// Profile edit functionality - Limited to Alias and Location only
let isEditMode = false;
let originalValues = {};

function toggleEditMode() {
    isEditMode = !isEditMode;
    
    if (isEditMode) {
        enterEditMode();
    } else {
        exitEditMode();
    }
}

function enterEditMode() {
    // Store original values for cancel functionality
    originalValues = {
        alias: document.querySelector('.profile-alias').textContent,
        location: document.querySelector('.profile-location').textContent
    };
    
    // Replace only alias and location fields with input fields
    replaceWithInput('.profile-alias', 'text');
    replaceWithInput('.profile-location', 'text');
    
    // Update buttons
    const editBtn = document.querySelector('.edit-profile-btn');
    editBtn.textContent = 'Cancel';
    editBtn.onclick = cancelEdit;
    
    // Add save button
    const saveBtn = document.createElement('button');
    saveBtn.className = 'save-profile-btn';
    saveBtn.textContent = 'Save Changes';
    saveBtn.onclick = saveProfile;
    saveBtn.style.cssText = 'background: #28a745; color: white; padding: 12px 24px; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; margin-right: 10px;';
    
    const profileActions = document.querySelector('.profile-actions');
    profileActions.insertBefore(saveBtn, editBtn);
}

function exitEditMode() {
    // Replace inputs back with display spans
    replaceWithSpan('.profile-alias');
    replaceWithSpan('.profile-location');
    
    // Reset buttons
    const editBtn = document.querySelector('.edit-profile-btn');
    editBtn.textContent = 'Edit Profile';
    editBtn.onclick = toggleEditMode;
    
    // Remove save button
    const saveBtn = document.querySelector('.save-profile-btn');
    if (saveBtn) saveBtn.remove();
}

function replaceWithInput(selector, type) {
    const element = document.querySelector(selector);
    if (!element) return;
    
    const input = document.createElement('input');
    input.type = type;
    input.value = element.textContent === 'Not provided' ? '' : element.textContent;
    input.className = element.className;
    input.style.cssText = 'border: 1px solid #ccc; padding: 8px; border-radius: 4px; font-size: 16px; width: 100%;';
    
    element.parentNode.replaceChild(input, element);
}

function replaceWithSpan(selector) {
    const input = document.querySelector(selector);
    if (!input || input.tagName !== 'INPUT') return;
    
    const span = document.createElement('span');
    span.textContent = input.value || 'Not provided';
    span.className = input.className;
    
    input.parentNode.replaceChild(span, input);
}

function cancelEdit() {
    // Restore original values
    Object.keys(originalValues).forEach(key => {
        const selector = `.profile-${key}`;
        const input = document.querySelector(selector);
        if (input && input.tagName === 'INPUT') {
            input.value = originalValues[key];
        }
    });
    
    exitEditMode();
}

async function saveProfile() {
    try {
        // Get current user
        const user = window.firebaseAuth.currentUser;
        if (!user) {
            alert('User not authenticated');
            return;
        }
        
        // Collect updated values - only alias and location
        const updatedData = {
            alias: document.querySelector('.profile-alias').value || null,
            location: document.querySelector('.profile-location').value || null
        };
        
        // Update Firestore
        if (window.updateUserProfile) {
            await window.updateUserProfile(user.uid, updatedData);
            console.log('Profile updated successfully');
            exitEditMode();
            
            // Refresh profile display
            if (window.populateUserProfile) {
                window.populateUserProfile();
            }
        } else {
            throw new Error('Update function not available');
        }
        
    } catch (error) {
        console.error('Error saving profile:', error);
        alert('Error saving profile. Please try again.');
    }
}

// Make functions globally available
window.toggleEditMode = toggleEditMode;
window.saveProfile = saveProfile;
window.cancelEdit = cancelEdit;