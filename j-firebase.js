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
  setDoc,
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
import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";

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
// Cloud Functions live in us-central1 (see cloud-functions/index.js).
const functions = getFunctions(app, "us-central1");

// Call a callable Cloud Function by name and resolve with its data payload.
// e.g. await window.callFunction("subscribe", { email })
window.firebaseFunctions = functions;
window.callFunction = (name, data) =>
    httpsCallable(functions, name)(data || {}).then((res) => res.data);

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
window.fsSetDoc = setDoc;
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

// Read a user's own profile by uid (doc id == uid). This works under rules
// that allow `isSelf(uid)` reads, unlike findUserByEmail's collection query
// (which Firestore denies for non-editors because it filters by email field).
async function getUserProfileById(uid) {
    if (!uid) return null;
    try {
        const snap = await getDoc(doc(db, "users", uid));
        return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    } catch (error) {
        console.error("Error reading user profile by id:", error);
        return null;
    }
}
window.getUserProfileById = getUserProfileById;

// ---------------------------------------------------------------------------
// Account-bar cache: remember the signed-in user's display name + admin flag
// in localStorage so we can paint the header immediately on the next page
// load, BEFORE Firebase auth re-resolves. This eliminates the "Log In /
// Sign Up" flash for already-logged-in users.
// ---------------------------------------------------------------------------
const ACCOUNT_CACHE_KEY = 'vr_account_cache';
function readAccountCache() {
    try { return JSON.parse(window.localStorage.getItem(ACCOUNT_CACHE_KEY) || 'null'); }
    catch (_) { return null; }
}
function writeAccountCache(obj) {
    try { window.localStorage.setItem(ACCOUNT_CACHE_KEY, JSON.stringify(obj)); } catch (_) {}
}
function clearAccountCache() {
    try { window.localStorage.removeItem(ACCOUNT_CACHE_KEY); } catch (_) {}
}
window.readAccountCache = readAccountCache;

// Paint the account bar from cache (used at first paint and after async module
// loads that inject the header). Safe to call repeatedly.
function paintAccountBarFromCache() {
    const cache = readAccountCache();
    const bar = document.querySelector('.account-bar');
    if (!bar) return;
    if (cache && cache.displayName) {
        window.__isAdminUser = !!cache.isAdmin;
        updateAccountBar(bar, cache.displayName);
    }
}
window.paintAccountBarFromCache = paintAccountBarFromCache;

// Keep your main listener as is
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log('User is logged in:', user.email);
        const userProfile = await getUserProfileById(user.uid);
        
        const firstName = userProfile?.firstName;
        const middleInitial = userProfile?.middleInitial;
        const lastName = userProfile?.lastName;

        const emailName = user.email ? user.email.split('@')[0] : 'Account';
        let displayName;
        if (firstName && middleInitial) {
            displayName = `${firstName} ${middleInitial}. ${lastName || ''}`.trim();
        } else if (firstName || lastName) {
            displayName = `${firstName || ''} ${lastName || ''}`.trim();
        } else {
            displayName = userProfile?.alias || emailName;
        }
        
        // Admin = site owner email OR Firestore role "editor".
        window.__isAdminUser =
            user.email === "wallentinetyler@gmail.com" ||
            (userProfile?.role || "").toLowerCase() === "editor";

        // Cache for the next page load so the name shows instantly.
        writeAccountCache({ displayName, isAdmin: window.__isAdminUser });

        // Trigger UI updates manually
        updateAccountBar(document.querySelector('.account-bar'), displayName);
        
    } else {
        console.log('User is not logged in');
        window.__isAdminUser = false;
        clearAccountCache();
        updateAccountBar(document.querySelector('.account-bar'), null);
    }
});

// Simplified updateAccountBar - NO onAuthStateChanged listener
function updateAccountBar(accountBarElement, displayName) {
    if (!accountBarElement) return;
    
    const accountLink = accountBarElement.querySelector('.account');
    if (!accountLink) return;

    // Called with no displayName (e.g. from ModuleLoader after injecting the
    // header): fall back to the cached name so async-loaded bars don't flash
    // "Log In / Sign Up" for logged-in users.
    if (displayName === undefined) {
        const cache = readAccountCache();
        if (cache && cache.displayName) {
            window.__isAdminUser = !!cache.isAdmin;
            displayName = cache.displayName;
        } else {
            displayName = null;
        }
    }

    // Clear any previously-built admin dropdown so repeated calls stay clean.
    const existingMenu = accountBarElement.querySelector('.account-menu');
    if (existingMenu) existingMenu.remove();
    accountLink.onclick = null;
    
    if (displayName) {
        accountLink.textContent = displayName;
        accountLink.classList.add('logged-in');

        if (window.__isAdminUser) {
            // Admin: the name becomes a dropdown (Profile / Admin Console / Log out).
            accountLink.href = '#';
            accountLink.setAttribute('aria-haspopup', 'true');
            accountLink.setAttribute('aria-expanded', 'false');

            const menu = document.createElement('div');
            menu.className = 'account-menu';
            menu.innerHTML =
                '<a href="/profile" class="account-menu-item">My Profile</a>' +
                '<a href="/admin" class="account-menu-item">Admin Console</a>' +
                '<a href="#" class="account-menu-item account-logout">Log out</a>';
            accountBarElement.appendChild(menu);

            accountLink.onclick = (e) => {
                e.preventDefault();
                const open = menu.classList.toggle('open');
                accountLink.setAttribute('aria-expanded', open ? 'true' : 'false');
            };
            document.addEventListener('click', (e) => {
                if (!accountBarElement.contains(e.target)) menu.classList.remove('open');
            });
            const logout = menu.querySelector('.account-logout');
            if (logout) logout.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    const { getAuth, signOut } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
                    await signOut(window.firebaseAuth || getAuth(window.firebaseApp));
                    window.location.href = '/';
                } catch (err) { console.error('Logout failed:', err); }
            });
        } else {
            accountLink.href = '/profile';
        }
    } else {
        accountLink.textContent = 'Log In / Sign Up';
        accountLink.href = '/login';
        accountLink.classList.remove('logged-in');
    }
}

// Make it globally available
window.updateAccountBar = updateAccountBar;

// Paint immediately from cache (module runs after the inlined header is parsed).
paintAccountBarFromCache();
document.addEventListener('DOMContentLoaded', paintAccountBarFromCache);



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
