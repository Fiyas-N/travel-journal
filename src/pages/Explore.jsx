import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import Navbar from '../components/Navbar';
import { db, auth } from '../firebase/config';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import DestinationCard from '../components/DestinationCard';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingScreen from '../components/LoadingScreen';

// Define filter animations near the top where other animations are defined
const filterContainerVariants = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const filterItemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
};

const Explore = ({ language, setLanguage, languages, user }) => {
  const navigate = useNavigate();
  const [showTrending, setShowTrending] = useState(false);
  const [sortBy, setSortBy] = useState('rating');
  const [sortOrder, setSortOrder] = useState('desc');
  const [ratingFilter, setRatingFilter] = useState(0);
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isRatingDropdownOpen, setIsRatingDropdownOpen] = useState(false);
  const [showTrendingTooltip, setShowTrendingTooltip] = useState(false);

  // Redirect unauthenticated users trying to access protected features
  const checkAuth = () => {
    if (!user) {
      navigate('/auth');
      return false;
    }
    return true;
  };

  // Check authentication when component mounts
  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
  }, [user, navigate]);

  // Fetch user's saved destinations
  useEffect(() => {
    const fetchSavedDestinations = async () => {
      if (!user) {
        setSavedDestinations([]);
        return;
      }
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setSavedDestinations(userDoc.data().savedDestinations || []);
        }
      } catch (err) {
        console.error('Error fetching saved destinations:', err);
        // Don't set error state here as it would override the main content
      }
    };

    fetchSavedDestinations();
  }, [user]);

  // Fetch all destinations
  useEffect(() => {
    const fetchDestinations = async (retryCount = 0) => {
      try {
        setLoading(true);
        setError(null);
        
        // Add error handling for potential Firebase initialization issues
        if (!db) {
          console.error('Firebase database not initialized');
          setError('Service unavailable. Please try again later.');
          setLoading(false);
          return;
        }
        
        // We want to fetch public data regardless of authentication status
        console.log('Fetching destinations, auth status:', user ? 'authenticated' : 'not authenticated');
        
        try {
          // Try to fetch from Firebase
          const placesCollection = collection(db, 'places');
          const placesSnapshot = await getDocs(placesCollection);
          console.log('Fetched places from Firebase:', placesSnapshot.docs.length);
          
          if (placesSnapshot.empty) {
            console.log('No destinations found in database');
            setDestinations([]);
            setFilteredDestinations([]);
            setError('No destinations found. Please check back later.');
          } else {
            const fetchedDestinations = placesSnapshot.docs.map(doc => {
              const data = doc.data();
              
              // Get the ratings count from the ratings object
              let ratingCount = 0;
              if (data.ratings && typeof data.ratings === 'object') {
                // Count the number of keys in the ratings object
                ratingCount = Object.keys(data.ratings).length;
              }
              
              return {
                id: doc.id,
                ...data,
                trending: false, // Will be determined based on bookmark count later
                bookmarkCount: 0, // Initialize bookmark count for trending calculation
                rating: data.averageRating || 0,
                reviewCount: ratingCount,
                name: data.name || 'Unnamed Destination',
                description: data.description || 'No description available',
                image: data.images?.[0] || data.image || 'https://via.placeholder.com/400x300?text=No+Image'
              };
            });

            // Calculate bookmark counts for trending determination
            try {
              const usersSnapshot = await getDocs(collection(db, 'users'));
              
              // Count how many times each place is bookmarked
              usersSnapshot.forEach(userDoc => {
                const userData = userDoc.data();
                const userSavedDestinations = userData.savedDestinations || [];
                
                // Increment bookmark count for each place this user has saved
                userSavedDestinations.forEach(placeId => {
                  const place = fetchedDestinations.find(p => p.id === placeId);
                  if (place) {
                    place.bookmarkCount = (place.bookmarkCount || 0) + 1;
                  }
                });
              });
              
              console.log('Bookmark counts calculated for trending determination');
            } catch (err) {
              console.error('Error calculating bookmark counts:', err);
            }

            console.log('Processed destinations:', fetchedDestinations.length);
            setDestinations(fetchedDestinations);
            setFilteredDestinations(fetchedDestinations);
            setError(null);
          }
        } catch (err) {
          console.error('Error fetching from Firebase:', err);
          setDestinations([]);
          setFilteredDestinations([]);
          setError('Failed to load destinations. Please try again later.');
        }
      } catch (err) {
        console.error('Error in main try block:', err);
        
        // If we haven't exceeded max retries, try again
        if (retryCount < 2) {
          console.log(`Retrying fetch (attempt ${retryCount + 1})...`);
          setTimeout(() => fetchDestinations(retryCount + 1), 1500);
          return;
        }
        
        setDestinations([]);
        setFilteredDestinations([]);
        setError('Failed to load destinations after multiple attempts. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchDestinations();
  }, [user]); // Add user as a dependency to refetch when auth state changes

  // Handle saving/unsaving destinations
  const toggleSaveDestination = async (id) => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    try {
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      // Check if document exists and has data
      if (!userDoc.exists()) {
        // Create new user document if it doesn't exist
        await setDoc(userRef, { savedDestinations: [id] });
        setSavedDestinations([id]);
        return;
      }
      
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

      // First, mark trending destinations based on bookmark counts (always do this)
      // Mark top destinations as trending based on bookmark counts (matching Home page logic)
      const trendingDestinations = [...filtered]
        .sort((a, b) => (b.bookmarkCount || 0) - (a.bookmarkCount || 0))
        .slice(0, 3);
      
      // Create a set of IDs for quick lookup
      const topIds = new Set(trendingDestinations.map(d => d.id));
      
      // Update the trending property for all destinations
      filtered = filtered.map(dest => ({
        ...dest,
        trending: topIds.has(dest.id)
      }));

      console.log('Top trending places by bookmarks:', trendingDestinations.map(d => d.name));
      
      // Then, if showTrending is true, filter to only show trending destinations
      if (showTrending) {
        filtered = filtered.filter(dest => dest.trending);
        console.log('Filtered to show only trending destinations:', filtered.length);
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
      console.log('Trending destinations:', filtered.filter(d => d.trending).length);
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

      <main className="pt-16 pb-12 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <LoadingScreen language={language} type="inline" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="text-xl text-red-600 mb-4">{error}</div>
            <button 
              onClick={() => {
                setLoading(true);
                setTimeout(() => {
                  const fetchDestinations = async () => {
                    try {
                      setError(null);
                      
                      // Check if Firebase is initialized
                      if (!db) {
                        console.error('Firebase database not initialized');
                        setError('Service unavailable. Please try again later.');
                        setLoading(false);
                        return;
                      }
                      
                      const placesCollection = collection(db, 'places');
                      const placesSnapshot = await getDocs(placesCollection);
                      
                      if (placesSnapshot.empty) {
                        setDestinations([]);
                        setFilteredDestinations([]);
                        setError('No destinations found. Try adding some places!');
                        return;
                      }
                      
                      const fetchedDestinations = placesSnapshot.docs.map(doc => {
                        const data = doc.data();
                        let ratingCount = 0;
                        if (data.ratings && typeof data.ratings === 'object') {
                          ratingCount = Object.keys(data.ratings).length;
                        }
                        
                        return {
                          id: doc.id,
                          ...data,
                          trending: false, // Will be determined based on bookmark count later
                          rating: data.averageRating || 0,
                          reviewCount: ratingCount,
                          name: data.name || 'Unnamed Destination',
                          description: data.description || 'No description available',
                          image: data.images?.[0] || data.image || 'https://via.placeholder.com/400x300?text=No+Image'
                        };
                      });

                      setDestinations(fetchedDestinations);
                      setFilteredDestinations(fetchedDestinations);
                      setError(null);
                    } catch (err) {
                      console.error('Error fetching destinations:', err);
                      setError('Failed to load places. Please try again later.');
                    } finally {
                      setLoading(false);
                    }
                  };
                  fetchDestinations();
                }, 1000);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              {language === 'hi' ? 'पुनः प्रयास करें' : 'Try Again'}
            </button>
          </div>
        ) : (
          <>
            <motion.div 
              className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-sm p-4 sm:p-6 mb-6 sm:mb-8"
              variants={filterContainerVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 items-center sm:justify-between">
                <div className="w-full sm:w-auto flex flex-wrap gap-3">
                  {/* Mobile-friendly search input */}
                  <div className="w-full sm:w-auto relative">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder={language === 'hi' ? 'स्थान खोजें...' : 'Search destinations...'}
                      className="w-full sm:w-64 px-3 py-2 rounded-md border border-gray-200 focus:border-blue-500 focus:outline-none text-sm"
                    />
                    <i className="fas fa-search absolute right-3 top-2.5 text-gray-400 text-sm"></i>
                  </div>
                </div>
                
                <div className="w-full sm:w-auto flex flex-wrap gap-3">
                  <motion.div className="sort-dropdown relative w-full sm:w-auto flex-1 sm:flex-none" variants={filterItemVariants}>
                    <button
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="w-full sm:w-auto px-3 sm:px-4 py-2 rounded-md bg-white shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-between sm:space-x-2 border border-gray-100 cursor-pointer"
                    >
                      <span className="text-gray-700 font-medium text-sm sm:text-base truncate">
                        {sortBy === 'name' ? 
                          (language === 'hi' ? 'नाम से क्रमबद्ध' : 'Sort by Name') : 
                          (language === 'hi' ? 'रेटिंग से क्रमबद्ध' : 'Sort by Rating')}
                        {" "}({sortOrder === 'asc' ? 
                          (language === 'hi' ? 'आरोही' : 'Asc') : 
                          (language === 'hi' ? 'अवरोही' : 'Desc')})
                      </span>
                      <i className={`fas fa-chevron-down text-gray-400 transition-transform duration-300 ${isDropdownOpen ? 'transform rotate-180' : ''}`}></i>
                    </button>

                    {isDropdownOpen && (
                      <div className="absolute mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-100 py-2 z-50">
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
                            className={`px-3 py-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between ${
                              sortBy === option.value.by && sortOrder === option.value.order ? 'bg-blue-50' : ''
                            }`}
                          >
                            <span className="text-sm">{language === 'hi' ? 
                              option.label === 'Name (A to Z)' ? 'नाम (A से Z)' : 
                              option.label === 'Name (Z to A)' ? 'नाम (Z से A)' : 
                              option.label === 'Rating (Low to High)' ? 'रेटिंग (कम से अधिक)' : 
                              'रेटिंग (अधिक से कम)'
                              : option.label}</span>
                            {sortBy === option.value.by && sortOrder === option.value.order && (
                              <i className="fas fa-check text-blue-600"></i>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>

                  <motion.div className="rating-dropdown relative w-full sm:w-auto flex-1 sm:flex-none" variants={filterItemVariants}>
                    <button
                      onClick={() => setIsRatingDropdownOpen(!isRatingDropdownOpen)}
                      className="w-full sm:w-auto px-3 sm:px-4 py-2 rounded-md bg-white shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-between sm:space-x-2 border border-gray-100 cursor-pointer"
                    >
                      <span className="text-gray-700 font-medium text-sm sm:text-base flex items-center">
                        <i className="fas fa-star text-yellow-400 mr-2"></i>
                        {ratingFilter === 0 ? (language === 'hi' ? 'सभी रेटिंग' : 'All Ratings') : `${ratingFilter}+ ${language === 'hi' ? 'स्टार' : 'Stars'}`}
                      </span>
                      <i className={`fas fa-chevron-down text-gray-400 transition-transform duration-300 ${isRatingDropdownOpen ? 'transform rotate-180' : ''}`}></i>
                    </button>

                    {isRatingDropdownOpen && (
                      <div className="absolute mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-100 py-2 z-50">
                        {[0, 4.5, 4.7, 4.9].map((rating) => (
                          <div
                            key={rating}
                            onClick={() => {
                              setRatingFilter(rating);
                              setIsRatingDropdownOpen(false);
                            }}
                            className={`px-3 py-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between ${
                              ratingFilter === rating ? 'bg-blue-50' : ''
                            }`}
                          >
                            <span className="text-sm">{rating === 0 ? (language === 'hi' ? 'सभी रेटिंग' : 'All Ratings') : `${rating}+ ${language === 'hi' ? 'स्टार' : 'Stars'}`}</span>
                            {ratingFilter === rating && <i className="fas fa-check text-blue-600"></i>}
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>

                  <motion.div className="w-full sm:w-auto" variants={filterItemVariants}>
                    <motion.button
                      onClick={() => setShowTrending(!showTrending)}
                      onMouseEnter={() => setShowTrendingTooltip(true)}
                      onMouseLeave={() => setShowTrendingTooltip(false)}
                      className={`w-full sm:w-auto px-3 sm:px-4 py-2 rounded-md transition-all duration-300 flex items-center justify-center space-x-2 ${
                        showTrending
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'bg-white text-gray-700 hover:shadow-md border border-gray-100'
                      }`}
                      aria-pressed={showTrending}
                      aria-label={language === 'hi' ? 'ट्रेंडिंग स्थान फ़िल्टर' : 'Trending Places Filter'}
                    >
                      <i className={`fas fa-fire ${showTrending ? 'text-white' : 'text-orange-500'}`}></i>
                      <span className="font-medium text-sm sm:text-base">{language === 'hi' ? 'ट्रेंडिंग' : 'Trending'}</span>
                      {showTrending && (
                        <i className="fas fa-check-circle text-white text-sm"></i>
                      )}
                    </motion.button>
                    
                    {showTrendingTooltip && (
                      <div className="absolute mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-100 py-2 px-3 z-50 text-sm right-0 hidden sm:block">
                        {language === 'hi' 
                          ? 'सबसे अधिक बुकमार्क किए गए शीर्ष 3 स्थान ट्रेंडिंग के रूप में दिखाए जाते हैं।' 
                          : 'Showing the top 3 most bookmarked destinations as trending.'}
                      </div>
                    )}
                  </motion.div>
                </div>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
              {filteredDestinations.length === 0 ? (
                <div className="col-span-full text-center py-8 text-gray-500">
                  {language === 'hi' 
                    ? 'कोई परिणाम नहीं मिला'
                    : 'No destinations found'}
                </div>
              ) : (
                filteredDestinations.map((destination) => (
                  <DestinationCard 
                    key={destination.id}
                    destination={destination} 
                    language={language} 
                    onBookmarkToggle={toggleSaveDestination}
                    savedDestinations={savedDestinations}
                  />
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