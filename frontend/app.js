// ===== BACKEND CONFIGURATION =====
// Set your backend URL here:
// - For local backend: 'http://localhost:8080/api'
// - For ngrok tunnel: 'https://your-id.ngrok-free.app/api'
// - For localtunnel: 'https://your-subdomain.loca.lt/api'
// - For Cloud Run: 'https://your-backend.run.app/api'
// - Leave null for auto-detection (localhost in dev)
const BACKEND_URL = 'https://video-gen-backend-859383774863.us-central1.run.app/api';  // Auto-updated by script

// API Base URL - uses BACKEND_URL if set, otherwise auto-detects
const API_BASE_URL = (() => {
    // Use configured URL if provided
    if (BACKEND_URL) {
        return BACKEND_URL;
    }

    // Auto-detect: use localhost
    return 'http://localhost:8080/api';
})();

let currentShots = 1;
let sequenceResults = null;
let currentRemixShots = 1;
let currentUser = null;
let authToken = null;

// ===== AUTHENTICATION =====
async function setupAuth() {
    console.log('Setting up authentication...');

    // Check if Firebase is available
    if (typeof firebase === 'undefined') {
        console.error('Firebase is not loaded!');
        alert('Firebase SDK not loaded. Please refresh the page.');
        return;
    }

    console.log('Firebase available:', firebase);

    const auth = firebase.auth();
    console.log('Auth instance:', auth);

    // Listen for auth state changes
    auth.onAuthStateChanged(async (user) => {
        console.log('Auth state changed, user:', user);
        currentUser = user;

        if (user) {
            // User is signed in
            authToken = await user.getIdToken();
            document.getElementById('user-email').textContent = user.email;
            document.getElementById('user-info').style.display = 'block';
            document.getElementById('login-prompt').style.display = 'none';

            // Enable forms
            document.getElementById('generation-form').style.pointerEvents = 'auto';
            document.getElementById('generation-form').style.opacity = '1';
            document.getElementById('remix-form').style.pointerEvents = 'auto';
            document.getElementById('remix-form').style.opacity = '1';

            // Check API key now that we're authenticated
            checkApiKey();
        } else {
            // User is signed out
            authToken = null;
            document.getElementById('user-info').style.display = 'none';
            document.getElementById('login-prompt').style.display = 'block';

            // Disable forms
            document.getElementById('generation-form').style.pointerEvents = 'none';
            document.getElementById('generation-form').style.opacity = '0.5';
            document.getElementById('remix-form').style.pointerEvents = 'none';
            document.getElementById('remix-form').style.opacity = '0.5';

            document.getElementById('status-text').textContent = 'Please sign in to continue';
        }
    });

    // Login button
    const loginBtn = document.getElementById('login-btn');
    console.log('Login button element:', loginBtn);

    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            console.log('Login button clicked!');
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('email');
            try {
                console.log('Attempting sign in...');
                await auth.signInWithPopup(provider);
            } catch (error) {
                console.error('Login error:', error);
                alert('Login failed: ' + error.message);
            }
        });
        console.log('Login button event listener attached');
    } else {
        console.error('Login button not found!');
    }

    // Logout button
    document.getElementById('logout-btn').addEventListener('click', async () => {
        try {
            await auth.signOut();
        } catch (error) {
            console.error('Logout error:', error);
        }
    });
}

// Helper function to get auth headers
async function getAuthHeaders() {
    if (!currentUser) {
        return {};
    }

    // Refresh token if needed
    authToken = await currentUser.getIdToken(true);

    return {
        'Authorization': `Bearer ${authToken}`
    };
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM Content Loaded - Starting initialization...');

    try {
        // Wait for Firebase to initialize
        console.log('Initializing Firebase...');
        await window.firebaseInit.initializeFirebase();
        console.log('Firebase initialized');

        // Setup authentication
        console.log('Setting up auth...');
        await setupAuth();
        console.log('Auth setup complete');

        initializeForm();
        setupEventListeners();
        setupTabs();
        initializeRemixForm();
        console.log('App initialization complete!');
    } catch (error) {
        console.error('Error during initialization:', error);
        alert('Failed to initialize app: ' + error.message);
    }
});

// Check API key status
async function checkApiKey() {
    try {
        const authHeaders = await getAuthHeaders();
        const response = await fetch(`${API_BASE_URL}/check-key`, {
            headers: authHeaders
        });
        const data = await response.json();
        
        const statusDot = document.getElementById('status-dot');
        const statusText = document.getElementById('status-text');
        
        if (data.configured && data.has_value) {
            statusDot.classList.add('configured');
            statusText.textContent = 'API key configured ✓';
        } else {
            statusText.textContent = '⚠️ API key not configured. Add your key to backend/config.json and restart the server.';
        }
    } catch (error) {
        console.error('Error checking API key:', error);
        document.getElementById('status-text').textContent = '❌ Unable to connect to server';
    }
}

// Initialize form with first shot
function initializeForm() {
    // Add first shot without incrementing currentShots
    const container = document.getElementById('shots-container');
    const shotPanel = createShotPanel(1);
    container.appendChild(shotPanel);
    updateShotsCount();
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('add-shot-btn').addEventListener('click', () => {
        if (currentShots < 3) {
            addShot();
        }
    });
    
    document.getElementById('apply-to-all-btn').addEventListener('click', applySharedSettings);
    
    document.getElementById('generate-btn').addEventListener('click', generateVideos);
    const remixBtn = document.getElementById('remix-btn');
    if (remixBtn) {
        remixBtn.addEventListener('click', submitRemix);
    }
    const addRemixShotBtn = document.getElementById('add-remix-shot-btn');
    if (addRemixShotBtn) {
        addRemixShotBtn.addEventListener('click', () => {
            if (currentRemixShots < 3) addRemixShot();
        });
    }
}

// Tabs between Generate and Remix
function setupTabs() {
    const tabGenerate = document.getElementById('tab-generate');
    const tabRemix = document.getElementById('tab-remix');
    const genForm = document.getElementById('generation-form');
    const remixForm = document.getElementById('remix-form');
    if (!tabGenerate || !tabRemix || !genForm || !remixForm) return;
    tabGenerate.addEventListener('click', () => {
        tabGenerate.classList.add('active');
        tabRemix.classList.remove('active');
        genForm.style.display = 'block';
        remixForm.style.display = 'none';
        document.getElementById('progress-section').style.display = 'none';
        document.getElementById('results-section').style.display = 'none';
    });
    tabRemix.addEventListener('click', () => {
        tabRemix.classList.add('active');
        tabGenerate.classList.remove('active');
        genForm.style.display = 'none';
        remixForm.style.display = 'block';
        document.getElementById('progress-section').style.display = 'none';
        document.getElementById('results-section').style.display = 'none';
    });
}

// Initialize remix form with the first shot
function initializeRemixForm() {
    const container = document.getElementById('remix-shots-container');
    if (!container) return;
    container.innerHTML = '';
    currentRemixShots = 1;
    const panel = createRemixShotPanel(1);
    container.appendChild(panel);
    updateRemixShotsCount();
}

function addRemixShot() {
    if (currentRemixShots >= 3) return;
    currentRemixShots++;
    updateRemixShotsCount();
    enableAddRemixButton(currentRemixShots < 3);
    const container = document.getElementById('remix-shots-container');
    const panel = createRemixShotPanel(currentRemixShots);
    container.appendChild(panel);
}

function removeRemixShot(shotNumber) {
    const panel = document.getElementById(`remix-shot-${shotNumber}`);
    if (panel) {
        panel.remove();
        currentRemixShots--;
        updateRemixShotsCount();
        enableAddRemixButton(currentRemixShots < 3);
        renumberRemixShots();
    }
}

function renumberRemixShots() {
    const container = document.getElementById('remix-shots-container');
    const shots = container.querySelectorAll('.shot-panel');
    shots.forEach((panel, index) => {
        const newNumber = index + 1;
        const oldNumber = panel.id.replace('remix-shot-', '');
        panel.id = `remix-shot-${newNumber}`;
        const ids = panel.querySelectorAll('[id^="remix-dialog-"], [id^="remix-expand-btn-"], [id^="remix-expand-text-"], [id^="remix-form-group-"]');
        ids.forEach(el => { el.id = el.id.replace(`-${oldNumber}`, `-${newNumber}`); });
        const numEl = panel.querySelector('.shot-number');
        if (numEl) numEl.textContent = `Shot ${newNumber}`;
        const removeBtn = panel.querySelector('.remove-shot-btn');
        if (removeBtn) removeBtn.setAttribute('onclick', `removeRemixShot(${newNumber})`);
        const expandBtn = panel.querySelector('.expand-btn');
        if (expandBtn) expandBtn.setAttribute('onclick', `expandRemixShotFields(${newNumber})`);
    });
}

function updateRemixShotsCount() {
    const el = document.getElementById('remix-shots-count');
    if (el) el.textContent = `${currentRemixShots} of 3 shots`;
}

function enableAddRemixButton(enabled) {
    const btn = document.getElementById('add-remix-shot-btn');
    if (!btn) return;
    btn.disabled = !enabled;
}

function createRemixShotPanel(shotNumber) {
    const panel = document.createElement('div');
    panel.className = 'shot-panel';
    panel.id = `remix-shot-${shotNumber}`;
    panel.innerHTML = `
        <div class="shot-header">
            <span class="shot-number">Shot ${shotNumber}</span>
            <div class="shot-actions">
                <button class="expand-btn" onclick="expandRemixShotFields(${shotNumber})" id="remix-expand-btn-${shotNumber}">
                    <span id="remix-expand-text-${shotNumber}">Show Character/Environment/Lighting</span>
                </button>
                <button class="remove-shot-btn" onclick="removeRemixShot(${shotNumber})">🗑️ Remove</button>
            </div>
        </div>
        <div class="form-group hidden-field" id="remix-form-group-characters-${shotNumber}">
            <label>Character Description ${shotNumber === 1 ? '(Optional)' : '(Optional)'}</label>
            <textarea id="remix-characters-${shotNumber}" placeholder="Describe the characters (optional)"></textarea>
        </div>
        <div class="form-group hidden-field" id="remix-form-group-environment-${shotNumber}">
            <label>Environment Description ${shotNumber === 1 ? '(Optional)' : '(Optional)'}</label>
            <textarea id="remix-environment-${shotNumber}" placeholder="Describe the environment (optional)"></textarea>
        </div>
        <div class="form-group hidden-field" id="remix-form-group-lighting-${shotNumber}">
            <label>Lighting & Camera Angles ${shotNumber === 1 ? '(Optional)' : '(Optional)'}</label>
            <textarea id="remix-lighting-${shotNumber}" placeholder="Lighting and camera setup (optional)"></textarea>
        </div>
        <div class="form-group">
            <label for="remix-dialog-${shotNumber}">Dialog *</label>
            <textarea id="remix-dialog-${shotNumber}" placeholder="New dialog for this shot" required></textarea>
        </div>
        <div style="text-align: center;">
            <span class="duration-badge">Duration: 12 seconds</span>
        </div>
    `;
    return panel;
}

function expandRemixShotFields(shotNumber) {
    const expandText = document.getElementById(`remix-expand-text-${shotNumber}`);
    const expandBtn = document.getElementById(`remix-expand-btn-${shotNumber}`);
    if (!expandBtn) return;
    const isExpanded = expandBtn.classList.contains('expanded');
    const fieldIds = [
        `remix-form-group-characters-${shotNumber}`,
        `remix-form-group-environment-${shotNumber}`,
        `remix-form-group-lighting-${shotNumber}`
    ];
    if (isExpanded) {
        fieldIds.forEach(id => document.getElementById(id)?.classList.add('hidden-field'));
        expandBtn.classList.remove('expanded');
        if (expandText) expandText.textContent = 'Show Character/Environment/Lighting';
    } else {
        fieldIds.forEach(id => document.getElementById(id)?.classList.remove('hidden-field'));
        expandBtn.classList.add('expanded');
        if (expandText) expandText.textContent = 'Hide Character/Environment/Lighting';
    }
}

// Submit Remix
async function submitRemix() {
    const videoId = document.getElementById('remix-video-id')?.value.trim();
    if (!videoId) { alert('Video ID is required'); return; }

    // Collect shots
    const shots = [];
    for (let i = 1; i <= currentRemixShots; i++) {
        const panel = document.getElementById(`remix-shot-${i}`);
        if (!panel) continue;
        const dialog = document.getElementById(`remix-dialog-${i}`)?.value.trim();
        if (!dialog) { alert(`Shot ${i} is missing required field (Dialog)`); return; }
        shots.push({
            characters: document.getElementById(`remix-characters-${i}`)?.value || '',
            environment: document.getElementById(`remix-environment-${i}`)?.value || '',
            lighting: document.getElementById(`remix-lighting-${i}`)?.value || '',
            camera_angles: document.getElementById(`remix-lighting-${i}`)?.value || '',
            dialog
        });
    }

    const payload = { video_id: videoId, shots };

    try {
        // Show progress area
        document.getElementById('progress-section').style.display = 'block';
        document.getElementById('results-section').style.display = 'none';
        const progressContainer = document.getElementById('progress-container');
        progressContainer.innerHTML = '<div class="progress-item">Initializing remix...</div>';
        const btn = document.getElementById('remix-btn');
        btn.disabled = true;

        const authHeaders = await getAuthHeaders();
        const response = await fetch(`${API_BASE_URL}/remix`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `Server error: ${response.status}`;
            try { errorMessage = JSON.parse(errorText).error || errorMessage; } catch {}
            throw new Error(errorMessage);
        }

        const startResult = await response.json();
        if (startResult.error || startResult.status === 'error') {
            throw new Error(startResult.error || 'Remix failed to start');
        }

        const taskId = startResult.task_id;
        const eventSource = new EventSource(`${API_BASE_URL}/progress/${taskId}`);
        eventSource.onmessage = function(event) {
            const data = JSON.parse(event.data);
            if (data.type === 'progress') {
                updateProgressDisplay(data);
            } else if (data.type === 'shot_start') {
                progressContainer.innerHTML += `<div class="progress-item">${data.message}</div>`;
            } else if (data.type === 'shot_complete') {
                progressContainer.innerHTML += `<div class="progress-item" style="color: #10b981;">✓ ${data.message}</div>`;
            } else if (data.type === 'complete') {
                eventSource.close();
                sequenceResults = data.result;
                displayResults(sequenceResults);
                btn.disabled = false;
            } else if (data.type === 'error') {
                eventSource.close();
                showError(data.message);
                btn.disabled = false;
            }
        };

        eventSource.onerror = function(error) {
            console.error('EventSource failed:', error);
            eventSource.close();
            btn.disabled = false;
        };
    } catch (error) {
        showError(error.message);
        const btn = document.getElementById('remix-btn');
        if (btn) btn.disabled = false;
    }
}

// Add a new shot panel
function addShot() {
    if (currentShots >= 3) return;
    
    currentShots++;
    updateShotsCount();
    enableAddButton(currentShots < 3);
    
    const container = document.getElementById('shots-container');
    const shotPanel = createShotPanel(currentShots);
    container.appendChild(shotPanel);
    
    // Auto-apply shared settings to new shot if they exist
    const sharedCharacters = document.getElementById('shared-characters')?.value || '';
    const sharedEnvironment = document.getElementById('shared-environment')?.value || '';
    const sharedLighting = document.getElementById('shared-lighting')?.value || '';
    
    let hasSharedSettings = false;
    const hiddenFieldIds = [];
    
    if (sharedCharacters) {
        const charactersField = document.getElementById(`characters-${currentShots}`);
        if (charactersField) {
            charactersField.value = sharedCharacters;
            toggleFieldVisibility(`characters-${currentShots}`, true);
            hiddenFieldIds.push(`characters-${currentShots}`);
            hasSharedSettings = true;
        }
    }
    
    if (sharedEnvironment) {
        const environmentField = document.getElementById(`environment-${currentShots}`);
        if (environmentField) {
            environmentField.value = sharedEnvironment;
            toggleFieldVisibility(`environment-${currentShots}`, true);
            hiddenFieldIds.push(`environment-${currentShots}`);
            hasSharedSettings = true;
        }
    }
    
    if (sharedLighting) {
        const lightingField = document.getElementById(`lighting-${currentShots}`);
        if (lightingField) {
            lightingField.value = sharedLighting;
            toggleFieldVisibility(`lighting-${currentShots}`, true);
            hiddenFieldIds.push(`lighting-${currentShots}`);
            hasSharedSettings = true;
        }
    }
    
    // Show expand button if there are shared settings
    const expandBtn = document.getElementById(`expand-btn-${currentShots}`);
    if (hasSharedSettings && expandBtn) {
        expandBtn.classList.remove('hidden');
        expandBtn.dataset.hiddenFields = hiddenFieldIds.join(',');
    }
}

// Create a shot panel element
function createShotPanel(shotNumber) {
    const panel = document.createElement('div');
    panel.className = 'shot-panel';
    panel.id = `shot-${shotNumber}`;
    
    panel.innerHTML = `
        <div class="shot-header">
            <span class="shot-number">Shot ${shotNumber}</span>
            <div class="shot-actions">
                ${shotNumber > 1 ? `
                <button class="expand-btn" onclick="expandShotFields(${shotNumber})" id="expand-btn-${shotNumber}">
                    <span id="expand-text-${shotNumber}">Show Character/Environment/Lighting</span>
                </button>
                ` : `
                <button class="expand-btn hidden" onclick="expandShot(${shotNumber})" id="expand-btn-${shotNumber}">
                    <span id="expand-text-${shotNumber}">Show Shared Settings</span>
                </button>
                `}
                <button class="remove-shot-btn" onclick="removeShot(${shotNumber})">🗑️ Remove</button>
            </div>
        </div>
        
        <div class="form-group ${shotNumber > 1 ? 'hidden-field' : ''}" id="form-group-characters-${shotNumber}">
            <label for="characters-${shotNumber}">Character Description ${shotNumber === 1 ? '*' : '(Optional)'}</label>
            <textarea id="characters-${shotNumber}" placeholder="Describe the characters in this shot (e.g., A 30-year-old male programmer with short dark hair, wearing a black t-shirt)" ${shotNumber === 1 ? 'required' : ''}></textarea>
            ${shotNumber > 1 ? `<p style="font-size: 0.85em; color: #666; font-style: italic; margin-top: 4px;">If left empty, uses the same character from Shot 1. Only fill this if you want to change the character.</p>` : ''}
        </div>
        
        <div class="form-group ${shotNumber > 1 ? 'hidden-field' : ''}" id="form-group-environment-${shotNumber}">
            <label for="environment-${shotNumber}">Environment Description ${shotNumber === 1 ? '*' : '(Optional)'}</label>
            <textarea id="environment-${shotNumber}" placeholder="Describe the environment/setting (e.g., modern kitchen with morning light from window)" ${shotNumber === 1 ? 'required' : ''}></textarea>
            ${shotNumber > 1 ? `<p style="font-size: 0.85em; color: #666; font-style: italic; margin-top: 4px;">If left empty, uses the same environment from Shot 1. Only fill this if you want to change the environment.</p>` : ''}
        </div>
        
        ${shotNumber === 1 ? `
        <div class="form-group">
            <label for="image-${shotNumber}">Reference Image (Optional - Use with Caution)</label>
            <input type="file" id="image-${shotNumber}" accept="image/*" onchange="previewImage(${shotNumber})">
            <div id="image-preview-${shotNumber}" class="image-preview-container"></div>
            <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-left: 4px solid #f59e0b; padding: 16px; margin-top: 12px; border-radius: 12px; box-shadow: 0 2px 8px rgba(245, 158, 11, 0.2);">
                <strong style="color: #f59e0b; font-size: 1rem; display: block; margin-bottom: 8px;">⚠️ Content Moderation Warning</strong>
                <p style="margin: 8px 0 0 0; font-size: 0.9em; color: #78350f; line-height: 1.6;">
                    Reference images frequently trigger OpenAI's content moderation.
                    <strong>Only use images if absolutely necessary.</strong> Test without images first.
                </p>
                <p style="margin: 10px 0 0 0; font-size: 0.9em; color: #dc2626; font-weight: 600;">
                    ❌ DO NOT USE: Images with faces, people, or any human subjects - these will always trigger moderation
                </p>
                <p style="margin: 8px 0 0 0; font-size: 0.9em; color: #78350f; line-height: 1.6;">
                    ✅ SAFE: Landscapes, objects, abstract patterns, buildings, nature (NO people or faces)
                </p>
            </div>
        </div>
        ` : `
        <div class="form-group" style="display: none;">
            <label for="image-${shotNumber}">Reference Image</label>
            <input type="file" id="image-${shotNumber}" accept="image/*" onchange="previewImage(${shotNumber})" disabled>
            <div id="image-preview-${shotNumber}" class="image-preview-container"></div>
            <p style="font-size: 0.85em; color: #666; font-style: italic;">Reference images are only available for Shot 1 (remix shots inherit visuals from previous shot)</p>
        </div>
        `}
        
        <div class="form-group ${shotNumber > 1 ? 'hidden-field' : ''}" id="form-group-lighting-${shotNumber}">
            <label for="lighting-${shotNumber}">Lighting & Camera Angles ${shotNumber > 1 ? '(Optional)' : ''}</label>
            <textarea id="lighting-${shotNumber}" placeholder="Describe lighting and camera setup (e.g., Natural morning light, handheld camera, shallow depth of field, vertical 9:16 format)"></textarea>
            ${shotNumber > 1 ? `<p style="font-size: 0.85em; color: #666; font-style: italic; margin-top: 4px;">If left empty, uses the same lighting and camera angles from Shot 1. Only fill this if you want to change the lighting/camera.</p>` : ''}
        </div>
        
        <div class="form-group">
            <label for="dialog-${shotNumber}">Dialog *</label>
            <textarea id="dialog-${shotNumber}" placeholder="What the character says (e.g., 'OpenAI just dropped Sora 2 API... this is INSANE.')" required></textarea>
        </div>
        
        <div style="text-align: center;">
            <span class="duration-badge">Duration: 12 seconds</span>
        </div>
    `;
    
    return panel;
}

// Remove a shot panel
function removeShot(shotNumber) {
    const panel = document.getElementById(`shot-${shotNumber}`);
    if (panel) {
        panel.remove();
        currentShots--;
        updateShotsCount();
        enableAddButton(currentShots < 3);
        // Renumber all remaining shots
        renumberShots();
    }
}

// Renumber all shots sequentially starting from 1
function renumberShots() {
    const container = document.getElementById('shots-container');
    const shots = container.querySelectorAll('.shot-panel');
    
    shots.forEach((panel, index) => {
        const newNumber = index + 1;
        const oldNumber = panel.id.replace('shot-', '');
        
        // Update panel ID
        panel.id = `shot-${newNumber}`;
        
        // Update all IDs inside this shot
        const elementsToUpdate = panel.querySelectorAll('[id^="characters-"], [id^="environment-"], [id^="image-"], [id^="lighting-"], [id^="dialog-"], [id^="image-preview-"], [id^="expand-btn-"], [id^="expand-text-"], [id^="form-group-"]');
        elementsToUpdate.forEach(el => {
            const oldId = el.id;
            // Replace the old number with new number in the ID
            el.id = oldId.replace(`-${oldNumber}`, `-${newNumber}`);
        });
        
        // Update shot number display
        const shotNumberEl = panel.querySelector('.shot-number');
        if (shotNumberEl) {
            shotNumberEl.textContent = `Shot ${newNumber}`;
        }
        
        // Update onclick handlers
        const removeBtn = panel.querySelector('.remove-shot-btn');
        if (removeBtn) {
            removeBtn.setAttribute('onclick', `removeShot(${newNumber})`);
        }
        
        const expandBtn = panel.querySelector('.expand-btn');
        if (expandBtn) {
            // Update button handler based on shot number
            if (newNumber > 1) {
                expandBtn.setAttribute('onclick', `expandShotFields(${newNumber})`);
                // Update button text if visible
                const expandText = document.getElementById(`expand-text-${newNumber}`);
                if (expandText && !expandBtn.classList.contains('hidden')) {
                    const isExpanded = expandBtn.classList.contains('expanded');
                    expandText.textContent = isExpanded ? 'Hide Character/Environment/Lighting' : 'Show Character/Environment/Lighting';
                }
            } else {
                expandBtn.setAttribute('onclick', `expandShot(${newNumber})`);
            }
        }
        
        // Update file input onchange
        const fileInput = panel.querySelector(`#image-${newNumber}`);
        if (fileInput) {
            fileInput.setAttribute('onchange', `previewImage(${newNumber})`);
        }
    });
}

// Update shots count display
function updateShotsCount() {
    document.getElementById('shots-count').textContent = `${currentShots} of 3 shots`;
}

// Enable/disable add button
function enableAddButton(enabled) {
    const btn = document.getElementById('add-shot-btn');
    if (enabled) {
        btn.disabled = false;
    } else {
        btn.disabled = true;
    }
}

// Toggle field visibility based on shared settings
function toggleFieldVisibility(fieldId, hide) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    
    // Find the parent form-group
    let formGroup = field.parentElement;
    while (formGroup && !formGroup.classList.contains('form-group')) {
        formGroup = formGroup.parentElement;
    }
    
    if (formGroup) {
        if (hide) {
            formGroup.classList.add('hidden-field');
        } else {
            formGroup.classList.remove('hidden-field');
        }
    }
}

// Expand hidden fields for a specific shot (for shared settings)
function expandShot(shotNumber) {
    const expandText = document.getElementById(`expand-text-${shotNumber}`);
    const expandBtn = document.getElementById(`expand-btn-${shotNumber}`);
    const shotPanel = document.getElementById(`shot-${shotNumber}`);
    
    if (!shotPanel || !expandBtn) return;
    
    const isExpanded = expandBtn.classList.contains('expanded');
    
    // Get the list of hidden field IDs from the button's data attribute
    const hiddenFieldIds = expandBtn.dataset.hiddenFields ? expandBtn.dataset.hiddenFields.split(',') : [];
    
    if (isExpanded) {
        // Hide fields again
        hiddenFieldIds.forEach(fieldId => {
            if (fieldId) {
                const field = document.getElementById(fieldId);
                if (field) {
                    // Find the parent form-group
                    let formGroup = field.parentElement;
                    while (formGroup && !formGroup.classList.contains('form-group')) {
                        formGroup = formGroup.parentElement;
                    }
                    if (formGroup) {
                        formGroup.classList.add('hidden-field');
                    }
                }
            }
        });
        expandBtn.classList.remove('expanded');
        expandText.textContent = 'Show Shared Settings';
    } else {
        // Show fields
        hiddenFieldIds.forEach(fieldId => {
            if (fieldId) {
                const field = document.getElementById(fieldId);
                if (field) {
                    // Find the parent form-group
                    let formGroup = field.parentElement;
                    while (formGroup && !formGroup.classList.contains('form-group')) {
                        formGroup = formGroup.parentElement;
                    }
                    if (formGroup) {
                        formGroup.classList.remove('hidden-field');
                    }
                }
            }
        });
        expandBtn.classList.add('expanded');
        expandText.textContent = 'Hide Shared Settings';
    }
}

// Expand character, environment, and lighting fields for shots 2 and 3
function expandShotFields(shotNumber) {
    const expandText = document.getElementById(`expand-text-${shotNumber}`);
    const expandBtn = document.getElementById(`expand-btn-${shotNumber}`);
    
    if (!expandBtn) return;
    
    const isExpanded = expandBtn.classList.contains('expanded');
    const fieldIds = [
        `form-group-characters-${shotNumber}`,
        `form-group-environment-${shotNumber}`,
        `form-group-lighting-${shotNumber}`
    ];
    
    if (isExpanded) {
        // Hide fields
        fieldIds.forEach(fieldId => {
            const formGroup = document.getElementById(fieldId);
            if (formGroup) {
                formGroup.classList.add('hidden-field');
            }
        });
        expandBtn.classList.remove('expanded');
        expandText.textContent = 'Show Character/Environment/Lighting';
    } else {
        // Show fields
        fieldIds.forEach(fieldId => {
            const formGroup = document.getElementById(fieldId);
            if (formGroup) {
                formGroup.classList.remove('hidden-field');
            }
        });
        expandBtn.classList.add('expanded');
        expandText.textContent = 'Hide Character/Environment/Lighting';
    }
}

// Toggle shared settings visibility
function toggleSharedSettings() {
    const content = document.getElementById('shared-settings-content');
    const toggleBtn = document.getElementById('toggle-shared-settings-btn');
    const toggleText = document.getElementById('shared-settings-toggle-text');
    
    if (!content || !toggleBtn || !toggleText) return;
    
    const isExpanded = toggleBtn.classList.contains('expanded');
    
    if (isExpanded) {
        // Hide shared settings
        content.classList.add('hidden-field');
        toggleBtn.classList.remove('expanded');
        toggleText.textContent = 'Show Shared Settings';
    } else {
        // Show shared settings
        content.classList.remove('hidden-field');
        toggleBtn.classList.add('expanded');
        toggleText.textContent = 'Hide Shared Settings';
    }
}

// Apply shared settings to all shots
function applySharedSettings() {
    const sharedCharacters = document.getElementById('shared-characters')?.value || '';
    const sharedEnvironment = document.getElementById('shared-environment')?.value || '';
    const sharedLighting = document.getElementById('shared-lighting')?.value || '';
    
    if (!sharedCharacters && !sharedEnvironment && !sharedLighting) {
        alert('Please enter at least one shared setting (Characters, Environment, or Lighting)');
        return;
    }
    
    // Track if any settings are being applied
    let hasSharedSettings = false;
    
    // Apply to all existing shots
    for (let i = 1; i <= currentShots; i++) {
        const hiddenFieldIds = [];
        
        if (sharedCharacters) {
            const charactersField = document.getElementById(`characters-${i}`);
            if (charactersField) {
                charactersField.value = sharedCharacters;
                // Hide the field
                toggleFieldVisibility(`characters-${i}`, true);
                hiddenFieldIds.push(`characters-${i}`);
                hasSharedSettings = true;
            }
        }
        
        if (sharedEnvironment) {
            const environmentField = document.getElementById(`environment-${i}`);
            if (environmentField) {
                environmentField.value = sharedEnvironment;
                // Hide the field
                toggleFieldVisibility(`environment-${i}`, true);
                hiddenFieldIds.push(`environment-${i}`);
                hasSharedSettings = true;
            }
        }
        
        if (sharedLighting) {
            const lightingField = document.getElementById(`lighting-${i}`);
            if (lightingField) {
                lightingField.value = sharedLighting;
                // Hide the field
                toggleFieldVisibility(`lighting-${i}`, true);
                hiddenFieldIds.push(`lighting-${i}`);
                hasSharedSettings = true;
            }
        }
        
        // Show expand button if there are shared settings
        const expandBtn = document.getElementById(`expand-btn-${i}`);
        if (hasSharedSettings && expandBtn) {
            expandBtn.classList.remove('hidden');
            expandBtn.dataset.hiddenFields = hiddenFieldIds.join(',');
        }
    }
    
    // Show confirmation
    const btn = document.getElementById('apply-to-all-btn');
    const originalText = btn.textContent;
    btn.textContent = '✓ Applied!';
    btn.style.backgroundColor = '#10b981';
    
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.backgroundColor = '';
    }, 2000);
}

// Preview uploaded image
function previewImage(shotNumber) {
    const input = document.getElementById(`image-${shotNumber}`);
    const previewContainer = document.getElementById(`image-preview-${shotNumber}`);
    
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            previewContainer.innerHTML = `<img src="${e.target.result}" alt="Preview" class="image-preview">`;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// Collect shot data from form
function collectShotData(shotNumber) {
    const characters = document.getElementById(`characters-${shotNumber}`)?.value || '';
    const environment = document.getElementById(`environment-${shotNumber}`)?.value || '';
    const lighting = document.getElementById(`lighting-${shotNumber}`)?.value || '';
    const cameraAngles = document.getElementById(`lighting-${shotNumber}`)?.value || '';
    const dialog = document.getElementById(`dialog-${shotNumber}`)?.value || '';
    
    return {
        characters,
        environment,
        lighting: lighting || cameraAngles,
        camera_angles: cameraAngles,
        dialog
    };
}

// Generate videos
async function generateVideos() {
    try {
        // Validate and collect data from all shots
        const shotsData = [];
        for (let i = 1; i <= currentShots; i++) {
            const panel = document.getElementById(`shot-${i}`);
            if (panel) {
                const data = collectShotData(i);
                
                // Basic validation - only require characters and environment for shot 1
                if (i === 1 && (!data.characters || !data.environment || !data.dialog)) {
                    alert(`Shot 1 is missing required fields (Characters, Environment, or Dialog)`);
                    return;
                }
                // For shots 2 and 3, only dialog is required
                if (i > 1 && !data.dialog) {
                    alert(`Shot ${i} is missing required field (Dialog)`);
                    return;
                }
                
                shotsData.push(data);
            }
        }
        
        // Show progress section
        document.getElementById('progress-section').style.display = 'block';
        document.getElementById('results-section').style.display = 'none';
        document.getElementById('generate-btn').disabled = true;
        
        // Clear previous progress
        const progressContainer = document.getElementById('progress-container');
        progressContainer.innerHTML = '<div class="progress-item">Initializing generation...</div>';
        
        // Get video quality
        const quality = document.getElementById('video-quality')?.value || '720x1280';
        
        // Get Sora model
        const model = document.getElementById('sora-model')?.value || 'sora-2-pro';
        
        // Collect image file only for shot 1 (remix shots 2 and 3 don't use reference images)
        const imageFiles = [];
        
        // Only collect image for shot 1
        const shot1Input = document.getElementById('image-1');
        if (shot1Input && shot1Input.files && shot1Input.files[0]) {
            imageFiles[1] = shot1Input.files[0];
        }
        
        // Get auth headers
        const authHeaders = await getAuthHeaders();

        // Use FormData if we have images, otherwise use JSON
        let body, headers;
        if (imageFiles[1]) {
            const formData = new FormData();
            formData.append('shots', JSON.stringify(shotsData));
            formData.append('quality', quality);
            formData.append('model', model);

            // Only append image_1 (shots 2 and 3 don't use reference images)
            formData.append('image_1', imageFiles[1]);

            body = formData;
            headers = { ...authHeaders }; // Auth headers only, browser sets Content-Type
        } else {
            body = JSON.stringify({ shots: shotsData, quality: quality, model: model });
            headers = { 'Content-Type': 'application/json', ...authHeaders };
        }

        // Call backend API
        const response = await fetch(`${API_BASE_URL}/generate`, {
            method: 'POST',
            headers: headers,
            body: body
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `Server error: ${response.status}`;
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.error || errorMessage;
            } catch (e) {
                errorMessage = errorText || errorMessage;
            }
            throw new Error(errorMessage);
        }
        
        const startResult = await response.json();
        
        if (startResult.error || startResult.status === 'error') {
            throw new Error(startResult.error || 'Video generation failed to start');
        }
        
        // Get the task_id and connect to progress stream
        const taskId = startResult.task_id;
        
        // Connect to Server-Sent Events for progress updates
        const eventSource = new EventSource(`${API_BASE_URL}/progress/${taskId}`);
        
        let finalResult = null;
        
        eventSource.onmessage = function(event) {
            const data = JSON.parse(event.data);
            
            if (data.type === 'progress') {
                // Update progress display
                updateProgressDisplay(data);
            } else if (data.type === 'shot_start') {
                // Shot started
                progressContainer.innerHTML += `<div class="progress-item">${data.message}</div>`;
            } else if (data.type === 'shot_complete') {
                // Shot completed
                progressContainer.innerHTML += `<div class="progress-item" style="color: #10b981;">✓ ${data.message}</div>`;
            } else if (data.type === 'complete') {
                // Generation complete
                finalResult = data.result;
                eventSource.close();
                
                // Store results
                sequenceResults = finalResult;
                
                // Display results
                displayResults(finalResult);
            } else if (data.type === 'error') {
                // Error occurred
                eventSource.close();
                showError(data.message);
                document.getElementById('generate-btn').disabled = false;
            }
        };
        
        eventSource.onerror = function(error) {
            console.error('EventSource failed:', error);
            eventSource.close();
            
            // Fallback: try to get the result
            setTimeout(async () => {
                try {
                    const resultResponse = await fetch(`${API_BASE_URL}/generate-result/${taskId}`);
                    if (resultResponse.ok) {
                        const result = await resultResponse.json();
                        sequenceResults = result;
                        displayResults(result);
                    } else {
                        showError('Failed to get generation result');
                        document.getElementById('generate-btn').disabled = false;
                    }
                } catch (e) {
                    showError('Connection error');
                    document.getElementById('generate-btn').disabled = false;
                }
            }, 1000);
        };
        
    } catch (error) {
        showError(error.message);
        document.getElementById('generate-btn').disabled = false;
    }
}

// Update progress display
function updateProgressDisplay(data) {
    const progressContainer = document.getElementById('progress-container');
    
    // Find or create progress item for this shot
    let progressItem = document.getElementById(`shot-${data.shot_number}-progress`);
    
    if (!progressItem) {
        progressItem = document.createElement('div');
        progressItem.id = `shot-${data.shot_number}-progress`;
        progressItem.className = 'progress-item';
        progressContainer.appendChild(progressItem);
    }
    
    // Create progress bar HTML
    const progressBar = `
        <div style="margin: 10px 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                <span>${data.message}</span>
                <span style="font-weight: bold;">${data.progress.toFixed(1)}%</span>
            </div>
            <div style="background: #e5e7eb; border-radius: 10px; height: 8px; overflow: hidden;">
                <div style="background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%); height: 100%; width: ${data.progress}%; transition: width 0.3s ease;"></div>
            </div>
        </div>
    `;
    
    progressItem.innerHTML = progressBar;
}

// Display generation results
async function displayResults(result) {
    document.getElementById('progress-section').style.display = 'none';
    document.getElementById('results-section').style.display = 'block';
    
    const resultsContainer = document.getElementById('results-container');
    
    let html = '<div class="video-results">';
    
    // Display all shots separately
    if (result.shots && result.shots.length > 0) {
        result.shots.forEach((shot, index) => {
            html += `
                <div class="video-result-card" style="margin-top: ${index > 0 ? '15px' : '0'};">
                    <h4>Shot ${index + 1}</h4>
                    <p>Status: ${shot.status || 'completed'}</p>
                    <button class="download-btn" onclick="downloadShot('${result.sequence_id}', ${index + 1})">
                        📥 Download Shot ${index + 1}
                    </button>
                    ${shot.video_id ? `<p style="margin-top: 10px; font-size: 0.85em; color: #666; font-family: monospace; word-break: break-all;">Video ID: ${shot.video_id}</p>` : ''}
                </div>
            `;
        });
    } else {
        html += `
            <div class="video-result-card">
                <h3>⚠️ No videos generated</h3>
                <p>No shots were successfully generated.</p>
            </div>
        `;
    }
    
    html += '</div>';
    resultsContainer.innerHTML = html;
    
    document.getElementById('generate-btn').disabled = false;
}

// Download individual shot
function downloadShot(sequenceId, shotNumber) {
    window.location.href = `${API_BASE_URL}/download/${sequenceId}/${shotNumber}`;
}

// Show error message
function showError(message) {
    const progressContainer = document.getElementById('progress-container');
    let errorHtml = `<div class="error-message">`;
    
    // Check if it's a billing error
    if (message.toLowerCase().includes('billing')) {
        errorHtml += `<h3>💳 Billing Limit Reached</h3>`;
        errorHtml += `<p style="color: #dc2626; font-weight: 600;">Your OpenAI account has reached its billing limit.</p>`;
        errorHtml += `<p><strong>What this means:</strong></p>`;
        errorHtml += `<ul style="text-align: left; margin: 20px 40px;">`;
        errorHtml += `<li>Your account's spending limit has been reached</li>`;
        errorHtml += `<li>Payment method may need to be updated</li>`;
        errorHtml += `<li>You may have exceeded your monthly spending cap</li>`;
        errorHtml += `</ul>`;
        errorHtml += `<div style="background: #fef3c7; border: 2px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 15px 0;">`;
        errorHtml += `<strong>🔧 How to Fix:</strong>`;
        errorHtml += `<ol style="text-align: left; margin: 10px 0 0 25px;">`;
        errorHtml += `<li>Visit <a href="https://platform.openai.com/account/billing" target="_blank" style="color: #3b82f6; text-decoration: underline;">https://platform.openai.com/account/billing</a></li>`;
        errorHtml += `<li>Add or update your payment method</li>`;
        errorHtml += `<li>Check and increase your spending limits if needed</li>`;
        errorHtml += `<li>Wait a few minutes for changes to take effect</li>`;
        errorHtml += `<li>Try generating again</li>`;
        errorHtml += `</ol>`;
        errorHtml += `</div>`;
    }
    // Check if it's a moderation error
    else if (message.toLowerCase().includes('moderation')) {
        errorHtml += `<h3>⚠️ Content Moderation Issue</h3>`;
        errorHtml += `<p>Your video request was blocked by OpenAI's content moderation system.</p>`;
        errorHtml += `<p><strong>Most likely cause:</strong> The reference image you uploaded triggered content moderation.</p>`;
        errorHtml += `<p><strong>Solution:</strong></p>`;
        errorHtml += `<ul style="text-align: left; margin: 20px 40px;">`;
        errorHtml += `<li><strong>Remove the reference image</strong> and try again - this works 95% of the time</li>`;
        errorHtml += `<li>Images with faces or people will ALWAYS trigger moderation - do not use them</li>`;
        errorHtml += `<li>If you need an image, use simple objects, landscapes, abstract patterns, or buildings</li>`;
        errorHtml += `</ul>`;
        errorHtml += `<div style="background: #dcfce7; border: 2px solid #22c55e; padding: 15px; border-radius: 8px; margin: 15px 0;">`;
        errorHtml += `<strong>✅ Recommended:</strong> Test your prompts WITHOUT images first. If they work, your prompts are fine. The image is the problem.`;
        errorHtml += `</div>`;
        errorHtml += `<p style="font-size: 0.9em; color: #666;"><em>Error: ${message}</em></p>`;
        
        // Add special note about images
        const currentShots = sequenceResults?.shots?.length || 0;
        if (currentShots > 0) {
            errorHtml += `<div style="margin-top: 20px; padding: 15px; background: #eff6ff; border-radius: 8px;">`;
            errorHtml += `<strong>Quick Fix:</strong> Go back to the form above, remove any uploaded images, and click "Generate Videos" again.`;
            errorHtml += `</div>`;
        }
    } else {
        errorHtml += `<h3>❌ Error</h3>`;
        errorHtml += `<p>${message}</p>`;
    }
    
    // Only show the "Go Back" button for moderation errors
    if (!message.toLowerCase().includes('billing') && !message.toLowerCase().includes('moderation')) {
        errorHtml += `<button class="download-btn" onclick="location.reload()" style="margin-top: 20px;">Go Back & Try Again</button>`;
    } else if (message.toLowerCase().includes('moderation')) {
        errorHtml += `<button class="download-btn" onclick="location.reload()" style="margin-top: 20px;">Go Back & Remove Images</button>`;
    } else if (message.toLowerCase().includes('billing')) {
        errorHtml += `<button class="download-btn" onclick="window.open('https://platform.openai.com/account/billing', '_blank')" style="margin-top: 20px; margin-bottom: 20px; display: block; width: 100%;">Open Billing Settings</button>`;
        errorHtml += `<button class="download-btn" onclick="location.reload()" style="background-color: #6b7280; display: block; width: 100%;">Refresh Page</button>`;
    }
    errorHtml += `</div>`;
    
    progressContainer.innerHTML = errorHtml;
}

// Make functions globally available
window.removeShot = removeShot;
window.previewImage = previewImage;
window.expandShot = expandShot;
window.expandShotFields = expandShotFields;
window.toggleSharedSettings = toggleSharedSettings;
window.downloadShot = downloadShot;
window.removeRemixShot = removeRemixShot;
window.expandRemixShotFields = expandRemixShotFields;

