const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  let connection;
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'velorent',
      multipleStatements: true
    });

    console.log('Connected! Starting migration...\n');

    // Read migration file
    const sqlFile = path.join(__dirname, 'config', 'migrate-database.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Split by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('USE'));

    for (const statement of statements) {
      if (statement.toLowerCase().includes('select')) {
        // For SELECT statements, show results
        try {
          const [results] = await connection.execute(statement);
          if (Array.isArray(results) && results.length > 0) {
            console.log('Result:', results[0]);
          }
        } catch (err) {
          // Ignore SELECT errors
        }
      } else {
        // For other statements, execute and catch errors
        try {
          await connection.execute(statement);
          console.log('✓ Executed:', statement.substring(0, 50) + '...');
        } catch (err) {
          // Check if error is about column/table already existing
          if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_DUP_KEYNAME') {
            console.log('⚠ Skipped (already exists):', statement.substring(0, 50) + '...');
          } else {
            console.error('✗ Error:', err.message);
            console.error('  Statement:', statement.substring(0, 100));
          }
        }
      }
    }

    console.log('\n✅ Migration completed!');
    console.log('\nPlease restart your backend server and try submitting a request again.');

  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigration();

