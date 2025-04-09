import { initializeApp } from 'firebase/app'
import { getAuth, RecaptchaVerifier } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getAnalytics } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: "AIzaSyAOMuKK71_-QVipM3eeZZdBYFsyi3CgEVw",
  authDomain: "travel-journal-b209d.firebaseapp.com",
  projectId: "travel-journal-b209d",
  storageBucket: "travel-journal-b209d.appspot.com",
  messagingSenderId: "150977921302",
  appId: "1:150977921302:web:f50448c69604b6ea1b9037",
  measurementId: "G-31K3849RT2"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase services
export const auth = getAuth(app)
export const db = getFirestore(app)

// Fix Firebase Auth UI styling
// This injects a style tag to ensure the Auth UI doesn't touch the navbar
const injectAuthUIStyles = () => {
  // Only inject once
  if (!document.getElementById('firebase-auth-ui-styles')) {
    const styleTag = document.createElement('style');
    styleTag.id = 'firebase-auth-ui-styles';
    styleTag.innerHTML = `
      #firebaseui-auth-container,
      .firebaseui-container,
      .mdl-card,
      .firebase-auth-container,
      div[role="dialog"] {
        margin-top: 80px !important;
        padding-top: 20px !important;
      }
    `;
    document.head.appendChild(styleTag);
    
    // Add a listener to fix any dynamically added auth UI elements
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
          const authContainers = document.querySelectorAll('#firebaseui-auth-container, .firebaseui-container');
          authContainers.forEach(container => {
            container.style.marginTop = '80px';
            container.style.paddingTop = '20px';
          });
        }
      });
    });
    
    // Start observing the document body for changes
    observer.observe(document.body, { childList: true, subtree: true });
  }
};

// Call the function to inject styles
if (typeof window !== 'undefined') {
  injectAuthUIStyles();
}

// Helper function to create RecaptchaVerifier instance
export const generateRecaptchaVerifier = (containerId, callback) => {
  return new RecaptchaVerifier(auth, containerId, {
    size: 'normal',
    callback: callback,
    'expired-callback': () => {
      console.log('Recaptcha expired');
    }
  });
};

// Only initialize analytics if window is available (browser environment)
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null

export default app 