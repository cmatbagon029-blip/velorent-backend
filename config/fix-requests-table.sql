-- Fix requests table - add missing columns
USE velorent;

-- Add missing columns to requests table (without AFTER clause to avoid errors)
ALTER TABLE requests 
ADD COLUMN new_start_date DATE COMMENT 'For reschedule requests',
ADD COLUMN new_end_date DATE COMMENT 'For reschedule requests',
ADD COLUMN new_rent_time TIME COMMENT 'For reschedule requests',
ADD COLUMN computed_fee DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Computed fee based on company policies',
ADD COLUMN company_response TEXT COMMENT 'Response from company';

