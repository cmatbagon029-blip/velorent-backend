-- Safe deletion script for booking_requests table
-- This script drops the foreign key constraints first, then deletes the table

USE velorent;

-- Step 1: Find and drop foreign key constraints
-- Find constraint for booking_id
SET @constraint_name1 = (
    SELECT CONSTRAINT_NAME 
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE TABLE_SCHEMA = 'velorent' 
    AND TABLE_NAME = 'booking_requests' 
    AND REFERENCED_TABLE_NAME = 'bookings'
    LIMIT 1
);

-- Find constraint for company_id
SET @constraint_name2 = (
    SELECT CONSTRAINT_NAME 
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE TABLE_SCHEMA = 'velorent' 
    AND TABLE_NAME = 'booking_requests' 
    AND REFERENCED_TABLE_NAME = 'companies'
    LIMIT 1
);

-- Drop booking_id foreign key if it exists
SET @sql1 = IF(@constraint_name1 IS NOT NULL, 
    CONCAT('ALTER TABLE booking_requests DROP FOREIGN KEY ', @constraint_name1), 
    'SELECT "No booking_id foreign key constraint found" as message'
);
PREPARE stmt1 FROM @sql1;
EXECUTE stmt1;
DEALLOCATE PREPARE stmt1;

-- Drop company_id foreign key if it exists
SET @sql2 = IF(@constraint_name2 IS NOT NULL, 
    CONCAT('ALTER TABLE booking_requests DROP FOREIGN KEY ', @constraint_name2), 
    'SELECT "No company_id foreign key constraint found" as message'
);
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- Step 2: Drop the table
DROP TABLE IF EXISTS booking_requests;

SELECT 'booking_requests table deleted successfully' as result;






