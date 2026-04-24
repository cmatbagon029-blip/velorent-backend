const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { createConnection } = require('../utils/db');
const config = require('../config');
const { verifyToken } = require('../middleware/auth');
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

    connection = await createConnection();

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
    const jwtSecret = process.env.JWT_SECRET || config.JWT_SECRET || 'your-secret-key';
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      jwtSecret,
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

// Register endpoint (added to fix 404)
router.post('/register', async (req, res) => {
  let connection;
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required'
      });
    }

    connection = await createConnection();

    // Check if user already exists
    const [existingUsers] = await connection.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email address is already registered'
      });
    }

    // Hash the password securely
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert new user into database
    const [result] = await connection.execute(
      'INSERT INTO users (name, email, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
      [name, email, hashedPassword, 'client']
    );

    // Generate JWT token automatically on successful signup
    const jwtSecret = process.env.JWT_SECRET || config.JWT_SECRET || 'your-secret-key';
    const token = jwt.sign(
      {
        userId: result.insertId,
        email: email,
        role: 'client'
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Registration successful',
      token,
      user: {
        id: result.insertId,
        name,
        email,
        role: 'client'
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during registration',
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

    connection = await createConnection();

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
    const jwtSecret = process.env.JWT_SECRET || config.JWT_SECRET || 'your-secret-key';
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        provider: user.provider
      },
      jwtSecret,
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


// Get user profile
router.get('/profile', verifyToken, async (req, res) => {
  let connection;
  try {
    connection = await createConnection();
    const [users] = await connection.execute(
      'SELECT id, name, email, phone, address, picture, role, provider, created_at FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user: users[0] });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    if (connection) await connection.end();
  }
});

// Update user profile
router.put('/profile', verifyToken, async (req, res) => {
  let connection;
  try {
    const { name, phone, address } = req.body;
    connection = await createConnection();

    await connection.execute(
      'UPDATE users SET name = ?, phone = ?, address = ?, updated_at = NOW() WHERE id = ?',
      [name, phone, address, req.user.userId]
    );

    const [updatedUsers] = await connection.execute(
      'SELECT id, name, email, phone, address, picture, role, provider, created_at FROM users WHERE id = ?',
      [req.user.userId]
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUsers[0]
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    if (connection) await connection.end();
  }
});

module.exports = router;
