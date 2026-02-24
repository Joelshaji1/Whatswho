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

// Request Logger Middleware
app.use((req, res, next) => {
    console.log(`[HTTP] ${req.method} ${req.url} - ${new Date().toISOString()}`);
    next();
});

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

        // Send token with lowercased email for consistency
        const token = jwt.sign({ id: user.id, email: user.email.toLowerCase() }, process.env.JWT_SECRET || 'your_super_secret_key');
        res.json({ token, email: user.email.toLowerCase() });
    } catch (err) {
        console.error('Verify Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Helper to handle message saving and broadcasting
async function handleOutgoingMessage(data, socketSource = null) {
    const { sender, recipient, body } = data;

    if (!sender || !recipient || !body) {
        console.warn('[DB] Rejected: Missing fields', { sender, recipient, body });
        throw new Error('Missing message fields (sender, recipient, or body)');
    }

    const normSender = sender.toString().toLowerCase();
    const normRecipient = recipient.toString().toLowerCase();

    const result = await pool.query(
        'INSERT INTO messages (sender, recipient, body) VALUES ($1, $2, $3) RETURNING id, timestamp',
        [normSender, normRecipient, body]
    );

    const savedMsg = {
        ...data,
        id: result.rows[0].id,
        timestamp: result.rows[0].timestamp,
        sender: normSender,
        recipient: normRecipient,
        is_read: false,
        is_deleted_everyone: false,
        deleted_for: []
    };

    // Broadcast to recipient
    if (users[normRecipient]) {
        users[normRecipient].forEach(sid => {
            io.to(sid).emit('receive_message', savedMsg);
        });
    }

    // Sync with sender's other sockets (excluding the source if it came from a socket)
    if (users[normSender]) {
        users[normSender].forEach(sid => {
            if (sid !== socketSource) {
                io.to(sid).emit('receive_message', savedMsg);
            }
        });
    }

    return savedMsg;
}

app.get('/api/messages', authenticateToken, async (req, res) => {
    try {
        const normalizedEmail = req.user.email.toLowerCase();
        // Return messages that are NOT deleted for this specific user
        const result = await pool.query(
            'SELECT * FROM messages WHERE (LOWER(sender) = $1 OR LOWER(recipient) = $1) AND NOT ($2 = ANY(deleted_for)) ORDER BY timestamp ASC',
            [normalizedEmail, normalizedEmail]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/messages/read', authenticateToken, async (req, res) => {
    try {
        const { sender } = req.body; // The person whose messages are being read
        const myEmail = req.user.email.toLowerCase();
        const senderEmail = sender.toLowerCase();

        await pool.query(
            'UPDATE messages SET is_read = TRUE WHERE LOWER(sender) = $1 AND LOWER(recipient) = $2 AND is_read = FALSE',
            [senderEmail, myEmail]
        );

        // Notify the sender that their messages were read
        if (users[senderEmail]) {
            users[senderEmail].forEach(sid => {
                io.to(sid).emit('message_read', { reader: myEmail });
            });
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/messages/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { mode } = req.body; // 'me' or 'everyone'
        const myEmail = req.user.email.toLowerCase();

        const msgCheck = await pool.query('SELECT * FROM messages WHERE id = $1', [id]);
        if (msgCheck.rows.length === 0) return res.status(404).json({ error: 'Message not found' });

        const msg = msgCheck.rows[0];

        if (mode === 'everyone') {
            if (msg.sender.toLowerCase() !== myEmail) {
                return res.status(403).json({ error: 'Only the sender can delete for everyone' });
            }
            await pool.query('UPDATE messages SET is_deleted_everyone = TRUE, body = \'This message was deleted\' WHERE id = $1', [id]);

            // Broadcast to both parties
            [msg.sender.toLowerCase(), msg.recipient.toLowerCase()].forEach(email => {
                if (users[email]) {
                    users[email].forEach(sid => {
                        io.to(sid).emit('message_deleted', { id, mode: 'everyone' });
                    });
                }
            });
        } else {
            // Delete only for me
            await pool.query('UPDATE messages SET deleted_for = array_append(deleted_for, $1) WHERE id = $2', [myEmail, id]);
            res.json({ success: true, mode: 'me' });
            return;
        }

        res.json({ success: true, mode });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/users/info', authenticateToken, async (req, res) => {
    try {
        const { emails } = req.query; // Comma separated list
        if (!emails) return res.json([]);
        const emailList = emails.split(',').map(e => e.toLowerCase());

        const result = await pool.query(
            'SELECT email, nickname, profile_image FROM users WHERE email = ANY($1)',
            [emailList]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const { nickname, profile_image } = req.body;
        const myEmail = req.user.email.toLowerCase();

        await pool.query(
            'UPDATE users SET nickname = COALESCE($1, nickname), profile_image = COALESCE($2, profile_image) WHERE LOWER(email) = $3',
            [nickname, profile_image, myEmail]
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/messages', authenticateToken, async (req, res) => {
    try {
        const { sender } = req.body;
        if (!sender) {
            return res.status(400).json({ error: 'Sender field is required' });
        }

        const userEmail = req.user.email.toLowerCase();
        const senderEmail = sender.toLowerCase();

        // Ensure sender matches the token for security
        if (senderEmail !== userEmail) {
            console.warn(`[API] Sender mismatch: ${senderEmail} vs ${userEmail}`);
            return res.status(403).json({ error: `Sender mismatch: ${senderEmail} vs ${userEmail}` });
        }

        const savedMsg = await handleOutgoingMessage(req.body);
        res.json(savedMsg);
    } catch (err) {
        console.error('[API] Message send error:', err.message);
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
            console.log(`[Socket] Received message from ${socket.id}`);
            await handleOutgoingMessage(data, socket.id);
        } catch (err) {
            console.error('[Socket] send_message error:', err);
        }
    });

    // Call Signaling
    socket.on('call_init', (data) => {
        const { to, from, isVideo } = data;
        console.log(`[Socket] Call Init from ${from} to ${to} (Video: ${isVideo})`);
        const targetEmail = to.toLowerCase();
        if (users[targetEmail]) {
            users[targetEmail].forEach(sid => {
                io.to(sid).emit('incoming_call', { from, isVideo });
            });
        }
    });

    socket.on('call_ans', (data) => {
        const { to, from, accepted } = data;
        console.log(`[Socket] Call Ans from ${from} to ${to}: ${accepted}`);
        const targetEmail = to.toLowerCase();
        if (users[targetEmail]) {
            users[targetEmail].forEach(sid => {
                io.to(sid).emit('call_response', { from, accepted });
            });
        }
    });

    socket.on('call_end', (data) => {
        const { to, from } = data;
        console.log(`[Socket] Call End from ${from} to ${to}`);
        const targetEmail = to.toLowerCase();
        if (users[targetEmail]) {
            users[targetEmail].forEach(sid => {
                io.to(sid).emit('call_completed', { from });
            });
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
