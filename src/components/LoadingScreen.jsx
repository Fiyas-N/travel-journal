import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import translations from '../utils/translations';
import '../styles/loading-animations.css';

/**
 * Enhanced loading screen component with travel theme and dynamic animations
 * Simplified for a cleaner, more elegant design
 * Optimized for both desktop and mobile devices with performance enhancements
 * @param {Object} props - Component props
 * @param {string} props.language - Current language for translations
 * @param {string} [props.size='default'] - Size of the loader (small, default, large)
 * @param {string} [props.message] - Optional custom loading message
 * @param {string} [props.type='fullpage'] - Type of loader (fullpage, inline, overlay)
 */
const LoadingScreen = ({ language, size = 'default', message, type = 'fullpage' }) => {
  const t = translations[language] || translations.en;
  const [dots, setDots] = useState(['•']);
  const [isMobile, setIsMobile] = useState(false);
  
  // Detect mobile devices for performance optimization
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    
    // Check initially
    checkMobile();
    
    // Add event listener for window resize
    window.addEventListener('resize', checkMobile);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Optimize dot animation interval for mobile
  useEffect(() => {
    const intervalDuration = isMobile ? 800 : 600; // Slower on mobile
    
    const intervalId = setInterval(() => {
      setDots(prevDots => {
        if (prevDots.length >= 3) return ['•'];
        return [...prevDots, '•'];
      });
    }, intervalDuration);
    
    return () => clearInterval(intervalId);
  }, [isMobile]);
  
  // Memoize size classes to prevent recalculation
  const sizeClasses = useMemo(() => {
    return {
      small: 'w-12 h-12 md:w-16 md:h-16',
      default: 'w-16 h-16 md:w-20 md:h-20',
      large: 'w-20 h-20 md:w-24 md:h-24',
    }[size] || 'w-16 h-16 md:w-20 md:h-20';
  }, [size]);

  // Memoize container classes to prevent recalculation
  const containerClasses = useMemo(() => {
    return {
      fullpage: 'fixed inset-0 z-50 flex items-center justify-center bg-white px-4',
      inline: 'flex flex-col items-center justify-center py-4 md:py-6',
      overlay: 'absolute inset-0 z-40 flex items-center justify-center bg-white bg-opacity-90 px-4',
    }[type] || 'fixed inset-0 z-50 flex items-center justify-center bg-white px-4';
  }, [type]);

  const loadingMessage = message || t.loading || 'Loading';

  // Memoize font size for compass to avoid recomputation
  const compassSize = useMemo(() => {
    if (isMobile) {
      return size === 'small' ? '0.875rem' : size === 'large' ? '1.5rem' : '1.125rem';
    } else {
      return size === 'small' ? '1rem' : size === 'large' ? '1.75rem' : '1.25rem';
    }
  }, [size, isMobile]);

  return (
    <div className={containerClasses}>
      <div className="flex flex-col items-center p-4 md:p-5 max-w-xs text-center">
        {/* Simplified brand presentation with globe icon - responsive text size */}
        <div className="mb-4 md:mb-6 text-xl md:text-2xl font-medium text-blue-500">
          <span className="inline-block mr-2">
            <i className="fas fa-globe-americas animate-globe"></i>
          </span>
          {t.travelJournal || 'Travel Journal'}
        </div>
        
        {/* Clean minimalist loader with subtle effects */}
        <div className={`${sizeClasses} mb-4 md:mb-6 relative`}>
          <div className="absolute inset-0 rounded-full border-4 border-gray-100">
            <div className="absolute top-0 left-0 w-full h-full rounded-full border-4 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
          </div>
          
          {/* Simplified compass animation - responsive font size */}
          <div className="absolute inset-0 flex items-center justify-center opacity-50">
            <i className="fas fa-compass text-blue-500" style={{ fontSize: compassSize }}></i>
          </div>
        </div>
        
        {/* Simplified loading text with dots - responsive text size */}
        <div>
          <p className="text-base md:text-lg font-medium text-gray-700 mb-2">
            {loadingMessage}
            <span className="ml-1 text-blue-500">
              {dots.join('')}
            </span>
          </p>
          
          {/* Simple secondary message - responsive text size */}
          <p className="text-xs md:text-sm text-gray-500 animate-pulse-text">
            <i className="fas fa-map-marker-alt mr-1 md:mr-2 text-red-500"></i>
            {t.discoveringWorld || 'Discovering the world for you...'}
          </p>
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