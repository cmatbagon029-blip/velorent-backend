/**
 * Test script for PayMongo payment integration
 * This helps verify the payment endpoint is working
 * 
 * Usage: node test-payment.js
 * 
 * Note: You'll need a valid JWT token from your auth endpoint
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3000';
const TEST_TOKEN = 'YOUR_JWT_TOKEN_HERE'; // Get this from login endpoint
const TEST_BOOKING_ID = 1; // Use an actual booking ID from your database
const TEST_AMOUNT = 5000; // Test amount in PHP (₱5,000.00)

async function testPayment() {
  try {
    console.log('🧪 Testing PayMongo Payment Integration...\n');

    // Test 1: Create payment
    console.log('1. Testing POST /api/payments/create-payment');
    console.log(`   Amount: ₱${TEST_AMOUNT.toLocaleString()}`);
    console.log(`   Booking ID: ${TEST_BOOKING_ID}\n`);

    if (TEST_TOKEN === 'YOUR_JWT_TOKEN_HERE') {
      console.log('❌ Please update TEST_TOKEN with a valid JWT token from your login endpoint');
      return;
    }

    const response = await axios.post(
      `${API_BASE_URL}/api/payments/create-payment`,
      {
        amount: TEST_AMOUNT,
        booking_id: TEST_BOOKING_ID
      },
      {
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Payment created successfully!');
    console.log('   Response:', JSON.stringify(response.data, null, 2));
    console.log(`\n   Checkout URL: ${response.data.checkout_url}`);
    console.log('\n   📱 Open this URL in a browser to test GCash payment\n');

    // Test 2: Check payment status
    console.log('2. Testing GET /api/payments/status/:booking_id');
    const statusResponse = await axios.get(
      `${API_BASE_URL}/api/payments/status/${TEST_BOOKING_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`
        }
      }
    );

    console.log('✅ Payment status retrieved:');
    console.log('   Status:', JSON.stringify(statusResponse.data, null, 2));

  } catch (error) {
    console.error('\n❌ Test failed!');
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('   Error:', error.message);
    }
    
    if (error.response?.status === 401) {
      console.error('\n💡 Tip: Make sure you have a valid JWT token');
      console.error('   Get one by logging in via POST /api/auth/login');
    }
    
    if (error.response?.status === 500 && error.response.data?.error?.includes('PayMongo')) {
      console.error('\n💡 Tip: Check your PayMongo secret key in config.env');
    }
  }
}

// Run the test
testPayment();

