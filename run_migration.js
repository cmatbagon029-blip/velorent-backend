const { createConnection } = require('./utils/db');

async function migrate() {
  let connection;
  try {
    console.log('Starting migration...');
    connection = await createConnection();

    // Check if unique_chat index exists
    const [indexes] = await connection.execute(
      "SHOW INDEX FROM conversations WHERE Key_name = 'unique_chat'"
    );

    if (indexes.length > 0) {
      await connection.execute("ALTER TABLE conversations DROP INDEX unique_chat");
      console.log('✅ Dropped unique index "unique_chat"');
    } else {
      console.log('ℹ️ Unique index "unique_chat" not found, skipping drop');
    }

    // Check if idx_chat_triplet index exists
    const [newIndexes] = await connection.execute(
      "SHOW INDEX FROM conversations WHERE Key_name = 'idx_chat_triplet'"
    );

    if (newIndexes.length === 0) {
      await connection.execute(
        "CREATE INDEX idx_chat_triplet ON conversations(user_id, company_id, vehicle_id)"
      );
      console.log('✅ Created standard index "idx_chat_triplet"');
    } else {
      console.log('ℹ️ Standard index "idx_chat_triplet" already exists');
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    if (connection) await connection.end();
  }
}

migrate();
