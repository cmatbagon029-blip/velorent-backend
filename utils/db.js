const mysql = require('mysql2/promise');
const config = require('../config');

/**
 * Creates a database connection using environment variables or config defaults
 * @returns {Promise<mysql.Connection>} MySQL connection
 */
async function createConnection() {
  return await mysql.createConnection({
    host: process.env.DB_HOST || config.DB_HOST || 'localhost',
    user: process.env.DB_USER || config.DB_USER || 'root',
    password: process.env.DB_PASS || process.env.DB_PASSWORD || config.DB_PASS || '',
    database: process.env.DB_NAME || config.DB_NAME || 'velorent',
    port: process.env.DB_PORT || 3306
  });
}

module.exports = { createConnection };

