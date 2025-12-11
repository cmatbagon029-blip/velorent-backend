const mysql = require('mysql2/promise');

async function checkActivityLogs() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'velorent'
    });

    // Check if activity_logs table exists
    const [tables] = await connection.execute("SHOW TABLES LIKE 'activity_logs'");
    
    if (tables.length === 0) {
      console.log('❌ activity_logs table does not exist');
      return;
    }

    console.log('✓ activity_logs table exists\n');

    // Get table structure
    const [columns] = await connection.execute('DESCRIBE activity_logs');
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
      AND (TABLE_NAME = 'activity_logs' OR REFERENCED_TABLE_NAME = 'activity_logs')
    `);

    console.log('\nForeign key relationships:');
    if (foreignKeys.length === 0) {
      console.log('  - No foreign keys found');
    } else {
      foreignKeys.forEach(fk => {
        if (fk.TABLE_NAME === 'activity_logs') {
          console.log(`  - activity_logs.${fk.COLUMN_NAME} → ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
        } else {
          console.log(`  - ${fk.TABLE_NAME}.${fk.COLUMN_NAME} → activity_logs.${fk.REFERENCED_COLUMN_NAME}`);
        }
      });
    }

    // Check row count
    const [count] = await connection.execute('SELECT COUNT(*) as count FROM activity_logs');
    console.log(`\nRow count: ${count[0].count}`);

    // Check if there are any triggers
    const [triggers] = await connection.execute(`
      SELECT TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE, ACTION_STATEMENT
      FROM INFORMATION_SCHEMA.TRIGGERS
      WHERE TRIGGER_SCHEMA = 'velorent'
      AND (EVENT_OBJECT_TABLE = 'activity_logs' OR ACTION_STATEMENT LIKE '%activity_logs%')
    `);

    console.log('\nTriggers:');
    if (triggers.length === 0) {
      console.log('  - No triggers found');
    } else {
      triggers.forEach(trigger => {
        console.log(`  - ${trigger.TRIGGER_NAME} on ${trigger.EVENT_OBJECT_TABLE}`);
      });
    }

    // Check for any stored procedures that might use it
    const [procedures] = await connection.execute(`
      SELECT ROUTINE_NAME, ROUTINE_DEFINITION
      FROM INFORMATION_SCHEMA.ROUTINES
      WHERE ROUTINE_SCHEMA = 'velorent'
      AND ROUTINE_DEFINITION LIKE '%activity_logs%'
    `);

    console.log('\nStored procedures:');
    if (procedures.length === 0) {
      console.log('  - No stored procedures found');
    } else {
      procedures.forEach(proc => {
        console.log(`  - ${proc.ROUTINE_NAME}`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkActivityLogs();







