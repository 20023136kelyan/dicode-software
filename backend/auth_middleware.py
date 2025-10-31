"""
Firebase Authentication Middleware for Flask
Verifies Firebase ID tokens from Authorization header using Google's public keys
No service account needed!
"""

import os
import json
from functools import wraps
from flask import request, jsonify
import requests
from jose import jwt, JWTError

# Firebase public keys URL
FIREBASE_KEYS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"

# Cache for public keys
_firebase_public_keys = None
_keys_cache_time = 0

def initialize_firebase_admin():
    """No initialization needed for public key verification"""
    print("Using Firebase public key verification (no credentials required)")


def get_firebase_public_keys():
    """Fetch Firebase public keys for token verification"""
    global _firebase_public_keys, _keys_cache_time
    import time

    # Cache keys for 1 hour
    current_time = time.time()
    if _firebase_public_keys and (current_time - _keys_cache_time) < 3600:
        return _firebase_public_keys

    try:
        response = requests.get(FIREBASE_KEYS_URL, timeout=5)
        response.raise_for_status()
        _firebase_public_keys = response.json()
        _keys_cache_time = current_time
        return _firebase_public_keys
    except Exception as e:
        print(f"Error fetching Firebase public keys: {e}")
        return _firebase_public_keys if _firebase_public_keys else {}


def verify_token(id_token):
    """
    Verify Firebase ID token using Google's public keys
    Returns decoded token if valid, None otherwise
    """
    try:
        # Get Firebase public keys
        public_keys = get_firebase_public_keys()
        if not public_keys:
            print("No public keys available")
            return None

        # Get the key ID from token header
        unverified_header = jwt.get_unverified_header(id_token)
        key_id = unverified_header.get('kid')

        if not key_id or key_id not in public_keys:
            print(f"Invalid key ID: {key_id}")
            return None

        # Get the public key
        public_key = public_keys[key_id]

        # Verify the token
        project_id = os.environ.get('FIREBASE_PROJECT_ID', 'dicode-video-gen')
        decoded_token = jwt.decode(
            id_token,
            public_key,
            algorithms=['RS256'],
            audience=project_id,
            issuer=f'https://securetoken.google.com/{project_id}'
        )

        return decoded_token
    except JWTError as e:
        print(f"JWT verification failed: {e}")
        return None
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
