import { useEffect } from 'react';

/**
 * Component that fixes spacing issues with Firebase Auth UI
 * This component doesn't render anything, but modifies the DOM to add spacing between navbar and auth UI
 */
const FirebaseAuthUIFix = () => {
  useEffect(() => {
    // Function to add spacing to Firebase Auth UI elements
    const fixAuthUISpacing = () => {
      const authContainers = document.querySelectorAll(
        '#firebaseui-auth-container, .firebaseui-container, .mdl-card, div[role="dialog"], .firebase-auth-container, .auth-container'
      );
      
      let foundContainers = false;
      
      authContainers.forEach(container => {
        if (container) {
          foundContainers = true;
          
          // Check if we're on the auth page
          const isAuthPage = window.location.pathname.includes('/auth');
          if (isAuthPage) {
            container.style.marginTop = '100px';
          } else {
            container.style.marginTop = '0';
          }
          
          container.style.paddingTop = '0';
          container.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
          container.style.position = 'relative';
          container.style.zIndex = '1';
          
          // Add padding to any card content
          const cardContent = container.querySelector('.firebaseui-card-content');
          if (cardContent) {
            cardContent.style.paddingTop = '0';
          }
        }
      });
      
      return foundContainers;
    };
    
    // Run immediately
    const initialCheck = fixAuthUISpacing();
    
    // If no containers found initially, set up a polling check in case they're added later
    let pollInterval = null;
    if (!initialCheck) {
      pollInterval = setInterval(() => {
        const found = fixAuthUISpacing();
        // If found containers, can stop polling
        if (found && pollInterval) {
          clearInterval(pollInterval);
        }
      }, 500); // Check every 500ms
    }
    
    // Set up observer to monitor DOM changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.addedNodes.length) {
          // Run with a slight delay to ensure elements are fully rendered
          setTimeout(fixAuthUISpacing, 100);
        }
      });
    });
    
    // Start observing
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Add a global style for auth pages to ensure proper spacing
    const styleTag = document.createElement('style');
    styleTag.innerHTML = `
      [data-page-type="auth"], 
      .firebase-auth-container, 
      .auth-container,
      #firebaseui-auth-container, 
      .firebaseui-container {
        position: relative !important;
        z-index: 1 !important;
      }
      
      /* Add space for auth pages */
      .auth-page [data-page-type="auth"],
      .auth-page .firebase-auth-container,
      .auth-page .auth-container,
      .auth-page #firebaseui-auth-container,
      .auth-page .firebaseui-container,
      body[data-auth-page="true"] .auth-container {
        margin-top: 100px !important;
        padding-top: 20px !important;
      }
      
      /* Fix for sign-in page to prevent content from being hidden under navbar */
      .min-h-screen {
        padding-top: 0;
      }
      
      /* Ensure auth content is properly positioned */
      .flex-1.flex.items-center.justify-center {
        padding-top: 0;
      }
    `;
    document.head.appendChild(styleTag);
    
    // Check if we're on an auth page and add a class to body
    if (window.location.pathname.includes('/auth')) {
      document.body.setAttribute('data-auth-page', 'true');
      document.body.classList.add('auth-page');
    }
    
    // Listen for route changes
    const handleRouteChange = () => {
      if (window.location.pathname.includes('/auth')) {
        document.body.setAttribute('data-auth-page', 'true');
        document.body.classList.add('auth-page');
      } else {
        document.body.removeAttribute('data-auth-page');
        document.body.classList.remove('auth-page');
      }
      fixAuthUISpacing();
    };
    
    window.addEventListener('popstate', handleRouteChange);
    
    // Clean up observer and interval when component unmounts
    return () => {
      observer.disconnect();
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      styleTag.remove();
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, []);
  
  // This component doesn't render anything
  return null;
};

export default FirebaseAuthUIFix; 