-- Migration script to extract admin remarks from reason field to company_remarks
-- Run this with: mysql -u root -p velorent < backend/config/migrate-admin-remarks.sql

USE velorent;

-- First, ensure company_remarks column exists
ALTER TABLE requests 
ADD COLUMN IF NOT EXISTS company_remarks TEXT COMMENT 'Additional remarks from company' AFTER company_response;

-- Update existing records: extract admin remarks from reason field
UPDATE requests 
SET company_remarks = TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(reason, '[Admin Remarks]:', -1), '\n', 1)),
    reason = TRIM(REPLACE(REPLACE(reason, CONCAT('[Admin Remarks]:', TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(reason, '[Admin Remarks]:', -1), '\n', 1))), ''), '[Admin Remarks]:', ''))
WHERE reason LIKE '%[Admin Remarks]:%'
  AND (company_remarks IS NULL OR company_remarks = '');

