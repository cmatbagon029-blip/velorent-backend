const mysql = require('mysql2/promise');

async function checkBookingRequests() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'velorent'
    });

    // Check if booking_requests table exists
    const [tables] = await connection.execute("SHOW TABLES LIKE 'booking_requests'");
    
    if (tables.length === 0) {
      console.log('❌ booking_requests table does not exist');
      return;
    }

    console.log('✓ booking_requests table exists\n');

    // Get table structure
    const [columns] = await connection.execute('DESCRIBE booking_requests');
    console.log('Table structure:');
    columns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });

    // Check for foreign keys
    const [foreignKeys] = await connection.execute(`
      SELECT 
        CONSTRAINT_NAME,
        TABLE_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = 'velorent'
      AND (TABLE_NAME = 'booking_requests' OR REFERENCED_TABLE_NAME = 'booking_requests')
    `);

    console.log('\nForeign key relationships:');
    if (foreignKeys.length === 0) {
      console.log('  - No foreign keys found');
    } else {
      foreignKeys.forEach(fk => {
        if (fk.TABLE_NAME === 'booking_requests') {
          console.log(`  - booking_requests.${fk.COLUMN_NAME} → ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
        } else {
          console.log(`  - ${fk.TABLE_NAME}.${fk.COLUMN_NAME} → booking_requests.${fk.REFERENCED_COLUMN_NAME}`);
        }
      });
    }

    // Check row count
    const [count] = await connection.execute('SELECT COUNT(*) as count FROM booking_requests');
    console.log(`\nRow count: ${count[0].count}`);

    // Show sample data if any
    if (count[0].count > 0) {
      const [samples] = await connection.execute('SELECT * FROM booking_requests LIMIT 3');
      console.log('\nSample data (first 3 rows):');
      samples.forEach((row, idx) => {
        console.log(`  Row ${idx + 1}:`, JSON.stringify(row, null, 2));
      });
    }

    // Compare with requests table structure
    console.log('\n=== COMPARISON WITH requests TABLE ===');
    const [requestsColumns] = await connection.execute('DESCRIBE requests');
    console.log('\nrequests table structure:');
    requestsColumns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });

    const [requestsCount] = await connection.execute('SELECT COUNT(*) as count FROM requests');
    console.log(`\nrequests table row count: ${requestsCount[0].count}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkBookingRequests();






