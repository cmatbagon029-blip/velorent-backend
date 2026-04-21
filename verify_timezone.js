const { createConnection } = require('./utils/db');

async function verify() {
  let connection;
  try {
    connection = await createConnection();
    const [rows] = await connection.execute("SELECT NOW() as db_now, @@session.time_zone as session_tz");
    console.log('--- Timezone Verification ---');
    console.log('Node.js Local Time:', new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' }));
    console.log('Database Session Timezone:', rows[0].session_tz);
    console.log('Database Current Time:', rows[0].db_now);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (connection) await connection.end();
  }
}

verify();
