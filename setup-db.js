const mysql = require('mysql2/promise');
const fs = require('fs');

async function setupDatabase() {
  let connection;
  try {
    console.log('Setting up database...');
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'velorent'
    });

    // Read and execute the complete schema
    const schema = fs.readFileSync('config/complete-schema.sql', 'utf8');
    const statements = schema.split(';').filter(s => s.trim());
    
    for (const stmt of statements) {
      if (stmt.trim()) {
        try {
          await connection.execute(stmt);
          console.log('Executed:', stmt.substring(0, 50) + '...');
        } catch (err) {
          console.log('Skipped (already exists):', stmt.substring(0, 50) + '...');
        }
      }
    }

    // Check if we have any users
    const [users] = await connection.execute('SELECT * FROM users');
    console.log('Users in database:', users.length);
    
    if (users.length === 0) {
      console.log('No users found. Creating test user...');
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('password123', 10);
      
      await connection.execute(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        ['Test User', 'test@example.com', hashedPassword, 'user']
      );
      console.log('Test user created: test@example.com / password123');
    }

    // Check if we have any bookings
    const [bookings] = await connection.execute('SELECT * FROM bookings');
    console.log('Bookings in database:', bookings.length);

    console.log('Database setup completed successfully!');
  } catch (error) {
    console.error('Database setup error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

setupDatabase();
