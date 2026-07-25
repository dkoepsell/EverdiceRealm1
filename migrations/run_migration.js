const fs = require('fs');
const path = require('path');
const { pool } = require('../server/db');

async function runMigration() {
  const fileName = process.argv[2];
  if (!fileName) {
    console.error('Usage: node migrations/run_migration.js <file.sql>');
    process.exit(1);
  }

  console.log(`Running migration: ${fileName}`);

  try {
    const sqlPath = path.isAbsolute(fileName)
      ? fileName
      : path.join(__dirname, fileName);
    if (!fs.existsSync(sqlPath)) {
      console.error(`Migration file not found: ${sqlPath}`);
      process.exit(1);
    }
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Connect to the database
    const client = await pool.connect();
    
    try {
      // Execute the SQL script
      await client.query(sql);
      console.log('Migration completed successfully');
    } finally {
      // Release the client back to the pool
      client.release();
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});