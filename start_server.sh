#!/bin/bash

# Start the Sora Video Generator Backend Server

echo "🎬 Starting Sora Video Generator Backend..."
echo ""

# Check if we're in the project root
if [ ! -f "backend/app.py" ]; then
    echo "Error: backend/app.py not found"
    echo "Please run this script from the project root directory"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies if needed
if [ ! -f "venv/installed.txt" ]; then
    echo "Installing dependencies..."
    pip install -r backend/requirements.txt
    touch venv/installed.txt
fi

# Start the Flask server
echo ""
echo "Starting Flask server on http://localhost:8080"
echo "Open frontend/index.html in your browser to use the app"
echo ""

cd backend && python app.py

