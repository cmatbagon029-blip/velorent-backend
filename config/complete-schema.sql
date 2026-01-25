CREATE DATABASE IF NOT EXISTS velorent;
USE velorent;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(255),
    address TEXT,
    contact_person VARCHAR(255),
    company_logo VARCHAR(255),
    image_path VARCHAR(255),
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100),
    price_with_driver DECIMAL(10,2),
    price_without_driver DECIMAL(10,2),
    Owner VARCHAR(255),
    image_path VARCHAR(255),
    company_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    user_name VARCHAR(255) NOT NULL,
    mobile_number VARCHAR(20) NOT NULL,
    vehicle_id INT,
    company_id INT,
    company_name VARCHAR(255),
    vehicle_name VARCHAR(255) NOT NULL,
    service_type ENUM('with_driver', 'without_driver') NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    rent_time TIME,
    destination VARCHAR(255) NOT NULL,
    occasion VARCHAR(255),
    message TEXT,
    valid_id_path VARCHAR(255),
    additional_id_path VARCHAR(255),
    booking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('Pending', 'Approved', 'Rejected', 'Active', 'Completed', 'Cancelled') DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
);

-- Drivers table (if needed)
CREATE TABLE IF NOT EXISTS drivers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    driver_name VARCHAR(255) NOT NULL,
    driver_phone VARCHAR(20),
    driver_fee DECIMAL(10,2),
    company_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
);

-- Insert sample data
INSERT IGNORE INTO users (id, name, email, password, role) VALUES 
(1, 'Admin User', 'admin@velorent.com', '$2b$10$example', 'admin'),
(2, 'Test User', 'user@test.com', '$2b$10$example', 'user');

INSERT IGNORE INTO companies (id, company_name, contact_email, contact_phone, address, contact_person, status) VALUES 
(1, 'ABC Car Rental', 'contact@abccar.com', '+63 912 345 6789', '123 Main St, Ormoc City', 'John Doe', 'approved'),
(2, 'XYZ Vehicle Services', 'info@xyzvehicles.com', '+63 987 654 3210', '456 Business Ave, Ormoc City', 'Jane Smith', 'approved');

INSERT IGNORE INTO vehicles (id, name, type, price_with_driver, price_without_driver, Owner, company_id) VALUES 
(1, 'Toyota Camry', 'sedan', 2500.00, 2000.00, 'ABC Car Rental', 1),
(2, 'Honda Civic', 'sedan', 2200.00, 1800.00, 'ABC Car Rental', 1),
(3, 'Ford Everest', 'suv', 3500.00, 3000.00, 'XYZ Vehicle Services', 2),
(4, 'Toyota Vios', 'sedan', 1800.00, 1500.00, 'XYZ Vehicle Services', 2);
