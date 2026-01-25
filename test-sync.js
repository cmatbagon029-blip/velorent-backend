const mysql = require('mysql2/promise');

async function testSync() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'velorent'
    });

    console.log('Testing sync mechanism...\n');

    // Get all approved reschedule requests
    const [approvedRequests] = await connection.execute(
      `SELECT r.*, 
              DATE_FORMAT(b.start_date, '%Y-%m-%d') as current_start_date, 
              DATE_FORMAT(b.end_date, '%Y-%m-%d') as current_end_date, 
              b.rent_time as current_rent_time,
              DATE_FORMAT(r.new_start_date, '%Y-%m-%d') as formatted_new_start,
              DATE_FORMAT(r.new_end_date, '%Y-%m-%d') as formatted_new_end
       FROM requests r
       JOIN bookings b ON r.booking_id = b.id
       WHERE r.request_type = 'reschedule' 
       AND r.status = 'approved' 
       AND r.new_start_date IS NOT NULL`
    );

    console.log(`Found ${approvedRequests.length} approved reschedule requests:\n`);

    approvedRequests.forEach((req, index) => {
      console.log(`Request ${index + 1} (ID: ${req.id}):`);
      console.log(`  Booking ID: ${req.booking_id}`);
      console.log(`  Current booking dates: ${req.current_start_date} to ${req.current_end_date}`);
      console.log(`  New requested dates: ${req.formatted_new_start} to ${req.formatted_new_end}`);
      console.log(`  Dates match: ${req.current_start_date === req.formatted_new_start && req.current_end_date === req.formatted_new_end}`);
      console.log('');
    });

    // Check if any need syncing
    const needsSync = approvedRequests.filter(req => 
      req.current_start_date !== req.formatted_new_start || 
      req.current_end_date !== req.formatted_new_end
    );

    if (needsSync.length > 0) {
      console.log(`\n⚠ ${needsSync.length} booking(s) need to be synced!`);
      console.log('Run the sync by calling GET /api/rentals/my-bookings (this will auto-sync)');
    } else {
      console.log('\n✓ All bookings are already synced!');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testSync();

