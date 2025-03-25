import React from 'react';
import PropTypes from 'prop-types';
import translations from '../utils/translations';

/**
 * Animated loading screen component to be used across the application
 * @param {Object} props - Component props
 * @param {string} props.language - Current language for translations
 * @param {string} [props.size='default'] - Size of the loader (small, default, large)
 * @param {string} [props.message] - Optional custom loading message
 * @param {string} [props.type='fullpage'] - Type of loader (fullpage, inline, overlay)
 */
const LoadingScreen = ({ language, size = 'default', message, type = 'fullpage' }) => {
  const t = translations[language] || translations.en;
  
  // Determine size classes for loader
  const sizeClasses = {
    small: 'w-6 h-6 sm:w-8 sm:h-8 border-2',
    default: 'w-10 h-10 sm:w-12 sm:h-12 border-2 sm:border-3',
    large: 'w-12 h-12 sm:w-16 sm:h-16 border-3 sm:border-4',
  }[size] || 'w-10 h-10 sm:w-12 sm:h-12 border-2 sm:border-3';

  // Determine text size based on loader size
  const textClasses = {
    small: 'text-xs sm:text-sm',
    default: 'text-sm sm:text-base',
    large: 'text-base sm:text-lg',
  }[size] || 'text-sm sm:text-base';

  // Determine container classes based on type
  const containerClasses = {
    fullpage: 'fixed inset-0 z-50 flex flex-col items-center justify-center bg-white bg-opacity-90 safe-padding-bottom',
    inline: 'flex flex-col items-center justify-center py-6 sm:py-8',
    overlay: 'absolute inset-0 z-40 flex flex-col items-center justify-center bg-black bg-opacity-50',
  }[type] || 'fixed inset-0 z-50 flex flex-col items-center justify-center bg-white bg-opacity-90';

  const loadingMessage = message || t.loading || 'Loading...';

  return (
    <div className={containerClasses}>
      <div className="flex flex-col items-center">
        {/* Spinner animation */}
        <div className={`${sizeClasses} rounded-full border-blue-500 border-t-transparent animate-spin`} role="status" aria-label="Loading"></div>
        
        {/* Text below spinner */}
        <div className="mt-3 sm:mt-4 text-center">
          <p className={`${textClasses} font-medium text-gray-700`}>{loadingMessage}</p>
          
          {/* Optional animated dots */}
          <div className="mt-1 sm:mt-2 flex space-x-1 justify-center">
            <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
      
      {/* For fullpage loaders, add a small hint about what's happening */}
      {type === 'fullpage' && (
        <div className="absolute bottom-4 sm:bottom-6 left-0 right-0 text-center">
          <p className="text-xs sm:text-sm text-gray-400">
            {language === 'hi' ? 'कृपया प्रतीक्षा करें...' : 
             language === 'ml' ? 'ദയവായി കാത്തിരിക്കുക...' : 
             'Please wait a moment...'}
          </p>
        </div>
      )}
    </div>
  );
};

LoadingScreen.propTypes = {
  language: PropTypes.string.isRequired,
  size: PropTypes.oneOf(['small', 'default', 'large']),
  message: PropTypes.string,
  type: PropTypes.oneOf(['fullpage', 'inline', 'overlay'])
};

export default LoadingScreen; 