-- ==========================================================
-- VELORENT SYSTEM UPDATE: DYNAMIC FEES & SETTINGS
-- RUN THIS IN PHPMYADMIN (CPANEL)
-- ==========================================================

-- 1. Create system_settings table to store dynamic percentages
CREATE TABLE IF NOT EXISTS `system_settings` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `setting_key` VARCHAR(100) NOT NULL UNIQUE,
    `setting_value` TEXT NOT NULL,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Insert default fee percentages (12% booking, 2% processing)
INSERT IGNORE INTO `system_settings` (`setting_key`, `setting_value`) VALUES 
('booking_fee_percent', '12'),
('processing_fee_percent', '2');

-- 3. Update bookings table to store the calculated fee amounts
-- We use a check to avoid errors if the columns already exist
SET @dbname = DATABASE();
SET @tablename = 'bookings';
SET @columnname = 'booking_fee';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname
     AND TABLE_NAME = @tablename
     AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE bookings ADD COLUMN booking_fee DECIMAL(10,2) DEFAULT 0.00'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @columnname = 'paymongo_fee';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname
     AND TABLE_NAME = @tablename
     AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE bookings ADD COLUMN paymongo_fee DECIMAL(10,2) DEFAULT 0.00'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verification Check
SELECT * FROM system_settings;
DESCRIBE bookings;
