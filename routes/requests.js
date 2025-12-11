const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const auth = require('../middleware/auth');
const { createConnection } = require('../utils/db');

// Get all requests for the current user
router.get('/my-requests', auth.verifyToken, async (req, res) => {
  let connection;
  try {
    connection = await createConnection();

    const [requests] = await connection.execute(
      `SELECT r.*, 
              b.vehicle_name, 
              b.start_date as original_start_date, 
              b.end_date as original_end_date,
              b.rent_time as original_rent_time,
              c.company_name
       FROM requests r
       JOIN bookings b ON r.booking_id = b.id
       JOIN companies c ON r.company_id = c.id
       WHERE r.user_id = ?
       ORDER BY r.created_at DESC`,
      [req.user.userId]
    );

    // Extract admin remarks from reason field and add as computed property
    const processedRequests = requests.map(request => {
      if (request.reason) {
        // Pattern to match [Admin Remarks]: content (captures everything after the colon)
        const adminRemarksMatch = request.reason.match(/\[Admin Remarks\]:\s*(.+)$/is);
        
        if (adminRemarksMatch) {
          // Extract admin remarks (everything after [Admin Remarks]:)
          const adminRemarks = adminRemarksMatch[1].trim();
          
          // Add admin remarks as a computed property (not stored in DB)
          request.company_remarks = adminRemarks;
          
          // Remove admin remarks from reason for display (everything from [Admin Remarks]: to end)
          let cleanReason = request.reason.replace(/\[Admin Remarks\]:\s*.+$/is, '').trim();
          request.reason = cleanReason || request.reason;
        }
      }
      return request;
    });

    res.json(processedRequests);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ 
      error: 'Failed to fetch requests',
      details: error.message 
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Get a specific request by ID
router.get('/:id', auth.verifyToken, async (req, res) => {
  let connection;
  try {
    connection = await createConnection();

    const [requests] = await connection.execute(
      `SELECT r.*, 
              b.vehicle_name, 
              b.start_date as original_start_date, 
              b.end_date as original_end_date,
              b.rent_time as original_rent_time,
              c.company_name
       FROM requests r
       JOIN bookings b ON r.booking_id = b.id
       JOIN companies c ON r.company_id = c.id
       WHERE r.id = ? AND r.user_id = ?`,
      [req.params.id, req.user.userId]
    );

    if (requests.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Extract admin remarks from reason field and add as computed property
    const request = requests[0];
    if (request.reason) {
      // Pattern to match [Admin Remarks]: content (captures everything after the colon)
      const adminRemarksMatch = request.reason.match(/\[Admin Remarks\]:\s*(.+)$/is);
      
      if (adminRemarksMatch) {
        // Extract admin remarks (everything after [Admin Remarks]:)
        const adminRemarks = adminRemarksMatch[1].trim();
        
        // Add admin remarks as a computed property (not stored in DB)
        request.company_remarks = adminRemarks;
        
        // Remove admin remarks from reason for display (everything from [Admin Remarks]: to end)
        let cleanReason = request.reason.replace(/\[Admin Remarks\]:\s*.+$/is, '').trim();
        request.reason = cleanReason || request.reason;
      }
    }

    res.json(request);
  } catch (error) {
    console.error('Error fetching request:', error);
    res.status(500).json({ 
      error: 'Failed to fetch request',
      details: error.message 
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Create a new request (reschedule or cancellation)
router.post('/', auth.verifyToken, async (req, res) => {
  let connection;
  try {
    const { booking_id, request_type, reason, new_start_date, new_end_date, new_rent_time } = req.body;

    if (!booking_id || !request_type || !reason) {
      return res.status(400).json({ error: 'Missing required fields: booking_id, request_type, and reason are required' });
    }

    if (request_type !== 'reschedule' && request_type !== 'cancellation') {
      return res.status(400).json({ error: 'Invalid request_type. Must be "reschedule" or "cancellation"' });
    }

    if (request_type === 'reschedule' && (!new_start_date || !new_end_date)) {
      return res.status(400).json({ error: 'new_start_date and new_end_date are required for reschedule requests' });
    }

    connection = await createConnection();

    // Verify booking belongs to user
    const [bookings] = await connection.execute(
      'SELECT * FROM bookings WHERE id = ? AND user_id = ?',
      [booking_id, req.user.userId]
    );

    if (bookings.length === 0) {
      return res.status(404).json({ error: 'Booking not found or does not belong to you' });
    }

    const booking = bookings[0];

    // Check if booking is eligible for request
    if (booking.status === 'Cancelled' || booking.status === 'Completed') {
      return res.status(400).json({ error: 'Cannot create request for cancelled or completed bookings' });
    }

    // Check if there's already a pending request for this booking
    const [existingRequests] = await connection.execute(
      'SELECT id FROM requests WHERE booking_id = ? AND status = "pending"',
      [booking_id]
    );

    if (existingRequests.length > 0) {
      return res.status(400).json({ error: 'There is already a pending request for this booking' });
    }

    // Get company policies to compute fee
    const [policies] = await connection.execute(
      'SELECT * FROM company_policies WHERE company_id = ?',
      [booking.company_id]
    );

    let computed_fee = 0.00;
    let policy = null;

    if (policies.length > 0) {
      policy = policies[0];
      
      if (request_type === 'reschedule') {
        // Calculate days until booking
        const bookingDate = new Date(booking.start_date);
        const today = new Date();
        const daysUntilBooking = Math.ceil((bookingDate - today) / (1000 * 60 * 60 * 24));

        if (daysUntilBooking < policy.reschedule_free_days) {
          // Fee applies
          const feePercentage = parseFloat(policy.reschedule_fee_percentage) || 10.00;
          // Assuming we have a total cost in booking, otherwise use a default calculation
          // For now, we'll set a base fee that can be adjusted
          computed_fee = feePercentage; // This should be calculated based on booking total
        }
      } else if (request_type === 'cancellation') {
        const feePercentage = parseFloat(policy.cancellation_fee_percentage) || 20.00;
        computed_fee = feePercentage; // This should be calculated based on booking total
      }
    }

    // Insert request
    const [result] = await connection.execute(
      `INSERT INTO requests (
        user_id, company_id, booking_id, request_type, status, reason, 
        new_start_date, new_end_date, new_rent_time, computed_fee
      ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
      [
        req.user.userId,
        booking.company_id,
        booking_id,
        request_type,
        reason,
        new_start_date || null,
        new_end_date || null,
        new_rent_time || null,
        computed_fee
      ]
    );

    const requestId = result.insertId;

    // Create notification for the user
    const notificationMessage = request_type === 'reschedule' 
      ? `Your reschedule request for booking #${booking_id} has been submitted and is pending approval.`
      : `Your cancellation request for booking #${booking_id} has been submitted and is pending approval.`;

    await connection.execute(
      `INSERT INTO notifications (user_id, message, type, related_request_id, related_booking_id, status)
       VALUES (?, ?, 'request_update', ?, ?, 'unread')`,
      [req.user.userId, notificationMessage, requestId, booking_id]
    );

    // Fetch the created request with related data
    const [newRequests] = await connection.execute(
      `SELECT r.*, 
              b.vehicle_name, 
              b.start_date as original_start_date, 
              b.end_date as original_end_date,
              b.rent_time as original_rent_time,
              c.company_name
       FROM requests r
       JOIN bookings b ON r.booking_id = b.id
       JOIN companies c ON r.company_id = c.id
       WHERE r.id = ?`,
      [requestId]
    );

    if (newRequests.length === 0) {
      return res.status(500).json({ 
        error: 'Request created but could not be retrieved',
        details: 'Request ID: ' + requestId
      });
    }

    // Extract admin remarks from reason field and add as computed property
    const newRequest = newRequests[0];
    if (newRequest && newRequest.reason) {
      const adminRemarksMatch = newRequest.reason.match(/\[Admin Remarks\]:\s*(.+)$/is);
      if (adminRemarksMatch) {
        const adminRemarks = adminRemarksMatch[1].trim();
        newRequest.company_remarks = adminRemarks;
        let cleanReason = newRequest.reason.replace(/\[Admin Remarks\]:\s*.+$/is, '').trim();
        newRequest.reason = cleanReason || newRequest.reason;
      }
    }

    res.status(201).json(newRequest);
  } catch (error) {
    console.error('Error creating request:', error);
    console.error('Error stack:', error.stack);
    console.error('Request data:', req.body);
    res.status(500).json({ 
      error: 'Failed to create request',
      details: error.message,
      code: error.code,
      sqlState: error.sqlState
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Compute fee for a request (before submission)
router.post('/compute-fee', auth.verifyToken, async (req, res) => {
  let connection;
  try {
    const { booking_id, request_type, new_start_date } = req.body;

    if (!booking_id || !request_type) {
      return res.status(400).json({ error: 'booking_id and request_type are required' });
    }

    connection = await createConnection();

    // Get booking
    const [bookings] = await connection.execute(
      'SELECT * FROM bookings WHERE id = ? AND user_id = ?',
      [booking_id, req.user.userId]
    );

    if (bookings.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookings[0];

    // Get company policies
    const [policies] = await connection.execute(
      'SELECT * FROM company_policies WHERE company_id = ?',
      [booking.company_id]
    );

    let computed_fee = 0.00;
    let fee_details = {
      fee: 0,
      percentage: 0,
      reason: ''
    };

    if (policies.length > 0) {
      const policy = policies[0];

      if (request_type === 'reschedule') {
        // Calculate days until booking
        const bookingDate = new Date(booking.start_date);
        const today = new Date();
        const daysUntilBooking = Math.ceil((bookingDate - today) / (1000 * 60 * 60 * 24));

        if (daysUntilBooking >= policy.reschedule_free_days) {
          fee_details = {
            fee: 0,
            percentage: 0,
            reason: `Reschedule is free if requested at least ${policy.reschedule_free_days} days before booking`
          };
        } else {
          const feePercentage = parseFloat(policy.reschedule_fee_percentage) || 10.00;
          fee_details = {
            fee: feePercentage,
            percentage: feePercentage,
            reason: `Reschedule fee of ${feePercentage}% applies when requested within ${policy.reschedule_free_days} days of booking`
          };
          computed_fee = feePercentage;
        }
      } else if (request_type === 'cancellation') {
        const feePercentage = parseFloat(policy.cancellation_fee_percentage) || 20.00;
        fee_details = {
          fee: feePercentage,
          percentage: feePercentage,
          reason: `Cancellation fee of ${feePercentage}% applies`
        };
        computed_fee = feePercentage;
      }
    } else {
      // Default fees if no policy exists
      if (request_type === 'reschedule') {
        fee_details = {
          fee: 10.00,
          percentage: 10.00,
          reason: 'Default reschedule fee of 10% applies'
        };
        computed_fee = 10.00;
      } else {
        fee_details = {
          fee: 20.00,
          percentage: 20.00,
          reason: 'Default cancellation fee of 20% applies'
        };
        computed_fee = 20.00;
      }
    }

    res.json({
      computed_fee,
      fee_details,
      policy_applied: policies.length > 0
    });
  } catch (error) {
    console.error('Error computing fee:', error);
    res.status(500).json({ 
      error: 'Failed to compute fee',
      details: error.message 
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Approve or reject a request (admin/company endpoint)
router.put('/:id/approve', auth.verifyToken, async (req, res) => {
  let connection;
  try {
    const { status, company_response } = req.body;
    const requestId = req.params.id;

    if (!status || (status !== 'approved' && status !== 'rejected')) {
      return res.status(400).json({ error: 'Status must be "approved" or "rejected"' });
    }

    connection = await createConnection();

    // Get the request
    const [requests] = await connection.execute(
      'SELECT * FROM requests WHERE id = ?',
      [requestId]
    );

    if (requests.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const request = requests[0];

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request is not pending' });
    }

    // Update request status (company_remarks column doesn't exist, so we only update company_response)
    await connection.execute(
      'UPDATE requests SET status = ?, company_response = ?, updated_at = NOW() WHERE id = ?',
      [status, company_response || null, requestId]
    );

    // If approved and it's a reschedule request, update the booking dates
    if (status === 'approved' && request.request_type === 'reschedule') {
      await connection.execute(
        'UPDATE bookings SET start_date = ?, end_date = ?, rent_time = ? WHERE id = ?',
        [
          request.new_start_date,
          request.new_end_date,
          request.new_rent_time || null,
          request.booking_id
        ]
      );
    }

    // If approved and it's a cancellation request, cancel the booking
    if (status === 'approved' && request.request_type === 'cancellation') {
      await connection.execute(
        'UPDATE bookings SET status = "Cancelled" WHERE id = ?',
        [request.booking_id]
      );
    }

    // Create notification for the user
    const notificationMessage = status === 'approved'
      ? request.request_type === 'reschedule'
        ? `Your reschedule request for booking #${request.booking_id} has been approved. ${company_response || ''}`
        : `Your cancellation request for booking #${request.booking_id} has been approved. ${company_response || ''}`
      : `Your ${request.request_type} request for booking #${request.booking_id} has been rejected. ${company_response || ''}`;

    await connection.execute(
      `INSERT INTO notifications (user_id, message, type, related_request_id, related_booking_id, status)
       VALUES (?, ?, 'request_update', ?, ?, 'unread')`,
      [request.user_id, notificationMessage, requestId, request.booking_id]
    );

    // Fetch updated request
    const [updatedRequests] = await connection.execute(
      `SELECT r.*, 
              b.vehicle_name, 
              b.start_date as original_start_date, 
              b.end_date as original_end_date,
              b.rent_time as original_rent_time,
              c.company_name
       FROM requests r
       JOIN bookings b ON r.booking_id = b.id
       JOIN companies c ON r.company_id = c.id
       WHERE r.id = ?`,
      [requestId]
    );

    // Extract admin remarks from reason field and add as computed property
    const updatedRequest = updatedRequests[0];
    if (updatedRequest && updatedRequest.reason) {
      const adminRemarksMatch = updatedRequest.reason.match(/\[Admin Remarks\]:\s*(.+)$/is);
      if (adminRemarksMatch) {
        const adminRemarks = adminRemarksMatch[1].trim();
        updatedRequest.company_remarks = adminRemarks;
        let cleanReason = updatedRequest.reason.replace(/\[Admin Remarks\]:\s*.+$/is, '').trim();
        updatedRequest.reason = cleanReason || updatedRequest.reason;
      }
    }

    res.json(updatedRequest);
  } catch (error) {
    console.error('Error updating request:', error);
    res.status(500).json({ 
      error: 'Failed to update request',
      details: error.message 
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Delete a request (only for cancelled/rejected requests)
router.delete('/:id', auth.verifyToken, async (req, res) => {
  let connection;
  try {
    connection = await createConnection();

    // Get the request to verify it belongs to the user and is in a deletable state
    const [requests] = await connection.execute(
      'SELECT * FROM requests WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.userId]
    );

    if (requests.length === 0) {
      return res.status(404).json({ error: 'Request not found or does not belong to you' });
    }

    const request = requests[0];

    // Only allow deletion of rejected or completed requests
    if (request.status === 'pending') {
      return res.status(400).json({ error: 'Cannot delete pending requests. Please wait for a response.' });
    }

    // Delete the request
    await connection.execute(
      'DELETE FROM requests WHERE id = ?',
      [req.params.id]
    );

    res.json({ message: 'Request deleted successfully' });
  } catch (error) {
    console.error('Error deleting request:', error);
    res.status(500).json({ 
      error: 'Failed to delete request',
      details: error.message 
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Delete multiple cancelled/rejected requests
router.post('/delete-multiple', auth.verifyToken, async (req, res) => {
  let connection;
  try {
    const { requestIds } = req.body;

    if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
      return res.status(400).json({ error: 'requestIds array is required' });
    }

    connection = await createConnection();

    // Verify all requests belong to the user and are not pending
    const placeholders = requestIds.map(() => '?').join(',');
    const [requests] = await connection.execute(
      `SELECT id, status FROM requests 
       WHERE id IN (${placeholders}) AND user_id = ?`,
      [...requestIds, req.user.userId]
    );

    if (requests.length === 0) {
      return res.status(404).json({ error: 'No valid requests found' });
    }

    // Check for pending requests
    const pendingRequests = requests.filter(r => r.status === 'pending');
    if (pendingRequests.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete pending requests. Please wait for a response.',
        pendingIds: pendingRequests.map(r => r.id)
      });
    }

    // Delete the requests
    const validIds = requests.map(r => r.id);
    const deletePlaceholders = validIds.map(() => '?').join(',');
    await connection.execute(
      `DELETE FROM requests WHERE id IN (${deletePlaceholders})`,
      validIds
    );

    res.json({ 
      message: `${validIds.length} request(s) deleted successfully`,
      deletedCount: validIds.length
    });
  } catch (error) {
    console.error('Error deleting requests:', error);
    res.status(500).json({ 
      error: 'Failed to delete requests',
      details: error.message 
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

module.exports = router;

