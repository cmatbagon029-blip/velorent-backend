const { createConnection } = require('./utils/db');

async function migrate() {
  let connection;
  try {
    connection = await createConnection();
    
    const queries = [
      "ALTER TABLE conversations ADD COLUMN deleted_by_user TINYINT(1) DEFAULT 0",
      "ALTER TABLE conversations ADD COLUMN deleted_by_company TINYINT(1) DEFAULT 0",
      "ALTER TABLE messages ADD COLUMN deleted_by_user TINYINT(1) DEFAULT 0",
      "ALTER TABLE messages ADD COLUMN deleted_by_company TINYINT(1) DEFAULT 0"
    ];

    for (const sql of queries) {
      try {
        await connection.execute(sql);
        console.log(`Executed: ${sql}`);
      } catch (e) {
        console.log(`Skipped: ${sql} (Reason: ${e.message})`);
      }
    }
    
    console.log("Migration complete.");
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    if (connection) await connection.end();
  }
}

migrate();
