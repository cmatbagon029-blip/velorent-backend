// database.js
const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.DB_HOST,          // e.g. 'mysql-xxxx.render.com'
  user: process.env.DB_USER,          // your DB username
  password: process.env.DB_PASSWORD,  // your DB password
  database: process.env.DB_NAME,      // your DB name
  port: process.env.DB_PORT || 3306,  // MySQL default port
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

pool.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message);
  } else {
    console.log("✅ Connected to Render MySQL database");
    connection.release();
  }
});

module.exports = pool.promise();
