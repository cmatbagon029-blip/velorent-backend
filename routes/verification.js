const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const router = express.Router();

// Configure multer for file storage
// You might want to use disk storage if you need to process the file first
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Ensure this directory exists in your backend project
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });


router.post('/verify-id', upload.single('idImage'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded.' });
  }

  const form = new FormData();
  form.append('file', fs.createReadStream(req.file.path));
  form.append('apikey', 'rQcv01xXTviixMQgJO3LSuYDbCI0xAj4'); // Your provided API key
  form.append('accuracy', '2'); // Optional: Higher accuracy level
  form.append('return_original_image', '0'); // Optional: Do not return original image
  form.append('return_cropped_image', '1'); // Optional: Return cropped document image
  form.append('return_face_image', '1'); // Optional: Return cropped face image
  form.append('verification_checks', '1'); // Optional: Enable verification checks

  // --- Add this logging block ---
  console.log('--- Request details being sent to IDAnalyzer ---');
  console.log('URL:', 'https://api.idanalyzer.com/v2/scan');
  console.log('Method:', 'POST');
  console.log('Headers:', form.getHeaders());
  // Note: Cannot easily log the full form data stream here, but headers are key
  console.log('--- End Request details ---');
  // --- End logging block ---

  try {
    console.log('Sending ID to IDAnalyzer for verification...');
    const response = await axios.post('https://api.idanalyzer.com/v2/scan', form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity, // Allow large file uploads
      maxBodyLength: Infinity,    // Allow large file uploads
    });
    console.log('IDAnalyzer response received.');

    // Clean up uploaded file after processing
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('Failed to delete uploaded file:', err);
    });

    // Send the IDAnalyzer response back to the frontend
    res.json(response.data);

  } catch (err) {
    console.error('Error verifying ID with IDAnalyzer:', err.message);
    // Clean up uploaded file even on error
    if (req.file && req.file.path) {
        fs.unlink(req.file.path, (unlinkErr) => {
            if (unlinkErr) console.error('Failed to delete uploaded file on error:', unlinkErr);
        });
    }

    if (err.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('IDAnalyzer Error Response Data:', err.response.data);
      console.error('IDAnalyzer Error Response Status:', err.response.status);
      console.error('IDAnalyzer Error Response Headers:', err.response.headers);
       res.status(err.response.status).json({
         success: false,
         message: err.response.data.error || 'ID verification failed due to API error.',
         details: err.response.data
        });
    } else if (err.request) {
      // The request was made but no response was received
      console.error('IDAnalyzer Error Request:', err.request);
       res.status(500).json({
         success: false,
         message: 'No response received from ID verification service.',
         details: err.message
        });
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error setting up ID verification request:', err.message);
      res.status(500).json({
         success: false,
         message: 'Error preparing ID verification request.',
         details: err.message
        });
    }
  }
});

module.exports = router;