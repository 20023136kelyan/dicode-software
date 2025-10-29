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

### 1. Prerequisites

- Python 3.8 or higher
- pip (Python package manager)

### 2. Backend Setup

1. Install Python dependencies:
```bash
cd backend
pip install -r requirements.txt
```

2. Configure API Key:
   - Copy `config.example.json` to `config.json`
   - Edit `config.json` and add your OpenAI API key
   - Or the API key is already configured in `config.json`

3. Start the Flask server:
```bash
python app.py
```

The backend will run on `http://localhost:8080`

### 3. Frontend Setup

Simply open `frontend/index.html` in your web browser. No build step or additional setup required.

Or serve it with a simple HTTP server:
```bash
cd frontend
# Python 3
python -m http.server 8000

# Or use Node.js http-server
npx http-server -p 8000
```

Then open `http://localhost:8000` in your browser.

## Usage

1. **Configure API Key**: Make sure your OpenAI API key is in `backend/config.json`

2. **Start the Backend**: Run `python backend/app.py`

3. **Open the Frontend**: Open `frontend/index.html` in your browser

4. **Create Shots**:
   - Click "Add Shot" to create additional shots (up to 3)
   - Fill in required fields:
     - **Character Description**: Describe the characters (required)
     - **Environment Description**: Describe the setting (required)
     - **Reference Image**: Optional image to influence generation
     - **Lighting & Camera Angles**: Lighting and camera setup
     - **Dialog**: What the character says
   - Duration is fixed at 10 seconds per shot

5. **Generate**: Click "Generate Videos" and wait for processing

6. **Download**: Download individual shots or the complete stitched sequence

## API Endpoints

- `GET /api/check-key` - Check if API key is configured
- `POST /api/set-key` - Update API key (requires server restart)
- `POST /api/generate` - Generate video sequence
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

1. **First Shot**: Uses `openai.videos.create()` to generate initial video
2. **Subsequent Shots**: Uses `openai.videos.remix()` to maintain visual consistency across shots
3. **Prompt Building**: Combines user inputs into comprehensive Sora prompts
4. **Progress Tracking**: Polls OpenAI API for generation status
5. **Download**: Downloads completed videos to local storage

### Video Stitching

Uses MoviePy to concatenate multiple MP4 files into a single video sequence.

### Frontend-Backend Communication

The frontend uses vanilla JavaScript with fetch API to communicate with the Flask backend. No frameworks or build tools required.

## Troubleshooting

### API Key Issues
- Make sure your API key is in `backend/config.json`
- Check the API key status indicator on the web interface
- Restart the server after updating the config file

### Generation Failures
- Check that all required fields are filled
- Ensure you have sufficient API credits
- Review error messages in the progress section

### Video Download Issues
- Check that the generation completed successfully
- Verify output files exist in `backend/output/`
- Check browser console for errors

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
- Reference images are optional and enhance generation quality

