# Deploy Backend to Railway

Railway is a modern deployment platform that makes it easy to deploy your backend without organization policy restrictions.

## Step-by-Step Deployment Guide

### 1. Sign Up for Railway

1. Go to **https://railway.app**
2. Click **"Login"** or **"Start a New Project"**
3. Sign in with your **GitHub account**
4. Grant Railway access to your GitHub repositories

### 2. Create New Project

1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Search for and select your repository: `Video_Gen copy` or your repo name
4. Railway will automatically detect it's a Python app

### 3. Configure Environment Variables

After deployment starts, you need to add your API keys:

1. Click on your deployed service (should show "video-gen" or similar)
2. Click on the **"Variables"** tab
3. Click **"+ New Variable"**
4. Add these variables one by one:

```
OPENAI_API_KEY=your-openai-api-key-from-env-file

FIREBASE_PROJECT_ID=dicode-video-gen
```

**Important:** Use your actual OpenAI API key from your `.env` file

5. Railway will automatically redeploy with these variables

### 4. Wait for Deployment

1. Go to **"Deployments"** tab
2. Wait for the build to complete (usually 2-3 minutes)
3. You'll see ✅ when it's done

### 5. Get Your Backend URL

1. Click on the **"Settings"** tab
2. Scroll to **"Domains"** section
3. Click **"Generate Domain"**
4. Copy the URL (looks like: `https://video-gen-production-xxxx.up.railway.app`)

### 6. Update Frontend

Once you have your Railway URL, run:

```bash
cd "/Users/kelyan/Downloads/Video_Gen copy"
./update-and-redeploy-frontend.sh https://your-railway-url.up.railway.app
```

Replace `your-railway-url.up.railway.app` with your actual Railway URL.

### 7. Test Your App

Visit **https://dicode-video-gen.web.app** and:
- Click "Sign in with Google"
- Sign in with your account
- Try generating a video!

## Troubleshooting

### Build Fails

If the build fails:
1. Check the logs in Railway's "Deployments" tab
2. Make sure all files are committed to Git and pushed to GitHub
3. Railway deploys from your GitHub repo, not local files

### App Crashes

If the app starts but crashes:
1. Check you added the `OPENAI_API_KEY` environment variable
2. Check the logs in Railway's "Deployments" tab
3. Look for error messages

### CORS Errors

Railway should work fine with CORS. If you still see CORS errors:
1. Make sure you're using the correct Railway URL in the frontend
2. Check that the Railway app is running (green status)

## Cost

Railway offers:
- **$5 free credit** per month
- **500 hours** of execution time
- Your app should stay within the free tier for normal usage

## Updating Your App

When you make changes:
1. **Commit and push** to GitHub
2. Railway will **automatically redeploy**
3. No need to run deployment commands manually

## Alternative: Railway CLI (Advanced)

If you prefer using CLI:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Deploy
railway up
```

---

**Need Help?** Railway has great docs at https://docs.railway.app
