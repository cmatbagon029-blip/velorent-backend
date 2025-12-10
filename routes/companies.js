const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const config = require('../config');

// Get all rental companies
router.get('/', async (req, res) => {
  let connection;
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'velorent'
    });

    console.log('Fetching companies...');
    const [rows] = await connection.execute(`
      SELECT * FROM companies 
      WHERE status = 'approved'
      ORDER BY company_name
    `);
    
    // Transform image paths to full URLs and match frontend expectations
    const companies = rows.map(company => ({
      id: company.id,
      name: company.company_name,
      email: company.contact_email,
      contactNumber: company.contact_phone,
      address: company.address,
      contactPerson: company.contact_person,
      location: company.address, // Use address as location
      logoUrl: (company.company_logo || company.image_path) ? config.getS3Url(company.company_logo || company.image_path) : 'assets/images/company-placeholder.svg',
      rating: 4.5, // Default rating
      description: `Professional vehicle rental services by ${company.company_name}`
    }));

    console.log('Companies fetched successfully:', companies.length);
    res.json(companies);
  } catch (error) {
    console.error('Error in /api/companies:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to fetch companies',
      details: error.message,
      stack: error.stack
    });
  } finally {
    if (connection) {
      console.log('Closing database connection...');
      await connection.end();
    }
  }
});

// Get company rules by company ID
router.get('/:id/rules', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'velorent'
    });

    console.log('Fetching company rules for company ID:', req.params.id);
    
    const [rows] = await connection.execute(
      'SELECT rules_data FROM company_rules WHERE company_id = ?',
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.json({ rules: [] });
    }

    // Parse the JSON rules_data
    let rules = [];
    try {
      rules = JSON.parse(rows[0].rules_data);
    } catch (parseError) {
      console.error('Error parsing rules_data:', parseError);
      return res.json({ rules: [] });
    }

    console.log('Company rules fetched successfully:', rules.length);
    res.json({ rules });
  } catch (error) {
    console.error('Error fetching company rules:', error);
    res.status(500).json({ 
      error: 'Failed to fetch company rules',
      details: error.message 
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Get company availability by company ID
router.get('/:id/availability', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'velorent'
    });

    console.log('Fetching company availability for company ID:', req.params.id);
    
    const [rows] = await connection.execute(
      'SELECT * FROM company_availability WHERE company_id = ? ORDER BY day_of_week',
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.json({ availability: [] });
    }

    // Transform the data to be more frontend-friendly
    const availability = rows.map(row => ({
      id: row.id,
      companyId: row.company_id,
      dayOfWeek: row.day_of_week,
      isAvailable: Boolean(row.is_available),
      startTime: row.start_time,
      endTime: row.end_time,
      is24Hours: Boolean(row.is_24_hours)
    }));

    console.log('Company availability fetched successfully:', availability.length);
    res.json({ availability });
  } catch (error) {
    console.error('Error fetching company availability:', error);
    res.status(500).json({ 
      error: 'Failed to fetch company availability',
      details: error.message 
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Check if a specific date and time is available for a company
router.post('/:id/check-availability', async (req, res) => {
  let connection;
  try {
    const { date, time } = req.body;
    
    if (!date || !time) {
      return res.status(400).json({ error: 'Date and time are required' });
    }

    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'velorent'
    });

    // Get the day of the week from the date
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'lowercase' });
    
    console.log('Checking availability for:', { date, time, dayOfWeek });

    const [rows] = await connection.execute(
      'SELECT * FROM company_availability WHERE company_id = ? AND day_of_week = ?',
      [req.params.id, dayOfWeek]
    );

    if (rows.length === 0) {
      return res.json({ 
        isAvailable: false, 
        message: 'No availability data found for this day' 
      });
    }

    const availability = rows[0];
    
    // Check if the company is available on this day
    if (!availability.is_available) {
      return res.json({ 
        isAvailable: false, 
        message: 'Company is not available on this day' 
      });
    }

    // If it's 24 hours, any time is available
    if (availability.is_24_hours) {
      return res.json({ 
        isAvailable: true, 
        message: 'Available 24 hours' 
      });
    }

    // Check if the requested time is within the available time range
    const requestedTime = time;
    const startTime = availability.start_time;
    const endTime = availability.end_time;

    if (requestedTime >= startTime && requestedTime <= endTime) {
      return res.json({ 
        isAvailable: true, 
        message: `Available from ${startTime} to ${endTime}` 
      });
    } else {
      return res.json({ 
        isAvailable: false, 
        message: `Not available at this time. Available from ${startTime} to ${endTime}` 
      });
    }

  } catch (error) {
    console.error('Error checking company availability:', error);
    res.status(500).json({ 
      error: 'Failed to check company availability',
      details: error.message 
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Get drivers by company ID
router.get('/:id/drivers', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'velorent'
    });

    console.log('Fetching drivers for company ID:', req.params.id);
    
    const [rows] = await connection.execute(
      'SELECT * FROM drivers WHERE company_id = ? AND status = "approved" AND availability = "available" ORDER BY full_name',
      [req.params.id]
    );

    // Transform the data to be more frontend-friendly
    const drivers = rows.map(driver => ({
      id: driver.id,
      fullName: driver.full_name,
      email: driver.email,
      phone: driver.phone,
      licenseNumber: driver.license_number,
      imagePath: driver.image_path,
      experience: driver.experience,
      status: driver.status,
      availability: driver.availability,
      assignedVehicleId: driver.assigned_vehicle_id,
      hireDate: driver.hire_date,
      salary: driver.salary,
      notes: driver.notes
    }));

    console.log('Drivers fetched successfully:', drivers.length);
    res.json({ drivers });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({ 
      error: 'Failed to fetch drivers',
      details: error.message 
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Get company by ID
router.get('/:id', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'velorent'
    });

    const [rows] = await connection.execute(
      'SELECT * FROM companies WHERE id = ? AND status = "approved"',
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const company = {
      id: rows[0].id,
      name: rows[0].company_name,
      email: rows[0].contact_email,
      contactNumber: rows[0].contact_phone,
      address: rows[0].address,
      contactPerson: rows[0].contact_person,
      location: rows[0].address,
      logoUrl: (rows[0].company_logo || rows[0].image_path) ? config.getS3Url(rows[0].company_logo || rows[0].image_path) : 'assets/images/company-placeholder.svg',
      rating: 4.5,
      description: `Professional vehicle rental services by ${rows[0].company_name}`
    };

    res.json(company);
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({ 
      error: 'Failed to fetch company',
      details: error.message 
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

// Get company policies by company ID
router.get('/:id/policies', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'velorent'
    });

    const [rows] = await connection.execute(
      'SELECT * FROM company_policies WHERE company_id = ?',
      [req.params.id]
    );

    if (rows.length === 0) {
      // Return default policy if none exists
      return res.json({
        company_id: parseInt(req.params.id),
        reschedule_terms: 'Rescheduling is free if requested at least 3 days before the booking start date. A fee of 10% applies for reschedule requests made within 3 days of the booking.',
        cancellation_terms: 'Cancellation is allowed up to 24 hours before booking. A cancellation fee of 20% applies. Cancellations within 24 hours are non-refundable.',
        refund_terms: 'Deposits and reservation fees are non-refundable. Full refunds are only available for cancellations made more than 7 days in advance.',
        allow_reschedule: true,
        allow_cancellation: true,
        allow_refund: false,
        reschedule_free_days: 3,
        reschedule_fee_percentage: 10.00,
        cancellation_fee_percentage: 20.00,
        deposit_refundable: false
      });
    }

    const policy = rows[0];
    res.json({
      company_id: policy.company_id,
      reschedule_terms: policy.reschedule_terms,
      cancellation_terms: policy.cancellation_terms,
      refund_terms: policy.refund_terms,
      allow_reschedule: Boolean(policy.allow_reschedule),
      allow_cancellation: Boolean(policy.allow_cancellation),
      allow_refund: Boolean(policy.allow_refund),
      reschedule_free_days: policy.reschedule_free_days,
      reschedule_fee_percentage: parseFloat(policy.reschedule_fee_percentage),
      cancellation_fee_percentage: parseFloat(policy.cancellation_fee_percentage),
      deposit_refundable: Boolean(policy.deposit_refundable),
      last_updated: policy.last_updated
    });
  } catch (error) {
    console.error('Error fetching company policies:', error);
    res.status(500).json({ 
      error: 'Failed to fetch company policies',
      details: error.message 
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

module.exports = router; 