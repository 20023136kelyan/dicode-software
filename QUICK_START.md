# Quick Start Guide

> **Note:** This is a condensed guide. For detailed step-by-step instructions with troubleshooting, see the main [README.md](README.md).

## Prerequisites

Before starting, make sure you have:
- **Python 3.8 or higher** installed (check with `python3 --version`)
- **pip** package manager
- An **OpenAI API key** with Sora 2 access

## Quick Setup (Choose One Method)

### Option 1: Automated Script (macOS/Linux only)

**Step 1:** Navigate to the project directory in your terminal

**Step 2:** Make the script executable and run it:
```bash
chmod +x start_server.sh
./start_server.sh
```

This will automatically:
- Create a virtual environment if it doesn't exist
- Install all Python dependencies
- Start the backend server on port 8080

**Step 3:** Open `frontend/index.html` in your web browser

**Step 4:** Configure your API key:
- Copy `backend/config.example.json` to `backend/config.json`
- Edit `backend/config.json` and replace `"your-api-key-here"` with your actual OpenAI API key
- Restart the server (press `Ctrl+C` to stop, then run `./start_server.sh` again)

---

### Option 2: Manual Setup (All Platforms)

Follow these steps **in order**:

**Step 1: Navigate to Project Directory**
```bash
cd /path/to/Video_Gen\ copy
```
(Replace with your actual project path)

**Step 2: Create Virtual Environment**

**macOS/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

**Windows:**
```bash
python -m venv venv
venv\Scripts\activate
```

You should see `(venv)` in your terminal prompt. If not, the virtual environment isn't activated.

**Step 3: Install Dependencies**
```bash
pip install -r backend/requirements.txt
```

Wait for installation to complete (may take a few minutes).

**Step 4: Configure API Key**

**macOS/Linux:**
```bash
cp backend/config.example.json backend/config.json
```

**Windows:**
```bash
copy backend\config.example.json backend\config.json
```
Or manually copy the file in Windows Explorer.

Then:
- Open `backend/config.json` in a text editor
- Replace `"your-api-key-here"` with your actual OpenAI API key
- Save the file

**Step 5: Start Backend Server**
```bash
cd backend
python app.py
```

You should see: `* Running on http://0.0.0.0:8080`

**Keep this terminal open** - the server must keep running. Press `Ctrl+C` to stop it later.

**Step 6: Open Frontend**

Open a **new terminal window** (keep the backend running):

**Option A: Direct File (Simplest)**
- Navigate to the `frontend` folder
- Double-click `index.html` to open in your browser

**Option B: HTTP Server (Recommended for CORS)**
```bash
cd frontend
python3 -m http.server 8000
```
Then open `http://localhost:8000` in your browser.

## First Use - Verify Setup

After completing the setup above:

1. **Check API Key Status**: In the web interface, look for the API key status indicator. It should show as "configured" or "valid"
2. **If not configured**: 
   - Make sure `backend/config.json` exists (copy from `config.example.json` if needed)
   - Verify your API key is in the file
   - **Restart the backend server** (stop with `Ctrl+C`, then restart)
   - Refresh the frontend page
3. **Once configured**: You're ready to generate videos!

## Creating a Video

1. **Fill Required Fields**:
   - **Character Description**: Describe who/what appears in the video (required)
   - **Environment Description**: Describe the setting/location (required)

2. **Add Optional Details**:
   - Upload a reference image (optional, but improves quality)
   - Add lighting and camera angle details
   - Add dialog for the character

3. **Add More Shots** (optional):
   - Click "Add Shot" to create additional shots
   - Maximum 3 shots per sequence
   - Each shot is 10 seconds long

4. **Generate**:
   - Click "Generate Videos" button
   - Wait for processing (this can take several minutes)
   - Watch the progress updates in real-time

5. **Download**:
   - Once complete, download individual shots or the complete stitched sequence
   - Stitched videos automatically combine all shots into one continuous video

## Configuration

### Updating API Key

The OpenAI API key is stored in `backend/config.json`. To update it:

1. **Stop the server** (if running): Press `Ctrl+C` in the terminal
2. **Edit** `backend/config.json` in a text editor
3. **Replace** the `openai_api_key` value with your new key (keep the quotes!)
4. **Save** the file
5. **Restart** the server:
   - If using the script: `./start_server.sh`
   - If manual: `cd backend && python app.py`
6. **Refresh** the frontend page in your browser

## Troubleshooting

### Common Issues

**"python3: command not found"**
- Install Python 3 from python.org or use your system's package manager
- Some systems use `python` instead of `python3`

**"Module not found" or "No module named..."**
- Make sure your virtual environment is activated (you should see `(venv)` in terminal)
- If not activated: `source venv/bin/activate` (macOS/Linux) or `venv\Scripts\activate` (Windows)
- Reinstall dependencies: `pip install -r backend/requirements.txt`

**Port 8080 already in use**
- Stop the process using port 8080, or:
- Edit `backend/app.py`: change `port=8080` to `port=8081`
- Edit `frontend/app.js`: change `localhost:8080` to `localhost:8081` in `API_BASE_URL`

**Frontend can't connect to backend**
- Verify the backend is running (check terminal for "Running on http://0.0.0.0:8080")
- Make sure you're using the correct port (default: 8080)
- If opening `index.html` directly doesn't work, use Option B (HTTP server) in Step 6
- Check browser console (F12) for specific error messages

**API key not working / "API key not configured"**
- Make sure `backend/config.json` exists (copy from `config.example.json` if needed)
- Verify the API key format: `"openai_api_key": "sk-proj-..."` (with quotes)
- **Restart the server** after updating the config file (stop with `Ctrl+C`, then restart)
- Ensure your API key has Sora 2 access enabled

**Generation fails**
- Check that all required fields are filled (Character and Environment descriptions)
- Verify you have sufficient API credits in your OpenAI account
- Check the backend terminal for detailed error messages
- Ensure your API key has access to Sora 2

**Videos not downloading or stitching**
- Make sure video generation completed successfully (check progress messages)
- Verify output files exist in `backend/output/<sequence_id>/`
- Ensure moviepy is installed: `pip install moviepy>=1.0.3`

### Still Having Issues?

For more detailed troubleshooting and solutions, see the comprehensive [README.md](README.md) troubleshooting section.

