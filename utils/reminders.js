const mysql = require('mysql2/promise');
const config = require('../config');

// Function to calculate if an event is within a specific time window
// Returns true if the target time is within the window from now
function isWithinWindow(targetDateStr, targetTimeStr, hoursWindow) {
    if (!targetDateStr) return false;
    
    try {
        const now = new Date();
        // Construct the target date
        const timeStr = targetTimeStr || '12:00:00'; // Default to noon if no time provided
        // Use YYYY-MM-DD from targetDateStr since it might be a date object
        let datePart = targetDateStr;
        if (typeof targetDateStr === 'object') {
            datePart = targetDateStr.toISOString().split('T')[0];
        } else if (targetDateStr.includes('T')) {
            datePart = targetDateStr.split('T')[0];
        }
        
        const targetDateTime = new Date(`${datePart}T${timeStr}`);
        
        // Calculate the difference in hours
        const diffMs = targetDateTime.getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        
        // Return true if the difference is strictly positive and less than or equal to the window
        // For 24 hours window: 0 < diff <= 24
        // For 3 hours window: 0 < diff <= 3
        return diffHours > 0 && diffHours <= hoursWindow;
    } catch (error) {
        console.error('Error calculating date difference:', error);
        return false;
    }
}

async function processReminders() {
    console.log('[Reminders] Checking for upcoming rental deadlines...');
    let connection;
    try {
        connection = await mysql.createConnection({
            host: config.DB_HOST,
            user: config.DB_USER,
            password: config.DB_PASS,
            database: config.DB_NAME
        });

        // Fetch bookings that are currently ongoing
        const [bookings] = await connection.execute(
            `SELECT b.id, b.user_id, b.company_id, b.vehicle_name, b.end_date, b.rent_time, 
                    b.reminder_24h_sent, b.reminder_3h_sent
             FROM bookings b
             WHERE b.status IN ('Approved', 'Rented', 'Active')
               AND b.end_date >= CURDATE()
               AND (b.reminder_24h_sent = 0 OR b.reminder_3h_sent = 0)`
        );

        if (bookings.length === 0) {
            return; // Nothing to process
        }

        for (const booking of bookings) {
            const { id, user_id, company_id, vehicle_name, end_date, rent_time, reminder_24h_sent, reminder_3h_sent } = booking;
            
            // Format time string for messages (e.g. "15:00:00" -> "3:00 PM")
            let formattedTime = '12:00 PM';
            if (rent_time) {
                try {
                    const [hours, minutes] = rent_time.split(':');
                    const h = parseInt(hours, 10);
                    const ampm = h >= 12 ? 'PM' : 'AM';
                    const h12 = h % 12 || 12;
                    formattedTime = `${h12}:${minutes} ${ampm}`;
                } catch (e) {
                    console.error('Error formatting time', rent_time);
                }
            }

            // Check 24-hour reminder
            if (reminder_24h_sent == 0 && isWithinWindow(end_date, rent_time, 24)) {
                console.log(`[Reminders] Sending 24h reminder for booking #${id}`);
                const message = `Your rental for ${vehicle_name} ends tomorrow at ${formattedTime}. Please prepare for return.`;
                const companyMsg = `Rental for ${vehicle_name} (Booking #${id}) ends tomorrow at ${formattedTime}.`;
                
                // Notify Customer
                await connection.execute(
                    `INSERT INTO notifications (user_id, message, type, related_booking_id, status)
                     VALUES (?, ?, 'booking_update', ?, 'unread')`,
                    [user_id, message, id]
                );

                // Notify Company
                await connection.execute(
                    `INSERT INTO company_notifications (company_id, related_booking_id, message, is_read)
                     VALUES (?, ?, ?, 0)`,
                    [company_id, id, companyMsg]
                );

                // Mark as sent
                await connection.execute(
                    `UPDATE bookings SET reminder_24h_sent = 1 WHERE id = ?`,
                    [id]
                );
            }
            
            // Check 3-hour reminder
            else if (reminder_3h_sent == 0 && isWithinWindow(end_date, rent_time, 3)) {
                console.log(`[Reminders] Sending 3h reminder for booking #${id}`);
                const message = `Your rental for ${vehicle_name} ends soon (at ${formattedTime}). Please prepare for return.`;
                const companyMsg = `Rental for ${vehicle_name} (Booking #${id}) ends in a few hours (at ${formattedTime}).`;
                
                // Notify Customer
                await connection.execute(
                    `INSERT INTO notifications (user_id, message, type, related_booking_id, status)
                     VALUES (?, ?, 'booking_update', ?, 'unread')`,
                    [user_id, message, id]
                );

                // Notify Company
                await connection.execute(
                    `INSERT INTO company_notifications (company_id, related_booking_id, message, is_read)
                     VALUES (?, ?, ?, 0)`,
                    [company_id, id, companyMsg]
                );

                // Mark as sent
                await connection.execute(
                    `UPDATE bookings SET reminder_3h_sent = 1 WHERE id = ?`,
                    [id]
                );
            }
        }
    } catch (error) {
        // Ignore table not found errors since the migration might not have been run yet
        if (error.code !== 'ER_NO_SUCH_TABLE' && error.code !== 'ER_BAD_FIELD_ERROR') {
            console.error('[Reminders] Error processing reminders:', error);
        } else {
            console.log('[Reminders] Waiting for database migration (run update_reminders_db.php)...');
        }
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Start the periodic task (run every 15 minutes)
function startReminderService() {
    console.log('[Reminders] Proactive reminder service started.');
    // Run immediately on start
    processReminders();
    // Then run every 15 minutes
    setInterval(processReminders, 15 * 60 * 1000);
}

module.exports = {
    startReminderService,
    processReminders // Exported for manual trigger testing if needed
};
