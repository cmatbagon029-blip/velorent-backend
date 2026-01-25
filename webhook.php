<?php
/**
 * PayMongo Webhook Handler
 * 
 * This file handles webhook events from PayMongo to update payment status
 * 
 * Register this URL in PayMongo Dashboard:
 * Developers → Webhooks → Add Webhook
 * URL: https://yourdomain.com/backend/webhook.php
 * Events: payment.paid, payment.failed
 */

// CORS Headers - Must be at the very top before any output
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

header('Content-Type: application/json');

// Database configuration
$db_host = 'localhost';
$db_user = 'root';
$db_pass = '';
$db_name = 'velorent';

// PayMongo webhook secret (get from PayMongo dashboard)
$webhook_secret = getenv('PAYMONGO_WEBHOOK_SECRET') ?: 'whsec_your_webhook_secret_here';

// Get the raw request body
$payload = @file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_PAYMONGO_SIGNATURE'] ?? '';

// Verify webhook signature (optional but recommended for security)
// For production, implement signature verification using the webhook secret

try {
    // Parse the webhook event
    $event = json_decode($payload, true);
    
    if (!$event || !isset($event['data'])) {
        throw new Exception('Invalid webhook payload');
    }

    $eventType = $event['data']['attributes']['type'] ?? '';
    $eventData = $event['data'] ?? [];

    // Connect to database
    $conn = new mysqli($db_host, $db_user, $db_pass, $db_name);
    
    if ($conn->connect_error) {
        throw new Exception('Database connection failed: ' . $conn->connect_error);
    }

    // Handle different event types
    switch ($eventType) {
        case 'payment.paid':
            // Payment was successful
            $paymentIntentId = $eventData['attributes']['payment_intent_id'] ?? $eventData['attributes']['data']['attributes']['payment_intent_id'] ?? null;
            $sourceId = $eventData['id'] ?? $eventData['attributes']['data']['id'] ?? null;
            
            if ($paymentIntentId) {
                
                // Update payment status to 'paid'
                $stmt = $conn->prepare(
                    "UPDATE payments 
                     SET status = 'paid', source_id = ?, updated_at = NOW() 
                     WHERE payment_intent_id = ?"
                );
                $stmt->bind_param("ss", $sourceId, $paymentIntentId);
                $stmt->execute();
                
                if ($stmt->affected_rows > 0) {
                    // Get booking and user information for notification
                    $stmt2 = $conn->prepare(
                        "SELECT b.id as booking_id, b.user_id, b.vehicle_name
                         FROM bookings b
                         INNER JOIN payments p ON b.id = p.booking_id
                         WHERE p.payment_intent_id = ? AND b.status = 'Pending'"
                    );
                    $stmt2->bind_param("s", $paymentIntentId);
                    $stmt2->execute();
                    $result = $stmt2->get_result();
                    
                    if ($result->num_rows > 0) {
                        $booking = $result->fetch_assoc();
                        $bookingId = $booking['booking_id'];
                        $userId = $booking['user_id'];
                        $vehicleName = $booking['vehicle_name'];
                        
                        // Get payment method from event data
                        $paymentMethod = null;
                        
                        // Log event data for debugging
                        error_log("Webhook event data: " . json_encode($eventData));
                        
                        // Try multiple paths to get payment method
                        // Path 1: Check event data -> attributes -> data -> attributes -> source
                        $sourceData = $eventData['attributes']['data']['attributes']['source'] ?? null;
                        
                        // Path 2: Check event data -> attributes -> source
                        if (!$sourceData) {
                            $sourceData = $eventData['attributes']['source'] ?? null;
                        }
                        
                        // Path 3: Check event data -> data -> attributes -> source
                        if (!$sourceData && isset($event['data']['attributes']['data']['attributes']['source'])) {
                            $sourceData = $event['data']['attributes']['data']['attributes']['source'];
                        }
                        
                        // Path 4: Check if event data itself is the source
                        if (!$sourceData && isset($eventData['type'])) {
                            $sourceData = $eventData;
                        }
                        
                        if ($sourceData) {
                            $sourceType = $sourceData['type'] ?? null;
                            error_log("Found source type: " . $sourceType);
                            if ($sourceType === 'gcash') {
                                $paymentMethod = 'GCash';
                            } else if ($sourceType === 'grab_pay') {
                                $paymentMethod = 'GrabPay';
                            } else if ($sourceType === 'paymaya') {
                                $paymentMethod = 'PayMaya';
                            } else if ($sourceType === 'qrph') {
                                $paymentMethod = 'QR Ph';
                            } else if ($sourceType) {
                                $paymentMethod = ucfirst(str_replace('_', ' ', $sourceType));
                            }
                        }
                        
                        // If still no method, try to query PayMongo API for the payment intent
                        if (!$paymentMethod && $paymentIntentId) {
                            // Use cURL to query PayMongo API
                            $paymongoSecretKey = getenv('PAYMONGO_SECRET_KEY') ?: '';
                            if ($paymongoSecretKey) {
                                $ch = curl_init("https://api.paymongo.com/v1/payment_intents/{$paymentIntentId}");
                                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                                curl_setopt($ch, CURLOPT_HTTPHEADER, [
                                    'Authorization: Basic ' . base64_encode($paymongoSecretKey . ':'),
                                    'Content-Type: application/json'
                                ]);
                                $response = curl_exec($ch);
                                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                                curl_close($ch);
                                
                                if ($httpCode === 200 && $response) {
                                    $paymongoData = json_decode($response, true);
                                    $latestPayment = $paymongoData['data']['attributes']['latest_payment'] ?? null;
                                    if ($latestPayment) {
                                        $source = $latestPayment['attributes']['source'] ?? null;
                                        if ($source) {
                                            $sourceType = $source['type'] ?? null;
                                            if ($sourceType === 'gcash') {
                                                $paymentMethod = 'GCash';
                                            } else if ($sourceType === 'grab_pay') {
                                                $paymentMethod = 'GrabPay';
                                            } else if ($sourceType === 'paymaya') {
                                                $paymentMethod = 'PayMaya';
                                            } else if ($sourceType === 'qrph') {
                                                $paymentMethod = 'QR Ph';
                                            } else if ($sourceType) {
                                                $paymentMethod = ucfirst(str_replace('_', ' ', $sourceType));
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        
                        error_log("Final payment method: " . ($paymentMethod ?? 'NULL'));
                        
                        // Generate transaction ID: TXN-{booking_id}-{date}
                        $dateStr = date('Ymd');
                        $transactionId = 'TXN-' . str_pad($bookingId, 8, '0', STR_PAD_LEFT) . '-' . $dateStr;
                        
                        // Update booking with payment information
                        $updateStmt = $conn->prepare(
                            "UPDATE bookings SET 
                                payment_method = ?,
                                payment_status = 'paid',
                                transaction_id = ?,
                                transaction_date = NOW(),
                                reference_number = ?
                             WHERE id = ?"
                        );
                        $referenceNumber = $paymentIntentId ?? $sourceId ?? null;
                        $updateStmt->bind_param("ssssi", $paymentMethod, $transactionId, $referenceNumber, $bookingId);
                        $updateStmt->execute();
                        $updateStmt->close();
                        
                        // Check if notification already exists to prevent duplicates
                        $checkStmt = $conn->prepare(
                            "SELECT id FROM notifications 
                             WHERE user_id = ? AND related_booking_id = ? 
                             AND type = 'booking_update' 
                             AND message LIKE ?"
                        );
                        $messagePattern = "%confirmed and is waiting for approval%";
                        $checkStmt->bind_param("iis", $userId, $bookingId, $messagePattern);
                        $checkStmt->execute();
                        $checkResult = $checkStmt->get_result();
                        
                        if ($checkResult->num_rows == 0) {
                            // Create notification for the user
                            $notificationMessage = "Your booking for {$vehicleName} (Booking #{$bookingId}) has been confirmed and is waiting for approval. You will be notified once it's approved.";
                            $stmt3 = $conn->prepare(
                                "INSERT INTO notifications (user_id, message, type, related_booking_id, status) 
                                 VALUES (?, ?, 'booking_update', ?, 'unread')"
                            );
                            $stmt3->bind_param("isi", $userId, $notificationMessage, $bookingId);
                            $stmt3->execute();
                            $stmt3->close();
                            
                            error_log("Payment successful: payment_intent_id = $paymentIntentId, notification created for booking #$bookingId");
                        } else {
                            error_log("Payment successful: payment_intent_id = $paymentIntentId, notification already exists for booking #$bookingId");
                        }
                        $checkStmt->close();
                    }
                    $stmt2->close();
                    
                    // Note: Booking status remains 'Pending' - it will be approved by admin/company later
                }
                $stmt->close();
            }
            break;

        case 'payment.failed':
            // Payment failed
            $paymentIntentId = $eventData['attributes']['payment_intent_id'] ?? $eventData['attributes']['data']['attributes']['payment_intent_id'] ?? null;
            if ($paymentIntentId) {
                
                // Update payment status to 'failed'
                $stmt = $conn->prepare(
                    "UPDATE payments 
                     SET status = 'failed', updated_at = NOW() 
                     WHERE payment_intent_id = ?"
                );
                $stmt->bind_param("s", $paymentIntentId);
                $stmt->execute();
                $stmt->close();
                
                error_log("Payment failed: payment_intent_id = $paymentIntentId");
            }
            break;

        case 'checkout_session.completed':
            // Checkout session completed (user completed the checkout)
            if (isset($eventData['id'])) {
                $checkoutId = $eventData['id'];
                
                // Update payment with checkout session info if needed
                $stmt = $conn->prepare(
                    "UPDATE payments 
                     SET source_id = ?, updated_at = NOW() 
                     WHERE source_id = ?"
                );
                $stmt->bind_param("ss", $checkoutId, $checkoutId);
                $stmt->execute();
                $stmt->close();
            }
            break;

        default:
            error_log("Unhandled webhook event type: $eventType");
    }

    $conn->close();

    // Return success response
    http_response_code(200);
    echo json_encode(['status' => 'success', 'message' => 'Webhook processed']);

} catch (Exception $e) {
    error_log('Webhook error: ' . $e->getMessage());
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>

