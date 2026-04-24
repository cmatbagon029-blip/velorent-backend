const express = require('express');
const router = express.Router();
const { createConnection } = require('../utils/db');
const auth = require('../middleware/auth');

// Get all system settings (Public or Auth)
router.get('/', async (req, res) => {
  let connection;
  try {
    connection = await createConnection();
    const [settings] = await connection.execute('SELECT setting_key, setting_value FROM system_settings');
    
    // Format as a simple object
    const settingsObj = {};
    settings.forEach(s => {
      settingsObj[s.setting_key] = s.setting_value;
    });
    
    res.json(settingsObj);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  } finally {
    if (connection) await connection.end();
  }
});

// Update settings (Admin only)
router.post('/update', auth.verifyToken, async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
  }

  let connection;
  try {
    const { settings } = req.body; // Expecting { "key": "value", ... }
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Invalid settings format' });
    }

    connection = await createConnection();
    
    for (const [key, value] of Object.entries(settings)) {
      await connection.execute(
        'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
        [key, value.toString(), value.toString()]
      );
    }

    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  } finally {
    if (connection) await connection.end();
  }
});

module.exports = router;
