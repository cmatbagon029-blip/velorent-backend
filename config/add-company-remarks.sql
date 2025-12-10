-- Add company_remarks column to requests table
-- Run this with: mysql -u root -p velorent < backend/config/add-company-remarks.sql

USE velorent;

-- Add company_remarks column if it doesn't exist
ALTER TABLE requests 
ADD COLUMN company_remarks TEXT COMMENT 'Additional remarks from company' AFTER company_response;

