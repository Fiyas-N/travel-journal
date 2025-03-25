import { useState, useEffect, useCallback, useRef } from 'react';
import staticTranslations from './translations';
import { translateText, createDynamicTranslator } from './libreTranslate';

/**
 * Custom hook for handling translations in the application
 * Combines static translations with dynamic LibreTranslate translations
 * 
 * @param {string} language - Current language code (e.g., 'en', 'hi', 'ml')
 * @param {boolean} useDynamicTranslation - Whether to use LibreTranslate for missing translations
 * @returns {Object} Translation utilities
 */
export const useTranslation = (language = 'en', useDynamicTranslation = true) => {
  // Store translated values to avoid repeated API calls
  const translationCache = useRef({});
  
  // State to track loading state of translations
  const [isLoading, setIsLoading] = useState(false);
  
  // Reset the cache when language changes
  useEffect(() => {
    if (!translationCache.current[language]) {
      translationCache.current[language] = {};
    }
  }, [language]);
  
  /**
   * Get a translation for a specific key
   * First checks static translations, then falls back to LibreTranslate if enabled
   */
  const translate = useCallback(async (key, defaultText = key) => {
    // 1. Check static translations first
    const staticTranslation = staticTranslations[language]?.[key];
    if (staticTranslation) return staticTranslation;
    
    // 2. Check cache
    if (translationCache.current[language]?.[key]) {
      return translationCache.current[language][key];
    }
    
    // 3. If dynamic translation is disabled, fallback to English or key
    if (!useDynamicTranslation) {
      return staticTranslations.en?.[key] || defaultText;
    }
    
    // 4. Use LibreTranslate for dynamic translation
    try {
      setIsLoading(true);
      
      // Try to translate from English static translation if available
      const sourceText = staticTranslations.en?.[key] || defaultText;
      
      // Don't translate if the language is English and we're using the English text
      if (language === 'en' && sourceText === staticTranslations.en?.[key]) {
        return sourceText;
      }
      
      const translated = await translateText(sourceText, 'en', language);
      
      // Cache the result
      if (!translationCache.current[language]) {
        translationCache.current[language] = {};
      }
      translationCache.current[language][key] = translated;
      
      return translated;
    } catch (error) {
      console.error(`Translation error for key "${key}":`, error);
      // Fallback to English or the key itself
      return staticTranslations.en?.[key] || defaultText;
    } finally {
      setIsLoading(false);
    }
  }, [language, useDynamicTranslation]);
  
  /**
   * Get a translation synchronously - returns cached value or static translation
   * This is useful for immediate UI rendering without waiting for API
   */
  const t = useCallback((key, defaultText = key) => {
    // Check cache first
    if (translationCache.current[language]?.[key]) {
      return translationCache.current[language][key];
    }
    
    // Then check static translations
    if (staticTranslations[language]?.[key]) {
      return staticTranslations[language][key];
    }
    
    // Fallback to English or default
    return staticTranslations.en?.[key] || defaultText;
  }, [language]);
  
  /**
   * Preload a set of translations for the current language
   * Useful for loading translations for a specific page or component
   */
  const preloadTranslations = useCallback(async (keys) => {
    if (!useDynamicTranslation || language === 'en') return;
    
    setIsLoading(true);
    try {
      const translations = await Promise.all(
        keys.map(async (key) => {
          // Skip if already in cache or in static translations
          if (translationCache.current[language]?.[key] || staticTranslations[language]?.[key]) {
            return null;
          }
          
          const sourceText = staticTranslations.en?.[key] || key;
          const translated = await translateText(sourceText, 'en', language);
          
          return { key, translated };
        })
      );
      
      // Update cache with new translations
      translations.forEach(item => {
        if (item) {
          if (!translationCache.current[language]) {
            translationCache.current[language] = {};
          }
          translationCache.current[language][item.key] = item.translated;
        }
      });
    } catch (error) {
      console.error('Error preloading translations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [language, useDynamicTranslation]);
  
  /**
   * Translate text directly without using keys
   */
  const translateRawText = useCallback(async (text, sourceLanguage = 'auto') => {
    if (!text || !useDynamicTranslation || language === sourceLanguage) {
      return text;
    }
    
    try {
      setIsLoading(true);
      return await translateText(text, sourceLanguage, language);
    } catch (error) {
      console.error('Error translating raw text:', error);
      return text;
    } finally {
      setIsLoading(false);
    }
  }, [language, useDynamicTranslation]);
  
  return {
    t, // Synchronous translation function (using cache and static translations)
    translate, // Asynchronous translation function (with LibreTranslate fallback)
    translateRawText, // Translate arbitrary text without keys
    preloadTranslations, // Preload multiple translations at once
    isLoading, // Whether any translation is currently loading
    language, // Current language
    hasStaticTranslation: (key) => !!staticTranslations[language]?.[key] // Check if a static translation exists
  };
};

export default useTranslation; 