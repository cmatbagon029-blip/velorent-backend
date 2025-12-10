const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const config = require('../config');

// Get all vehicles
router.get('/', async (req, res) => {
  let connection;
  try {
    const { status } = req.query; // Optional status filter
    console.log('Connecting to database...');
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'velorent'
    });

    // Build query with optional status filter
    let query = `
      SELECT 
        v.id,
        v.name,
        v.model,
        v.type,
        v.price_with_driver,
        v.price_without_driver,
        v.Owner,
        v.image_path,
        v.company_id,
        v.status,
        v.year,
        v.color,
        v.engine_size,
        v.transmission,
        v.mileage,
        v.seaters,
        c.company_name
      FROM vehicles v
      LEFT JOIN companies c ON v.company_id = c.id
      WHERE (c.status = 'approved' OR c.status IS NULL)
    `;
    
    const params = [];
    
    // Add status filter if provided
    if (status) {
      const validStatuses = ['available', 'under maintenance', 'currently rented', 'unavailable'];
      if (validStatuses.includes(status.toLowerCase())) {
        query += ` AND v.status = ?`;
        params.push(status);
      }
    }
    
    query += ` ORDER BY v.id`;

    console.log('Fetching vehicles...');
    const [vehicles] = await connection.execute(query, params);

    console.log('Raw vehicles fetched:', vehicles.length);
    
    // Transform the data to match the frontend expectations
    const transformedVehicles = vehicles.map(vehicle => ({
      id: vehicle.id,
      name: vehicle.name,
      model: vehicle.model,
      type: vehicle.type,
      price_with_driver: vehicle.price_with_driver,
      price_without_driver: vehicle.price_without_driver,
      imageUrl: vehicle.image_path ? config.getS3Url(vehicle.image_path) : 'assets/images/vehicle-placeholder.svg',
      company_id: vehicle.company_id,
      company_name: vehicle.company_name || vehicle.Owner,
      status: vehicle.status || 'available', // Default to available if not set
      year: vehicle.year,
      color: vehicle.color,
      engine_size: vehicle.engine_size,
      transmission: vehicle.transmission,
      mileage: vehicle.mileage,
      seaters: vehicle.seaters,
      capacity: vehicle.seaters || (vehicle.type === 'Van' ? '12' : vehicle.type === 'SUV' ? '7' : '5'),
      rating: 4.5 // Default rating
    }));

    console.log('Transformed vehicles:', transformedVehicles.length);
    res.json(transformedVehicles);

  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({ 
      error: 'Failed to fetch vehicles: ' + error.message,
      details: error.stack
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Check vehicle availability for date range
router.get('/:id/availability', async (req, res) => {
  let connection;
  try {
    const { startDate, endDate } = req.query;
    const vehicleId = req.params.id;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'velorent'
    });

    // First, check vehicle status
    const [vehicles] = await connection.execute(
      'SELECT status FROM vehicles WHERE id = ?',
      [vehicleId]
    );

    if (vehicles.length === 0) {
      return res.status(404).json({ 
        isAvailable: false, 
        message: 'Vehicle not found.' 
      });
    }

    const vehicleStatus = vehicles[0].status;

    // Check if vehicle status makes it unavailable
    if (vehicleStatus === 'unavailable' || vehicleStatus === 'under maintenance') {
      return res.json({ 
        isAvailable: false, 
        message: `Vehicle is ${vehicleStatus}.` 
      });
    }

    if (vehicleStatus === 'currently rented') {
      return res.json({ 
        isAvailable: false, 
        message: 'Vehicle is currently rented.' 
      });
    }

    // Check for overlapping bookings with statuses that block new bookings
    const [conflicts] = await connection.execute(`
      SELECT id FROM bookings 
      WHERE vehicle_id = ? 
      AND status IN ('Pending', 'Active', 'Approved')
      AND (
        (start_date <= ? AND end_date >= ?)
        OR (start_date <= ? AND end_date >= ?)
        OR (start_date >= ? AND end_date <= ?)
      )
    `, [vehicleId, startDate, startDate, endDate, endDate, startDate, endDate]);

    if (conflicts.length > 0) {
      return res.json({ 
        isAvailable: false, 
        message: 'Vehicle is already booked for the selected dates.' 
      });
    }

    res.json({ 
      isAvailable: true, 
      message: 'Vehicle is available for the selected dates.' 
    });
  } catch (error) {
    console.error('Error checking vehicle availability:', error);
    res.status(500).json({ 
      error: 'Failed to check vehicle availability',
      details: error.message 
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Get vehicle by ID
router.get('/:id', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'velorent'
    });

    const [vehicles] = await connection.execute(`
      SELECT 
        v.id,
        v.name,
        v.model,
        v.type,
        v.price_with_driver,
        v.price_without_driver,
        v.Owner,
        v.image_path,
        v.company_id,
        v.description,
        v.year,
        v.color,
        v.engine_size,
        v.transmission,
        v.mileage,
        v.seaters,
        v.status,
        c.company_name
      FROM vehicles v
      LEFT JOIN companies c ON v.company_id = c.id
      WHERE v.id = ?
    `, [req.params.id]);

    if (vehicles.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const vehicle = vehicles[0];
    const transformedVehicle = {
      id: vehicle.id,
      name: vehicle.name,
      model: vehicle.model,
      type: vehicle.type,
      description: vehicle.description || `${vehicle.name} - Well-maintained vehicle ready for your journey`,
      year: vehicle.year || new Date().getFullYear().toString(),
      color: vehicle.color || 'Silver',
      engine_size: vehicle.engine_size || '1.5L',
      transmission: vehicle.transmission || 'Automatic',
      mileage: vehicle.mileage || '30,000 km',
      price_with_driver: vehicle.price_with_driver,
      price_without_driver: vehicle.price_without_driver,
      imageUrl: vehicle.image_path ? config.getS3Url(vehicle.image_path) : 'assets/images/vehicle-placeholder.svg',
      company_id: vehicle.company_id,
      company_name: vehicle.company_name || vehicle.Owner,
      rating: 4.5,
      capacity: vehicle.seaters || (vehicle.type === 'Van' ? '12' : vehicle.type === 'SUV' ? '7' : '5'),
      status: vehicle.status
    };

    res.json(transformedVehicle);
  } catch (error) {
    console.error('Error fetching vehicle:', error);
    res.status(500).json({ 
      error: 'Failed to fetch vehicle',
      details: error.message 
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

module.exports = router;