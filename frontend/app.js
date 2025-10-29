const API_BASE_URL = 'http://localhost:8080/api';

let currentShots = 1;
let sequenceResults = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    checkApiKey();
    initializeForm();
    setupEventListeners();
});

// Check API key status
async function checkApiKey() {
    try {
        const response = await fetch(`${API_BASE_URL}/check-key`);
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
    const sharedImage = document.getElementById('shared-image');
    
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
    
    // Handle image file for new shot
    if (sharedImage && sharedImage.files && sharedImage.files[0]) {
        const shotImageInput = document.getElementById(`image-${currentShots}`);
        if (shotImageInput) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(sharedImage.files[0]);
            shotImageInput.files = dataTransfer.files;
            
            // Trigger the preview
            previewImage(currentShots);
            toggleFieldVisibility(`image-${currentShots}`, true);
            hiddenFieldIds.push(`image-${currentShots}`);
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
                <button class="expand-btn hidden" onclick="expandShot(${shotNumber})" id="expand-btn-${shotNumber}">
                    <span id="expand-text-${shotNumber}">Show Shared Settings</span>
                </button>
                <button class="remove-shot-btn" onclick="removeShot(${shotNumber})">🗑️ Remove</button>
            </div>
        </div>
        
        <div class="form-group">
            <label for="characters-${shotNumber}">Character Description *</label>
            <textarea id="characters-${shotNumber}" placeholder="Describe the characters in this shot (e.g., A 30-year-old male programmer with short dark hair, wearing a black t-shirt)" required></textarea>
        </div>
        
        <div class="form-group">
            <label for="environment-${shotNumber}">Environment Description *</label>
            <textarea id="environment-${shotNumber}" placeholder="Describe the environment/setting (e.g., modern kitchen with morning light from window)" required></textarea>
        </div>
        
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
        
        <div class="form-group">
            <label for="lighting-${shotNumber}">Lighting & Camera Angles</label>
            <textarea id="lighting-${shotNumber}" placeholder="Describe lighting and camera setup (e.g., Natural morning light, handheld camera, shallow depth of field, vertical 9:16 format)"></textarea>
        </div>
        
        <div class="form-group">
            <label for="dialog-${shotNumber}">Dialog *</label>
            <textarea id="dialog-${shotNumber}" placeholder="What the character says (e.g., 'OpenAI just dropped Sora 2 API... this is INSANE.')" required></textarea>
        </div>
        
        <div style="text-align: center;">
            <span class="duration-badge">Duration: 12 seconds (max per shot. Combine multiple shots for longer videos)</span>
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
    }
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

// Expand hidden fields for a specific shot
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

// Apply shared settings to all shots
function applySharedSettings() {
    const sharedCharacters = document.getElementById('shared-characters')?.value || '';
    const sharedEnvironment = document.getElementById('shared-environment')?.value || '';
    const sharedLighting = document.getElementById('shared-lighting')?.value || '';
    const sharedImage = document.getElementById('shared-image');
    
    if (!sharedCharacters && !sharedEnvironment && !sharedLighting && (!sharedImage || !sharedImage.files || !sharedImage.files[0])) {
        alert('Please enter at least one shared setting (Characters, Environment, Lighting, or Image)');
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
        
        // Handle image file - create a new FileList for each shot's input
        if (sharedImage && sharedImage.files && sharedImage.files[0]) {
            const shotImageInput = document.getElementById(`image-${i}`);
            if (shotImageInput) {
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(sharedImage.files[0]);
                shotImageInput.files = dataTransfer.files;
                
                // Trigger the preview
                previewImage(i);
                // Hide the field
                toggleFieldVisibility(`image-${i}`, true);
                hiddenFieldIds.push(`image-${i}`);
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

// Preview shared image
function previewSharedImage() {
    const input = document.getElementById('shared-image');
    const previewContainer = document.getElementById('shared-image-preview');
    
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
                
                // Basic validation
                if (!data.characters || !data.environment || !data.dialog) {
                    alert(`Shot ${i} is missing required fields (Characters, Environment, or Dialog)`);
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
        
        // Collect image files from individual shots AND check for shared image
        const imageFiles = [];
        const sharedImageInput = document.getElementById('shared-image');
        const sharedImage = sharedImageInput && sharedImageInput.files && sharedImageInput.files[0] ? sharedImageInput.files[0] : null;
        
        for (let i = 1; i <= currentShots; i++) {
            const input = document.getElementById(`image-${i}`);
            if (input && input.files && input.files[0]) {
                imageFiles[i] = input.files[0];
            } else if (sharedImage) {
                // If individual shot doesn't have an image, use the shared image
                imageFiles[i] = sharedImage;
            }
        }
        
        // Use FormData if we have images, otherwise use JSON
        let body, headers;
        if (imageFiles.some(f => f)) {
            const formData = new FormData();
            formData.append('shots', JSON.stringify(shotsData));
            
            for (let i = 1; i < imageFiles.length; i++) {
                if (imageFiles[i]) {
                    formData.append(`image_${i}`, imageFiles[i]);
                }
            }
            
            body = formData;
            headers = {}; // Let browser set Content-Type with boundary
        } else {
            body = JSON.stringify({ shots: shotsData });
            headers = { 'Content-Type': 'application/json' };
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
        
        const result = await response.json();
        
        if (result.error || result.status === 'error') {
            throw new Error(result.error || 'Video generation failed');
        }
        
        // Store results
        sequenceResults = result;
        
        // Display results
        await displayResults(result);
        
    } catch (error) {
        showError(error.message);
        document.getElementById('generate-btn').disabled = false;
    }
}

// Display generation results
async function displayResults(result) {
    document.getElementById('progress-section').style.display = 'none';
    document.getElementById('results-section').style.display = 'block';
    
    const resultsContainer = document.getElementById('results-container');
    
    let html = '<div class="video-results">';
    
    // Automatically stitch if multiple shots
    if (result.shots && result.shots.length > 1) {
        html += '<div class="video-result-card">';
        html += '<h3>Stitching sequence...</h3>';
        html += '<p>Combining all shots...</p>';
        html += '</div>';
        
        resultsContainer.innerHTML = html;
        
        try {
            // Call the stitch API
            const response = await fetch(`${API_BASE_URL}/stitch/${result.sequence_id}`, {
                method: 'POST'
            });
            
            const stitchResult = await response.json();
            
            if (stitchResult.error) {
                throw new Error(stitchResult.error);
            }
            
            // Show download button for stitched sequence
            html = '<div class="video-results">';
            html += `
                <div class="video-result-card">
                    <h3>✓ Full Sequence Ready</h3>
                    <p>All ${result.shots.length} shots combined</p>
                    <button class="download-btn" onclick="window.location.href='${API_BASE_URL}/download-sequence/${result.sequence_id}'">
                        📥 Download Full Sequence
                    </button>
                </div>
            `;
            
            // Add individual shots section
            html += '<div style="margin-top: 20px;">';
            html += '<h4 style="text-align: center; color: #666;">Individual Shots (Optional)</h4>';
            result.shots.forEach((shot, index) => {
                html += `
                    <div class="video-result-card" style="margin-top: 10px;">
                        <h4>Shot ${index + 1}</h4>
                        <button class="download-btn" onclick="downloadShot('${result.sequence_id}', ${index + 1})" style="background-color: #6366f1;">
                            Download Shot ${index + 1}
                        </button>
                    </div>
                `;
            });
            html += '</div>';
            html += '</div>';
            
            resultsContainer.innerHTML = html;
            
        } catch (error) {
            html = '<div class="video-results">';
            html += `
                <div class="error-message">
                    <h3>⚠️ Stitching Failed</h3>
                    <p>${error.message}</p>
                </div>
            `;
            html += '</div>';
            resultsContainer.innerHTML = html;
        }
    } else if (result.shots && result.shots.length === 1) {
        // Single shot - just show download button
        html += `
            <div class="video-result-card">
                <h3>✓ Video Ready</h3>
                <p>Status: ${result.shots[0].status}</p>
                <button class="download-btn" onclick="downloadShot('${result.sequence_id}', 1)">
                    📥 Download Video
                </button>
            </div>
        `;
        html += '</div>';
        resultsContainer.innerHTML = html;
    }
    
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
    
    // Check if it's a moderation error
    if (message.toLowerCase().includes('moderation')) {
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
    
    errorHtml += `<button class="download-btn" onclick="location.reload()" style="margin-top: 20px;">Go Back & Remove Images</button>`;
    errorHtml += `</div>`;
    
    progressContainer.innerHTML = errorHtml;
}

// Make functions globally available
window.removeShot = removeShot;
window.previewImage = previewImage;
window.previewSharedImage = previewSharedImage;
window.expandShot = expandShot;
window.downloadShot = downloadShot;

