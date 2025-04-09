import React from 'react';
import PropTypes from 'prop-types';
import '../styles/loading-animations.css';

/**
 * Simplified collection of travel-themed loading indicators
 * Optimized for both mobile and desktop devices
 */

/**
 * Simple inline loading indicator with compass icon
 */
export const InlineLoader = ({ size = 'default', color = 'blue' }) => {
  const sizeClasses = {
    small: 'w-3 h-3 sm:w-4 sm:h-4',
    default: 'w-4 h-4 sm:w-6 sm:h-6',
    large: 'w-6 h-6 sm:w-8 sm:h-8',
  }[size] || 'w-4 h-4 sm:w-6 sm:h-6';

  const colorClasses = {
    blue: 'text-blue-500',
    red: 'text-red-500',
    green: 'text-green-500',
    yellow: 'text-yellow-500',
    gray: 'text-gray-500',
  }[color] || 'text-blue-500';

  return (
    <span className={`inline-flex items-center justify-center ${colorClasses}`}>
      <i className={`fas fa-compass ${sizeClasses} animate-spin`} style={{ animationDuration: '1.5s' }}></i>
    </span>
  );
};

InlineLoader.propTypes = {
  size: PropTypes.oneOf(['small', 'default', 'large']),
  color: PropTypes.oneOf(['blue', 'red', 'green', 'yellow', 'gray']),
};

/**
 * Map pin loader with subtle ripple effect
 */
export const MapPinLoader = ({ text, size = 'default' }) => {
  const sizeClasses = {
    small: 'text-base sm:text-lg',
    default: 'text-lg sm:text-xl',
    large: 'text-xl sm:text-2xl',
  }[size] || 'text-lg sm:text-xl';

  return (
    <div className="flex items-center space-x-2 sm:space-x-3">
      <div className="relative">
        <i className={`fas fa-map-marker-alt ${sizeClasses} text-red-500`}></i>
        <div className="absolute inset-0 animate-ripple opacity-30 bg-red-100 rounded-full" style={{ transform: 'scale(1.2)' }}></div>
      </div>
      {text && <span className="text-sm sm:text-base text-gray-700">{text}</span>}
    </div>
  );
};

MapPinLoader.propTypes = {
  text: PropTypes.string,
  size: PropTypes.oneOf(['small', 'default', 'large']),
};

/**
 * Progress bar with minimal design
 */
export const TravelProgressBar = ({ progress = 0, showPlane = true }) => {
  // Ensure progress is between 0 and 100
  const validProgress = Math.max(0, Math.min(100, progress));
  
  return (
    <div className="w-full">
      <div className="h-1.5 sm:h-2 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-blue-500 rounded-full"
          style={{ width: `${validProgress}%`, transition: 'width 0.3s ease' }}
        >
          {showPlane && validProgress > 3 && (
            <div className="relative" style={{ marginLeft: `${validProgress - 3}%` }}>
              <i className="fas fa-plane-departure text-white text-xs absolute -top-1 transform -translate-y-1/2"></i>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

TravelProgressBar.propTypes = {
  progress: PropTypes.number,
  showPlane: PropTypes.bool,
};

/**
 * Bouncing dots loader
 */
export const BouncingDotsLoader = ({ color = 'blue', size = 'default' }) => {
  const colorClasses = {
    blue: 'bg-blue-500',
    red: 'bg-red-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    gray: 'bg-gray-500',
  }[color] || 'bg-blue-500';
  
  const sizeClasses = {
    small: 'w-1 h-1 sm:w-1.5 sm:h-1.5',
    default: 'w-1.5 h-1.5 sm:w-2 sm:h-2',
    large: 'w-2 h-2 sm:w-3 sm:h-3',
  }[size] || 'w-1.5 h-1.5 sm:w-2 sm:h-2';
  
  return (
    <div className="flex justify-center space-x-1">
      {[0, 1, 2].map((i) => (
        <div 
          key={i}
          className={`rounded-full ${colorClasses} ${sizeClasses} animate-pulse`}
          style={{ 
            animationDelay: `${i * 0.15}s`
          }}
        ></div>
      ))}
    </div>
  );
};

BouncingDotsLoader.propTypes = {
  color: PropTypes.oneOf(['blue', 'red', 'green', 'yellow', 'gray']),
  size: PropTypes.oneOf(['small', 'default', 'large']),
};

export default {
  InlineLoader,
  MapPinLoader,
  TravelProgressBar,
  BouncingDotsLoader
}; 