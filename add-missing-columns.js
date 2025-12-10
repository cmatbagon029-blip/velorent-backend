const mysql = require('mysql2/promise');

async function addMissingColumns() {
  let connection;
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'velorent'
    });

    console.log('Connected! Adding missing columns...\n');

    // Check and add columns to requests table
    const [requestColumns] = await connection.execute("SHOW COLUMNS FROM requests LIKE 'new_start_date'");
    if (requestColumns.length === 0) {
      await connection.execute("ALTER TABLE requests ADD COLUMN new_start_date DATE COMMENT 'For reschedule requests'");
      console.log('✓ Added new_start_date to requests table');
    } else {
      console.log('⚠ new_start_date already exists');
    }

    const [endDateColumns] = await connection.execute("SHOW COLUMNS FROM requests LIKE 'new_end_date'");
    if (endDateColumns.length === 0) {
      await connection.execute("ALTER TABLE requests ADD COLUMN new_end_date DATE COMMENT 'For reschedule requests'");
      console.log('✓ Added new_end_date to requests table');
    } else {
      console.log('⚠ new_end_date already exists');
    }

    const [timeColumns] = await connection.execute("SHOW COLUMNS FROM requests LIKE 'new_rent_time'");
    if (timeColumns.length === 0) {
      await connection.execute("ALTER TABLE requests ADD COLUMN new_rent_time TIME COMMENT 'For reschedule requests'");
      console.log('✓ Added new_rent_time to requests table');
    } else {
      console.log('⚠ new_rent_time already exists');
    }

    const [feeColumns] = await connection.execute("SHOW COLUMNS FROM requests LIKE 'computed_fee'");
    if (feeColumns.length === 0) {
      await connection.execute("ALTER TABLE requests ADD COLUMN computed_fee DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Computed fee based on company policies'");
      console.log('✓ Added computed_fee to requests table');
    } else {
      console.log('⚠ computed_fee already exists');
    }

    const [responseColumns] = await connection.execute("SHOW COLUMNS FROM requests LIKE 'company_response'");
    if (responseColumns.length === 0) {
      await connection.execute("ALTER TABLE requests ADD COLUMN company_response TEXT COMMENT 'Response from company'");
      console.log('✓ Added company_response to requests table');
    } else {
      console.log('⚠ company_response already exists');
    }

    // Check and add columns to notifications table
    const [typeColumns] = await connection.execute("SHOW COLUMNS FROM notifications LIKE 'type'");
    if (typeColumns.length === 0) {
      await connection.execute("ALTER TABLE notifications ADD COLUMN type ENUM('request_update', 'booking_update', 'general') DEFAULT 'general'");
      console.log('✓ Added type to notifications table');
    } else {
      console.log('⚠ type already exists');
    }

    const [relatedRequestColumns] = await connection.execute("SHOW COLUMNS FROM notifications LIKE 'related_request_id'");
    if (relatedRequestColumns.length === 0) {
      await connection.execute("ALTER TABLE notifications ADD COLUMN related_request_id INT COMMENT 'If notification is about a request'");
      console.log('✓ Added related_request_id to notifications table');
    } else {
      console.log('⚠ related_request_id already exists');
    }

    const [relatedBookingColumns] = await connection.execute("SHOW COLUMNS FROM notifications LIKE 'related_booking_id'");
    if (relatedBookingColumns.length === 0) {
      await connection.execute("ALTER TABLE notifications ADD COLUMN related_booking_id INT COMMENT 'If notification is about a booking'");
      console.log('✓ Added related_booking_id to notifications table');
    } else {
      console.log('⚠ related_booking_id already exists');
    }

    console.log('\n✅ All columns added successfully!');
    console.log('\nPlease restart your backend server and try submitting a request again.');

  } catch (error) {
    console.error('Error:', error.message);
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('(Column already exists - this is okay)');
    } else {
      process.exit(1);
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

addMissingColumns();

