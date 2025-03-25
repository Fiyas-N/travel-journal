import React, { createContext, useContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import useTranslation from '../utils/useTranslation';
import { getAvailableLanguages, checkServiceAvailability } from '../utils/libreTranslate';
import staticTranslations from '../utils/translations';
import { appConfig, libreTranslateConfig } from '../utils/config';

// Create context
export const TranslationContext = createContext(null);

/**
 * Hook to use translation context anywhere in the app
 * @returns {Object} Translation context
 */
export const useTranslationContext = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslationContext must be used within a TranslationProvider');
  }
  return context;
};

/**
 * Translation Provider Component
 * Wraps the application with translation context
 */
export const TranslationProvider = ({ 
  children, 
  initialLanguage = appConfig.defaultLanguage,
  useDynamicTranslation = appConfig.useDynamicTranslations,
  supportedLanguages = appConfig.supportedLanguages
}) => {
  // Current language state
  const [language, setLanguage] = useState(initialLanguage);
  // State for available languages from LibreTranslate
  const [availableLanguages, setAvailableLanguages] = useState([]);
  // State for combined language list
  const [languages, setLanguages] = useState(supportedLanguages);
  // Whether LibreTranslate is available
  const [libreTranslateAvailable, setLibreTranslateAvailable] = useState(false);
  // Debug mode
  const [debugMode, setDebugMode] = useState(appConfig.debug);

  // Get translation utilities from custom hook
  const translation = useTranslation(language, useDynamicTranslation && libreTranslateConfig.enabled);
  
  // Get static languages from translations.js
  const staticLanguages = Object.keys(staticTranslations);
  
  // Check if LibreTranslate service is available
  useEffect(() => {
    if (useDynamicTranslation && libreTranslateConfig.enabled) {
      const checkService = async () => {
        try {
          const isAvailable = await checkServiceAvailability();
          setLibreTranslateAvailable(isAvailable);
          console.log('LibreTranslate service available:', isAvailable);
        } catch (error) {
          console.error('Error checking LibreTranslate service:', error);
          setLibreTranslateAvailable(false);
        }
      };
      
      checkService();
    }
  }, [useDynamicTranslation]);
  
  // Fetch available languages from LibreTranslate
  useEffect(() => {
    if (useDynamicTranslation && libreTranslateConfig.enabled && libreTranslateAvailable) {
      const fetchLanguages = async () => {
        try {
          const langs = await getAvailableLanguages();
          setAvailableLanguages(langs);
        } catch (error) {
          console.error('Error fetching LibreTranslate languages:', error);
          setAvailableLanguages([]);
        }
      };
      
      fetchLanguages();
    }
  }, [useDynamicTranslation, libreTranslateAvailable]);
  
  // Combine static languages, supported languages, and LibreTranslate languages
  useEffect(() => {
    const allLanguages = new Set([
      ...staticLanguages,
      ...supportedLanguages.map(lang => lang.code)
    ]);
    
    // Add languages from LibreTranslate
    if (libreTranslateAvailable && availableLanguages.length > 0) {
      availableLanguages.forEach(lang => {
        allLanguages.add(lang.code);
      });
    }
    
    // Convert to array of language objects
    const languageList = Array.from(allLanguages).map(code => {
      // Find language info from supportedLanguages first
      const supportedLang = supportedLanguages.find(lang => lang.code === code);
      if (supportedLang) {
        return supportedLang;
      }
      
      // Then from LibreTranslate
      const libreLang = availableLanguages.find(lang => lang.code === code);
      if (libreLang) {
        return { code: libreLang.code, name: libreLang.name };
      }
      
      // Default fallback
      return { 
        code, 
        name: code === 'en' ? 'English' : 
              code === 'hi' ? 'हिंदी' : 
              code === 'ml' ? 'മലയാളം' : code.toUpperCase()
      };
    });
    
    setLanguages(languageList);
  }, [staticLanguages, supportedLanguages, availableLanguages, libreTranslateAvailable]);
  
  // Load language from localStorage on initial load
  useEffect(() => {
    const savedLanguage = localStorage.getItem('preferredLanguage');
    if (savedLanguage) {
      setLanguage(savedLanguage);
    }
  }, []);
  
  // Toggle debug mode
  const toggleDebugMode = () => {
    setDebugMode(prev => !prev);
  };
  
  // Change language handler
  const changeLanguage = (newLanguage) => {
    setLanguage(newLanguage);
    localStorage.setItem('preferredLanguage', newLanguage);
    document.documentElement.setAttribute('lang', newLanguage);
  };
  
  // Value to provide through context
  const contextValue = {
    ...translation,
    language,
    setLanguage: changeLanguage,
    languages,
    libreTranslateAvailable,
    useDynamicTranslation,
    debugMode,
    toggleDebugMode,
    staticLanguages,
    availableLanguages
  };
  
  return (
    <TranslationContext.Provider value={contextValue}>
      {children}
    </TranslationContext.Provider>
  );
};

TranslationProvider.propTypes = {
  children: PropTypes.node.isRequired,
  initialLanguage: PropTypes.string,
  useDynamicTranslation: PropTypes.bool,
  supportedLanguages: PropTypes.arrayOf(
    PropTypes.shape({
      code: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired
    })
  )
};

export default TranslationProvider; 