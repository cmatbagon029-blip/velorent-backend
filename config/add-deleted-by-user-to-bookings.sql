-- Migration to add deleted_by_user to bookings table
USE velorent;

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS deleted_by_user TINYINT(1) DEFAULT 0;

SELECT 'Added deleted_by_user column to bookings table' AS result;
