# Sora Video Generator Web Application

A full-stack web application for generating video sequences using OpenAI's Sora 2 API. Create multi-shot video sequences with up to 3 shots, each 10 seconds long, with detailed control over characters, environments, lighting, camera angles, and dialog.

## Features

- **Multi-Shot Sequences**: Generate up to 3 sequential shots per video
- **Detailed Control**: Configure characters, environments, lighting, camera angles, and dialog for each shot
- **Image References**: Upload reference images to influence video generation
- **Automatic Stitching**: Combine multiple shots into a single continuous video
- **Progress Tracking**: Real-time status updates during generation
- **Dual Downloads**: Download individual shots or the complete stitched sequence
- **Modern UI**: Clean, responsive interface with no build step required
- **Remix Mode**: Remix an existing Sora video (single or multi-shot) with new dialog and adjustments
- **Model & Quality Selection**: Choose model (e.g. `sora-2-pro`) and output quality (e.g. `720x1280`)

## Project Structure

```
/backend/
  app.py              # Flask server with API endpoints
  generator.py        # Sora video generation logic
  stitcher.py         # Video concatenation
  config.json         # API key storage (not in git)
  config.example.json # Template for configuration
  requirements.txt    # Python dependencies
  /output/            # Generated videos storage

/frontend/
  index.html          # Main UI
  app.js              # Client-side logic
  styles.css          # Styling

/utils/              # Existing utilities
  downloader.py
  director.py
  prompt_templates.py
```

## Setup Instructions

Follow these steps **in order** if you're starting fresh after downloading from GitHub:

### Step 1: Verify Prerequisites

Make sure you have:
- **Python 3.8 or higher** installed
- **pip** (Python package manager)

To check your Python version:
```bash
python3 --version
```

### Step 2: Navigate to Project Directory

Open your terminal and navigate to the project folder:
```bash
cd /path/to/Video_Gen\ copy
```

(Replace `/path/to/Video_Gen\ copy` with your actual project path)

### Step 3: Set Up Python Virtual Environment

Create and activate a virtual environment (recommended to avoid conflicts):

**On macOS/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

**On Windows:**
```bash
python -m venv venv
venv\Scripts\activate
```

**Note:** If a `venv` folder already exists, you can skip the creation step and just activate it.

You should see `(venv)` at the start of your command prompt when activated. If you don't see this, the virtual environment is not active - repeat the activation command for your operating system.

### Step 4: Install Python Dependencies

Install all required packages:
```bash
pip install -r backend/requirements.txt
```

Wait for all packages to install. This may take a few minutes.

### Step 5: Configure API Key

1. **Copy the example config file:**
   
   **On macOS/Linux:**
   ```bash
   cp backend/config.example.json backend/config.json
   ```
   
   **On Windows:**
   ```bash
   copy backend\config.example.json backend\config.json
   ```
   
   Or manually copy the file in Windows Explorer/Finder.

2. **Edit the config file:**
   - Open `backend/config.json` in a text editor
   - Replace `"your-api-key-here"` with your actual OpenAI API key
   - Your config file should look like:
     ```json
     {
         "openai_api_key": "sk-proj-your-actual-key-here"
     }
     ```
   - **Important:** Never commit this file to git (it's already in .gitignore)

### Step 6: Start the Backend Server

Start the Flask backend server:
```bash
cd backend
python app.py
```

You should see output like:
```
 * Running on http://0.0.0.0:8080
```

**Keep this terminal window open** - the server needs to keep running.

To stop the server later, press `Ctrl+C` in the terminal where it's running.

### Step 7: Open the Frontend

With the backend running, open your browser to:

`http://localhost:8080`

The backend serves the frontend files directly, so no separate static server is required. If you prefer to open the HTML file directly or use a separate static server, you can still open `frontend/index.html` or run `python3 -m http.server` in the `frontend` directory.

### Step 8: Verify Everything Works

1. In the web interface, check the API key status indicator (should show as configured)
2. If it shows "not configured", go back to Step 5 and verify your `config.json` file
3. Once the indicator shows the API key is configured, you're ready to generate videos!

---

## Quick Start Script (Alternative Method)

If you prefer an automated setup, you can use the provided script:

```bash
chmod +x start_server.sh
./start_server.sh
```

This script will:
- Create a virtual environment if it doesn't exist
- Install dependencies automatically
- Start the backend server

Then simply open `frontend/index.html` in your browser.

## Usage

**Prerequisites:** Complete the Setup Instructions above first.

1. **Make sure the backend is running** (from Step 6 above) - you should see the Flask server running in a terminal

2. **Open the frontend** (from Step 7 above) - the web interface should be open in your browser

3. **Verify API Key**: Check the API key status indicator in the web interface - it should show as configured

4. **Create Shots**:
   - Click "Add Shot" to create additional shots (up to 3)
   - Fill in required fields:
     - **Character Description**: Describe the characters (required)
     - **Environment Description**: Describe the setting (required)
     - **Reference Image (Shot 1 only)**: Optional image to influence generation. Shots 2 and 3 are generated via remix and do not accept image references.
     - **Lighting & Camera Angles**: Lighting and camera setup
     - **Dialog**: What the character says
   - Duration is fixed at 10 seconds per shot
   - Choose **Model** and **Quality** if exposed in the UI (defaults are `sora-2-pro` and `720x1280`)

5. **Generate**: Click "Generate Videos" and wait for processing

6. **Download**: Download individual shots or the complete stitched sequence

## API Endpoints

- `GET /api/check-key` - Check if API key is configured
- `POST /api/set-key` - Update API key (requires server restart)
- `POST /api/generate` - Generate video sequence
- `GET /api/progress/<task_id>` - Stream progress events for a generation/remix task (SSE)
- `GET /api/generate-result/<task_id>` - Fetch the final result for a task
- `POST /api/remix` - Remix existing video(s) with new dialog and options (single or multi-shot)
- `POST /api/stitch/<sequence_id>` - Stitch shots into one video
- `GET /api/download/<sequence_id>/<shot_number>` - Download individual shot
- `GET /api/download-sequence/<sequence_id>` - Download stitched sequence
- `GET /api/status/<video_id>` - Check generation status

## Configuration

### API Key

The API key is stored in `backend/config.json`. You can:
- Edit it directly (requires server restart)
- Use the `/api/set-key` endpoint to update it

### Output Location

Generated videos are stored in `backend/output/<sequence_id>/` where `<sequence_id>` is a timestamp-based identifier.

## Technical Details

### Video Generation Process

1. **First Shot**: Uses `openai.videos.create()` to generate initial video (optional image reference supported)
2. **Subsequent Shots**: Uses `openai.videos.remix()` to maintain visual consistency across shots (no image reference)
3. **Prompt Building**: Combines user inputs into comprehensive Sora prompts
4. **Progress Tracking**: Polls OpenAI API for generation status
5. **Download**: Downloads completed videos to local storage

### Video Stitching

Uses MoviePy to concatenate multiple MP4 files into a single video sequence.

### Frontend-Backend Communication

The frontend uses vanilla JavaScript with fetch API to communicate with the Flask backend. No frameworks or build tools required. The backend serves `index.html`, `styles.css`, and `app.js` so the app is accessible at `http://localhost:8080/` when the server is running.

## Troubleshooting

### Setup Issues

**"python3: command not found"**
- Make sure Python 3 is installed. On macOS, you can install it via Homebrew: `brew install python3`
- On Windows, download from python.org
- Try using `python` instead of `python3` on some systems

**"pip: command not found"**
- Make sure pip is installed. Try: `python3 -m ensurepip --upgrade`
- On some systems, use `pip3` instead of `pip`

**"Module not found" errors after installation**
- Make sure your virtual environment is activated (you should see `(venv)` in your terminal prompt)
- Reinstall dependencies: `pip install -r backend/requirements.txt`
- Make sure you're installing from the project root directory

**"Port 8080 already in use"**
- Another process is using port 8080. Either:
  - Stop the other process
  - Edit `backend/app.py` and change `port=8080` to a different port (e.g., `port=8081`)
  - Update `frontend/app.js` to use the same port in `API_BASE_URL`

**Frontend can't connect to backend**
- Make sure the backend server is running (Step 6)
- Make sure you're accessing the frontend from the correct URL
- Check browser console (F12) for CORS errors
- If opening `index.html` directly doesn't work, try using a local HTTP server (Option B in Step 7)

### API Key Issues
- Make sure `backend/config.json` exists (copy from `config.example.json` if needed)
- Verify the API key is correct and has quotes: `"openai_api_key": "sk-proj-..."`
- Check the API key status indicator on the web interface
- **Restart the server** after updating the config file (stop with Ctrl+C, then restart)
- Make sure your OpenAI API key has access to Sora 2

### Generation Failures
- Check that all required fields are filled (Character and Environment descriptions)
- Ensure you have sufficient API credits in your OpenAI account
- Review error messages in the progress section
- Check the backend terminal for detailed error messages
- Verify your API key has Sora 2 access enabled

### Video Download Issues
- Check that the generation completed successfully
- Verify output files exist in `backend/output/<sequence_id>/`
- Check browser console (F12) for errors
- Make sure the backend server is still running

## Dependencies

### Backend
- flask>=3.0.0
- flask-cors>=4.0.0
- openai>=2.2.0
- moviepy>=1.0.3
- pillow>=11.3.0

### Frontend
- None (vanilla HTML/CSS/JavaScript)

## License

This project is provided as-is for educational and development purposes.

## Notes

- Each shot is exactly 10 seconds long
- Maximum 3 shots per sequence
- Videos are generated vertically (720x1280) by default
- The remix feature ensures visual consistency across shots
- Reference images are optional and enhance generation quality (supported for the first shot only)

