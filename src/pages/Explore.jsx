import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import Navbar from '../components/Navbar';
import { db, auth } from '../firebase/config';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';

const Explore = ({ language, setLanguage, languages, user }) => {
  const navigate = useNavigate();
  const [sortOrder, setSortOrder] = useState('asc');
  const [sortBy, setSortBy] = useState('name');
  const [ratingFilter, setRatingFilter] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isRatingDropdownOpen, setIsRatingDropdownOpen] = useState(false);
  const [showTrending, setShowTrending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [savedDestinations, setSavedDestinations] = useState([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [destinations, setDestinations] = useState([]);
  const [filteredDestinations, setFilteredDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch user's saved destinations
  useEffect(() => {
    const fetchSavedDestinations = async () => {
      if (!user) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setSavedDestinations(userDoc.data().savedDestinations || []);
        }
      } catch (err) {
        console.error('Error fetching saved destinations:', err);
      }
    };

    fetchSavedDestinations();
  }, [user]);

  // Fetch all destinations
  useEffect(() => {
    const fetchDestinations = async () => {
      try {
        setLoading(true);
        const placesSnapshot = await getDocs(collection(db, 'places'));
        console.log('Fetched places:', placesSnapshot.docs.length);
        
        const fetchedDestinations = placesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            trending: (data.likes || 0) > 100,
            rating: data.averageRating || 0,
            reviews: data.reviews?.length || 0,
            name: data.name || 'Unnamed Destination',
            description: data.description || 'No description available',
            image: data.images?.[0] || data.image || 'https://via.placeholder.com/400x300?text=No+Image'
          };
        });

        console.log('Processed destinations:', fetchedDestinations.length);
        setDestinations(fetchedDestinations);
        setFilteredDestinations(fetchedDestinations);
        setError(null);
      } catch (err) {
        console.error('Error fetching destinations:', err);
        setError('Failed to load destinations');
      } finally {
        setLoading(false);
      }
    };

    fetchDestinations();
  }, []);

  // Handle saving/unsaving destinations
  const toggleSaveDestination = async (id) => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    try {
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      const currentSaved = userDoc.data()?.savedDestinations || [];
      
      const newSaved = currentSaved.includes(id)
        ? currentSaved.filter(savedId => savedId !== id)
        : [...currentSaved, id];

      await setDoc(userRef, { savedDestinations: newSaved }, { merge: true });
      setSavedDestinations(newSaved);
    } catch (err) {
      console.error('Error updating saved destinations:', err);
    }
  };

  // Handle destination click
  const handleDestinationClick = (destinationId) => {
    navigate(`/destination/${destinationId}`);
  };

  // Filter and sort destinations
  useEffect(() => {
    if (!destinations.length) return;

    try {
      let filtered = [...destinations];

      if (searchTerm) {
        filtered = filtered.filter(dest =>
          (dest.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
          (dest.description?.toLowerCase() || '').includes(searchTerm.toLowerCase())
        );
      }

      if (showTrending) {
        filtered = filtered.filter(dest => dest.trending);
      }

      if (ratingFilter > 0) {
        filtered = filtered.filter(dest => dest.rating >= ratingFilter);
      }

      filtered.sort((a, b) => {
        if (sortBy === 'name') {
          const comparison = (a.name || '').localeCompare(b.name || '');
          return sortOrder === 'asc' ? comparison : -comparison;
        } else {
          const comparison = (b.rating || 0) - (a.rating || 0);
          return sortOrder === 'asc' ? -comparison : comparison;
        }
      });

      console.log('Filtered destinations:', filtered.length);
      setFilteredDestinations(filtered);
    } catch (err) {
      console.error('Error filtering destinations:', err);
      setError('Error filtering destinations');
    }
  }, [destinations, sortOrder, sortBy, ratingFilter, showTrending, searchTerm]);

  // Add click outside handler for dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.sort-dropdown')) {
        setIsDropdownOpen(false);
      }
      if (!event.target.closest('.rating-dropdown')) {
        setIsRatingDropdownOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  console.log('Render state:', { loading, error, destinationsCount: destinations.length, filteredCount: filteredDestinations.length });

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar 
        language={language}
        setLanguage={setLanguage}
        languages={languages}
        user={user}
        setShowLoginModal={setShowLoginModal}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        isProfileOpen={isProfileOpen}
        setIsProfileOpen={setIsProfileOpen}
      />

      <main className="pt-20 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-2xl text-gray-600">Loading...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-xl text-red-600">{error}</div>
          </div>
        ) : (
          <>
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-sm p-8 mb-8">
              <div className="flex flex-wrap gap-6 items-center justify-between">
                <div className="flex items-center space-x-6">
                  <div className="sort-dropdown relative">
                    <button
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="px-6 py-3 !rounded-button bg-white shadow-sm hover:shadow-md transition-all duration-300 flex items-center space-x-2 border border-gray-100 cursor-pointer whitespace-nowrap"
                    >
                      <span className="text-gray-700 font-medium">
                        Sort by: {sortBy === 'name' ? 'Name' : 'Rating'} ({sortOrder === 'asc' ? 'Ascending' : 'Descending'})
                      </span>
                      <i className={`fas fa-chevron-down text-gray-400 transition-transform duration-300 ${isDropdownOpen ? 'transform rotate-180' : ''}`}></i>
                    </button>

                    {isDropdownOpen && (
                      <div className="absolute mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-100 py-2 z-50">
                        {[
                          { label: 'Name (A to Z)', value: { by: 'name', order: 'asc' } },
                          { label: 'Name (Z to A)', value: { by: 'name', order: 'desc' } },
                          { label: 'Rating (Low to High)', value: { by: 'rating', order: 'asc' } },
                          { label: 'Rating (High to Low)', value: { by: 'rating', order: 'desc' } },
                        ].map((option) => (
                          <div
                            key={option.label}
                            onClick={() => {
                              setSortBy(option.value.by);
                              setSortOrder(option.value.order);
                              setIsDropdownOpen(false);
                            }}
                            className={`px-4 py-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between ${
                              sortBy === option.value.by && sortOrder === option.value.order ? 'bg-blue-50' : ''
                            }`}
                          >
                            <span>{option.label}</span>
                            {sortBy === option.value.by && sortOrder === option.value.order && (
                              <i className="fas fa-check text-blue-600"></i>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rating-dropdown relative">
                    <button
                      onClick={() => setIsRatingDropdownOpen(!isRatingDropdownOpen)}
                      className="px-6 py-3 !rounded-button bg-white shadow-sm hover:shadow-md transition-all duration-300 flex items-center space-x-2 border border-gray-100 cursor-pointer whitespace-nowrap"
                    >
                      <i className="fas fa-star text-yellow-400"></i>
                      <span className="text-gray-700 font-medium">
                        {ratingFilter === 0 ? 'All Ratings' : `${ratingFilter}+ Stars`}
                      </span>
                      <i className={`fas fa-chevron-down text-gray-400 transition-transform duration-300 ${isRatingDropdownOpen ? 'transform rotate-180' : ''}`}></i>
                    </button>

                    {isRatingDropdownOpen && (
                      <div className="absolute mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-2 z-50">
                        {[0, 4.5, 4.7, 4.9].map((rating) => (
                          <div
                            key={rating}
                            onClick={() => {
                              setRatingFilter(rating);
                              setIsRatingDropdownOpen(false);
                            }}
                            className={`px-4 py-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between ${
                              ratingFilter === rating ? 'bg-blue-50' : ''
                            }`}
                          >
                            <span>{rating === 0 ? 'All Ratings' : `${rating}+ Stars`}</span>
                            {ratingFilter === rating && <i className="fas fa-check text-blue-600"></i>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setShowTrending(!showTrending)}
                  className={`px-6 py-3 !rounded-button transition-all duration-300 flex items-center space-x-2 cursor-pointer whitespace-nowrap ${
                    showTrending
                      ? 'bg-blue-600 text-white shadow-lg scale-105'
                      : 'bg-white text-gray-700 hover:shadow-md border border-gray-100'
                  }`}
                >
                  <i className={`fas fa-fire ${showTrending ? 'text-white' : 'text-orange-500'}`}></i>
                  <span className="font-medium">{language === 'hi' ? 'ट्रेंडिंग स्थान' : 'Trending Places'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {filteredDestinations.length === 0 ? (
                <div className="col-span-full text-center py-8 text-gray-500">
                  {language === 'hi' 
                    ? 'कोई परिणाम नहीं मिला'
                    : 'No destinations found'}
                </div>
              ) : (
                filteredDestinations.map((destination) => (
                  <div
                    key={destination.id}
                    className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 cursor-pointer"
                    onClick={() => handleDestinationClick(destination.id)}
                  >
                    <div className="relative h-48 overflow-hidden group">
                      <img
                        src={destination.image}
                        alt={destination.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        onError={(e) => {
                          e.target.src = 'https://via.placeholder.com/400x300?text=No+Image';
                        }}
                      />
                      {destination.trending && (
                        <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1">
                          <i className="fas fa-fire"></i>
                          <span>{language === 'hi' ? 'ट्रेंडिंग' : 'Trending'}</span>
                        </div>
                      )}
                    </div>

                    <div className="p-6">
                      <h3 className="text-xl font-semibold mb-2 text-gray-800 hover:text-blue-600 transition-colors duration-300">
                        {destination.name}
                      </h3>
                      <p className="text-gray-600 mb-4 line-clamp-2">{destination.description}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex items-center text-yellow-400">
                            <i className="fas fa-star"></i>
                          </div>
                          <span className="ml-1 font-medium text-gray-800">
                            {destination.rating.toFixed(1)}
                          </span>
                          <span className="text-gray-500 ml-1">
                            ({destination.reviews} {language === 'hi' ? 'समीक्षाएं' : 'reviews'})
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSaveDestination(destination.id);
                          }}
                          className={`text-2xl transition-colors duration-300 transform hover:scale-110 ${
                            savedDestinations.includes(destination.id)
                              ? 'text-blue-600'
                              : 'text-gray-400 hover:text-blue-600'
                          }`}
                        >
                          <i className={`fas ${savedDestinations.includes(destination.id) ? 'fa-bookmark' : 'fa-bookmark'}`}></i>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

Explore.propTypes = {
  language: PropTypes.string.isRequired,
  setLanguage: PropTypes.func.isRequired,
  languages: PropTypes.array.isRequired,
  user: PropTypes.object
};

export default Explore; 