import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { getReviewCount } from '../utils/ratings';
import translations from '../utils/translations';

const DestinationCard = ({ destination, language, onBookmarkToggle, savedDestinations = [] }) => {
  const navigate = useNavigate();
  const isSaved = savedDestinations.includes?.(destination.id) || false;
  const [imageError, setImageError] = useState(false);
  
  // Get translations for the current language
  const t = translations[language] || translations.en;
  
  const handleBookmarkClick = (e) => {
    if (onBookmarkToggle) {
      e.stopPropagation();
      onBookmarkToggle(destination.id, e);
    }
  };

  const handleImageError = (e) => {
    setImageError(true);
    e.target.src = 'https://via.placeholder.com/400x300?text=No+Image';
  };

  return (
    <div 
      className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 cursor-pointer w-full"
      onClick={() => navigate(`/destination/${destination.id}`)}
    >
      <div className="relative h-40 sm:h-48 overflow-hidden group">
        {!imageError ? (
          <img 
            src={destination.images?.[0] || destination.image} 
            alt={destination.name || t.unnamedPlace} 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            onError={handleImageError}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <div className="text-center p-3 sm:p-4">
              <i className="fas fa-image text-gray-400 text-3xl sm:text-4xl mb-1 sm:mb-2"></i>
              <p className="text-gray-500 text-xs sm:text-sm">{t.imageNotAvailable}</p>
            </div>
          </div>
        )}
        {destination.trending && (
          <div className="absolute top-2 sm:top-3 right-2 sm:right-3 z-10 bg-gradient-to-r from-orange-500 to-pink-500 bg-opacity-85 text-white text-[8px] sm:text-[9px] py-0.5 px-1.5 rounded-sm shadow-sm flex items-center">
            <i className="fas fa-fire mr-1 text-[7px] sm:text-[8px]"></i>
            <span>{t.trending}</span>
          </div>
        )}
        
        {onBookmarkToggle && (
          <button
            className={`absolute top-2 sm:top-4 left-2 sm:left-4 p-2 sm:p-2 rounded-full ${isSaved ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'} min-h-0 min-w-0 sm:min-h-0 sm:min-w-0 touch-target`}
            onClick={handleBookmarkClick}
            aria-label={isSaved ? t.removeBookmark || 'Remove bookmark' : t.addBookmark || 'Add bookmark'}
            style={{ 
              width: '36px', 
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <i className={`${isSaved ? 'fas' : 'far'} fa-bookmark`}></i>
          </button>
        )}
      </div>
      <div className="p-3 sm:p-4 md:p-6">
        <h3 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 mb-1 sm:mb-2 line-clamp-1">{destination.name || t.unnamedPlace}</h3>
        <p className="text-gray-600 mb-2 sm:mb-3 md:mb-4 line-clamp-2 text-xs sm:text-sm md:text-base">{destination.description || t.noDescription || 'No description available'}</p>
        <div className="flex items-center gap-1 text-gray-700 text-xs sm:text-sm">
          <i className="fas fa-star text-yellow-400"></i>
          <span className="font-semibold">{(destination.averageRating || destination.rating || 0).toFixed(1)}</span>
          <span className="text-gray-500">({getReviewCount(destination)} {t.reviews})</span>
          {!onBookmarkToggle && (
            <button 
              className="ml-auto text-gray-400 hover:text-gray-600 min-h-0 min-w-0 sm:min-h-0 sm:min-w-0"
              aria-label={t.bookmark || 'Bookmark'}
              style={{ padding: '8px' }}
            >
              <i className="far fa-bookmark"></i>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

DestinationCard.propTypes = {
  destination: PropTypes.object.isRequired,
  language: PropTypes.string.isRequired,
  onBookmarkToggle: PropTypes.func,
  savedDestinations: PropTypes.array
};

// Add a CSS class for better touch targets on mobile
const styleElement = document.createElement('style');
styleElement.textContent = `
  @media (max-width: 640px) {
    .touch-target {
      position: relative;
    }
    .touch-target::after {
      content: '';
      position: absolute;
      top: -10px;
      left: -10px;
      right: -10px;
      bottom: -10px;
      z-index: -1;
    }
  }
`;
document.head.appendChild(styleElement);

export default DestinationCard;