-- Migration script to allow multiple conversations
-- Drop the unique constraint
ALTER TABLE conversations DROP INDEX unique_chat;

-- Add a standard index for performance
CREATE INDEX idx_chat_triplet ON conversations(user_id, company_id, vehicle_id);
