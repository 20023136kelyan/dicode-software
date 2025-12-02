# Firebase Functions Environment Variables Setup

## Required Environment Variables

Based on your codebase, the following environment variables are needed for Firebase Cloud Functions:

### 1. OpenAI Configuration
- `OPENAI_API_KEY` - Your OpenAI API key (required)
- `OPENAI_BASE_URL` - Custom OpenAI base URL (optional, defaults to https://api.openai.com/v1)
- `OPENAI_ORG_ID` - Your OpenAI organization ID (optional)
- `OPENAI_PROJECT_ID` - Your OpenAI project ID (optional)

### 2. Firebase Configuration
- `FIREBASE_PROJECT_ID` - Your Firebase project ID
- `FIREBASE_CLIENT_EMAIL` - Service account client email (optional for Cloud Functions - auto-provided)
- `FIREBASE_PRIVATE_KEY` - Service account private key (optional for Cloud Functions - auto-provided)
- `FIREBASE_STORAGE_BUCKET` - Your Firebase storage bucket (e.g., `your-project.appspot.com`)

### 3. FFmpeg Configuration
- `FFMPEG_PATH` - Path to FFmpeg binary (optional - auto-detected in functions)
- `FUNCTIONS_FFMPEG_PATH` - Alternative FFmpeg path for functions (optional)
- `VIDEO_GEN_FFMPEG_PATH` - Another FFmpeg path fallback (optional)

### 4. Other Configuration
- `FUNCTION_REGION` - Cloud Function region (optional, defaults to `us-central1`)
- `NODE_ENV` - Environment mode (production/development)

## Setup Instructions

### Method 1: Using Firebase CLI (Recommended)

1. **Set all required environment variables at once:**

```bash
firebase functions:config:set \
  openai.api_key="sk-your-openai-api-key-here" \
  openai.base_url="https://api.openai.com/v1" \
  firebase.project_id="your-firebase-project-id" \
  firebase.storage_bucket="your-project.appspot.com" \
  function.region="us-central1"
```

2. **Deploy the functions to apply the configuration:**

```bash
firebase deploy --only functions
```

3. **Verify the configuration:**

```bash
firebase functions:config:get
```

### Method 2: Using Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Functions** → **Environment Variables**
4. Click **Add variable** and add each variable individually:
   - `OPENAI_API_KEY` = `sk-...`
   - `FIREBASE_PROJECT_ID` = `your-project-id`
   - `FIREBASE_STORAGE_BUCKET` = `your-project.appspot.com`
   - etc.

## How Environment Variables Work in Cloud Functions

Firebase Cloud Functions uses **Runtime Config** to securely store environment variables:

1. Variables are set using `firebase functions:config:set`
2. They're stored securely in Google Cloud (not in your repository)
3. When functions start, they're available as `process.env.VARIABLE_NAME`
4. Your code (like `openai.ts` and `firebaseAdmin.ts`) reads them automatically

### Important Notes

- **Service Account Credentials**: In Cloud Functions, Firebase Admin SDK automatically uses the default service account. You typically don't need to manually set `FIREBASE_PRIVATE_KEY` or `FIREBASE_CLIENT_EMAIL`.

- **Required vs Optional**: The only truly required variable is `OPENAI_API_KEY`. Other Firebase variables are often auto-provided in the Cloud Functions environment.

- **Testing Locally**: For local development, create a `.env` file in your `client/` directory:

```bash
# client/.env.local
OPENAI_API_KEY=sk-...
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

## Quick Setup Script

You can use this script to set the minimum required variables:

```bash
#!/bin/bash
# Set your values here
OPENAI_KEY="sk-your-key-here"
FIREBASE_PROJECT="your-project-id"
STORAGE_BUCKET="your-project.appspot.com"

firebase functions:config:set \
  openai.api_key="$OPENAI_KEY" \
  firebase.project_id="$FIREBASE_PROJECT" \
  firebase.storage_bucket="$STORAGE_BUCKET"

echo "Configuration set. Now deploying functions..."
firebase deploy --only functions
```

## Troubleshooting

### Check current configuration
```bash
firebase functions:config:get
```

### View only OpenAI config
```bash
firebase functions:config:get openai
```

### Unset a variable
```bash
firebase functions:config:unset openai.api_key
```

### View function logs
```bash
firebase functions:log
```

## Next Steps

After setting up environment variables:

1. Deploy your functions: `firebase deploy --only functions`
2. Test the health endpoint to verify setup
3. Monitor logs for any configuration errors
4. Update variables as needed using `firebase functions:config:set`
