const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_XrmSdx7tRIl4@ep-divine-fog-a16hsnhm-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
});

async function checkSchema() {
    try {
        const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'");
        console.log('Columns in users table:', res.rows);
    } catch (err) {
        console.error('Error checking schema:', err);
    } finally {
        await pool.end();
    }
}

checkSchema();
