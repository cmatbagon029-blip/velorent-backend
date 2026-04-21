const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const config = require('../config');
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

    // Check if there is an active conversation from today
    let sql = 'SELECT * FROM conversations WHERE user_id = ? AND company_id = ?';
    let params = [user_id, company_id];

    if (vehicle_id) {
      sql += ' AND vehicle_id = ?';
      params.push(vehicle_id);
    } else {
      sql += ' AND vehicle_id IS NULL';
    }

    // Order by updated_at to get the most recent one where not deleted by user
    sql += ' AND deleted_by_user = 0 ORDER BY updated_at DESC LIMIT 1';

    const [conversations] = await connection.execute(sql, params);

    if (conversations.length > 0) {
      const lastConv = conversations[0];
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
      const lastUpdate = new Date(lastConv.updated_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

      // If the last conversation was from today, reuse it
      if (today === lastUpdate) {
        // Transform image paths to full URLs
        if (lastConv.company_logo) lastConv.company_logo = config.getS3Url(lastConv.company_logo);
        if (lastConv.vehicle_image) lastConv.vehicle_image = config.getS3Url(lastConv.vehicle_image);
        
        return res.json(lastConv);
      }
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

    const conversation = newConversation[0];
    
    // Transform image paths to full URLs
    if (conversation.company_logo) conversation.company_logo = config.getS3Url(conversation.company_logo);
    if (conversation.vehicle_image) conversation.vehicle_image = config.getS3Url(conversation.vehicle_image);
    
    res.status(201).json(conversation);
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
      `SELECT c.*, co.company_name, co.company_logo, v.name as vehicle_name, v.image_path as vehicle_image,
       (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_role = 'company' AND m.is_read = 0 AND m.deleted_by_user = 0) as unread_count
       FROM conversations c
       JOIN companies co ON c.company_id = co.id
       LEFT JOIN vehicles v ON c.vehicle_id = v.id
       WHERE c.user_id = ? AND c.deleted_by_user = 0
       ORDER BY c.updated_at DESC`,
      [req.user.userId]
    );

    // Transform image paths to full URLs
    const transformedConversations = conversations.map(conv => ({
      ...conv,
      company_logo: conv.company_logo ? config.getS3Url(conv.company_logo) : null,
      vehicle_image: conv.vehicle_image ? config.getS3Url(conv.vehicle_image) : null
    }));

    res.json(transformedConversations);
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

    // Mark company messages as read
    await connection.execute(
      "UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND sender_role = 'company' AND is_read = 0 AND deleted_by_user = 0",
      [req.params.conversationId]
    );

    const [messages] = await connection.execute(
      'SELECT * FROM messages WHERE conversation_id = ? AND deleted_by_user = 0 ORDER BY created_at ASC',
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

// Delete a message
router.delete('/messages/:id', auth.verifyToken, async (req, res) => {
  let connection;
  try {
    connection = await createConnection();
    const messageId = req.params.id;
    const userId = req.user.userId;
    const userRole = req.user.role; // 'user' or 'company'
    const deleteType = req.body.delete_type || 'me'; // 'me' or 'everyone'

    // Check if the message exists and belongs to the sender
    const [messages] = await connection.execute(
      'SELECT * FROM messages WHERE id = ?',
      [messageId]
    );

    if (messages.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const message = messages[0];
    
    if (deleteType === 'everyone') {
      // Only sender can delete for everyone
      if (message.sender_role !== userRole || message.sender_id !== userId) {
        return res.status(403).json({ error: 'Only the sender can delete this message for everyone' });
      }
      // Update message as unsent instead of deleting row
      await connection.execute(
        "UPDATE messages SET is_unsent = 1, message = 'This message was unsent' WHERE id = ?", 
        [messageId]
      );
    } else {
      // Delete for me (logical)
      if (userRole === 'user') {
        await connection.execute('UPDATE messages SET deleted_by_user = 1 WHERE id = ?', [messageId]);
      } else {
        await connection.execute('UPDATE messages SET deleted_by_company = 1 WHERE id = ?', [messageId]);
      }
    }

    res.json({ success: true, message: `Message deleted for ${deleteType === 'everyone' ? 'everyone' : 'you'}` });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  } finally {
    if (connection) await connection.end();
  }
});

// Delete a conversation
router.delete('/conversations/:id', auth.verifyToken, async (req, res) => {
  let connection;
  try {
    connection = await createConnection();
    const conversationId = req.params.id;
    const userId = req.user.userId;
    const userRole = req.user.role;
    const deleteType = req.body.delete_type || 'me';

    if (deleteType === 'everyone') {
      // Verify user participates in conversation (or is authorized)
      const [convs] = await connection.execute(
        'SELECT * FROM conversations WHERE id = ? AND user_id = ?',
        [conversationId, userId]
      );
      if (convs.length === 0) return res.status(403).json({ error: 'Access denied' });

      await connection.execute('DELETE FROM conversations WHERE id = ?', [conversationId]);
    } else {
      // Mark as deleted for user
      await connection.execute('UPDATE conversations SET deleted_by_user = 1 WHERE id = ?', [conversationId]);
    }

    res.json({ success: true, message: `Conversation deleted for ${deleteType === 'everyone' ? 'everyone' : 'you'}` });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  } finally {
    if (connection) await connection.end();
  }
});

module.exports = router;
