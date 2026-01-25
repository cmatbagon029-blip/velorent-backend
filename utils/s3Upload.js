const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../config.env') });

// Load from config.env
let envConfig = {};
try {
  const envFile = fs.readFileSync(path.join(__dirname, '../config.env'), 'utf8');
  envFile.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    // Skip empty lines, comments, and lines that don't contain '='
    if (trimmedLine && !trimmedLine.startsWith('#') && trimmedLine.includes('=')) {
      const equalIndex = trimmedLine.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmedLine.substring(0, equalIndex).trim();
        const value = trimmedLine.substring(equalIndex + 1).trim();
        // Only add if key is valid (alphanumeric and underscores)
        if (key && /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
          envConfig[key] = value;
        }
      }
    }
  });
} catch (error) {
  console.log('config.env not found or error reading it, using process.env:', error.message);
}

// Get AWS credentials from process.env (populated by dotenv) or fallback to manual parsing
// Prioritize process.env since dotenv is more reliable
const S3_REGION = process.env.S3_REGION || envConfig.S3_REGION || 'ap-southeast-2';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || envConfig.S3_ACCESS_KEY;
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || envConfig.S3_SECRET_KEY;
const S3_BUCKET = process.env.S3_BUCKET || envConfig.S3_BUCKET || 'velorent-company-files';

// Debug logging (only in development)
if (process.env.DEBUG_MODE === 'true') {
  console.log('S3 Configuration check:');
  console.log('  S3_REGION:', S3_REGION ? '✓' : '✗');
  console.log('  S3_ACCESS_KEY:', S3_ACCESS_KEY ? '✓ (length: ' + S3_ACCESS_KEY.length + ')' : '✗');
  console.log('  S3_SECRET_KEY:', S3_SECRET_KEY ? '✓ (length: ' + S3_SECRET_KEY.length + ')' : '✗');
  console.log('  S3_BUCKET:', S3_BUCKET ? '✓ (' + S3_BUCKET + ')' : '✗');
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
      return {
        success: false,
        message: 'AWS S3 credentials not configured. Please set S3_ACCESS_KEY, S3_SECRET_KEY, and S3_BUCKET in config.env'
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

