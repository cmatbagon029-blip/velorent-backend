-- Add 'Rented' to bookings status ENUM
ALTER TABLE bookings MODIFY COLUMN status ENUM('Pending', 'Approved', 'Rejected', 'Active', 'Completed', 'Cancelled', 'Rented', 'Disapproved') DEFAULT 'Pending';

-- Ensure vehicles status supports 'currently rented'
ALTER TABLE vehicles MODIFY COLUMN status ENUM('available', 'under maintenance', 'currently rented', 'unavailable') DEFAULT 'available';
