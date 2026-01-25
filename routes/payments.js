const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const axios = require('axios');
const config = require('../config');
const auth = require('../middleware/auth');

// PayMongo API base URL (same endpoint for test and live modes)
// Test/Live mode is determined by the API keys (sk_test_/pk_test_ for test, sk_live_/pk_live_ for live)
const PAYMONGO_API_URL = 'https://api.paymongo.com/v1';

// Helper function to create database connection
async function getConnection() {
  return await mysql.createConnection({
    host: config.DB_HOST || 'localhost',
    user: config.DB_USER || 'root',
    password: config.DB_PASS || '',
    database: config.DB_NAME || 'velorent'
  });
}

// Create QR Ph (Online QR) payment intent and return QR image URL
router.post('/qrph', auth.verifyToken, async (req, res) => {
  let connection;
  try {
    const { amount, booking_id } = req.body;

    // Validate required fields
    if (!amount || amount <= 0) {
      return res.status(400).json({
        error: 'Amount is required and must be greater than 0'
      });
    }

    if (!booking_id) {
      return res.status(400).json({
        error: 'booking_id is required'
      });
    }

    // Validate PayMongo secret key is configured
    if (!config.PAYMONGO_SECRET_KEY) {
      console.error('PayMongo secret key is not configured in config.env');
      return res.status(500).json({
        error: 'PayMongo secret key is not configured',
        hint: 'Please check your config.env file and ensure PAYMONGO_SECRET_KEY is set'
      });
    }

    // Convert amount to centavos (PayMongo uses smallest currency unit)
    const amountInCentavos = Math.round(amount * 100);

    console.log('=== CREATING PAYMONGO QRPH PAYMENT INTENT ===');
    console.log('Amount (PHP):', amount);
    console.log('Amount (centavos):', amountInCentavos);
    console.log('Booking ID:', booking_id);

    const authHeader = `Basic ${Buffer.from(config.PAYMONGO_SECRET_KEY + ':').toString('base64')}`;

    // STEP 1: Create Payment Intent that allows QR Ph
    const intentBody = {
      data: {
        attributes: {
          amount: amountInCentavos,
          currency: 'PHP',
          payment_method_allowed: ['qrph'],
          payment_method_options: {
            qrph: {
              // Let PayMongo handle default expiry (usually 30 minutes)
            }
          },
          description: `Vehicle Rental QR Ph Payment - Booking #${booking_id}`,
          metadata: {
            booking_id: booking_id.toString(),
            channel: 'velorent_app',
            payment_type: 'qrph_online'
          }
        }
      }
    };

    const intentResponse = await axios.post(
      `${PAYMONGO_API_URL}/payment_intents`,
      intentBody,
      {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!intentResponse.data || !intentResponse.data.data) {
      throw new Error('Invalid response from PayMongo when creating payment intent');
    }

    const intentData = intentResponse.data.data;
    const intentId = intentData.id;

    console.log('Created QRPH payment intent:', intentId);

    // STEP 2: Create QR Ph payment method
    const paymentMethodBody = {
      data: {
        attributes: {
          type: 'qrph'
          // Optional: you can add billing details here if needed
        }
      }
    };

    const methodResponse = await axios.post(
      `${PAYMONGO_API_URL}/payment_methods`,
      paymentMethodBody,
      {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!methodResponse.data || !methodResponse.data.data) {
      throw new Error('Invalid response from PayMongo when creating payment method');
    }

    const paymentMethodId = methodResponse.data.data.id;
    console.log('Created QRPH payment method:', paymentMethodId);

    // STEP 3: Attach payment method to intent to generate the QR
    const attachBody = {
      data: {
        attributes: {
          payment_method: paymentMethodId
        }
      }
    };

    const attachResponse = await axios.post(
      `${PAYMONGO_API_URL}/payment_intents/${intentId}/attach`,
      attachBody,
      {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!attachResponse.data || !attachResponse.data.data) {
      throw new Error('Invalid response from PayMongo when attaching payment method');
    }

    const attachedIntent = attachResponse.data.data;
    const nextAction = attachedIntent.attributes?.next_action || {};

    // PayMongo QR Ph docs use next_action.code.image_url for the QR image
    const qrImageUrl =
      nextAction.code?.image_url ||
      nextAction.qr_image_url ||
      nextAction.qr_code?.image ||
      null;

    if (!qrImageUrl) {
      console.error('Attach response next_action:', JSON.stringify(nextAction, null, 2));
      throw new Error('QR image URL not found in PayMongo response');
    }

    console.log('QRPH image URL received from PayMongo');

    // Save payment record to database (no checkout_url for QRPH, but keep intent for tracking)
    connection = await getConnection();

    await connection.execute(
      `INSERT INTO payments (booking_id, amount, status, checkout_url, payment_intent_id, source_id) 
       VALUES (?, ?, 'pending', ?, ?, ?)`,
      [booking_id, amount, null, intentId, null]
    );

    res.json({
      qr_image_url: qrImageUrl,
      payment_intent_id: intentId
    });
  } catch (error) {
    console.error('=== QRPH PAYMENT CREATION ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error response status:', error.response?.status);
    console.error('Error response data:', JSON.stringify(error.response?.data, null, 2));

    let errorDetails = error.message;
    if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
      errorDetails = error.response.data.errors.map(e => e.detail || e.message || JSON.stringify(e)).join('; ');
    } else if (error.response?.data?.message) {
      errorDetails = error.response.data.message;
    }

    res.status(500).json({
      error: 'Failed to create QRPH payment',
      details: errorDetails
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Create payment checkout link
router.post('/create-payment', auth.verifyToken, async (req, res) => {
  let connection;
  try {
    const { amount, booking_id } = req.body;

    // Validate required fields
    if (!amount || amount <= 0) {
      return res.status(400).json({ 
        error: 'Amount is required and must be greater than 0' 
      });
    }

    if (!booking_id) {
      return res.status(400).json({ 
        error: 'booking_id is required' 
      });
    }

    // Validate PayMongo secret key is configured
    console.log('=== PAYMENT CONFIG CHECK ===');
    console.log('Config object keys:', Object.keys(config));
    console.log('PAYMONGO_SECRET_KEY exists:', !!config.PAYMONGO_SECRET_KEY);
    console.log('PAYMONGO_SECRET_KEY value (first 10 chars):', config.PAYMONGO_SECRET_KEY?.substring(0, 10) || 'NOT SET');
    
    if (!config.PAYMONGO_SECRET_KEY) {
      console.error('PayMongo secret key is not configured in config.env');
      return res.status(500).json({ 
        error: 'PayMongo secret key is not configured',
        hint: 'Please check your config.env file and ensure PAYMONGO_SECRET_KEY is set'
      });
    }

    // Convert amount to centavos (PayMongo uses smallest currency unit)
    const amountInCentavos = Math.round(amount * 100);

    console.log('=== CREATING PAYMONGO CHECKOUT SESSION ===');
    console.log('Amount (PHP):', amount);
    console.log('Amount (centavos):', amountInCentavos);
    console.log('Booking ID:', booking_id);
    console.log('PayMongo Secret Key (first 10 chars):', config.PAYMONGO_SECRET_KEY?.substring(0, 10) + '...');

    // Create checkout session with PayMongo (for GCash payments)
    // PayMongo API format: https://developers.paymongo.com/reference/create-a-checkout-session
    // Note: line_items must have all required fields
    const requestBody = {
      data: {
        attributes: {
          send_email_receipt: true,
          show_description: true,
          show_line_items: true,
          line_items: [
            {
              currency: 'PHP',
              amount: amountInCentavos,
              name: `Vehicle Rental - Booking #${booking_id}`,
              quantity: 1,
              description: `Down payment for vehicle rental booking #${booking_id}`
            }
          ],
          // Payment methods available in test mode: GCash, GrabPay, PayMaya
          // Note: In test mode, use PayMongo test cards or test GCash account
          // If GCash is not available, other methods will be shown
          payment_method_types: ['gcash', 'grab_pay', 'paymaya'],
          success_url: `${config.IONIC_APP_URL || 'http://localhost:8100'}/payment/success?booking_id=${booking_id}`,
          cancel_url: `${config.IONIC_APP_URL || 'http://localhost:8100'}/payment/cancel?booking_id=${booking_id}`,
          description: `Vehicle Rental Payment - Booking #${booking_id}`,
          metadata: {
            booking_id: booking_id.toString()
          }
        }
      }
    };

    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    const authHeader = `Basic ${Buffer.from(config.PAYMONGO_SECRET_KEY + ':').toString('base64')}`;
    console.log('Authorization header (first 20 chars):', authHeader.substring(0, 20) + '...');

    const checkoutResponse = await axios.post(
      `${PAYMONGO_API_URL}/checkout_sessions`,
      requestBody,
      {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('PayMongo response status:', checkoutResponse.status);
    console.log('PayMongo response data:', JSON.stringify(checkoutResponse.data, null, 2));

    if (!checkoutResponse.data || !checkoutResponse.data.data) {
      throw new Error('Invalid response from PayMongo API');
    }

    const checkoutUrl = checkoutResponse.data.data.attributes?.checkout_url;
    const checkoutId = checkoutResponse.data.data.id;
    const paymentIntentId = checkoutResponse.data.data.attributes?.payment_intent?.id || null;

    if (!checkoutUrl) {
      throw new Error('Checkout URL not found in PayMongo response');
    }

    console.log('Checkout URL:', checkoutUrl);
    console.log('Checkout ID:', checkoutId);
    console.log('Payment Intent ID:', paymentIntentId);

    // Save payment record to database
    connection = await getConnection();
    
    await connection.execute(
      `INSERT INTO payments (booking_id, amount, status, checkout_url, payment_intent_id, source_id) 
       VALUES (?, ?, 'pending', ?, ?, ?)`,
      [booking_id, amount, checkoutUrl, paymentIntentId, checkoutId]
    );

    res.json({
      checkout_url: checkoutUrl
    });

  } catch (error) {
    console.error('=== PAYMENT CREATION ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error response status:', error.response?.status);
    console.error('Error response headers:', error.response?.headers);
    console.error('Error response data:', JSON.stringify(error.response?.data, null, 2));
    console.error('Error stack:', error.stack);
    
    // Extract error details from PayMongo response
    let errorDetails = error.message;
    let paymongoErrors = null;
    
    if (error.response?.data) {
      // PayMongo typically returns errors in this format:
      // { errors: [{ detail: "...", source: {...} }] }
      if (error.response.data.errors && Array.isArray(error.response.data.errors)) {
        paymongoErrors = error.response.data.errors;
        errorDetails = error.response.data.errors.map(e => e.detail || e.message || JSON.stringify(e)).join('; ');
      } 
      // Sometimes it's just an error object
      else if (error.response.data.error) {
        errorDetails = error.response.data.error;
        paymongoErrors = error.response.data;
      }
      // Or a message field
      else if (error.response.data.message) {
        errorDetails = error.response.data.message;
        paymongoErrors = error.response.data;
      }
      // Or the whole response
      else {
        errorDetails = JSON.stringify(error.response.data);
        paymongoErrors = error.response.data;
      }
    }
    
    // Log the extracted details
    console.error('Extracted error details:', errorDetails);
    console.error('PayMongo errors:', paymongoErrors);
    
    res.status(500).json({ 
      error: 'Failed to create payment',
      details: Array.isArray(errorDetails) ? errorDetails : [errorDetails],
      paymongo_error: paymongoErrors,
      message: errorDetails
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Get payment status by booking_id
router.get('/status/:booking_id', auth.verifyToken, async (req, res) => {
  let connection;
  try {
    connection = await getConnection();
    
    const [payments] = await connection.execute(
      `SELECT * FROM payments WHERE booking_id = ? ORDER BY created_at DESC LIMIT 1`,
      [req.params.booking_id]
    );

    if (payments.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = payments[0];
    
    // If payment is still pending and we have a payment_intent_id, check PayMongo directly
    if (payment.status === 'pending' && payment.payment_intent_id) {
      try {
        const authHeader = `Basic ${Buffer.from(config.PAYMONGO_SECRET_KEY + ':').toString('base64')}`;
        const paymongoResponse = await axios.get(
          `${PAYMONGO_API_URL}/payment_intents/${payment.payment_intent_id}`,
          {
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json'
            }
          }
        );

        const paymongoStatus = paymongoResponse.data?.data?.attributes?.status;
        console.log('PayMongo payment intent status:', paymongoStatus);

        // If PayMongo shows it's paid, update our database
        if (paymongoStatus === 'succeeded' || paymongoStatus === 'paid') {
          await connection.execute(
            `UPDATE payments SET status = 'paid', updated_at = NOW() WHERE id = ?`,
            [payment.id]
          );
          
          // Get booking information for notification and update
          const [bookings] = await connection.execute(
            `SELECT id, user_id, vehicle_name, status FROM bookings WHERE id = ? AND status = 'Pending'`,
            [req.params.booking_id]
          );
          
          if (bookings.length > 0) {
            const booking = bookings[0];
            const bookingId = booking.id;
            const userId = booking.user_id;
            const vehicleName = booking.vehicle_name;
            
            // Get payment method from PayMongo
            let paymentMethod = null;
            
            // Log the full response for debugging
            console.log('=== PAYMONGO PAYMENT INTENT RESPONSE ===');
            console.log('Full response:', JSON.stringify(paymongoResponse.data, null, 2));
            
            const paymentIntent = paymongoResponse.data?.data;
            if (paymentIntent) {
              // Try multiple paths to get the payment method
              // Path 1: Check latest_payment -> source
              const latestPaymentData = paymentIntent.attributes?.latest_payment;
              if (latestPaymentData) {
                const source = latestPaymentData.attributes?.source;
                if (source) {
                  const sourceType = source.type;
                  console.log('Found source type from latest_payment:', sourceType);
                  if (sourceType === 'gcash') {
                    paymentMethod = 'GCash';
                  } else if (sourceType === 'grab_pay') {
                    paymentMethod = 'GrabPay';
                  } else if (sourceType === 'paymaya') {
                    paymentMethod = 'PayMaya';
                  } else if (sourceType) {
                    paymentMethod = sourceType.charAt(0).toUpperCase() + sourceType.slice(1).replace(/_/g, ' ');
                  }
                }
              }
              
              // Path 2: Check payment_method_allowed (what was offered)
              if (!paymentMethod && paymentIntent.attributes?.payment_method_allowed) {
                const allowedMethods = paymentIntent.attributes.payment_method_allowed;
                console.log('Found payment_method_allowed:', allowedMethods);
                if (Array.isArray(allowedMethods) && allowedMethods.length > 0) {
                  const firstMethod = allowedMethods[0];
                  if (firstMethod === 'gcash') {
                    paymentMethod = 'GCash';
                  } else if (firstMethod === 'grab_pay') {
                    paymentMethod = 'GrabPay';
                  } else if (firstMethod === 'paymaya') {
                    paymentMethod = 'PayMaya';
                  } else if (firstMethod === 'qrph') {
                    paymentMethod = 'QR Ph';
                  }
                }
              }
              
              // Path 3: Query the payment source directly if we have a source_id
              if (!paymentMethod && payment.source_id) {
                try {
                  const sourceResponse = await axios.get(
                    `https://api.paymongo.com/v1/sources/${payment.source_id}`,
                    {
                      headers: {
                        'Authorization': authHeader,
                        'Content-Type': 'application/json'
                      }
                    }
                  );
                  const sourceType = sourceResponse.data?.data?.attributes?.type;
                  console.log('Found source type from source API:', sourceType);
                  if (sourceType === 'gcash') {
                    paymentMethod = 'GCash';
                  } else if (sourceType === 'grab_pay') {
                    paymentMethod = 'GrabPay';
                  } else if (sourceType === 'paymaya') {
                    paymentMethod = 'PayMaya';
                  } else if (sourceType) {
                    paymentMethod = sourceType.charAt(0).toUpperCase() + sourceType.slice(1).replace(/_/g, ' ');
                  }
                } catch (sourceError) {
                  console.error('Error fetching source from PayMongo:', sourceError.message);
                }
              }
            }
            
            console.log('Final payment method determined:', paymentMethod);
            
            // Generate transaction ID: TXN-{booking_id}-{date}
            const today = new Date();
            const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
            const transactionId = `TXN-${String(bookingId).padStart(8, '0')}-${dateStr}`;
            
            // Update booking with payment information
            await connection.execute(
              `UPDATE bookings SET 
                payment_method = ?,
                payment_status = 'paid',
                transaction_id = ?,
                transaction_date = NOW(),
                reference_number = ?
               WHERE id = ?`,
              [
                paymentMethod,
                transactionId,
                payment.payment_intent_id || payment.source_id || null,
                bookingId
              ]
            );
            
            // Check if notification already exists to prevent duplicates
            const [existingNotifications] = await connection.execute(
              `SELECT id FROM notifications 
               WHERE user_id = ? AND related_booking_id = ? 
               AND type = 'booking_update' 
               AND message LIKE ?`,
              [userId, bookingId, '%confirmed and is waiting for approval%']
            );
            
            if (existingNotifications.length === 0) {
              // Create notification for the user
              const notificationMessage = `Your booking for ${vehicleName} (Booking #${bookingId}) has been confirmed and is waiting for approval. You will be notified once it's approved.`;
              await connection.execute(
                `INSERT INTO notifications (user_id, message, type, related_booking_id, status) 
                 VALUES (?, ?, 'booking_update', ?, 'unread')`,
                [userId, notificationMessage, bookingId]
              );
              
              console.log(`Payment status updated to paid from PayMongo API. Notification created for booking #${bookingId}`);
            } else {
              console.log(`Payment status updated to paid from PayMongo API. Notification already exists for booking #${bookingId}`);
            }
            // Note: Booking status remains 'Pending' - it will be approved by admin/company later
          }
          
          payment.status = 'paid';
          console.log('Payment status updated to paid from PayMongo API');
        } else if (paymongoStatus === 'awaiting_payment_method' || paymongoStatus === 'awaiting_next_action') {
          // Still processing
          console.log('Payment still processing in PayMongo');
        } else if (paymongoStatus === 'payment_failed' || paymongoStatus === 'canceled') {
          await connection.execute(
            `UPDATE payments SET status = 'failed', updated_at = NOW() WHERE id = ?`,
            [payment.id]
          );
          payment.status = 'failed';
          console.log('Payment status updated to failed from PayMongo API');
        }
      } catch (paymongoError) {
        console.error('Error checking PayMongo API:', paymongoError.message);
        // Continue with database status if PayMongo check fails
      }
    }

    res.json(payment);
  } catch (error) {
    console.error('Error fetching payment status:', error);
    res.status(500).json({ 
      error: 'Failed to fetch payment status',
      details: error.message
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Get all payments for a user (via their bookings)
router.get('/my-payments', auth.verifyToken, async (req, res) => {
  let connection;
  try {
    connection = await getConnection();
    
    const [payments] = await connection.execute(
      `SELECT p.*, b.vehicle_name, b.company_name, b.start_date, b.end_date 
       FROM payments p
       JOIN bookings b ON p.booking_id = b.id
       WHERE b.user_id = ?
       ORDER BY p.created_at DESC`,
      [req.user.userId]
    );

    res.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ 
      error: 'Failed to fetch payments',
      details: error.message
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

module.exports = router;

