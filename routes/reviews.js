const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { createConnection } = require('../utils/db');

// Submit a new review
router.post('/', auth.verifyToken, async (req, res) => {
    let connection;
    try {
        const { booking_id, rating, comment } = req.body;
        const user_id = req.user.userId;

        if (!booking_id || !rating) {
            return res.status(400).json({ error: 'Booking ID and rating are required' });
        }

        connection = await createConnection();

        // 1. Verify booking exists and belongs to user
        const [bookings] = await connection.execute(
            'SELECT vehicle_id, company_id, status FROM bookings WHERE id = ? AND user_id = ?',
            [booking_id, user_id]
        );

        if (bookings.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        const booking = bookings[0];

        // 2. Check if already reviewed
        const [existing] = await connection.execute(
            'SELECT id FROM reviews WHERE booking_id = ?',
            [booking_id]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'You have already submitted a review for this booking' });
        }

        // 3. Insert review
        await connection.execute(
            'INSERT INTO reviews (booking_id, user_id, vehicle_id, company_id, rating, comment) VALUES (?, ?, ?, ?, ?, ?)',
            [booking_id, user_id, booking.vehicle_id, booking.company_id, rating, comment || null]
        );

        res.status(201).json({ message: 'Review submitted successfully' });
    } catch (error) {
        console.error('Error submitting review:', error);
        res.status(500).json({ error: 'Failed to submit review', details: error.message });
    } finally {
        if (connection) await connection.end();
    }
});

// Get review for a specific booking
router.get('/booking/:bookingId', auth.verifyToken, async (req, res) => {
    let connection;
    try {
        connection = await createConnection();
        const [reviews] = await connection.execute(
            'SELECT * FROM reviews WHERE booking_id = ?',
            [req.params.bookingId]
        );

        if (reviews.length === 0) {
            return res.json(null);
        }

        res.json(reviews[0]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch review' });
    } finally {
        if (connection) await connection.end();
    }
});

// Get reviews for a specific vehicle
router.get('/vehicle/:vehicleId', async (req, res) => {
    let connection;
    try {
        connection = await createConnection();
        const [reviews] = await connection.execute(
            `SELECT r.*, u.name as user_name 
             FROM reviews r 
             JOIN users u ON r.user_id = u.id 
             WHERE r.vehicle_id = ? 
             ORDER BY r.created_at DESC`,
            [req.params.vehicleId]
        );
        res.json(reviews);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch vehicle reviews' });
    } finally {
        if (connection) await connection.end();
    }
});

// Get reviews for a specific company
router.get('/company/:companyId', async (req, res) => {
    let connection;
    try {
        connection = await createConnection();
        const [reviews] = await connection.execute(
            `SELECT r.*, u.name as user_name, v.model_name as vehicle_name 
             FROM reviews r 
             JOIN users u ON r.user_id = u.id 
             LEFT JOIN vehicles v ON r.vehicle_id = v.id
             WHERE r.company_id = ? 
             ORDER BY r.created_at DESC`,
            [req.params.companyId]
        );
        res.json(reviews);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch company reviews' });
    } finally {
        if (connection) await connection.end();
    }
});

module.exports = router;
