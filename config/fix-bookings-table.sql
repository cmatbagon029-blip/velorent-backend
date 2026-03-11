-- Migration script to add missing columns to the bookings table
USE velorent;

-- Add cost and payment related columns
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS total_cost DECIMAL(10,2) DEFAULT 0.00 AFTER status,
ADD COLUMN IF NOT EXISTS down_payment DECIMAL(10,2) DEFAULT 0.00 AFTER total_cost,
ADD COLUMN IF NOT EXISTS remaining_amount DECIMAL(10,2) DEFAULT 0.00 AFTER down_payment,
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) AFTER remaining_amount,
ADD COLUMN IF NOT EXISTS payment_status ENUM('pending', 'paid', 'failed') DEFAULT 'pending' AFTER payment_method,
ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(100) AFTER payment_status,
ADD COLUMN IF NOT EXISTS transaction_date DATETIME AFTER transaction_id,
ADD COLUMN IF NOT EXISTS reference_number VARCHAR(255) AFTER transaction_date,
ADD COLUMN IF NOT EXISTS notification_sent TINYINT(1) DEFAULT 0 AFTER reference_number;

-- Add driver related columns
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS driver_id INT AFTER notification_sent,
ADD COLUMN IF NOT EXISTS driver_name VARCHAR(255) AFTER driver_id,
ADD COLUMN IF NOT EXISTS driver_phone VARCHAR(50) AFTER driver_name,
ADD COLUMN IF NOT EXISTS driver_experience VARCHAR(255) AFTER driver_phone;

-- Ensure service_type supports the enum values used in code
ALTER TABLE bookings 
MODIFY COLUMN service_type ENUM('with_driver', 'without_driver', 'Pick-up/Drop-off', 'Self-drive') DEFAULT 'Self-drive';

SELECT 'Bookings table schema fix completed successfully!' AS result;
