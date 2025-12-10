# Backend Deployment Guide

This guide will help you deploy the VeloRent backend to production.

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- MySQL database
- AWS S3 account (for file storage)
- PayMongo account (for payments)

## Environment Variables Setup

1. Copy the example environment file:
   ```bash
   cp .env.example config.env
   ```

2. Edit `config.env` and fill in your actual values:

   ```env
   # Database Configuration
   DB_HOST=your-db-host
   DB_NAME=your-db-name
   DB_USER=your-db-user
   DB_PASS=your-db-password

   # Server Configuration
   PORT=3000
   HOST=0.0.0.0

   # JWT Secret (IMPORTANT: Use a strong random string in production)
   JWT_SECRET=your-strong-random-secret-key-here

   # AWS S3 Configuration
   S3_BUCKET=your-s3-bucket-name
   S3_REGION=your-s3-region
   S3_ACCESS_KEY=your-s3-access-key
   S3_SECRET_KEY=your-s3-secret-key
   S3_BASE_URL=https://your-bucket.s3.region.amazonaws.com

   # PayMongo Configuration
   PAYMONGO_SECRET_KEY=your-paymongo-secret-key
   PAYMONGO_PUBLIC_KEY=your-paymongo-public-key
   PAYMONGO_WEBHOOK_SECRET=your-paymongo-webhook-secret
   ```

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Make sure your database is set up and accessible.

3. Start the server:
   ```bash
   npm start
   ```

   Or for development:
   ```bash
   npm run dev
   ```

## Deployment Platforms

### Render.com

1. Connect your GitHub repository to Render
2. Create a new Web Service
3. Set the following:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node
4. Add all environment variables from your `config.env` file in the Render dashboard
5. Deploy!

### Heroku

1. Install Heroku CLI
2. Login: `heroku login`
3. Create app: `heroku create your-app-name`
4. Set environment variables:
   ```bash
   heroku config:set DB_HOST=your-db-host
   heroku config:set DB_NAME=your-db-name
   # ... set all other variables
   ```
5. Deploy: `git push heroku main`

### DigitalOcean App Platform

1. Connect your GitHub repository
2. Create a new App
3. Configure:
   - **Build Command**: `npm install`
   - **Run Command**: `npm start`
4. Add environment variables in the App Settings
5. Deploy

## Important Security Notes

1. **Never commit `config.env` to version control** - it contains sensitive information
2. **Use strong JWT_SECRET** - Generate a random string for production
3. **Use production PayMongo keys** - Switch from test keys to live keys
4. **Restrict CORS in production** - Update `app.js` to only allow your frontend domain
5. **Use HTTPS** - Always use HTTPS in production

## Verifying Deployment

After deployment, test your API:

```bash
curl https://your-domain.com/api/vehicles
```

You should receive a JSON response (or an empty array if no vehicles exist).

## Troubleshooting

- **CORS errors**: Make sure CORS is properly configured in `app.js`
- **Database connection errors**: Verify your database credentials and network access
- **Port issues**: Make sure the PORT environment variable is set correctly
- **Missing dependencies**: Run `npm install` to ensure all packages are installed

## Support

For issues or questions, check the main README.md or contact the development team.

