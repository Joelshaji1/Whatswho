const { Pool } = require('pg');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_XrmSdx7tRIl4@ep-divine-fog-a16hsnhm-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
});

const schema = fs.readFileSync('schema.sql', 'utf8');

async function applySchema() {
    try {
        console.log('Applying schema...');
        await pool.query(schema);
        console.log('Schema applied successfully!');
    } catch (err) {
        console.error('Error applying schema:', err);
    } finally {
        await pool.end();
    }
}

applySchema();
