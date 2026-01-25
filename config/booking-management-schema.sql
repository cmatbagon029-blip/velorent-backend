-- Database schema for booking management features
-- Run this script to add the required tables for reschedule/cancellation requests

USE velorent;

-- Company Policies table
CREATE TABLE IF NOT EXISTS company_policies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    reschedule_terms TEXT,
    cancellation_terms TEXT,
    refund_terms TEXT,
    allow_reschedule BOOLEAN DEFAULT TRUE,
    allow_cancellation BOOLEAN DEFAULT TRUE,
    allow_refund BOOLEAN DEFAULT TRUE,
    reschedule_free_days INT DEFAULT 3 COMMENT 'Number of days before booking where reschedule is free',
    reschedule_fee_percentage DECIMAL(5,2) DEFAULT 10.00 COMMENT 'Percentage fee for reschedule after free period',
    cancellation_fee_percentage DECIMAL(5,2) DEFAULT 20.00 COMMENT 'Percentage fee for cancellation',
    deposit_refundable BOOLEAN DEFAULT FALSE COMMENT 'Whether deposits are refundable',
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE KEY unique_company_policy (company_id)
);

-- Requests table for reschedule and cancellation requests
CREATE TABLE IF NOT EXISTS requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    company_id INT NOT NULL,
    booking_id INT NOT NULL,
    request_type ENUM('reschedule', 'cancellation') NOT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    reason TEXT,
    new_start_date DATE COMMENT 'For reschedule requests',
    new_end_date DATE COMMENT 'For reschedule requests',
    new_rent_time TIME COMMENT 'For reschedule requests',
    computed_fee DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Computed fee based on company policies',
    company_response TEXT COMMENT 'Response from company',
    company_remarks TEXT COMMENT 'Additional remarks from company',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    INDEX idx_user_requests (user_id),
    INDEX idx_company_requests (company_id),
    INDEX idx_booking_requests (booking_id),
    INDEX idx_status (status)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    message TEXT NOT NULL,
    type ENUM('request_update', 'booking_update', 'general') DEFAULT 'general',
    related_request_id INT COMMENT 'If notification is about a request',
    related_booking_id INT COMMENT 'If notification is about a booking',
    status ENUM('read', 'unread') DEFAULT 'unread',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (related_request_id) REFERENCES requests(id) ON DELETE SET NULL,
    FOREIGN KEY (related_booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
    INDEX idx_user_notifications (user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- Insert default policies for existing companies
INSERT INTO company_policies (company_id, reschedule_terms, cancellation_terms, refund_terms, allow_reschedule, allow_cancellation, allow_refund, reschedule_free_days, reschedule_fee_percentage, cancellation_fee_percentage, deposit_refundable)
SELECT 
    id,
    'Rescheduling is free if requested at least 3 days before the booking start date. A fee of 10% applies for rescheduling requests made within 3 days of the booking.',
    'Cancellation is allowed up to 24 hours before booking. A cancellation fee of 20% applies. Cancellations within 24 hours are non-refundable.',
    'Deposits and reservation fees are non-refundable. Full refunds are only available for cancellations made more than 7 days in advance.',
    TRUE,
    TRUE,
    FALSE,
    3,
    10.00,
    20.00,
    FALSE
FROM companies
WHERE id NOT IN (SELECT company_id FROM company_policies);

