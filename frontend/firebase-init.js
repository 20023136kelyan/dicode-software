// Firebase initialization script
// This file initializes Firebase with credentials

let firebaseApp = null;
let firebaseInitialized = false;

// Initialize Firebase
async function initializeFirebase() {
    try {
        // Firebase config from environment
        const firebaseConfig = {
            apiKey: "AIzaSyAL0oArAIfVLd5kwGvhupkrC-th1fWa6vY",
            authDomain: "dicode-video-gen.firebaseapp.com",
            projectId: "dicode-video-gen",
            storageBucket: "dicode-video-gen.firebasestorage.app",
            messagingSenderId: "859383774863",
            appId: "1:859383774863:web:79f7e1a3b2909a167bbafa"
        };

        // Import Firebase SDK (using CDN, loaded in HTML)
        if (typeof firebase === 'undefined') {
            console.error('Firebase SDK not loaded. Make sure Firebase scripts are included in HTML.');
            return null;
        }

        // Initialize Firebase
        firebaseApp = firebase.initializeApp(firebaseConfig);
        firebaseInitialized = true;

        console.log('Firebase initialized successfully');
        return firebaseApp;
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        return null;
    }
}

// Get Firebase app instance
function getFirebaseApp() {
    if (!firebaseInitialized) {
        console.warn('Firebase not initialized. Call initializeFirebase() first.');
        return null;
    }
    return firebaseApp;
}

// Get Firebase services (Firestore, Auth, Storage, etc.)
function getFirestore() {
    const app = getFirebaseApp();
    if (!app) return null;
    return firebase.firestore();
}

function getAuth() {
    const app = getFirebaseApp();
    if (!app) return null;
    return firebase.auth();
}

function getStorage() {
    const app = getFirebaseApp();
    if (!app) return null;
    return firebase.storage();
}

// Export functions for use in other scripts
window.firebaseInit = {
    initializeFirebase,
    getFirebaseApp,
    getFirestore,
    getAuth,
    getStorage,
    isInitialized: () => firebaseInitialized
};

