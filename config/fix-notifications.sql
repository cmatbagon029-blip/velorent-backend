-- Update notifications table to match expected schema
USE velorent;

-- Add missing columns to notifications table
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS type ENUM('request_update', 'booking_update', 'general') DEFAULT 'general' AFTER message,
ADD COLUMN IF NOT EXISTS related_request_id INT COMMENT 'If notification is about a request' AFTER type,
ADD COLUMN IF NOT EXISTS related_booking_id INT COMMENT 'If notification is about a booking' AFTER related_request_id;

-- Add foreign keys if they don't exist
-- Note: MySQL doesn't support IF NOT EXISTS for foreign keys, so we'll check first
SET @dbname = DATABASE();
SET @tablename = 'notifications';

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_user_notifications ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_status_notifications ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_created_at_notifications ON notifications(created_at);

SELECT 'Notifications migration completed successfully!' AS result;

