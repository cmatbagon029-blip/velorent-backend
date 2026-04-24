const mysql = require('mysql2/promise');
const config = require('./config.js');

async function check() {
  const conn = await mysql.createConnection({ 
    host: '127.0.0.1', 
    user: config.DB_USER, 
    password: config.DB_PASS,
    database: config.DB_NAME 
  });
  
  const [cols] = await conn.execute('SHOW CREATE TABLE notifications');
  console.log('notifications:\\n', cols[0]['Create Table']);
  
  const [cols2] = await conn.execute('SHOW CREATE TABLE bookings');
  console.log('bookings:\\n', cols2[0]['Create Table']);
  
  conn.end();
}
check().catch(console.error);
