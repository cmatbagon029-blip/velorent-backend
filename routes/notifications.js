const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const auth = require('../middleware/auth');
const { createConnection } = require('../utils/db');

// Get all notifications for the current user
router.get('/my-notifications', auth.verifyToken, async (req, res) => {
  let connection;
  try {
    connection = await createConnection();

    const [notifications] = await connection.execute(
      `SELECT * FROM notifications 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [req.user.userId]
    );

    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ 
      error: 'Failed to fetch notifications',
      details: error.message 
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Get unread notification count
router.get('/unread-count', auth.verifyToken, async (req, res) => {
  let connection;
  try {
    connection = await createConnection();

    const [result] = await connection.execute(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND status = "unread"',
      [req.user.userId]
    );

    res.json({ count: result[0].count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ 
      error: 'Failed to fetch unread count',
      details: error.message 
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Mark notification as read
router.put('/:id/read', auth.verifyToken, async (req, res) => {
  let connection;
  try {
    connection = await createConnection();

    const [result] = await connection.execute(
      'UPDATE notifications SET status = "read" WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ 
      error: 'Failed to mark notification as read',
      details: error.message 
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Mark all notifications as read
router.put('/mark-all-read', auth.verifyToken, async (req, res) => {
  let connection;
  try {
    connection = await createConnection();

    await connection.execute(
      'UPDATE notifications SET status = "read" WHERE user_id = ? AND status = "unread"',
      [req.user.userId]
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ 
      error: 'Failed to mark all notifications as read',
      details: error.message 
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

module.exports = router;

