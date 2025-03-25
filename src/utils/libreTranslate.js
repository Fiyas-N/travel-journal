/**
 * libreTranslate.js - Utility functions for interfacing with LibreTranslate API
 */
import axios from 'axios';
import { libreTranslateConfig } from './config';

// Get configuration settings
const {
  apiUrl,
  fallbackApiUrls,
  timeout,
  apiKey,
  maxTextLength,
  preferredSourceLanguage
} = libreTranslateConfig;

// Create axios instance with timeout and base URL
const libreTranslateClient = axios.create({
  baseURL: apiUrl,
  timeout: timeout || 10000,
  headers: {
    'Content-Type': 'application/json',
    ...(apiKey ? { 'Authorization': `ApiKey ${apiKey}` } : {})
  }
});

// Track failed requests to implement fallback
let currentApiUrlIndex = 0;
let failedRequestCount = 0;
const MAX_FAILED_REQUESTS = 3;

/**
 * Switch to a fallback API if available
 * @returns {boolean} True if switched to a fallback, false if no fallbacks available
 */
const switchToFallbackApi = () => {
  if (!fallbackApiUrls || fallbackApiUrls.length === 0) {
    return false;
  }
  
  currentApiUrlIndex = (currentApiUrlIndex + 1) % (fallbackApiUrls.length + 1);
  
  // If we've cycled through all fallbacks, go back to the main API
  if (currentApiUrlIndex === 0) {
    libreTranslateClient.defaults.baseURL = apiUrl;
    console.log('Trying main LibreTranslate API again:', apiUrl);
  } else {
    const fallbackUrl = fallbackApiUrls[currentApiUrlIndex - 1];
    libreTranslateClient.defaults.baseURL = fallbackUrl;
    console.log('Switching to fallback LibreTranslate API:', fallbackUrl);
  }
  
  failedRequestCount = 0;
  return true;
};

/**
 * Handle API request with fallback support
 * @param {Function} requestFn - Function that makes the API request
 * @returns {Promise<any>} The API response
 */
const withFallback = async (requestFn) => {
  try {
    const result = await requestFn();
    failedRequestCount = 0; // Reset on success
    return result;
  } catch (error) {
    failedRequestCount++;
    
    if (failedRequestCount >= MAX_FAILED_REQUESTS) {
      if (switchToFallbackApi()) {
        console.log('Retrying request with fallback API');
        return requestFn();
      }
    }
    
    throw error;
  }
};

/**
 * Get available language pairs from LibreTranslate
 * @returns {Promise<Array>} Array of available languages
 */
export const getAvailableLanguages = async () => {
  try {
    const response = await withFallback(() => 
      libreTranslateClient.get('languages')
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching available languages:', error);
    return [];
  }
};

/**
 * Detect the language of a text
 * @param {string} text - Text to detect language
 * @returns {Promise<Object>} Detected language information
 */
export const detectLanguage = async (text) => {
  if (!text || text.trim() === '') {
    return { language: 'en', confidence: 0 };
  }
  
  try {
    const response = await withFallback(() => 
      libreTranslateClient.post('detect', {
        q: text.substring(0, maxTextLength) // Limit text length
      })
    );
    
    const detections = response.data;
    return detections[0] || { language: 'en', confidence: 0 };
  } catch (error) {
    console.error('Error detecting language:', error);
    return { language: 'en', confidence: 0 };
  }
};

/**
 * Translate text from one language to another
 * @param {string} text - Text to translate
 * @param {string} sourceLanguage - Source language code or 'auto' for auto-detection
 * @param {string} targetLanguage - Target language code
 * @returns {Promise<string>} Translated text
 */
export const translateText = async (text, sourceLanguage = preferredSourceLanguage, targetLanguage) => {
  if (!text || text.trim() === '') {
    return text;
  }
  
  try {
    // If source language is 'auto', detect it first
    let source = sourceLanguage;
    if (sourceLanguage === 'auto') {
      const detected = await detectLanguage(text);
      source = detected.language;
      
      // If detected language is already the target language, return original text
      if (source === targetLanguage) {
        return text;
      }
    }
    
    // Limit text length to avoid API limitations
    const truncatedText = text.substring(0, maxTextLength);
    
    const response = await withFallback(() => 
      libreTranslateClient.post('translate', {
        q: truncatedText,
        source: source,
        target: targetLanguage,
        format: 'text',
        ...(apiKey ? { api_key: apiKey } : {})
      })
    );
    
    return response.data.translatedText || text;
  } catch (error) {
    console.error('Translation error:', error);
    return text; // Return original text on error
  }
};

/**
 * Translate a large text by splitting it into smaller chunks
 * @param {string} text - Large text to translate
 * @param {string} sourceLanguage - Source language code or 'auto'
 * @param {string} targetLanguage - Target language code
 * @returns {Promise<string>} Translated text
 */
export const translateLongText = async (text, sourceLanguage = preferredSourceLanguage, targetLanguage) => {
  if (!text || text.length === 0) {
    return text;
  }
  
  // For texts shorter than the max length, use regular translation
  if (text.length <= maxTextLength) {
    return translateText(text, sourceLanguage, targetLanguage);
  }
  
  // Split text into manageable chunks
  const chunks = [];
  let remainingText = text;
  
  // Try to split at paragraph boundaries first
  const paragraphs = text.split(/\n\s*\n/);
  
  if (paragraphs.length > 1) {
    // Translate paragraph by paragraph
    const translatedParagraphs = [];
    for (const paragraph of paragraphs) {
      if (paragraph.trim() === '') {
        translatedParagraphs.push('');
        continue;
      }
      
      const translatedParagraph = await translateText(
        paragraph, 
        sourceLanguage, 
        targetLanguage
      );
      
      translatedParagraphs.push(translatedParagraph);
    }
    
    // Join the translated paragraphs with double newlines
    return translatedParagraphs.join('\n\n');
  } else {
    // If the text doesn't have paragraphs, split into chunks by size
    while (remainingText.length > 0) {
      // Find a good break point (sentence end) near the max length
      let breakPoint = Math.min(remainingText.length, maxTextLength);
      
      if (breakPoint < remainingText.length) {
        // Look for sentence boundaries
        const lastPeriod = remainingText.lastIndexOf('.', breakPoint);
        const lastQuestion = remainingText.lastIndexOf('?', breakPoint);
        const lastExclamation = remainingText.lastIndexOf('!', breakPoint);
        
        // Find the last sentence boundary
        const sentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);
        
        // Use sentence boundary if found, otherwise use word boundary
        if (sentenceEnd > breakPoint * 0.5) {
          breakPoint = sentenceEnd + 1; // Include the punctuation
        } else {
          // Fallback to word boundary
          const lastSpace = remainingText.lastIndexOf(' ', breakPoint);
          if (lastSpace > breakPoint * 0.5) {
            breakPoint = lastSpace + 1;
          }
        }
      }
      
      // Add chunk
      chunks.push(remainingText.substring(0, breakPoint));
      remainingText = remainingText.substring(breakPoint);
    }
    
    // Translate each chunk
    const translatedChunks = [];
    for (const chunk of chunks) {
      const translatedChunk = await translateText(
        chunk,
        sourceLanguage,
        targetLanguage
      );
      translatedChunks.push(translatedChunk);
    }
    
    // Join the translated chunks
    return translatedChunks.join(' ');
  }
};

/**
 * Create a dynamic translator function for UI components
 * @param {string} targetLanguage - Target language code
 * @param {Object} fallbackTranslations - Fallback translations object
 * @returns {Function} Translation function
 */
export const createDynamicTranslator = (targetLanguage, fallbackTranslations) => {
  // Return a function that can be used in components
  return async (key, defaultText) => {
    // First check if we have a static translation
    if (fallbackTranslations[targetLanguage]?.[key]) {
      return fallbackTranslations[targetLanguage][key];
    }
    
    // If not, try to translate the default text
    if (defaultText) {
      return await translateText(defaultText, 'en', targetLanguage);
    }
    
    // If we have an English translation, translate that
    if (fallbackTranslations.en?.[key]) {
      return await translateText(fallbackTranslations.en[key], 'en', targetLanguage);
    }
    
    // Last resort: return the key itself
    return key;
  };
};

/**
 * Check if LibreTranslate service is available
 * @returns {Promise<boolean>} Whether the service is available
 */
export const checkServiceAvailability = async () => {
  try {
    const response = await libreTranslateClient.get('languages', { timeout: 5000 });
    return response.status === 200 && Array.isArray(response.data) && response.data.length > 0;
  } catch (error) {
    console.error('LibreTranslate service unavailable:', error.message);
    
    // Try fallback URLs if available
    if (fallbackApiUrls && fallbackApiUrls.length > 0) {
      console.log('Trying fallback LibreTranslate instances...');
      
      // Test each fallback URL
      for (const fallbackUrl of fallbackApiUrls) {
        try {
          const fallbackClient = axios.create({
            baseURL: fallbackUrl,
            timeout: 5000,
            headers: { 'Content-Type': 'application/json' }
          });
          
          const fallbackResponse = await fallbackClient.get('languages');
          
          if (fallbackResponse.status === 200 && 
              Array.isArray(fallbackResponse.data) && 
              fallbackResponse.data.length > 0) {
            
            // Switch to this working fallback
            libreTranslateClient.defaults.baseURL = fallbackUrl;
            console.log('Switched to working fallback API:', fallbackUrl);
            return true;
          }
        } catch (fallbackError) {
          console.error(`Fallback API ${fallbackUrl} unavailable:`, fallbackError.message);
        }
      }
    }
    
    return false;
  }
};

export default {
  getAvailableLanguages,
  detectLanguage,
  translateText,
  translateLongText,
  createDynamicTranslator,
  checkServiceAvailability
}; 