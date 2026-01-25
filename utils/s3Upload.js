const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const config = require('../config');

// Get AWS credentials from config (which loads from config.env via dotenv)
// Also check process.env as fallback for environment variables set directly
const S3_REGION = process.env.S3_REGION || config.S3_REGION || 'ap-southeast-2';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || config.S3_ACCESS_KEY;
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || config.S3_SECRET_KEY;
const S3_BUCKET = process.env.S3_BUCKET || config.S3_BUCKET || 'velorent-company-files';

// Debug logging (always log on Render, or when DEBUG_MODE is enabled)
const isRender = process.env.RENDER || process.env.RENDER_SERVICE_NAME;
if (isRender || process.env.DEBUG_MODE === 'true' || config.DEBUG_MODE) {
  console.log('=== S3 Configuration Check ===');
  console.log('Environment:', isRender ? 'Render (Production)' : 'Local');
  console.log('  S3_REGION:', S3_REGION);
  console.log('  S3_BUCKET:', S3_BUCKET);
  console.log('  S3_ACCESS_KEY:', S3_ACCESS_KEY ? `${S3_ACCESS_KEY.substring(0, 8)}...` : 'NOT SET');
  console.log('  S3_SECRET_KEY:', S3_SECRET_KEY ? 'SET' : 'NOT SET');
  console.log('  From process.env.S3_ACCESS_KEY:', process.env.S3_ACCESS_KEY ? 'YES' : 'NO');
  console.log('  From config.S3_ACCESS_KEY:', config.S3_ACCESS_KEY ? 'YES' : 'NO');
}

// Configure AWS S3 (will be initialized per request to use latest credentials)
function getS3Client() {
  return new AWS.S3({
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
    region: S3_REGION
  });
}

/**
 * Upload image to S3
 * 
 * @param {Object} file Multer file object
 * @param {string} folder Folder name in S3 bucket
 * @param {string|null} customName Optional custom filename
 * @returns {Promise<Object>} {success: bool, url: 'full URL', path: 'S3 path', message: 'error message'}
 */
async function uploadImageToS3(file, folder = 'uploads', customName = null) {
  try {
    // Validate file
    if (!file || !file.path) {
      return {
        success: false,
        message: 'File upload error: No file provided'
      };
    }

    // Check if AWS credentials are configured
    if (!S3_ACCESS_KEY || !S3_SECRET_KEY || !S3_BUCKET) {
      console.error('=== S3 CONFIGURATION ERROR ===');
      console.error('S3_ACCESS_KEY:', S3_ACCESS_KEY ? 'SET' : 'NOT SET');
      console.error('S3_SECRET_KEY:', S3_SECRET_KEY ? 'SET' : 'NOT SET');
      console.error('S3_BUCKET:', S3_BUCKET || 'NOT SET');
      console.error('Environment check:');
      console.error('  process.env.S3_ACCESS_KEY:', process.env.S3_ACCESS_KEY ? 'SET' : 'NOT SET');
      console.error('  process.env.S3_SECRET_KEY:', process.env.S3_SECRET_KEY ? 'SET' : 'NOT SET');
      console.error('  process.env.S3_BUCKET:', process.env.S3_BUCKET || 'NOT SET');
      console.error('  config.S3_ACCESS_KEY:', config.S3_ACCESS_KEY ? 'SET' : 'NOT SET');
      console.error('  config.S3_SECRET_KEY:', config.S3_SECRET_KEY ? 'SET' : 'NOT SET');
      console.error('  config.S3_BUCKET:', config.S3_BUCKET || 'NOT SET');
      
      const isRender = process.env.RENDER || process.env.RENDER_SERVICE_NAME;
      const envHint = isRender 
        ? 'Set these as environment variables in your Render dashboard (Settings → Environment)'
        : 'Set these in your config.env file or as environment variables';
      
      return {
        success: false,
        message: `AWS S3 credentials not configured. ${envHint}. Required: S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET`
      };
    }

    // Read file from temporary location
    const fileContent = fs.readFileSync(file.path);
    
    // Generate filename
    const extension = path.extname(file.originalname || file.filename || '').toLowerCase() || '.jpg';
    const fileName = customName || `${Date.now()}_${Math.random().toString(36).substring(7)}${extension}`;
    const key = `${folder}/${fileName}`;

    // Determine content type
    const contentType = file.mimetype || 'image/jpeg';
    
    // Get S3 client
    const s3 = getS3Client();
    
    // Upload to S3
    const uploadParams = {
      Bucket: S3_BUCKET,
      Key: key,
      Body: fileContent,
      ContentType: contentType,
      ACL: 'public-read' // Make file publicly accessible
    };

    const result = await s3.upload(uploadParams).promise();

    // Generate public URL
    const url = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;

    // Delete temporary file
    try {
      fs.unlinkSync(file.path);
    } catch (unlinkError) {
      console.warn('Failed to delete temporary file:', unlinkError);
    }

    return {
      success: true,
      url: url,
      path: key,
      message: 'Upload successful'
    };

  } catch (error) {
    console.error('S3 upload error:', error);
    
    // Try to delete temporary file even on error
    try {
      if (file && file.path) {
        fs.unlinkSync(file.path);
      }
    } catch (unlinkError) {
      console.warn('Failed to delete temporary file after error:', unlinkError);
    }

    return {
      success: false,
      message: `S3 upload failed: ${error.message}`
    };
  }
}

module.exports = {
  uploadImageToS3
};

