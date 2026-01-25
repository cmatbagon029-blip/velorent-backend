-- Migration script to add missing columns for booking management
-- Run this with: mysql -u root -p velorent < backend/config/migrate-database.sql

USE velorent;

-- Add missing columns to requests table
ALTER TABLE requests 
ADD COLUMN new_start_date DATE COMMENT 'For reschedule requests' AFTER reason,
ADD COLUMN new_end_date DATE COMMENT 'For reschedule requests' AFTER new_start_date,
ADD COLUMN new_rent_time TIME COMMENT 'For reschedule requests' AFTER new_end_date,
ADD COLUMN computed_fee DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Computed fee based on company policies' AFTER new_rent_time,
ADD COLUMN company_response TEXT COMMENT 'Response from company' AFTER computed_fee;

-- Add indexes to requests table
CREATE INDEX idx_user_requests ON requests(user_id);
CREATE INDEX idx_company_requests ON requests(company_id);
CREATE INDEX idx_booking_requests ON requests(booking_id);
CREATE INDEX idx_status ON requests(status);

-- Update company_policies table
ALTER TABLE company_policies 
ADD COLUMN reschedule_terms TEXT AFTER cancellation_policy,
ADD COLUMN cancellation_terms TEXT AFTER reschedule_terms,
ADD COLUMN refund_terms TEXT AFTER cancellation_terms,
ADD COLUMN allow_reschedule BOOLEAN DEFAULT TRUE AFTER refund_terms,
ADD COLUMN allow_cancellation BOOLEAN DEFAULT TRUE AFTER allow_reschedule,
ADD COLUMN allow_refund BOOLEAN DEFAULT TRUE AFTER allow_cancellation,
ADD COLUMN reschedule_free_days INT DEFAULT 3 COMMENT 'Number of days before booking where reschedule is free' AFTER allow_refund,
ADD COLUMN reschedule_fee_percentage DECIMAL(5,2) DEFAULT 10.00 COMMENT 'Percentage fee for reschedule after free period' AFTER reschedule_free_days,
ADD COLUMN cancellation_fee_percentage DECIMAL(5,2) DEFAULT 20.00 COMMENT 'Percentage fee for cancellation' AFTER reschedule_fee_percentage,
ADD COLUMN deposit_refundable BOOLEAN DEFAULT FALSE COMMENT 'Whether deposits are refundable' AFTER cancellation_fee_percentage,
ADD COLUMN last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER deposit_refundable;

-- Copy data from old columns to new columns in company_policies
UPDATE company_policies 
SET reschedule_terms = reschedule_policy 
WHERE reschedule_terms IS NULL AND reschedule_policy IS NOT NULL;

UPDATE company_policies 
SET cancellation_terms = cancellation_policy 
WHERE cancellation_terms IS NULL AND cancellation_policy IS NOT NULL;

UPDATE company_policies 
SET refund_terms = refund_policy 
WHERE refund_terms IS NULL AND refund_policy IS NOT NULL;

UPDATE company_policies 
SET allow_reschedule = enable_reschedule 
WHERE allow_reschedule IS NULL AND enable_reschedule IS NOT NULL;

UPDATE company_policies 
SET allow_cancellation = enable_cancellation 
WHERE allow_cancellation IS NULL AND enable_cancellation IS NOT NULL;

UPDATE company_policies 
SET allow_refund = enable_refund 
WHERE allow_refund IS NULL AND enable_refund IS NOT NULL;

-- Update notifications table
ALTER TABLE notifications 
ADD COLUMN type ENUM('request_update', 'booking_update', 'general') DEFAULT 'general' AFTER message,
ADD COLUMN related_request_id INT COMMENT 'If notification is about a request' AFTER type,
ADD COLUMN related_booking_id INT COMMENT 'If notification is about a booking' AFTER related_request_id;

-- Add indexes to notifications
CREATE INDEX idx_user_notifications ON notifications(user_id);
CREATE INDEX idx_status_notifications ON notifications(status);
CREATE INDEX idx_created_at_notifications ON notifications(created_at);

SELECT 'Migration completed successfully!' AS result;

