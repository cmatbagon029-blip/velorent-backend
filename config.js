require('dotenv').config({ path: './config.env' });

module.exports = {
  // AWS S3 Configuration
  S3_BASE_URL: process.env.S3_BASE_URL || 'https://velorent-company-files.s3.ap-southeast-2.amazonaws.com',
  S3_BUCKET: process.env.S3_BUCKET || 'velorent-company-files',
  S3_REGION: process.env.S3_REGION || 'ap-southeast-2',
  
  // Database Configuration
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_NAME: process.env.DB_NAME || 'velorent',
  DB_USER: process.env.DB_USER || 'root',
  DB_PASS: process.env.DB_PASS || '',
  
  // Application Configuration
  APP_URL: process.env.APP_URL || 'http://localhost/VelorentAdmin',
  IONIC_APP_URL: process.env.IONIC_APP_URL || 'http://localhost:8100',
  DEBUG_MODE: process.env.DEBUG_MODE === 'true',
  
  // PayMongo Configuration
  PAYMONGO_SECRET_KEY: process.env.PAYMONGO_SECRET_KEY,
  PAYMONGO_PUBLIC_KEY: process.env.PAYMONGO_PUBLIC_KEY,
  PAYMONGO_WEBHOOK_SECRET: process.env.PAYMONGO_WEBHOOK_SECRET,
  
  // Helper function to convert local paths to S3 URLs
  getS3Url: (localPath) => {
    if (!localPath) return null;
    
    // If the path already contains https or http, return as is
    if (localPath.startsWith('http://') || localPath.startsWith('https://')) {
      return localPath;
    }
    
    // If it's a placeholder, return as is
    if (localPath.includes('vehicle-placeholder.svg') || localPath.includes('company-placeholder.svg')) {
      return localPath;
    }
    
    // Remove 'uploads/' prefix if present (database may have it)
    let cleanPath = localPath.replace(/^uploads\//, '');
    
    // If the path starts with '/', remove it
    cleanPath = cleanPath.startsWith('/') ? cleanPath.substring(1) : cleanPath;
    
    // Construct S3 URL
    return `${process.env.S3_BASE_URL || module.exports.S3_BASE_URL}/${cleanPath}`;
  }
};

