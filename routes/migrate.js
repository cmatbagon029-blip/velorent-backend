const express = require('express');
const router = express.Router();
const { createConnection } = require('../utils/db');

// Secure this in a real production environment with a secret key
// For this immediate migration, we'll expose it and then you should remove it
router.post('/run-production-migration', async (req, res) => {
    let connection;
    try {
        const secret = req.body.secret;
        // Simple security check to prevent random visitors from running this
        if (secret !== 'velorent_migrate_production_2026') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        connection = await createConnection();

        console.log('Starting production database migration...');

        // 1. Create reviews table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS reviews (
                id INT AUTO_INCREMENT PRIMARY KEY,
                booking_id INT NOT NULL,
                user_id INT NOT NULL,
                vehicle_id INT NOT NULL,
                company_id INT NOT NULL,
                rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
                comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                UNIQUE KEY unique_booking_review (booking_id)
            )
        `);
        console.log('✓ Checked/Created reviews table');

        // 2. Create company_notifications table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS company_notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                booking_id INT,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                type VARCHAR(50) NOT NULL DEFAULT 'system',
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✓ Checked/Created company_notifications table');

        // 3. Add reminder columns to bookings table
        // We catch errors in case the columns already exist
        try {
            await connection.execute(`ALTER TABLE bookings ADD COLUMN reminder_24h_sent TINYINT(1) DEFAULT 0`);
            console.log('✓ Added reminder_24h_sent to bookings');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('✓ reminder_24h_sent already exists');
            } else {
                throw e;
            }
        }

        try {
            await connection.execute(`ALTER TABLE bookings ADD COLUMN reminder_3h_sent TINYINT(1) DEFAULT 0`);
            console.log('✓ Added reminder_3h_sent to bookings');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('✓ reminder_3h_sent already exists');
            } else {
                throw e;
            }
        }

        res.json({ success: true, message: 'Production database migration completed successfully' });
    } catch (error) {
        console.error('Migration failed:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});

module.exports = router;
