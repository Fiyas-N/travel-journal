import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import Navbar from '../components/Navbar';
import { db, auth } from '../firebase/config';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import DestinationCard from '../components/DestinationCard';

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
                trending: (data.likes || 0) > 100,
                rating: data.averageRating || 0,
                reviewCount: ratingCount,
                name: data.name || 'Unnamed Destination',
                description: data.description || 'No description available',
                image: data.images?.[0] || data.image || 'https://via.placeholder.com/400x300?text=No+Image'
              };
            });

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
                          trending: (data.likes || 0) > 100,
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