const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_XrmSdx7tRIl4@ep-divine-fog-a16hsnhm-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
});

async function migrate() {
    try {
        console.log('Starting migration...');

        // Add password column to users if missing
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255)");
        console.log('Added password column to users (if missing)');

        // Ensure messages table exists and has correct columns
        await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
          id SERIAL PRIMARY KEY,
          sender VARCHAR(50) NOT NULL,
          recipient VARCHAR(50) NOT NULL,
          body TEXT NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        console.log('Ensured messages table exists');

        console.log('Migration completed successfully!');
    } catch (err) {
        console.error('Migration error:', err);
    } finally {
        await pool.end();
    }
}

migrate();
