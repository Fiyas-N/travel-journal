/**
 * config.js - Application configuration settings
 */

// LibreTranslate configuration
export const libreTranslateConfig = {
  // Main API URL - change to your preferred instance
  apiUrl: 'https://libretranslate.de/',
  
  // Fallback API URLs if the main one fails
  fallbackApiUrls: [
    'https://translate.argosopentech.com/',
    'https://translate.terraprint.co/'
  ],
  
  // Request timeout in milliseconds
  timeout: 10000,
  
  // Whether to use LibreTranslate 
  enabled: true,
  
  // API key if required (some instances require an API key)
  // apiKey: 'your-api-key',
  
  // Cache duration for translations (in minutes)
  cacheDuration: 60,
  
  // Maximum text length to translate in one request
  maxTextLength: 5000,
  
  // Preferred source language (or 'auto' for auto-detect)
  preferredSourceLanguage: 'auto',
};

// Firebase configuration
export const firebaseConfig = {
  // Your Firebase config is already set up in firebase/config.js
};

// Default application settings
export const appConfig = {
  // Default language
  defaultLanguage: 'en',
  
  // Available languages (static list)
  supportedLanguages: [
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'हिंदी' },
    { code: 'ml', name: 'മലയാളം' }
  ],
  
  // Enable debug mode
  debug: false,
  
  // Use static translations by default
  useStaticTranslations: true,
  
  // Use dynamic translations when static ones are not available
  useDynamicTranslations: true,
};

export default {
  libreTranslate: libreTranslateConfig,
  app: appConfig,
}; 