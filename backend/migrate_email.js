const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function migrate() {
    try {
        console.log('Starting Email/OTP migration...');

        // Add columns to users
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_code VARCHAR(10)");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expiry TIMESTAMP");

        // If username column exists, we can't easily map it to email without user input, 
        // but we can make the email column searchable.
        // In this specific case, for a clean sweep, let's ensure the email column exists and is NOT NULL if we were starting fresh.
        // However, for migration, we'll allow NULL email for legacy users but recommend they login via email now.

        console.log('Database migrated successfully!');
    } catch (err) {
        console.error('Migration error:', err);
    } finally {
        await pool.end();
    }
}

migrate();
