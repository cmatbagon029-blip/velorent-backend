// database.js
const mysql = require('mysql2/promise');

// Create MySQL connection pool using Railway environment variables
const pool = mysql.createPool({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test connection on startup
(async () => {
  try {
    console.log("Connecting to MySQL (Railway)…");
    const conn = await pool.getConnection();
    console.log("Connected to Railway MySQL successfully!");
    conn.release();
  } catch (err) {
    console.error("MySQL connection failed:", err);
  }
})();

module.exports = pool;
