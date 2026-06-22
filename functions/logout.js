// functions/logout.js
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

function getAuthSafe() {
  // Prefer the instance created in j-firebase.js
  if (window.firebaseAuth) return window.firebaseAuth;
  if (window.firebaseApp)  return getAuth(window.firebaseApp);
  throw new Error("Firebase not initialized yet");
}

async function handleLogout() {
  try {
    const auth = getAuthSafe();     // <-- fetch when needed, after init
    await signOut(auth);
    console.log("User signed out successfully");
    window.location.href = "h-login.html";
  } catch (error) {
    console.error("Error signing out:", error);
    alert("Error signing out. Please try again.");
  }
}

window.handleLogout = handleLogout;
