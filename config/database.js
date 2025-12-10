const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',          
  database: 'velorent',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test the connection and create table if it doesn't exist
async function initializeDatabase() {
  let connection;
  try {
    console.log('Attempting to connect to MySQL database...');
    connection = await pool.getConnection();
    console.log('Successfully connected to MySQL database');

    // Check if database exists
    const [databases] = await connection.query('SHOW DATABASES LIKE ?', ['velorent']);
    if (databases.length === 0) {
      console.log('Creating velorent database...');
      await connection.query('CREATE DATABASE velorent');
      console.log('Database created successfully');
    }

    // Use the database
    await connection.query('USE velorent');
    console.log('Using velorent database');

    // Create users table if it doesn't exist
    console.log('Checking users table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('user', 'admin') DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Users table verified/created successfully');

  } catch (error) {
    console.error('Database initialization error:', error);
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('Access denied. Please check your MySQL username and password.');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('Connection refused. Please make sure MySQL server is running.');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('Database does not exist. Creating it now...');
      try {
        await connection.query('CREATE DATABASE velorent');
        console.log('Database created successfully');
      } catch (createError) {
        console.error('Failed to create database:', createError);
      }
    }
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// Initialize database on startup
initializeDatabase().catch(error => {
  console.error('Failed to initialize database:', error);
  process.exit(1); // Exit if database initialization fails
});

module.exports = pool;
