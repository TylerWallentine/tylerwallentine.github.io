// login.js - Handle login form submission
async function handleLogin(event) {
    event.preventDefault(); // Prevent form submission
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('error-message');
    
    // Clear any previous error messages
    if (errorDiv) {
        errorDiv.style.display = 'none';
        errorDiv.textContent = '';
    }
    
    try {
        // Use the global auth object from j-firebase.js
        if (!window.firebaseAuth || !window.signInWithEmailAndPassword) {
            throw new Error('Firebase not initialized');
        }
        
        const userCredential = await window.signInWithEmailAndPassword(
            window.firebaseAuth, 
            email, 
            password
        );
        const user = userCredential.user;
        
        console.log('User logged in:', user.email);
        
        // Redirect to main page after successful login
        window.location.href = '/';
        
    } catch (error) {
        console.error('Login error:', error);
        
        let errorMessage = 'Login failed. Please try again.';
        
        switch(error.code) {
            case 'auth/user-not-found':
                errorMessage = 'No account found with this email.';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Incorrect password.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address.';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Too many failed attempts. Please try again later.';
                break;
            case 'auth/invalid-credential':
                errorMessage = 'Invalid email or password.';
                break;
        }
        
        if (errorDiv) {
            errorDiv.textContent = errorMessage;
            errorDiv.style.display = 'block';
        } else {
            alert(errorMessage);
        }
    }
}

// Initialize login form when DOM is ready
function initializeLoginForm() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
        console.log('Login form initialized');
    }
}

// Make functions globally available
window.handleLogin = handleLogin;
window.initializeLoginForm = initializeLoginForm;

// Auto-initialize when script loads
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit to ensure Firebase is loaded
    setTimeout(initializeLoginForm, 500);
});