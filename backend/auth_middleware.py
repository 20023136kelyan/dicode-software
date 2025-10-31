"""
Firebase Authentication Middleware for Flask
Verifies Firebase ID tokens from Authorization header
"""

import os
from functools import wraps
from flask import request, jsonify
import firebase_admin
from firebase_admin import credentials, auth

# Initialize Firebase Admin SDK
def initialize_firebase_admin():
    """Initialize Firebase Admin SDK with credentials"""
    try:
        # Check if already initialized
        firebase_admin.get_app()
        print("Firebase Admin already initialized")
    except ValueError:
        # Not initialized yet, initialize now
        # Initialize without credentials - we only need to verify ID tokens
        # This works on any platform (Railway, Cloud Run, local, etc.)
        firebase_admin.initialize_app(options={
            'projectId': os.environ.get('FIREBASE_PROJECT_ID', 'dicode-video-gen'),
        })
        print("Firebase Admin initialized successfully")


def verify_token(id_token):
    """
    Verify Firebase ID token
    Returns decoded token if valid, None otherwise
    """
    try:
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token
    except Exception as e:
        print(f"Token verification failed: {e}")
        return None


def require_auth(f):
    """
    Decorator to require Firebase authentication
    Checks for Authorization: Bearer <token> header
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Get Authorization header
        auth_header = request.headers.get('Authorization')

        if not auth_header:
            return jsonify({'error': 'No authorization header'}), 401

        # Extract token from "Bearer <token>"
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            return jsonify({'error': 'Invalid authorization header format'}), 401

        token = parts[1]

        # Verify token
        decoded_token = verify_token(token)
        if not decoded_token:
            return jsonify({'error': 'Invalid or expired token'}), 401

        # Add user info to request context
        request.user = decoded_token

        return f(*args, **kwargs)

    return decorated_function


def optional_auth(f):
    """
    Decorator for optional authentication
    Adds user info if token is present and valid, but doesn't require it
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Get Authorization header
        auth_header = request.headers.get('Authorization')

        if auth_header:
            # Extract token
            parts = auth_header.split()
            if len(parts) == 2 and parts[0].lower() == 'bearer':
                token = parts[1]
                decoded_token = verify_token(token)
                if decoded_token:
                    request.user = decoded_token

        # Continue regardless of auth status
        return f(*args, **kwargs)

    return decorated_function
