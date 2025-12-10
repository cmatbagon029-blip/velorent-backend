-- Add missing columns to requests table
USE velorent;

-- Check if columns exist before adding them
SET @dbname = DATABASE();
SET @tablename = 'requests';
SET @columnname = 'new_start_date';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 'Column new_start_date already exists.' AS result;",
  "ALTER TABLE requests ADD COLUMN new_start_date DATE COMMENT 'For reschedule requests' AFTER reason;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = 'new_end_date';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 'Column new_end_date already exists.' AS result;",
  "ALTER TABLE requests ADD COLUMN new_end_date DATE COMMENT 'For reschedule requests' AFTER new_start_date;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = 'new_rent_time';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 'Column new_rent_time already exists.' AS result;",
  "ALTER TABLE requests ADD COLUMN new_rent_time TIME COMMENT 'For reschedule requests' AFTER new_end_date;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = 'computed_fee';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 'Column computed_fee already exists.' AS result;",
  "ALTER TABLE requests ADD COLUMN computed_fee DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Computed fee based on company policies' AFTER new_rent_time;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = 'company_response';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 'Column company_response already exists.' AS result;",
  "ALTER TABLE requests ADD COLUMN company_response TEXT COMMENT 'Response from company' AFTER computed_fee;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_requests ON requests(user_id);
CREATE INDEX IF NOT EXISTS idx_company_requests ON requests(company_id);
CREATE INDEX IF NOT EXISTS idx_booking_requests ON requests(booking_id);
CREATE INDEX IF NOT EXISTS idx_status ON requests(status);

SELECT 'Migration completed successfully!' AS result;

