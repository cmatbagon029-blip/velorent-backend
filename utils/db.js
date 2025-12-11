const mysql = require('mysql2/promise');
const config = require('../config');

/**
 * Creates a database connection using environment variables or config defaults
 * @returns {Promise<mysql.Connection>} MySQL connection
 */
async function createConnection() {
  // Get connection parameters (prioritize environment variables)
  const dbConfig = {
    host: process.env.DB_HOST || config.DB_HOST || 'localhost',
    user: process.env.DB_USER || config.DB_USER || 'root',
    password: process.env.DB_PASS || process.env.DB_PASSWORD || config.DB_PASS || '',
    database: process.env.DB_NAME || config.DB_NAME || 'velorent',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    connectTimeout: 10000, // 10 seconds
    acquireTimeout: 10000,
    timeout: 10000
  };

  // Log connection attempt (without password)
  console.log('Attempting database connection:', {
    host: dbConfig.host,
    user: dbConfig.user,
    database: dbConfig.database,
    port: dbConfig.port,
    hasPassword: !!dbConfig.password
  });

  try {
    const connection = await mysql.createConnection(dbConfig);
    console.log('✅ Database connection established successfully');
    return connection;
  } catch (error) {
    console.error('❌ Database connection failed:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      host: dbConfig.host,
      database: dbConfig.database
    });
    throw error;
  }
}

module.exports = { createConnection };

