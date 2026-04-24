-- Migration script to add booking_fee and paymongo_fee to the bookings table
USE velorent;

ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS booking_fee DECIMAL(10,2) DEFAULT 0.00 AFTER remaining_amount,
ADD COLUMN IF NOT EXISTS paymongo_fee DECIMAL(10,2) DEFAULT 0.00 AFTER booking_fee;

SELECT 'Fees columns added successfully!' AS result;
