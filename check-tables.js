const mysql = require('mysql2/promise');

async function checkTables() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'velorent'
    });

    // Check requests table
    const [requestsTable] = await connection.execute("SHOW TABLES LIKE 'requests'");
    console.log('Requests table exists:', requestsTable.length > 0);
    
    if (requestsTable.length > 0) {
      const [cols] = await connection.execute('DESCRIBE requests');
      console.log('\nRequests table columns:');
      cols.forEach(col => {
        console.log(`  - ${col.Field} (${col.Type})`);
      });
    } else {
      console.log('\n❌ ERROR: requests table does not exist!');
      console.log('Please run: mysql -u root -p velorent < backend/config/booking-management-schema.sql');
    }

    // Check company_policies table
    const [policiesTable] = await connection.execute("SHOW TABLES LIKE 'company_policies'");
    console.log('\nCompany_policies table exists:', policiesTable.length > 0);
    
    if (policiesTable.length > 0) {
      const [cols] = await connection.execute('DESCRIBE company_policies');
      console.log('\nCompany_policies table columns:');
      cols.forEach(col => {
        console.log(`  - ${col.Field} (${col.Type})`);
      });
    } else {
      console.log('\n❌ ERROR: company_policies table does not exist!');
    }

    // Check notifications table
    const [notificationsTable] = await connection.execute("SHOW TABLES LIKE 'notifications'");
    console.log('\nNotifications table exists:', notificationsTable.length > 0);
    
    if (notificationsTable.length > 0) {
      const [cols] = await connection.execute('DESCRIBE notifications');
      console.log('\nNotifications table columns:');
      cols.forEach(col => {
        console.log(`  - ${col.Field} (${col.Type})`);
      });
    } else {
      console.log('\n❌ ERROR: notifications table does not exist!');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkTables();

