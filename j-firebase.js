import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  addDoc,
  updateDoc,
  deleteDoc,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Initialize Firebase (modular)
const firebaseConfig = {
  apiKey: "AIzaSyCwg3oGU9w8E3pQpFDUPlVnSnZFR2YbLvo",
  authDomain: "studio-4706670934-ba8cb.firebaseapp.com",
  projectId: "studio-4706670934-ba8cb",
  storageBucket: "studio-4706670934-ba8cb.firebasestorage.app",
  messagingSenderId: "85781030477",
  appId: "1:85781030477:web:811926ce4e1ce852e31e04"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Expose modular APIs for non-module scripts
window.firebaseApp = app;
window.firestoreDb = db;
window.firebaseAuth = auth;

// Optionally expose helpers if other scripts rely on them
window.fsCollection = collection;
window.fsDoc = doc;
window.fsGetDoc = getDoc;
window.fsGetDocs = getDocs;
window.fsQuery = query;
window.fsWhere = where;
window.fsOrderBy = orderBy;
window.fsLimit = limit;
window.fsAddDoc = addDoc;
window.fsUpdateDoc = updateDoc;
window.fsDeleteDoc = deleteDoc;
window.fsIncrement = increment;
window.fsStartAfter = startAfter;

// Optional: Auth methods
window.signInWithEmailAndPassword = signInWithEmailAndPassword;
window.createUserWithEmailAndPassword = createUserWithEmailAndPassword;
window.onAuthStateChanged = onAuthStateChanged;

console.log("Globals exposed:", auth, db);


// Add this after initializing auth
async function updateUserProfile(userId, updates) {
    try {
        console.log('Attempting to update user:', userId);
        console.log('With data:', updates);
        
        const userDoc = doc(db, 'users', userId);
        console.log(userDoc)
        // Check if document exists first
        const docSnap = await getDoc(userDoc);
        if (!docSnap.exists()) {
            throw new Error('User document not found');
        }
        
        
        await updateDoc(userDoc, {
            ...updates,
            lastUpdated: new Date()
        });
        
        
        // Verify the update
        const updatedDoc = await getDoc(userDoc);

        return true;
    } catch (error) {
        console.error('Error updating user profile:', error);
        throw error;
    }
}

// Make it globally available
window.updateUserProfile = updateUserProfile;

async function findUserByEmail(email) {
    try {
        const usersRef = collection(db, "users");

        const q = query(usersRef, where('email', '==', email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            // User found - get the first document
            let userData = null;
            querySnapshot.forEach((doc) => {
                userData = { id: doc.id, ...doc.data() };
            });

            return userData; // Return OUTSIDE the forEach
        } else {
            console.log('No user found with email:', email);
            return null;
        }
    } catch (error) {
        console.error('Error finding user:', error);
        return null;
    }
}

window.findUserByEmail = findUserByEmail;

// Keep your main listener as is
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log('User is logged in:', user.email);
        const userProfile = await findUserByEmail(user.email);
        
        const firstName = userProfile?.firstName;
        const middleInitial = userProfile?.middleInitial;
        const lastName = userProfile?.lastName;

        let displayName;
        if (middleInitial) {
            displayName = `${firstName} ${middleInitial}. ${lastName}` || user.email.split('@')[0];
        } else {
            displayName = `${firstName} ${lastName}` || user.email.split('@')[0];
        }
        
        // Trigger UI updates manually
        updateAccountBar(document.querySelector('.account-bar'), displayName);
        
    } else {
        console.log('User is not logged in');
        updateAccountBar(document.querySelector('.account-bar'), null);
    }
});

// Simplified updateAccountBar - NO onAuthStateChanged listener
function updateAccountBar(accountBarElement, displayName) {
    if (!accountBarElement) return;
    
    const accountLink = accountBarElement.querySelector('.account');
    if (!accountLink) return;
    
    if (displayName) {
        accountLink.textContent = displayName;
        accountLink.href = '/profile';
        accountLink.classList.add('logged-in');
    } else {
        accountLink.textContent = 'Log In / Sign Up';
        accountLink.href = '/login';
        accountLink.classList.remove('logged-in');
    }
}

// Make it globally available
window.updateAccountBar = updateAccountBar;



document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const errorDiv = document.getElementById('error-message');
            
            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                
                console.log('User logged in:', user);
                window.location.href = '/'; // Change to your desired page
                
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
                }
                
                if (errorDiv) {
                    errorDiv.textContent = errorMessage;
                    errorDiv.style.display = 'block';
                }
            }
        });
    }
});




window.firestoreDb = db;
window.firebaseAuth = auth;

window.fsCollection = collection;
window.fsDoc = doc;
window.fsGetDoc = getDoc;
window.fsGetDocs = getDocs;
window.fsQuery = query;
window.fsWhere = where;
window.fsOrderBy = orderBy;
window.fsLimit = limit;
window.fsAddDoc = addDoc;
window.fsUpdateDoc = updateDoc;
window.fsIncrement = increment;

console.log("Globals exposed:", window.firebaseAuth, window.fsCollection);
