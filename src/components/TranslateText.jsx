import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTranslationContext } from './TranslationProvider';

/**
 * Component for translating arbitrary text with LibreTranslate
 * Can be used inline or as a block element
 */
const TranslateText = ({ 
  text, 
  sourceLanguage = 'auto',
  targetLanguage, // if not provided, uses context language
  showOriginal = false,
  className = '',
  loadingIndicator = 'translating...',
  translationFailed = 'Translation failed',
  isBlock = false // whether to render as block or inline element
}) => {
  const { language, translateRawText, libreTranslateAvailable } = useTranslationContext();
  const [translatedText, setTranslatedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Use context language if targetLanguage is not provided
  const targetLang = targetLanguage || language;
  
  useEffect(() => {
    let isMounted = true;
    
    const translate = async () => {
      // Skip translation if:
      // - text is empty
      // - LibreTranslate is not available
      // - source and target languages are the same
      if (!text || !libreTranslateAvailable || sourceLanguage === targetLang) {
        setTranslatedText(text);
        return;
      }
      
      try {
        setIsLoading(true);
        setError(null);
        
        const result = await translateRawText(text, sourceLanguage);
        
        if (isMounted) {
          setTranslatedText(result);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error translating text:', err);
          setError(err);
          setTranslatedText(text); // Fallback to original text
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    
    translate();
    
    return () => {
      isMounted = false;
    };
  }, [text, sourceLanguage, targetLang, translateRawText, libreTranslateAvailable]);
  
  // Dynamically determine the component type (span for inline, div for block)
  const Component = isBlock ? 'div' : 'span';
  
  if (isLoading) {
    return <Component className={`text-gray-400 italic ${className}`}>{loadingIndicator}</Component>;
  }
  
  if (error) {
    return <Component className={`text-red-500 ${className}`}>{translationFailed}</Component>;
  }
  
  // Special handling for when we want to show original text alongside translation
  if (showOriginal && translatedText !== text) {
    return (
      <Component className={className}>
        <span>{translatedText}</span>
        <span className="text-gray-500 text-sm ml-2">({text})</span>
      </Component>
    );
  }
  
  return <Component className={className}>{translatedText}</Component>;
};

TranslateText.propTypes = {
  text: PropTypes.string.isRequired,
  sourceLanguage: PropTypes.string,
  targetLanguage: PropTypes.string,
  showOriginal: PropTypes.bool,
  className: PropTypes.string,
  loadingIndicator: PropTypes.node,
  translationFailed: PropTypes.node,
  isBlock: PropTypes.bool
};

export default TranslateText; 