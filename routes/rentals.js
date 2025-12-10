const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const auth = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const { uploadImageToS3 } = require('../utils/s3Upload');

// Test endpoint to check database connection and table structure
router.get('/test-db', async function(req, res) {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'velorent'
    });

    // Check if bookings table exists and show its structure
    const [tables] = await connection.execute("SHOW TABLES LIKE 'bookings'");
    if (tables.length === 0) {
      return res.status(500).json({ error: 'Bookings table does not exist' });
    }

    const [columns] = await connection.execute("DESCRIBE bookings");
    res.json({ 
      message: 'Database connection successful',
      bookingsTableExists: true,
      columns: columns
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({ 
      error: 'Database connection failed',
      details: error.message 
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Get user's rentals
router.get('/my-rentals', auth.verifyToken, async function(req, res) {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'velorent'
    });

    const [rentals] = await connection.execute(
      `SELECT r.*, v.name as vehicle_name, v.imageUrl as vehicle_image, c.name as company_name 
       FROM rentals r 
       LEFT JOIN vehicles v ON r.vehicleId = v.id 
       LEFT JOIN rental_companies c ON r.companyId = c.id 
       WHERE r.userId = ? 
       ORDER BY r.createdAt DESC`,
      [req.user.userId]
    );

    res.json(rentals);
  } catch (error) {
    console.error('Error fetching rentals:', error);
    res.status(500).json({ 
      error: 'Failed to fetch rentals',
      details: error.message 
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Get rental by ID
router.get('/my-rentals/:id', auth.verifyToken, async function(req, res) {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'velorent'
    });

    const [rentals] = await connection.execute(
      `SELECT r.*, v.name as vehicle_name, v.image_path as vehicle_image, c.name as company_name 
       FROM rentals r 
       LEFT JOIN vehicles v ON r.vehicleId = v.id 
       LEFT JOIN rental_companies c ON r.companyId = c.id 
       WHERE r.id = ? AND r.userId = ?`,
      [req.params.id, req.user.id]
    );

    if (rentals.length === 0) {
      return res.status(404).json({ error: 'Rental not found' });
    }

    res.json(rentals[0]);
  } catch (error) {
    console.error('Error fetching rental:', error);
    res.status(500).json({ 
      error: 'Failed to fetch rental',
      details: error.message 
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Create new rental and booking with file uploads
router.post('/', auth.verifyToken, upload.fields([
  { name: 'validId', maxCount: 1 },
  { name: 'additionalId', maxCount: 1 }
]), async function(req, res) {
  console.log('=== BOOKING REQUEST DEBUG ===');
  console.log('User:', req.user);
  console.log('Body:', req.body);
  console.log('Files:', req.files);
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'velorent'
    });

    // Get fields from req.body (multer parses them as strings)
    const {
      fullName, mobileNumber, serviceType, rentFromDate, rentToDate, rentTime, destination, occasion, message, vehicleId, vehicleName,
      totalCost, downPayment, remainingAmount, paymentMethod, driverId, driverName, driverPhone, driverExperience
    } = req.body;

    console.log('=== BOOKING SUBMISSION DEBUG ===');
    console.log('Service Type:', serviceType);
    console.log('Driver ID:', driverId);
    console.log('Driver Name:', driverName);
    console.log('Driver Phone:', driverPhone);
    console.log('Driver Experience:', driverExperience);

    // Validate required fields
    if (!fullName || !mobileNumber || !serviceType || !rentFromDate || !rentToDate || !rentTime || !destination) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Driver information is optional - no longer required for Pick-up/Drop-off service

    // Check for existing pending or active bookings for this user (not approved ones)
    const [existingActiveBookings] = await connection.execute(
      `SELECT id FROM bookings WHERE user_id = ? AND (status = 'Pending' OR status = 'Active') LIMIT 1`,
      [req.user.userId]
    );
    if (existingActiveBookings.length > 0) {
      return res.status(400).json({ error: 'You already have a pending or ongoing booking. Please complete or cancel it before making a new booking.' });
    }

    // Check total rental limit (3 rentals maximum per user)
    const [totalBookings] = await connection.execute(
      `SELECT COUNT(*) as total FROM bookings WHERE user_id = ?`,
      [req.user.userId]
    );
    const totalRentals = totalBookings[0].total;
    console.log('Total rentals for user:', totalRentals);
    
    if (totalRentals >= 3) {
      return res.status(400).json({ 
        error: 'You have reached the maximum limit of 3 rentals. Please contact support if you need to make additional bookings.' 
      });
    }

    // Upload files to S3 and get URLs
    let validIdPath = null;
    let additionalIdPath = null;

    if (req.files['validId'] && req.files['validId'][0]) {
      const uploadResult = await uploadImageToS3(req.files['validId'][0], 'bookings/valid-ids');
      if (uploadResult.success) {
        validIdPath = uploadResult.url; // Store S3 URL instead of local path
        console.log('Valid ID uploaded to S3:', uploadResult.url);
      } else {
        console.error('Failed to upload valid ID to S3:', uploadResult.message);
        return res.status(500).json({ error: `Failed to upload valid ID: ${uploadResult.message}` });
      }
    }

    if (req.files['additionalId'] && req.files['additionalId'][0]) {
      const uploadResult = await uploadImageToS3(req.files['additionalId'][0], 'bookings/additional-ids');
      if (uploadResult.success) {
        additionalIdPath = uploadResult.url; // Store S3 URL instead of local path
        console.log('Additional ID uploaded to S3:', uploadResult.url);
      } else {
        console.error('Failed to upload additional ID to S3:', uploadResult.message);
        return res.status(500).json({ error: `Failed to upload additional ID: ${uploadResult.message}` });
      }
    }

    // Get vehicle name and company_id if not provided
    let vehicle_name = vehicleName;
    let company_id = null;
    let company_name = null;
    if (vehicleId) {
      const [vehicles] = await connection.execute('SELECT name, company_id FROM vehicles WHERE id = ?', [vehicleId]);
      if (vehicles.length > 0) {
        vehicle_name = vehicle_name || vehicles[0].name;
        company_id = vehicles[0].company_id;
        if (company_id) {
          const [companies] = await connection.execute('SELECT company_name FROM companies WHERE id = ?', [company_id]);
          if (companies.length > 0) {
            company_name = companies[0].company_name;
          }
        }
      }
    }

    // Insert into bookings table (now with user_id, start_date, end_date, company_id, company_name, payment info, and driver info)
    const [result] = await connection.execute(
      `INSERT INTO bookings (
        user_id, user_name, mobile_number, vehicle_id, company_id, company_name, vehicle_name, service_type, start_date, end_date, rent_time, destination, occasion, message, valid_id_path, additional_id_path, booking_date, status, driver_id, driver_name, driver_phone, driver_experience
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        req.user.userId,
        fullName,
        mobileNumber,
        vehicleId,
        company_id,
        company_name,
        vehicle_name || '',
        serviceType,
        rentFromDate,
        rentToDate,
        rentTime,
        destination,
        occasion || null,
        message || null,
        validIdPath,
        additionalIdPath,
        new Date(),
        'Pending',
        driverId || null,
        driverName || null,
        driverPhone || null,
        driverExperience || null
      ]
    );

    const bookingId = result.insertId;

    console.log('=== BOOKING CREATED SUCCESSFULLY ===');
    console.log('Booking ID (insertId):', bookingId);
    console.log('Result object:', JSON.stringify(result, null, 2));

    const response = { 
      message: 'Booking created',
      booking_id: bookingId,
      id: bookingId
    };

    console.log('Sending response:', JSON.stringify(response, null, 2));

    res.status(201).json(response);
  } catch (error) {
    console.error('=== BOOKING ERROR DEBUG ===');
    console.error('Error creating booking:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to create booking',
      details: error.message,
      stack: error.stack
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Delete a cancelled booking (placed early to avoid route conflicts)
router.delete('/bookings/:id', auth.verifyToken, async function(req, res) {
  let connection;
  try {
    console.log('=== DELETE BOOKING REQUEST ===');
    console.log('Booking ID:', req.params.id);
    console.log('User ID:', req.user?.userId);
    console.log('User object:', req.user);
    
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'velorent'
    });

    // Get the booking to verify it belongs to the user and is cancelled
    const [bookings] = await connection.execute(
      'SELECT * FROM bookings WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.userId]
    );

    console.log('Found bookings:', bookings.length);
    if (bookings.length > 0) {
      console.log('Booking status:', bookings[0].status);
    }

    if (bookings.length === 0) {
      return res.status(404).json({ error: 'Booking not found or does not belong to you' });
    }

    const booking = bookings[0];

    // Only allow deletion of cancelled bookings
    if (booking.status !== 'Cancelled') {
      return res.status(400).json({ 
        error: 'Only cancelled bookings can be deleted',
        currentStatus: booking.status
      });
    }

    // Delete the booking
    const [result] = await connection.execute(
      'DELETE FROM bookings WHERE id = ?',
      [req.params.id]
    );

    console.log('Delete result:', result.affectedRows, 'rows affected');

    res.json({ message: 'Booking deleted successfully' });
  } catch (error) {
    console.error('Error deleting booking:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to delete booking',
      details: error.message 
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Cancel rental
router.post('/:id/cancel', auth.verifyToken, async function(req, res) {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'velorent'
    });

    const [result] = await connection.execute(
      `UPDATE rentals 
       SET status = 'cancelled' 
       WHERE id = ? AND userId = ? AND status = 'pending'`,
      [req.params.id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Rental not found or cannot be cancelled' });
    }

    res.json({ message: 'Rental cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling rental:', error);
    res.status(500).json({ 
      error: 'Failed to cancel rental',
      details: error.message 
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Delete multiple cancelled bookings
router.post('/bookings/delete-multiple', auth.verifyToken, async function(req, res) {
  let connection;
  try {
    const { bookingIds } = req.body;

    if (!bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
      return res.status(400).json({ error: 'bookingIds array is required' });
    }

    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'velorent'
    });

    // Verify all bookings belong to the user and are cancelled
    const placeholders = bookingIds.map(() => '?').join(',');
    const [bookings] = await connection.execute(
      `SELECT id, status FROM bookings 
       WHERE id IN (${placeholders}) AND user_id = ?`,
      [...bookingIds, req.user.userId]
    );

    if (bookings.length === 0) {
      return res.status(404).json({ error: 'No valid bookings found' });
    }

    // Check for non-cancelled bookings
    const nonCancelled = bookings.filter(b => b.status !== 'Cancelled');
    if (nonCancelled.length > 0) {
      return res.status(400).json({ 
        error: 'Only cancelled bookings can be deleted',
        invalidIds: nonCancelled.map(b => ({ id: b.id, status: b.status }))
      });
    }

    // Delete the bookings
    const validIds = bookings.map(b => b.id);
    const deletePlaceholders = validIds.map(() => '?').join(',');
    await connection.execute(
      `DELETE FROM bookings WHERE id IN (${deletePlaceholders})`,
      validIds
    );

    res.json({ 
      message: `${validIds.length} booking(s) deleted successfully`,
      deletedCount: validIds.length
    });
  } catch (error) {
    console.error('Error deleting bookings:', error);
    res.status(500).json({ 
      error: 'Failed to delete bookings',
      details: error.message 
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Add booking to bookings table
router.post('/bookings', async function(req, res) {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'velorent'
    });

    const {
      user_name,
      mobile_number,
      vehicle_name,
      service_type,
      rent_date,
      rent_time,
      destination,
      occasion,
      message,
      valid_id_path,
      additional_id_path,
      booking_date,
      status
    } = req.body;

    if (!user_name || !mobile_number || !vehicle_name || !service_type || !rent_date || !rent_time || !destination || !status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await connection.execute(
      `INSERT INTO bookings (
        user_name, mobile_number, vehicle_name, service_type, rent_date, rent_time, destination, occasion, message, valid_id_path, additional_id_path, booking_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        user_name,
        mobile_number,
        vehicle_name,
        service_type,
        rent_date,
        rent_time,
        destination,
        occasion || null,
        message || null,
        valid_id_path || null,
        additional_id_path || null,
        booking_date || new Date(),
        status
      ]
    );
    res.status(201).json({ message: 'Booking created' });
  } catch (err) {
    console.error('Error creating booking:', err);
    res.status(500).json({ error: 'Failed to create booking' });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Get all bookings for the current user (by user_id)
router.get('/my-bookings', auth.verifyToken, async function(req, res) {
  let connection;
  try {
    console.log('=== MY-BOOKINGS DEBUG ===');
    console.log('User ID from token:', req.user.userId);
    console.log('User object:', req.user);
    
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'velorent'
    });

    // First check if bookings table exists
    const [tables] = await connection.execute("SHOW TABLES LIKE 'bookings'");
    console.log('Bookings table exists:', tables.length > 0);
    
    if (tables.length === 0) {
      return res.status(500).json({ 
        error: 'Bookings table does not exist',
        details: 'The bookings table has not been created in the database'
      });
    }

    // Check table structure
    const [columns] = await connection.execute("DESCRIBE bookings");
    console.log('Bookings table columns:', columns);

    // First, sync any approved reschedule requests with bookings
    // This ensures booking dates are updated even if approval happened outside the API
    // Get the most recent approved reschedule for each booking
    const [approvedReschedules] = await connection.execute(
      `SELECT r.id as request_id,
              r.booking_id,
              r.new_start_date,
              r.new_end_date,
              r.new_rent_time,
              DATE_FORMAT(b.start_date, '%Y-%m-%d') as current_start_date, 
              DATE_FORMAT(b.end_date, '%Y-%m-%d') as current_end_date, 
              b.rent_time as current_rent_time,
              DATE_FORMAT(r.new_start_date, '%Y-%m-%d') as formatted_new_start,
              DATE_FORMAT(r.new_end_date, '%Y-%m-%d') as formatted_new_end
       FROM requests r
       JOIN bookings b ON r.booking_id = b.id
       WHERE r.user_id = ? 
       AND r.request_type = 'reschedule' 
       AND r.status = 'approved' 
       AND r.new_start_date IS NOT NULL
       AND b.user_id = ?
       AND r.id = (
         SELECT MAX(r2.id) 
         FROM requests r2 
         WHERE r2.booking_id = r.booking_id 
         AND r2.request_type = 'reschedule' 
         AND r2.status = 'approved'
       )`,
      [req.user.userId, req.user.userId]
    );

    console.log(`Found ${approvedReschedules.length} approved reschedule requests to sync`);

    // Update bookings with approved reschedule dates
    for (const reschedule of approvedReschedules) {
      // Use formatted dates for comparison (already formatted by DATE_FORMAT in SQL)
      const currentStart = reschedule.current_start_date ? String(reschedule.current_start_date).trim() : null;
      const newStart = reschedule.formatted_new_start ? String(reschedule.formatted_new_start).trim() : null;
      const currentEnd = reschedule.current_end_date ? String(reschedule.current_end_date).trim() : null;
      const newEnd = reschedule.formatted_new_end ? String(reschedule.formatted_new_end).trim() : null;
      
      // Check if dates need updating
      const datesDiffer = currentStart !== newStart || currentEnd !== newEnd;
      const timeDiffers = reschedule.new_rent_time && reschedule.current_rent_time !== reschedule.new_rent_time;
      
      console.log(`Checking booking ${reschedule.booking_id}:`);
      console.log(`  Current dates: "${currentStart}" to "${currentEnd}"`);
      console.log(`  New dates: "${newStart}" to "${newEnd}"`);
      console.log(`  Dates differ: ${datesDiffer}`);
      
      if (datesDiffer || timeDiffers) {
        console.log(`Syncing booking ${reschedule.booking_id}:`);
        console.log(`  Updating from ${currentStart} to ${newStart}`);
        console.log(`  Updating from ${currentEnd} to ${newEnd}`);
        
        // Use the raw date values from the request - ensure they're in correct format
        // MySQL expects DATE format (YYYY-MM-DD) and TIME format (HH:MM:SS)
        const updateResult = await connection.execute(
          'UPDATE bookings SET start_date = DATE(?), end_date = DATE(?), rent_time = COALESCE(?, rent_time) WHERE id = ?',
          [
            reschedule.new_start_date,
            reschedule.new_end_date,
            reschedule.new_rent_time || null,
            reschedule.booking_id
          ]
        );
        
        console.log(`✓ Updated booking ${reschedule.booking_id} with new dates`);
        console.log(`  Rows affected: ${updateResult[0].affectedRows}`);
        
        if (updateResult[0].affectedRows === 0) {
          console.error(`  WARNING: No rows were updated! Check if booking ${reschedule.booking_id} exists.`);
        }
        
        // Verify the update immediately
        const [verify] = await connection.execute(
          'SELECT DATE_FORMAT(start_date, "%Y-%m-%d") as start_date, DATE_FORMAT(end_date, "%Y-%m-%d") as end_date, rent_time FROM bookings WHERE id = ?',
          [reschedule.booking_id]
        );
        if (verify.length > 0) {
          console.log(`  Verified: Booking now has dates ${verify[0].start_date} to ${verify[0].end_date}`);
          if (verify[0].start_date !== newStart || verify[0].end_date !== newEnd) {
            console.error(`  ERROR: Update verification failed! Expected ${newStart} to ${newEnd}, got ${verify[0].start_date} to ${verify[0].end_date}`);
          }
        }
      } else {
        console.log(`Booking ${reschedule.booking_id} already synced (dates match)`);
      }
    }

    // Sync approved cancellations
    const [approvedCancellations] = await connection.execute(
      `SELECT * FROM requests 
       WHERE user_id = ? 
       AND request_type = 'cancellation' 
       AND status = 'approved' 
       AND booking_id IN (SELECT id FROM bookings WHERE user_id = ? AND status != 'Cancelled')`,
      [req.user.userId, req.user.userId]
    );

    for (const cancellation of approvedCancellations) {
      await connection.execute(
        'UPDATE bookings SET status = "Cancelled" WHERE id = ?',
        [cancellation.booking_id]
      );
    }

    // Fetch bookings after sync to ensure we get updated dates
    const [bookings] = await connection.execute(
      `SELECT *, 
              DATE_FORMAT(start_date, '%Y-%m-%d') as formatted_start_date,
              DATE_FORMAT(end_date, '%Y-%m-%d') as formatted_end_date
       FROM bookings 
       WHERE user_id = ? 
       ORDER BY booking_date DESC`,
      [req.user.userId]
    );

    console.log('Found bookings:', bookings.length);
    console.log('Synced approved reschedules:', approvedReschedules.length);
    console.log('Synced approved cancellations:', approvedCancellations.length);
    
    // Log booking dates for debugging
    bookings.forEach((booking, index) => {
      console.log(`Booking ${index + 1} (ID: ${booking.id}): ${booking.vehicle_name}`);
      console.log(`  Dates: ${booking.formatted_start_date} to ${booking.formatted_end_date}`);
      console.log(`  Time: ${booking.rent_time || 'N/A'}`);
      console.log(`  Status: ${booking.status}`);
    });

    res.json(bookings);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ 
      error: 'Failed to fetch bookings',
      details: error.message,
      stack: error.stack
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Mark notification as read
router.put('/:id/mark-notification-read', auth.verifyToken, async function(req, res) {
  let connection;
  try {
    const bookingId = req.params.id;
    const userId = req.user.userId;
    
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'velorent'
    });

    // Update notification_sent to 1 for this booking
    await connection.execute(
      'UPDATE bookings SET notification_sent = 1 WHERE id = ? AND user_id = ?',
      [bookingId, userId]
    );

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ 
      error: 'Failed to mark notification as read',
      details: error.message
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Test endpoint to check authentication (requires auth)
router.get('/test-auth', auth.verifyToken, async function(req, res) {
  try {
    console.log('=== AUTH TEST ===');
    console.log('User from token:', req.user);
    res.json({
      message: 'Authentication successful',
      user: req.user
    });
  } catch (error) {
    console.error('Auth test error:', error);
    res.status(500).json({ 
      error: 'Auth test failed',
      details: error.message
    });
  }
});

// Test endpoint to check database connection (no auth required)
router.get('/test-db', async function(req, res) {
  let connection;
  try {
    console.log('=== DATABASE TEST ===');
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'velorent'
    });

    // Check if database exists
    const [databases] = await connection.execute("SHOW DATABASES LIKE 'velorent'");
    console.log('Database exists:', databases.length > 0);

    // Check tables
    const [tables] = await connection.execute("SHOW TABLES");
    console.log('Available tables:', tables);

    // Check if bookings table exists
    const [bookingsTable] = await connection.execute("SHOW TABLES LIKE 'bookings'");
    console.log('Bookings table exists:', bookingsTable.length > 0);

    if (bookingsTable.length > 0) {
      const [columns] = await connection.execute("DESCRIBE bookings");
      console.log('Bookings table structure:', columns);
    }

    res.json({
      databaseExists: databases.length > 0,
      tables: tables,
      bookingsTableExists: bookingsTable.length > 0,
      message: 'Database test completed'
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({ 
      error: 'Database test failed',
      details: error.message,
      stack: error.stack
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Test route to verify DELETE is working
router.delete('/test-delete', (req, res) => {
  res.json({ message: 'DELETE method is working' });
});

module.exports = router; 