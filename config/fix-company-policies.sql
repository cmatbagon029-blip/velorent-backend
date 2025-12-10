-- Update company_policies table to match expected schema
USE velorent;

-- Check if table exists and add missing columns
SET @dbname = DATABASE();
SET @tablename = 'company_policies';

-- Add reschedule_terms if it doesn't exist (rename from reschedule_policy if needed)
SET @columnname = 'reschedule_terms';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 'Column reschedule_terms already exists.' AS result;",
  "ALTER TABLE company_policies ADD COLUMN reschedule_terms TEXT AFTER cancellation_policy;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Copy data from reschedule_policy to reschedule_terms if reschedule_policy exists
UPDATE company_policies 
SET reschedule_terms = reschedule_policy 
WHERE reschedule_terms IS NULL AND reschedule_policy IS NOT NULL;

-- Add cancellation_terms
SET @columnname = 'cancellation_terms';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 'Column cancellation_terms already exists.' AS result;",
  "ALTER TABLE company_policies ADD COLUMN cancellation_terms TEXT AFTER reschedule_terms;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Copy data from cancellation_policy to cancellation_terms
UPDATE company_policies 
SET cancellation_terms = cancellation_policy 
WHERE cancellation_terms IS NULL AND cancellation_policy IS NOT NULL;

-- Add refund_terms
SET @columnname = 'refund_terms';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 'Column refund_terms already exists.' AS result;",
  "ALTER TABLE company_policies ADD COLUMN refund_terms TEXT AFTER cancellation_terms;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Copy data from refund_policy to refund_terms
UPDATE company_policies 
SET refund_terms = refund_policy 
WHERE refund_terms IS NULL AND refund_policy IS NOT NULL;

-- Add allow_reschedule (rename from enable_reschedule if needed)
SET @columnname = 'allow_reschedule';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 'Column allow_reschedule already exists.' AS result;",
  "ALTER TABLE company_policies ADD COLUMN allow_reschedule BOOLEAN DEFAULT TRUE AFTER refund_terms;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Copy data from enable_reschedule to allow_reschedule
UPDATE company_policies 
SET allow_reschedule = enable_reschedule 
WHERE allow_reschedule IS NULL AND enable_reschedule IS NOT NULL;

-- Add allow_cancellation
SET @columnname = 'allow_cancellation';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 'Column allow_cancellation already exists.' AS result;",
  "ALTER TABLE company_policies ADD COLUMN allow_cancellation BOOLEAN DEFAULT TRUE AFTER allow_reschedule;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Copy data from enable_cancellation to allow_cancellation
UPDATE company_policies 
SET allow_cancellation = enable_cancellation 
WHERE allow_cancellation IS NULL AND enable_cancellation IS NOT NULL;

-- Add allow_refund
SET @columnname = 'allow_refund';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 'Column allow_refund already exists.' AS result;",
  "ALTER TABLE company_policies ADD COLUMN allow_refund BOOLEAN DEFAULT TRUE AFTER allow_cancellation;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Copy data from enable_refund to allow_refund
UPDATE company_policies 
SET allow_refund = enable_refund 
WHERE allow_refund IS NULL AND enable_refund IS NOT NULL;

-- Add fee-related columns
ALTER TABLE company_policies 
ADD COLUMN IF NOT EXISTS reschedule_free_days INT DEFAULT 3 COMMENT 'Number of days before booking where reschedule is free' AFTER allow_refund,
ADD COLUMN IF NOT EXISTS reschedule_fee_percentage DECIMAL(5,2) DEFAULT 10.00 COMMENT 'Percentage fee for reschedule after free period' AFTER reschedule_free_days,
ADD COLUMN IF NOT EXISTS cancellation_fee_percentage DECIMAL(5,2) DEFAULT 20.00 COMMENT 'Percentage fee for cancellation' AFTER reschedule_fee_percentage,
ADD COLUMN IF NOT EXISTS deposit_refundable BOOLEAN DEFAULT FALSE COMMENT 'Whether deposits are refundable' AFTER cancellation_fee_percentage,
ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER deposit_refundable;

SELECT 'Company policies migration completed successfully!' AS result;

