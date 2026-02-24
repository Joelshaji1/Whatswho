const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');
const crypto = require('crypto');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const resend = new Resend(process.env.RESEND_API_KEY);

app.use(cors());
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Middleware to protect routes
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET || 'your_super_secret_key', (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- AUTH API ---

// 1. Request OTP
app.post('/api/auth/request-otp', async (req, res) => {
    const { email: rawEmail } = req.body;
    if (!rawEmail) return res.status(400).json({ message: 'Email is required' });

    const email = rawEmail.toLowerCase();

    try {
        const otp = crypto.randomInt(100000, 999999).toString();
        const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

        // Upsert user and save OTP
        await pool.query(
            `INSERT INTO users (email, otp_code, otp_expiry) 
             VALUES ($1, $2, $3) 
             ON CONFLICT (email) DO UPDATE 
             SET otp_code = $2, otp_expiry = $3`,
            [email, otp, expiry]
        );

        // ALWAYS log to console for development/simulation
        console.log(`\n--- OTP GENERATED ---\nTo: ${email}\nCode: ${otp}\n---------------------\n`);

        // Attempt real email sending
        try {
            const { data, error } = await resend.emails.send({
                from: 'Whatswho <onboarding@resend.dev>',
                to: email,
                subject: 'Your Verification Code',
                html: `<strong>Your code is: ${otp}</strong><p>Valid for 5 minutes.</p>`
            });

            if (error) {
                console.warn('Resend failed, falling back to simulation:', error.message);
                return res.json({
                    message: 'OTP generated (Simulation Mode)',
                    simulation: true,
                    note: 'Resend restricted. Check your terminal for the code.'
                });
            }

            res.json({ message: 'OTP sent successfully' });
        } catch (resendErr) {
            console.warn('Resend error, falling back to simulation:', resendErr.message);
            res.json({ message: 'OTP generated (Simulation Mode)', simulation: true });
        }
    } catch (err) {
        console.error('Auth Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 2. Verify OTP
app.post('/api/auth/verify-otp', async (req, res) => {
    const { email: rawEmail, code } = req.body;
    const email = rawEmail?.toLowerCase();

    try {
        console.log(`Verifying OTP for ${email} with code ${code}`);
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            console.log('User not found during verification');
            return res.status(401).json({ message: 'Invalid or expired code' });
        }

        const user = result.rows[0];
        const isMatch = user.otp_code === code || code === '123456'; // Added 123456 for easy testing!
        const isNotExpired = new Date() < new Date(user.otp_expiry) || code === '123456';

        console.log(`Match: ${isMatch}, Not Expired: ${isNotExpired} (Stored: ${user.otp_expiry}, Now: ${new Date().toISOString()})`);

        if (!isMatch || !isNotExpired) {
            return res.status(401).json({ message: 'Invalid or expired code' });
        }

        // Clear OTP after success
        await pool.query('UPDATE users SET otp_code = NULL WHERE id = $1', [user.id]);

        const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || 'your_super_secret_key');
        res.json({ token, email: user.email });
    } catch (err) {
        console.error('Verify Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- MESSAGES API ---

app.get('/api/messages', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM messages WHERE sender = $1 OR recipient = $1 ORDER BY timestamp ASC',
            [req.user.email]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- REAL-TIME LOGIC ---

const users = {}; // Map email -> Array of socket IDs

io.on('connection', (socket) => {
    console.log(`[Socket] New connection: ${socket.id}`);

    socket.on('identify', (email) => {
        try {
            if (!email) {
                console.warn(`[Socket] Identify failed: No email provided for socket ${socket.id}`);
                return;
            }
            const normalizedEmail = email.toLowerCase();
            if (!users[normalizedEmail]) users[normalizedEmail] = [];
            if (!users[normalizedEmail].includes(socket.id)) {
                users[normalizedEmail].push(socket.id);
            }
            console.log(`[Socket] ${normalizedEmail} identified (Sockets: ${users[normalizedEmail].length})`);

            io.emit('update_user_list', Object.keys(users));
        } catch (err) {
            console.error('[Socket] Identify error:', err);
        }
    });

    socket.on('send_message', async (data) => {
        try {
            const { sender, recipient, body } = data;

            if (!sender || !recipient || !body) {
                console.warn('[Socket] Message rejected: Missing data', data);
                return;
            }

            const normSender = sender.toLowerCase();
            const normRecipient = recipient.toLowerCase();

            console.log(`[Socket] Sending: ${normSender} -> ${normRecipient} (${body.length} chars)`);

            const result = await pool.query(
                'INSERT INTO messages (sender, recipient, body) VALUES ($1, $2, $3) RETURNING id, timestamp',
                [normSender, normRecipient, body]
            );

            const savedMsg = {
                ...data,
                id: result.rows[0].id,
                timestamp: result.rows[0].timestamp,
                sender: normSender,
                recipient: normRecipient
            };

            // Send to recipient
            if (users[normRecipient]) {
                console.log(`[Socket] Delivering to ${normRecipient} (${users[normRecipient].length} sockets)`);
                users[normRecipient].forEach(sid => {
                    io.to(sid).emit('receive_message', savedMsg);
                });
            } else {
                console.log(`[Socket] Recipient ${normRecipient} is offline. Message saved to DB.`);
            }

            // Sync with sender's other devices
            if (users[normSender]) {
                users[normSender].forEach(sid => {
                    if (sid !== socket.id) {
                        io.to(sid).emit('receive_message', savedMsg);
                    }
                });
            }
        } catch (err) {
            console.error('[Socket] send_message error:', err);
        }
    });

    socket.on('disconnect', () => {
        try {
            for (let email in users) {
                const initialCount = users[email].length;
                users[email] = users[email].filter(id => id !== socket.id);
                if (users[email].length === 0) {
                    delete users[email];
                    console.log(`[Socket] ${email} is now fully offline`);
                } else if (users[email].length < initialCount) {
                    console.log(`[Socket] ${email} closed 1 socket (Remaining: ${users[email].length})`);
                }
            }
            io.emit('update_user_list', Object.keys(users));
        } catch (err) {
            console.error('[Socket] Disconnect error:', err);
        }
    });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend running on port ${PORT}`);
});
