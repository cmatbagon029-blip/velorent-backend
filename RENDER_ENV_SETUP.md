# Render Environment Variables Setup

## Problem
The backend on Render (`velorent-backend.onrender.com`) needs environment variables to be set in the Render dashboard, not in `config.env` (which is not deployed).

## Required Environment Variables

### AWS S3 Configuration
```
S3_ACCESS_KEY=your_s3_access_key_here
S3_SECRET_KEY=your_s3_secret_key_here
S3_BUCKET=velorent-company-files
S3_REGION=ap-southeast-2
S3_BASE_URL=https://velorent-company-files.s3.ap-southeast-2.amazonaws.com
```

### PayMongo Configuration (LIVE - PRODUCTION)
```
PAYMONGO_SECRET_KEY=sk_live_your_live_secret_key_here
PAYMONGO_PUBLIC_KEY=pk_live_your_live_public_key_here
PAYMONGO_WEBHOOK_SECRET=whsk_your_webhook_secret_here
```

### Database Configuration
```
DB_HOST=your_render_db_host
DB_NAME=velorent
DB_USER=your_db_user
DB_PASS=your_db_password
```

### Application Configuration
```
APP_URL=http://localhost/VelorentAdmin
IONIC_APP_URL=http://localhost:8100
DEBUG_MODE=true
```

## How to Set Environment Variables in Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Select your service: `velorent-backend`
3. Click on **"Environment"** in the left sidebar
4. Scroll down to **"Environment Variables"** section
5. Click **"Add Environment Variable"** for each variable
6. Enter the **Key** and **Value** for each variable
7. Click **"Save Changes"**
8. Render will automatically redeploy your service

## Important Notes

- **Never commit secrets to Git** - They should only be in Render's environment variables
- After adding variables, wait for the service to redeploy (usually 1-2 minutes)
- You can check the logs to verify the variables are loaded correctly
- The service will automatically restart after you save environment variables

## Verification

After setting the variables, check the Render logs. You should see:
```
=== S3 Configuration Check ===
Environment: Render (Production)
  S3_REGION: ap-southeast-2
  S3_BUCKET: velorent-company-files
  S3_ACCESS_KEY: [first 8 chars]...
  S3_SECRET_KEY: SET
```

If you see "NOT SET" for any variable, it means that variable is not configured in Render.
