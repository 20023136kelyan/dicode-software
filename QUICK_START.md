# Quick Start Guide

## Setup & Running

### Option 1: Using the Start Script (Recommended)

```bash
./start_server.sh
```

### Option 2: Manual Setup

1. **Install Dependencies:**
```bash
cd backend
pip install -r requirements.txt
```

2. **Start Backend:**
```bash
python app.py
```

3. **Open Frontend:**
   - Open `frontend/index.html` in your web browser
   - Or serve it with a simple HTTP server:
```bash
cd frontend
python -m http.server 8000
# Then open http://localhost:8000
```

## First Use

1. The API key is already configured in `backend/config.json`
2. If you need to change it, edit `backend/config.json` and restart the server
3. Open the frontend and start generating videos!

## Creating a Video

1. Fill in the character and environment descriptions (required)
2. Optionally add reference images, lighting details, and dialog
3. Add more shots if desired (up to 3 total)
4. Click "Generate Videos"
5. Wait for generation to complete
6. Download individual shots or the complete stitched sequence

## Configuration

The OpenAI API key is stored in `backend/config.json`. To update it:

1. Edit `backend/config.json`
2. Replace the `openai_api_key` value with your key
3. Restart the server

## Troubleshooting

- **Port 5000 in use?** Edit `backend/app.py` to change the port
- **CORS errors?** Make sure the backend is running
- **Generation fails?** Check your API key and credits
- **Videos not stitching?** Ensure moviepy is installed correctly

