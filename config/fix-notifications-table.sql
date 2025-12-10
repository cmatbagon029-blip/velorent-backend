-- Fix notifications table - add missing columns
USE velorent;

-- Add missing columns to notifications table
ALTER TABLE notifications 
ADD COLUMN type ENUM('request_update', 'booking_update', 'general') DEFAULT 'general',
ADD COLUMN related_request_id INT COMMENT 'If notification is about a request',
ADD COLUMN related_booking_id INT COMMENT 'If notification is about a booking';

