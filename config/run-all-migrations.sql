-- Run all migrations for booking management system
-- Execute this file to update your database schema

SOURCE add-missing-columns.sql;
SOURCE fix-company-policies.sql;
SOURCE fix-notifications.sql;

SELECT 'All migrations completed!' AS result;

