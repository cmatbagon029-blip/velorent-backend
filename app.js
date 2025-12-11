const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth');
const vehicleRoutes = require('./routes/vehicles');
const companyRoutes = require('./routes/companies');
const rentalRoutes = require('./routes/rentals');
const verificationRoutes = require('./routes/verification');
const requestRoutes = require('./routes/requests');
const notificationRoutes = require('./routes/notifications');
const paymentRoutes = require('./routes/payments');

const app = express();

// Middleware
// Configure CORS to allow requests from mobile app and web app
app.use(cors({
  origin: '*', // Allow all origins (for mobile app and web app)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/rentals', rentalRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payments', paymentRoutes);

// Use the verification routes BEFORE app.listen
app.use('/api', verificationRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
  const { createConnection } = require('./utils/db');
  let connection;
  try {
    connection = await createConnection();
    await connection.execute('SELECT 1');
    await connection.end();
    res.json({ 
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (connection) {
      await connection.end().catch(() => {});
    }
    res.status(500).json({ 
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      code: error.code,
      env: {
        hasDBHost: !!process.env.DB_HOST,
        hasDBUser: !!process.env.DB_USER,
        hasDBName: !!process.env.DB_NAME,
        hasDBPass: !!(process.env.DB_PASS || process.env.DB_PASSWORD)
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something broke!',
    details: err.message 
  });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all network interfaces
app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`);
  console.log(`Server accessible at http://localhost:${PORT} and http://192.168.1.21:${PORT}`);
}); 
