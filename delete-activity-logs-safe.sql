-- Safe deletion script for activity_logs table
-- This script drops the foreign key constraint first, then deletes the table

USE velorent;

-- Step 1: Find and drop the foreign key constraint
-- First, let's find the constraint name
SET @constraint_name = (
    SELECT CONSTRAINT_NAME 
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE TABLE_SCHEMA = 'velorent' 
    AND TABLE_NAME = 'activity_logs' 
    AND REFERENCED_TABLE_NAME = 'companies'
    LIMIT 1
);

-- Drop the foreign key if it exists
SET @sql = IF(@constraint_name IS NOT NULL, 
    CONCAT('ALTER TABLE activity_logs DROP FOREIGN KEY ', @constraint_name), 
    'SELECT "No foreign key constraint found" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 2: Drop the table
DROP TABLE IF EXISTS activity_logs;

SELECT 'activity_logs table deleted successfully' as result;






