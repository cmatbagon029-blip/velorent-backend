-- Add new lifecycle statuses to bookings table
ALTER TABLE bookings MODIFY COLUMN status ENUM(
    'Pending', 
    'Approved', 
    'Rejected', 
    'Active', 
    'Completed', 
    'Cancelled', 
    'Rented', 
    'Disapproved', 
    'Preparing', 
    'Ready', 
    'Returning', 
    'Returned'
) DEFAULT 'Pending';

-- Optional: Update any empty statuses back to something sensible if they were broken by the previous ENUM mismatch
-- UPDATE bookings SET status = 'Pending' WHERE status = '' OR status IS NULL;
