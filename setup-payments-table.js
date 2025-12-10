/**
 * Setup script to create payments table
 * Run this with: node setup-payments-table.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function setupPaymentsTable() {
  let connection;
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'config', 'create-payments-table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Create database connection
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'velorent'
    });

    console.log('Connected to database');
    console.log('Creating payments table...');

    // Execute the SQL
    await connection.query(sql);

    console.log('✓ Payments table created successfully!');

    // Verify the table was created
    const [tables] = await connection.query("SHOW TABLES LIKE 'payments'");
    if (tables.length > 0) {
      console.log('✓ Payments table verified');
      
      // Show table structure
      const [columns] = await connection.query("DESCRIBE payments");
      console.log('\nTable structure:');
      console.table(columns);
    }

  } catch (error) {
    console.error('Error setting up payments table:', error.message);
    if (error.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log('⚠ Payments table already exists');
    } else {
      throw error;
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the setup
setupPaymentsTable()
  .then(() => {
    console.log('\nSetup completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Setup failed:', error);
    process.exit(1);
  });

