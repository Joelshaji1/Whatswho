const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function debug() {
    try {
        console.log('--- USERS ---');
        const users = await pool.query('SELECT id, email FROM users');
        console.table(users.rows);

        console.log('\n--- RECENT MESSAGES ---');
        const msgs = await pool.query('SELECT * FROM messages ORDER BY timestamp DESC LIMIT 10');
        console.table(msgs.rows);

        console.log('\n--- TABLE CHECK ---');
        const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log(tables.rows.map(t => t.table_name));

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

debug();
