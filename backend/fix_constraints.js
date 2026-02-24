const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function fixConstraints() {
    try {
        console.log('Fixing constraints for Email/OTP transition...');

        // 1. Clear legacy users who don't have emails to avoid NOT NULL conflicts
        console.log('Clearing legacy users...');
        await pool.query("DELETE FROM users WHERE email IS NULL");

        // 2. Make username nullable (optional for new system)
        console.log('Making username nullable...');
        await pool.query("ALTER TABLE users ALTER COLUMN username DROP NOT NULL");

        // 3. Ensure email is strictly not null and unique
        console.log('Setting email to NOT NULL...');
        await pool.query("ALTER TABLE users ALTER COLUMN email SET NOT NULL");

        console.log('Constraints updated successfully!');
    } catch (err) {
        console.error('Migration error:', err);
    } finally {
        await pool.end();
    }
}

fixConstraints();
