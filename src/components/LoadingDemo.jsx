import React, { useState, useEffect } from 'react';
import LoadingScreen from './LoadingScreen';
import { 
  InlineLoader, 
  MapPinLoader,
  TravelProgressBar,
  BouncingDotsLoader
} from './LoadingIndicators';

/**
 * Demo component to showcase the refined loading animations
 * Optimized for both desktop and mobile views
 */
const LoadingDemo = ({ language = 'en' }) => {
  const [progress, setProgress] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  // Check if fullscreen parameter is present in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setIsFullScreen(urlParams.get('fullscreen') === 'true');
  }, []);
  
  // Simulate progress for the progress bar demo
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) return 0;
        return prev + 5;
      });
    }, 400);
    
    return () => clearInterval(interval);
  }, []);
  
  // If fullscreen mode is enabled, show only the loading screen
  if (isFullScreen) {
    return <LoadingScreen language={language} type="fullpage" />;
  }
  
  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto bg-white rounded-xl shadow-md">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-3 sm:mb-6">Loading Animations</h2>
      <p className="text-sm sm:text-base text-gray-600 mb-5 sm:mb-8">Clean, minimalist loading animations for the Travel Journal app.</p>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {/* Inline loaders section */}
        <div className="bg-gray-50 p-4 sm:p-5 rounded-lg">
          <h3 className="text-md sm:text-lg font-semibold mb-3 sm:mb-4">Inline Loaders</h3>
          <div className="flex items-center space-x-4 mb-3 sm:mb-4">
            <InlineLoader size="small" color="blue" />
            <span className="text-sm sm:text-base">Small Blue</span>
          </div>
          <div className="flex items-center space-x-4">
            <InlineLoader size="default" color="green" />
            <span className="text-sm sm:text-base">Default Green</span>
          </div>
        </div>
        
        {/* Map Pin loaders */}
        <div className="bg-gray-50 p-4 sm:p-5 rounded-lg">
          <h3 className="text-md sm:text-lg font-semibold mb-3 sm:mb-4">Map Indicators</h3>
          <MapPinLoader text="Finding locations near you..." />
        </div>
        
        {/* Progress bar */}
        <div className="bg-gray-50 p-4 sm:p-5 rounded-lg">
          <h3 className="text-md sm:text-lg font-semibold mb-3 sm:mb-4">Progress Indicator</h3>
          <TravelProgressBar progress={progress} showPlane={true} />
          <p className="text-xs sm:text-sm text-gray-600 mt-2">Progress: {progress}%</p>
        </div>
        
        {/* Full screen loader */}
        <div className="bg-gray-50 p-4 sm:p-5 rounded-lg">
          <h3 className="text-md sm:text-lg font-semibold mb-3 sm:mb-4">Loading Screen</h3>
          <p className="text-xs sm:text-sm text-gray-600 mb-3">Shown during app initialization and page transitions.</p>
          <a href="/loading-demo?fullscreen=true" className="text-blue-500 hover:underline text-sm sm:text-base">
            View fullscreen version
          </a>
        </div>
      </div>
      
      {/* Full screen loader preview */}
      <div className="mt-6 sm:mt-8">
        <h3 className="text-md sm:text-lg font-semibold mb-3 sm:mb-4">Loading Screen Preview</h3>
        <div className="border border-gray-200 rounded-lg" style={{ height: '280px', overflow: 'hidden', position: 'relative' }}>
          <div style={{ transform: 'scale(0.6)', transformOrigin: 'center', height: '100%' }}>
            <LoadingScreen language={language} type="overlay" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingDemo; 