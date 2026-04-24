const mysql = require('mysql2/promise');
async function check() {
  const conn = await mysql.createConnection({ host: '127.0.0.1', user: 'root', database: 'velorent' });
  const [cols] = await conn.execute('DESCRIBE notifications');
  console.log('notifications columns:', cols.map(c => c.Field));
  
  const [cols2] = await conn.execute('DESCRIBE bookings');
  console.log('bookings columns:', cols2.map(c => c.Field));
  
  conn.end();
}
check().catch(console.error);
