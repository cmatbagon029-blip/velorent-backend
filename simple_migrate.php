<?php
// Standalone migration script
$host = 'localhost';
$db   = 'velorent';
$user = 'root';
$pass = '';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
];

try {
    $conn = new PDO($dsn, $user, $pass, $options);
    echo "Connected to database successfully.\n";

    // Drop unique index
    try {
        $conn->exec("ALTER TABLE conversations DROP INDEX unique_chat");
        echo "✅ Dropped unique index 'unique_chat'.\n";
    } catch (Exception $e) {
        echo "ℹ️ Index 'unique_chat' could not be dropped (maybe already gone).\n";
    }

    // Create standard index
    try {
        $conn->exec("CREATE INDEX idx_chat_triplet ON conversations(user_id, company_id, vehicle_id)");
        echo "✅ Created standard index 'idx_chat_triplet'.\n";
    } catch (Exception $e) {
        echo "ℹ️ Index 'idx_chat_triplet' already exists.\n";
    }

    echo "Migration complete!\n";

} catch (PDOException $e) {
    echo "Connection failed: " . $e->getMessage() . "\n";
}
