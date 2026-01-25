const express = require('express');
const cors = require('cors');
const path = require('path');
const vehiclesRouter = require('./routes/vehicles');
const companiesRouter = require('./routes/companies');
const authRouter = require('./routes/auth');
const rentalsRouter = require('./routes/rentals');

const app = express();

// Middleware
// Configure CORS to allow requests from mobile app
app.use(cors({
  origin: '*', // Allow all origins for development (restrict in production)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/vehicles', vehiclesRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/rentals', rentalsRouter);

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
