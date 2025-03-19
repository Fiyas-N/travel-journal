import React, { useState, useEffect } from 'react'
import { auth, db } from '../firebase/config'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore'
import PropTypes from 'prop-types'
import Navbar from '../components/Navbar'
import { getReviewCount } from '../utils/ratings'
import { motion, AnimatePresence } from 'framer-motion'
import { getAllStates, getDistrictsForState, getStateTranslation } from '../utils/indiaLocations'
import { getAllCountries, getCountryTranslation, getStatesForCountry } from '../utils/countries'
import DestinationCard from '../components/DestinationCard'

const Recommend = ({ language, setLanguage, languages }) => {
  const navigate = useNavigate()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [numRecommendations, setNumRecommendations] = useState(6)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [minRating, setMinRating] = useState(0)
  const [places, setPlaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)
  const [selectedState, setSelectedState] = useState('all')
  const [selectedCountry, setSelectedCountry] = useState('all')
  const [selectedDistrict, setSelectedDistrict] = useState('all')
  const [savedDestinations, setSavedDestinations] = useState([])

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setIsAuthenticated(true)
        setUser(currentUser)
        await fetchPlaces(currentUser)
        await fetchSavedDestinations(currentUser)
      } else {
        setIsAuthenticated(false)
        setUser(null)
        navigate('/auth')
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [navigate])

  useEffect(() => {
    if (selectedState !== 'all') {
      const stateDistricts = getDistrictsForState(selectedState)
      if (selectedDistrict !== 'all' && !stateDistricts.includes(selectedDistrict)) {
        setSelectedDistrict('all')
      }
    }
  }, [selectedState])

  const fetchPlaces = async (currentUser, retryCount = 0) => {
    try {
      setLoading(true);
      setError(null);

      console.log('Fetching user preferences...');
      // First, get user preferences
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const userPrefs = userDoc.data()?.preferences?.tripTypes || [];
      console.log('User preferences:', userPrefs);

      console.log('Fetching all places...');
      // Fetch all places
      const placesSnapshot = await getDocs(collection(db, 'places'));
      console.log('Places snapshot size:', placesSnapshot.docs.length);
      
      let fetchedPlaces = placesSnapshot.docs.map(doc => {
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
          reviewCount: ratingCount
        };
      });

      console.log('Processed places:', fetchedPlaces.length);

      if (fetchedPlaces.length === 0) {
        console.warn('No places found in the database');
        setError('No places found in the database. Try adding some places!');
        setLoading(false);
        return;
      }

      // Sort places by rating
      fetchedPlaces = fetchedPlaces.sort((a, b) => {
        const ratingA = a.averageRating || a.rating || 0;
        const ratingB = b.averageRating || b.rating || 0;
        return ratingB - ratingA;
      });

      // If user has preferences, prioritize those places
      if (userPrefs.length > 0) {
        fetchedPlaces = [
          ...fetchedPlaces.filter(place => userPrefs.includes(place.category)),
          ...fetchedPlaces.filter(place => !userPrefs.includes(place.category))
        ];
      }

      console.log('Final places array:', fetchedPlaces.length);
      setPlaces(fetchedPlaces);
      setError(null);
    } catch (err) {
      console.error('Error fetching places:', err);
      // If we haven't exceeded max retries, try again
      if (retryCount < 3) {
        console.log(`Retrying fetch (attempt ${retryCount + 1})...`);
        setTimeout(() => fetchPlaces(currentUser, retryCount + 1), 1500);
        return;
      }
      setError('Failed to load recommendations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Log savedDestinations whenever it changes
  useEffect(() => {
    console.log('savedDestinations state updated:', savedDestinations);
  }, [savedDestinations]);

  // Fetch user's saved destinations
  const fetchSavedDestinations = async (currentUser) => {
    try {
      console.log('Fetching saved destinations for user:', currentUser.uid);
      const userRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        console.log('User document does not exist, creating it...');
        // Create the user document if it doesn't exist
        await setDoc(userRef, { 
          savedDestinations: [],
          createdAt: new Date().toISOString()
        });
        setSavedDestinations([]);
        return;
      }
      
      const userData = userDoc.data();
      console.log('User data from Firestore:', userData);
      
      // Ensure savedDestinations exists
      if (!userData.savedDestinations) {
        console.log('savedDestinations field does not exist, initializing it...');
        await setDoc(userRef, { savedDestinations: [] }, { merge: true });
        setSavedDestinations([]);
      } else {
        console.log('Setting savedDestinations state:', userData.savedDestinations);
        setSavedDestinations(userData.savedDestinations);
      }
    } catch (err) {
      console.error('Error fetching saved destinations:', err);
    }
  };

  // Toggle bookmark for a destination
  const toggleBookmark = async (placeId, e) => {
    e.stopPropagation();
    
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    try {
      // Get the current button state before any changes
      const isCurrentlySaved = savedDestinations.includes(placeId);
      
      // Optimistically update UI state first for better user experience
      const newSavedDestinations = isCurrentlySaved
        ? savedDestinations.filter(id => id !== placeId)
        : [...savedDestinations, placeId];
      
      setSavedDestinations(newSavedDestinations);
      
      // Update Firestore
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { 
        savedDestinations: newSavedDestinations,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      // Show a temporary success message
      const message = isCurrentlySaved ? 'Bookmark removed' : 'Bookmark added';
      const successMessage = document.createElement('div');
      successMessage.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-md shadow-md z-50';
      successMessage.innerHTML = `<p class="text-sm text-center">${message}</p>`;
      document.body.appendChild(successMessage);
      
      setTimeout(() => {
        if (document.body.contains(successMessage)) {
          document.body.removeChild(successMessage);
        }
      }, 2000);
    } catch (err) {
      console.error('Error updating saved destinations:', err);
      
      // Revert the optimistic update if there was an error
      const isCurrentlySaved = savedDestinations.includes(placeId);
      const originalSavedDestinations = isCurrentlySaved
        ? savedDestinations.filter(id => id !== placeId)
        : [...savedDestinations, placeId];
      
      setSavedDestinations(originalSavedDestinations);
      
      // Show error message
      alert(`Error bookmarking: ${err.message}. Please try again.`);
    }
  };

  const filteredPlaces = places.filter(place => {
    // Filter by category if not 'all'
    if (selectedCategory !== 'all' && place.category !== selectedCategory) {
      return false;
    }
    
    // Filter by district if not 'all'
    if (selectedDistrict !== 'all' && place.district !== selectedDistrict) {
      return false;
    }
    
    // Filter by state if not 'all'
    if (selectedState !== 'all' && place.state !== selectedState) {
      return false;
    }
    
    // Filter by country if not 'all'
    if (selectedCountry !== 'all' && place.country !== selectedCountry) {
      return false;
    }
    
    // Filter by minimum rating
    const placeRating = place.averageRating || place.rating || 0;
    if (placeRating < minRating) {
      return false;
    }
    
    return true;
  }).slice(0, numRecommendations);

  // Create arrays of unique states and countries for the filter dropdowns
  const countries = ['all', ...getAllCountries()]
  
  // Get states based on selected country
  const getAvailableStates = () => {
    if (selectedCountry === 'all') {
      return [];
    } else if (selectedCountry === 'India') {
      return getAllStates();
    } else {
      return getStatesForCountry(selectedCountry);
    }
  }
  
  const states = ['all', ...getAvailableStates()]

  // Create array of unique districts for the filter dropdown
  const getAvailableDistricts = () => {
    if (selectedState === 'all') {
      return [];
    } else if (selectedCountry === 'India') {
      return getDistrictsForState(selectedState);
    } else {
      // For non-Indian states, get districts from the places data
      return [...new Set(
        places
          .filter(place => place.state === selectedState)
          .map(place => place.district)
          .filter(Boolean)
      )];
    }
  }
  
  const districts = ['all', ...getAvailableDistricts()]

  // Reset dependent filters when parent filter changes
  useEffect(() => {
    setSelectedState('all');
    setSelectedDistrict('all');
  }, [selectedCountry]);

  useEffect(() => {
    setSelectedDistrict('all');
  }, [selectedState]);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        when: "beforeChildren",
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { type: 'spring', stiffness: 100 }
    }
  };

  const filterContainerVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        type: 'spring', 
        stiffness: 100, 
        when: "beforeChildren",
        staggerChildren: 0.1
      }
    }
  };

  const filterItemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { type: 'spring', stiffness: 200 }
    }
  };

  const titleVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        type: 'spring', 
        stiffness: 100, 
        delay: 0.2 
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-2xl text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated && !loading) {
    // Only navigate when loading is complete and user is not authenticated
    navigate('/auth');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-2xl text-gray-600">Redirecting to login...</div>
      </div>
    );
  }

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

      <motion.main 
        className="max-w-7xl mx-auto px-4 py-8 pt-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >


        <motion.div 
          className="mb-8"
          variants={titleVariants}
          initial="hidden"
          animate="visible"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {language === 'hi' ? 'व्यक्तिगत अनुशंसाएँ' : 'Personalized Recommendations'}
          </h1>
          <p className="text-gray-600">
            {language === 'hi' 
              ? 'आपकी प्राथमिकताओं के आधार पर अनुकूलित स्थान'
              : 'Places tailored to your preferences'}
          </p>
        </motion.div>

        <AnimatePresence>
          {error && (
            <motion.div 
              className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter bar with animations */}
        <motion.div 
          className="bg-blue-50 rounded-lg p-4 mb-8 flex flex-wrap gap-4 items-center"
          variants={filterContainerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Number of recommendations filter */}
          <motion.div className="relative" variants={filterItemVariants}>
            <select
              value={numRecommendations}
              onChange={(e) => setNumRecommendations(Number(e.target.value))}
              className="appearance-none bg-white border border-gray-300 rounded-md pl-4 pr-10 py-2 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={3}>3 {language === 'hi' ? 'स्थान' : 'Places'}</option>
              <option value={6}>6 {language === 'hi' ? 'स्थान' : 'Places'}</option>
              <option value={12}>12 {language === 'hi' ? 'स्थान' : 'Places'}</option>
              <option value={20}>20 {language === 'hi' ? 'स्थान' : 'Places'}</option>
              <option value={100}>20+ {language === 'hi' ? 'स्थान' : 'Places'}</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
              </svg>
            </div>
          </motion.div>

          {/* Category filter */}
          <motion.div className="relative" variants={filterItemVariants}>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-md pl-4 pr-10 py-2 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">{language === 'hi' ? 'सभी श्रेणियां' : 'All Categories'}</option>
              <option value="beach">{language === 'hi' ? 'समुद्र तट' : 'Beach'}</option>
              <option value="mountain">{language === 'hi' ? 'पर्वत' : 'Mountain'}</option>
              <option value="cultural">{language === 'hi' ? 'सांस्कृतिक' : 'Cultural'}</option>
              <option value="adventure">{language === 'hi' ? 'साहसिक' : 'Adventure'}</option>
              <option value="city">{language === 'hi' ? 'शहर' : 'City'}</option>
              <option value="nature">{language === 'hi' ? 'प्रकृति' : 'Nature'}</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
              </svg>
            </div>
          </motion.div>

          {/* Rating filter */}
          <motion.div className="relative" variants={filterItemVariants}>
            <select
              value={minRating}
              onChange={(e) => setMinRating(Number(e.target.value))}
              className="appearance-none bg-white border border-gray-300 rounded-md pl-4 pr-10 py-2 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={0}>{language === 'hi' ? 'सभी रेटिंग' : 'All Ratings'}</option>
              <option value={3}>3+ {language === 'hi' ? 'स्टार' : 'Stars'}</option>
              <option value={4}>4+ {language === 'hi' ? 'स्टार' : 'Stars'}</option>
              <option value={4.5}>4.5+ {language === 'hi' ? 'स्टार' : 'Stars'}</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
              </svg>
            </div>
          </motion.div>

          {/* Country filter */}
          <motion.div className="relative" variants={filterItemVariants}>
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-md pl-4 pr-10 py-2 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">{language === 'hi' ? 'सभी देश' : 'All Countries'}</option>
              {countries.filter(country => country !== 'all').map(country => (
                <option key={country} value={country}>
                  {language === 'hi' ? getCountryTranslation(country) : country}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
              </svg>
            </div>
          </motion.div>

          {/* State filter */}
          <motion.div className="relative" variants={filterItemVariants}>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className={`appearance-none bg-white border border-gray-300 rounded-md pl-4 pr-10 py-2 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${selectedCountry === 'all' ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={selectedCountry === 'all'}
            >
              <option value="all">{language === 'hi' ? 'सभी राज्य' : 'All States'}</option>
              {states.length > 1 ? (
                states.filter(state => state !== 'all').map(state => (
                  <option key={state} value={state}>
                    {language === 'hi' ? getStateTranslation(state) : state}
                  </option>
                ))
              ) : (
                selectedCountry !== 'all' && (
                  <option disabled value="">
                    {language === 'hi' ? 'कोई राज्य उपलब्ध नहीं है' : 'No states available'}
                  </option>
                )
              )}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
              </svg>
            </div>
          </motion.div>

          {/* District filter */}
          <motion.div className="relative" variants={filterItemVariants}>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className={`appearance-none bg-white border border-gray-300 rounded-md pl-4 pr-10 py-2 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${selectedState === 'all' ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={selectedState === 'all'}
            >
              <option value="all">{language === 'hi' ? 'सभी जिले' : 'All Districts'}</option>
              {districts.length > 1 ? (
                districts.filter(district => district !== 'all').map(district => (
                  <option key={district} value={district}>{district}</option>
                ))
              ) : (
                selectedState !== 'all' && (
                  <option disabled value="">
                    {language === 'hi' ? 'कोई जिला उपलब्ध नहीं है' : 'No districts available'}
                  </option>
                )
              )}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
              </svg>
            </div>
          </motion.div>
        </motion.div>

        {loading ? (
          <motion.div 
            className="flex justify-center items-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div 
              className="rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"
              animate={{ rotate: 360 }}
              transition={{ 
                duration: 1.5, 
                ease: "linear", 
                repeat: Infinity 
              }}
            />
          </motion.div>
        ) : error ? (
          <motion.div 
            className="flex flex-col items-center justify-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-xl text-red-600 mb-6">{error}</div>
            <button 
              onClick={() => {
                if (user) {
                  setLoading(true);
                  setTimeout(() => fetchPlaces(user), 1000);
                }
              }}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-md"
            >
              <i className="fas fa-sync-alt mr-2"></i>
              {language === 'hi' ? 'पुनः प्रयास करें' : 'Try Again'}
            </button>
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            {filteredPlaces.length > 0 ? (
              <motion.div 
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                key="places-grid"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0 }}
              >
                {filteredPlaces.map((place, index) => (
                  <motion.div
                    key={place.id}
                    variants={itemVariants}
                    custom={index}
                    whileHover={{ 
                      scale: 1.03,
                      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                      transition: { duration: 0.2 }
                    }}
                  >
                    <DestinationCard 
                      destination={place} 
                      language={language} 
                      onBookmarkToggle={toggleBookmark}
                      savedDestinations={savedDestinations}
                    />
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div 
                className="text-center py-12 text-gray-500"
                key="no-results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
              >
                {language === 'hi' 
                  ? 'चयनित मापदंडों के लिए कोई स्थान नहीं मिला'
                  : 'No places found for the selected criteria'}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </motion.main>
    </div>
  );
};

Recommend.propTypes = {
  language: PropTypes.string.isRequired,
  setLanguage: PropTypes.func.isRequired,
  languages: PropTypes.array.isRequired
};

export default Recommend;