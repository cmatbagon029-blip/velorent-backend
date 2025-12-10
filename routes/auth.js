const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config');
const router = express.Router();

// Regular login endpoint
router.post('/login', async (req, res) => {
  let connection;
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    connection = await mysql.createConnection({
      host: config.DB_HOST,
      user: config.DB_USER,
      password: config.DB_PASS,
      database: config.DB_NAME
    });

    // Find user by email
    const [users] = await connection.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = users[0];

    // Check if user has a password (not a social login user)
    if (!user.password) {
      return res.status(401).json({
        success: false,
        message: 'This account uses social login. Please use Google or Facebook to sign in.'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        role: user.role 
      },
      'your-secret-key', // Replace with your actual secret key
      { expiresIn: '24h' }
    );

    // Remove sensitive information
    const userResponse = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      created_at: user.created_at
    };

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login',
      error: error.message
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Social login endpoint
router.post('/social-login', async (req, res) => {
  let connection;
  try {
    const { provider, socialId, email, name, picture } = req.body;

    // Validate required fields
    if (!provider || !socialId || !email || !name) {
      return res.status(400).json({ 
        success: false,
        message: 'Missing required social login information'
      });
    }

    connection = await mysql.createConnection({
      host: config.DB_HOST,
      user: config.DB_USER,
      password: config.DB_PASS,
      database: config.DB_NAME
    });

    // Check if user exists with this social ID
    const [existingUsers] = await connection.execute(
      'SELECT * FROM users WHERE social_id = ? AND provider = ?',
      [socialId, provider]
    );

    let user;

    if (existingUsers.length > 0) {
      // User exists, update their information
      user = existingUsers[0];
      
      await connection.execute(
        'UPDATE users SET name = ?, email = ?, picture = ?, updated_at = NOW() WHERE id = ?',
        [name, email, picture, user.id]
      );
      
      // Update user object with new data
      user.name = name;
      user.email = email;
      user.picture = picture;
    } else {
      // Check if user exists with same email
      const [emailUsers] = await connection.execute(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );

      if (emailUsers.length > 0) {
        // Link existing account with social account
        await connection.execute(
          'UPDATE users SET social_id = ?, provider = ?, picture = ?, updated_at = NOW() WHERE id = ?',
          [socialId, provider, picture, emailUsers[0].id]
        );
        user = emailUsers[0];
        user.social_id = socialId;
        user.provider = provider;
        user.picture = picture;
      } else {
        // Create new user
        const [result] = await connection.execute(
          'INSERT INTO users (name, email, social_id, provider, picture, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
          [name, email, socialId, provider, picture]
        );
        
        user = {
          id: result.insertId,
          name,
          email,
          social_id: socialId,
          provider,
          picture,
          created_at: new Date(),
          updated_at: new Date()
        };
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        provider: user.provider 
      },
      'your-secret-key', // Replace with your actual secret key
      { expiresIn: '24h' }
    );

    // Remove sensitive information
    const userResponse = {
        id: user.id,
        name: user.name,
        email: user.email,
      picture: user.picture,
      provider: user.provider,
      created_at: user.created_at
    };

    res.json({
      success: true,
      message: 'Social login successful',
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('Social login error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error during social login',
      error: error.message
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

module.exports = router;