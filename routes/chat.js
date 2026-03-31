const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { createConnection } = require('../utils/db');

// Start or get a conversation
router.post('/start', auth.verifyToken, async (req, res) => {
  let connection;
  try {
    const { company_id, vehicle_id } = req.body;
    const user_id = req.user.userId;

    if (!company_id) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    connection = await createConnection();

    // Check if conversation already exists
    let sql = 'SELECT * FROM conversations WHERE user_id = ? AND company_id = ?';
    let params = [user_id, company_id];

    if (vehicle_id) {
      sql += ' AND vehicle_id = ?';
      params.push(vehicle_id);
    } else {
      sql += ' AND vehicle_id IS NULL';
    }

    const [conversations] = await connection.execute(sql, params);

    if (conversations.length > 0) {
      return res.json(conversations[0]);
    }

    // Create new conversation
    const [result] = await connection.execute(
      'INSERT INTO conversations (user_id, company_id, vehicle_id, updated_at) VALUES (?, ?, ?, NOW())',
      [user_id, company_id, vehicle_id || null]
    );

    const [newConversation] = await connection.execute(
      'SELECT * FROM conversations WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json(newConversation[0]);
  } catch (error) {
    console.error('Error starting conversation:', error);
    res.status(500).json({ error: 'Failed to start conversation', details: error.message });
  } finally {
    if (connection) await connection.end();
  }
});

// Get all conversations for the authenticated user
router.get('/conversations', auth.verifyToken, async (req, res) => {
  let connection;
  try {
    connection = await createConnection();

    const [conversations] = await connection.execute(
      `SELECT c.*, co.company_name, co.company_logo, v.name as vehicle_name, v.image_path as vehicle_image
       FROM conversations c
       JOIN companies co ON c.company_id = co.id
       LEFT JOIN vehicles v ON c.vehicle_id = v.id
       WHERE c.user_id = ?
       ORDER BY c.updated_at DESC`,
      [req.user.userId]
    );

    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  } finally {
    if (connection) await connection.end();
  }
});

// Get history for a specific conversation
router.get('/messages/:conversationId', auth.verifyToken, async (req, res) => {
  let connection;
  try {
    connection = await createConnection();

    // Verify ownership
    const [conversations] = await connection.execute(
      'SELECT id FROM conversations WHERE id = ? AND user_id = ?',
      [req.params.conversationId, req.user.userId]
    );

    if (conversations.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [messages] = await connection.execute(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [req.params.conversationId]
    );

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  } finally {
    if (connection) await connection.end();
  }
});

// Send a message
router.post('/send', auth.verifyToken, async (req, res) => {
  let connection;
  try {
    const { conversation_id, message } = req.body;
    const user_id = req.user.userId;

    if (!conversation_id || !message) {
      return res.status(400).json({ error: 'Conversation ID and message are required' });
    }

    connection = await createConnection();

    // Verify ownership
    const [conversations] = await connection.execute(
      'SELECT id FROM conversations WHERE id = ? AND user_id = ?',
      [conversation_id, user_id]
    );

    if (conversations.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Insert message
    const [result] = await connection.execute(
      'INSERT INTO messages (conversation_id, sender_id, sender_role, message) VALUES (?, ?, ?, ?)',
      [conversation_id, user_id, 'user', message]
    );

    // Update conversation timestamp and last message
    await connection.execute(
      'UPDATE conversations SET last_message = ?, updated_at = NOW() WHERE id = ?',
      [message, conversation_id]
    );

    const [newMessage] = await connection.execute(
      'SELECT * FROM messages WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json(newMessage[0]);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  } finally {
    if (connection) await connection.end();
  }
});

module.exports = router;
