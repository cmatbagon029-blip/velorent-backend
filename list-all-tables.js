const mysql = require('mysql2/promise');

async function listAllTables() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'velorent'
    });

    const [tables] = await connection.execute('SHOW TABLES');
    console.log('\n=== ALL TABLES IN DATABASE ===\n');
    tables.forEach((table, index) => {
      const tableName = Object.values(table)[0];
      console.log(`${index + 1}. ${tableName}`);
    });
    console.log(`\nTotal: ${tables.length} tables\n`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

listAllTables();







