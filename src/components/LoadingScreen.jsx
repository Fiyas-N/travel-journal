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
    small: 'w-8 h-8 border-2',
    default: 'w-12 h-12 border-3',
    large: 'w-16 h-16 border-4',
  }[size] || 'w-12 h-12 border-3';

  // Determine container classes based on type
  const containerClasses = {
    fullpage: 'fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-90',
    inline: 'flex flex-col items-center justify-center py-8',
    overlay: 'absolute inset-0 z-40 flex items-center justify-center bg-black bg-opacity-50',
  }[type] || 'fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-90';

  const loadingMessage = message || t.loading || 'Loading...';

  return (
    <div className={containerClasses}>
      <div className="flex flex-col items-center">
        {/* Spinner animation */}
        <div className={`${sizeClasses} rounded-full border-blue-500 border-t-transparent animate-spin`}></div>
        
        {/* Text below spinner */}
        <div className="mt-4 text-center">
          <p className="text-base sm:text-lg font-medium text-gray-700">{loadingMessage}</p>
          {/* Optional additional decoration */}
          <div className="mt-2 flex space-x-1 justify-center">
            <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
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