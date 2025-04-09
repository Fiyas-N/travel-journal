import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { auth, db } from '../firebase/config'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, query, where } from 'firebase/firestore'
import PropTypes from 'prop-types'
import Navbar from '../components/Navbar'
import { getReviewCount } from '../utils/ratings'
import { motion, AnimatePresence } from 'framer-motion'
import { getAllStates, getDistrictsForState, getStateTranslation } from '../utils/indiaLocations'
import { getAllCountries, getCountryTranslation, getStatesForCountry } from '../utils/countries'
import DestinationCard from '../components/DestinationCard'
import translations from '../utils/translations'
import LoadingScreen from '../components/LoadingScreen'

// Utility function to shuffle an array (Fisher-Yates algorithm)
const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// Function to translate category names
const translateCategory = (category, language) => {
  const t = translations[language] || translations.en;
  
  if (!category) return '';
  
  // If translation exists, use it
  if (t[category.toLowerCase()]) {
    return t[category.toLowerCase()];
  }
  
  // Fallback to capitalized category name
  return category.charAt(0).toUpperCase() + category.slice(1);
};

const Recommend = ({ language, setLanguage, languages }) => {
  // Get translations for the current language
  const t = translations[language] || translations.en;
  
  // Add custom translations for Hindi
  if (language === 'hi') {
    // Add Hindi translations for strings that might not be in the main translations file
    t.personalizedRecommendations = 'व्यक्तिगत अनुशंसाएँ';
    t.placesTailoredToYourPreferences = 'आपकी प्राथमिकताओं के आधार पर अनुकूलित स्थान';
    t.redirectingToLogin = 'लॉगिन पर रीडायरेक्ट हो रहा है...';
    t.places = 'स्थान';
    t.allCategories = 'सभी श्रेणियां';
    t.allRatings = 'सभी रेटिंग';
    t.stars = 'स्टार';
    t.allCountries = 'सभी देश';
    t.allStates = 'सभी राज्य';
    t.allDistricts = 'सभी जिले';
    t.preferenceMatch = 'पसंद अनुसार';
    t.similarToSaved = 'समान स्थान';
    t.newDiscovery = 'नई खोज';
    t.bookmarkAdded = 'बुकमार्क जोड़ा गया';
    t.bookmarkRemoved = 'बुकमार्क हटाया गया';
    t.errorBookmarking = 'बुकमार्क करने में त्रुटि';
    t.pleaseTryAgain = 'कृपया पुनः प्रयास करें';
    t.noPlacesFound = 'डेटाबेस में कोई स्थान नहीं मिला। कुछ स्थान जोड़ने का प्रयास करें!';
    t.failedToLoadRecommendations = 'अनुशंसाएँ लोड करने में विफल। कृपया पुनः प्रयास करें।';
    t.noPlacesFoundForSelectedCriteria = 'चयनित मापदंडों के लिए कोई स्थान नहीं मिला';
    t.recommendationExplanation = 'हमने आपकी पसंद, बुकमार्क और इसी तरह के स्थानों के आधार पर अनुशंसाएँ तैयार की हैं। नीले बैज आपकी पसंद का स्थान, बैंगनी बैज समान स्थान और हरे बैज नई खोज दिखाते हैं।';
  }
  
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
  const [doneFiltering, setDoneFiltering] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [filterWarning, setFilterWarning] = useState(null);
  
  // Dropdown states
  const [isNumberDropdownOpen, setIsNumberDropdownOpen] = useState(false)
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false)
  const [isRatingDropdownOpen, setIsRatingDropdownOpen] = useState(false)
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false)
  const [isStateDropdownOpen, setIsStateDropdownOpen] = useState(false)
  const [isDistrictDropdownOpen, setIsDistrictDropdownOpen] = useState(false)

  // Add new state variables for tracking destination recommendation types
  const [preferenceBasedIds, setPreferenceBasedIds] = useState([]);
  const [similarityBasedIds, setSimilarityBasedIds] = useState([]);
  const [randomDiscoveryIds, setRandomDiscoveryIds] = useState([]);

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

  // Fix places with missing addedBy field
  const fixPlacesWithMissingAddedBy = async (currentUser) => {
    // This function is a no-op now since it was causing errors
    console.log('Place fixing function called but is now a no-op');
    return;
  };

  const fetchPlaces = async (currentUser, retryCount = 0) => {
    try {
      setLoading(true);
      setError(null);
      setFilterWarning(null);

      console.log('Fetching user preferences...');
      // First, get user preferences
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const userPrefs = userDoc.data()?.preferences?.tripTypes || [];
      const userSavedDestinations = userDoc.data()?.savedDestinations || [];
      console.log('User preferences:', userPrefs);
      console.log('User saved destinations:', userSavedDestinations);
      console.log('Current user ID:', currentUser.uid);

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
        
        // Ensure all location fields exist (normalize data)
        const country = data.country || 'Unknown';
        const state = data.state || 'Unknown';
        const district = data.district || 'Unknown';
        
        return {
          id: doc.id,
          ...data,
          country: country,
          state: state, 
          district: district,
          reviewCount: ratingCount,
          // Add translated category for display purposes
          translatedCategory: translateCategory(data.category, language)
        };
      });

      console.log('Processed places:', fetchedPlaces.length);
      
      // Debug which places have addedBy fields
      const placesWithAddedBy = fetchedPlaces.filter(place => place.addedBy);
      console.log(`Places with addedBy field: ${placesWithAddedBy.length} out of ${fetchedPlaces.length}`);
      
      // Log information about all places added by the current user
      const userAddedPlaces = fetchedPlaces.filter(place => 
        place.userId === currentUser.uid || place.addedBy === currentUser.uid
      );
      
      console.log(`Found ${userAddedPlaces.length} places added by the current user (before filtering):`);
      userAddedPlaces.forEach(place => {
        console.log(`- "${place.name}" (ID: ${place.id}, addedBy: ${place.addedBy || 'not set'}, userId: ${place.userId || 'not set'})`);
      });

      if (fetchedPlaces.length === 0) {
        console.warn('No places found in the database');
        setError(t.noPlacesFound || 'No places found in the database. Try adding some places!');
        setLoading(false);
        return;
      }

      // Enhanced filtering to make sure we catch user-added places
      console.log('Filtering out user-added places...');
      const filteredPlaces = fetchedPlaces.filter(place => {
        // Check if this place is added by the current user (check both userId and addedBy)
        const isAddedByUser = 
          (place.userId && place.userId === currentUser.uid) || 
          (place.addedBy && place.addedBy === currentUser.uid);
        
        if (isAddedByUser) {
          console.log(`Filtering out: "${place.name}" (addedBy: ${place.addedBy || 'not set'}, userId: ${place.userId || 'not set'})`);
          return false; // Filter out this place
        }
        
        // Include all other places
        return true;
      });
      
      console.log(`Filtered out ${fetchedPlaces.length - filteredPlaces.length} places added by the current user`);
      fetchedPlaces = filteredPlaces;
      
      // Double-check if any user places still remain
      const remainingUserPlaces = fetchedPlaces.filter(place => 
        place.userId === currentUser.uid || place.addedBy === currentUser.uid
      );
      
      if (remainingUserPlaces.length > 0) {
        console.error(`WARNING: ${remainingUserPlaces.length} user places still remain after filtering!`);
        remainingUserPlaces.forEach(place => {
          console.error(`- Still included: "${place.name}" (ID: ${place.id}, addedBy: ${place.addedBy || 'not set'}, userId: ${place.userId || 'not set'})`);
        });
      } else {
        console.log('All user-added places successfully filtered out.');
      }

      // Get details of saved destinations for similarity matching
      const savedDestinationsDetails = fetchedPlaces.filter(place => 
        userSavedDestinations.includes(place.id)
      );
      
      console.log('Saved destinations details:', savedDestinationsDetails.length);

      // Add a similarity score to each place based on user preferences and saved destinations
      fetchedPlaces = fetchedPlaces.map(place => {
        let similarityScore = 0;
        
        // CRITICAL: Use exactly the same scoring system as Home.jsx
        
        // Add points if the place category matches user preferences
        // This will give exactly 10 points for preference matches, making them easy to identify
        if (userPrefs.includes(place.category)) {
          similarityScore = 10; // Exactly 10 points for preference matches
        } else {
          // Only calculate similarity to saved places if it's not a preference match
          // This ensures clear separation between preference and similarity categories
          
          // Add points if the place is from the same country/state as saved destinations
          savedDestinationsDetails.forEach(savedPlace => {
            if (place.id !== savedPlace.id) { // Don't compare with itself
              if (place.country === savedPlace.country) similarityScore += 1;
              if (place.state === savedPlace.state) similarityScore += 1;
              if (place.district === savedPlace.district) similarityScore += 1;
              if (place.category === savedPlace.category) similarityScore += 3;
            }
          });
          
          // Cap similarity score at 9 to keep it below preference matches
          similarityScore = Math.min(similarityScore, 9);
        }
        
        // Places with similarityScore = 0 will automatically fall into the discovery category
        // Places with 1-9 are similarity-based
        // Places with exactly 10 are preference-based
        
        return {
          ...place,
          similarityScore
        };
      });

      // Sort all places by calculated similarity score and rating
      fetchedPlaces = fetchedPlaces.sort((a, b) => {
        // First sort by similarity score
        const scoreDiff = b.similarityScore - a.similarityScore;
        if (scoreDiff !== 0) return scoreDiff;
        
        // If similarity scores are equal, sort by rating
        const ratingA = a.averageRating || a.rating || 0;
        const ratingB = b.averageRating || b.rating || 0;
        return ratingB - ratingA;
      });

      // Check if the places have location data for filtering
      const placesWithCountry = fetchedPlaces.filter(place => place.country && place.country !== 'Unknown').length;
      const placesWithState = fetchedPlaces.filter(place => place.state && place.state !== 'Unknown').length;
      const placesWithDistrict = fetchedPlaces.filter(place => place.district && place.district !== 'Unknown').length;
      
      console.log(`Location data availability: ${placesWithCountry}/${fetchedPlaces.length} have country, ${placesWithState}/${fetchedPlaces.length} have state, ${placesWithDistrict}/${fetchedPlaces.length} have district`);
      
      // Set a warning if less than 50% of places have location data
      if (placesWithCountry / fetchedPlaces.length < 0.5) {
        setFilterWarning("Some destinations may not have location data, which could limit filtering options.");
      }

      console.log('Final places array with similarity scores:', fetchedPlaces.length);
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
      setError(t.failedToLoadRecommendations || 'Failed to load recommendations. Please try again.');
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
      const message = isCurrentlySaved 
        ? (t.bookmarkRemoved || 'Bookmark removed') 
        : (t.bookmarkAdded || 'Bookmark added');
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
      
      // Show error message with translation
      alert(`${t.errorBookmarking || 'Error bookmarking'}: ${err.message}. ${t.pleaseTryAgain || 'Please try again.'}`);
    }
  };

  // Define getFilteredPlaces inside the component 
  const getFilteredPlaces = useCallback((places, userId) => {
    if (!places || places.length === 0) {
      setDoneFiltering(true);
      setIsFetching(false);
      return [];
    }

    let finalFilteredPlaces = [];
    
    // Target percentages: 40% preference-based, 40% similarity-based, 20% discovery
    // This is exactly the same distribution as used in Home.jsx
    
    // Sort by similarity score in descending order to prioritize preference matches
    const sortedPlaces = [...places].sort((a, b) => b.similarityScore - a.similarityScore);
    
    // Use the scoring system from the fetchPlaces function:
    // - Score exactly 10: Preference match (blue badge)
    // - Score 1-9: Similar to saved (purple badge)
    // - Score 0: New discovery (green badge)
    
    // Calculate target counts based on the distribution
    const totalRecommendationsTarget = Math.min(sortedPlaces.length, 30); // Cap at 30 recommendations
    const preferenceBasedTarget = Math.ceil(totalRecommendationsTarget * 0.4);
    const similarityBasedTarget = Math.ceil(totalRecommendationsTarget * 0.4);
    const discoveryTarget = totalRecommendationsTarget - preferenceBasedTarget - similarityBasedTarget;
    
    // Create arrays for each category
    const preferenceBased = [];
    const similarityBased = [];
    const discovery = [];
    
    // Categorize places based on similarity score
    sortedPlaces.forEach(place => {
      // Make sure we have all the required fields for this place
      const placeWithAllFields = {
        ...place,
        country: place.country || 'Unknown',
        state: place.state || 'Unknown',
        district: place.district || 'Unknown',
        rating: place.rating || place.averageRating || 0
      };
    
      // Exact score of 10 means preference match
      if (place.similarityScore === 10) {
        preferenceBased.push({
          ...placeWithAllFields,
          recommendationType: 'preference'
        });
      }
      // Scores 1-9 mean similarity match
      else if (place.similarityScore >= 1 && place.similarityScore <= 9) {
        similarityBased.push({
          ...placeWithAllFields,
          recommendationType: 'similarity'
        });
      }
      // Score of 0 means discovery
      else {
        discovery.push({
          ...placeWithAllFields,
          recommendationType: 'discovery'
        });
      }
    });
    
    // Fill according to target percentages, using the same logic as Home.jsx
    finalFilteredPlaces = [
      ...preferenceBased.slice(0, preferenceBasedTarget),
      ...similarityBased.slice(0, similarityBasedTarget),
      ...discovery.slice(0, discoveryTarget)
    ];
    
    // Shuffle the recommendations to avoid grouping by type
    finalFilteredPlaces = shuffleArray(finalFilteredPlaces);
    
    // Log for debugging
    console.log('Recommendation distribution:', {
      preference: preferenceBased.slice(0, preferenceBasedTarget).length,
      similarity: similarityBased.slice(0, similarityBasedTarget).length,
      discovery: discovery.slice(0, discoveryTarget).length,
      total: finalFilteredPlaces.length
    });
    
    // Update UI states
    setDoneFiltering(true);
    setIsFetching(false);
    
    return finalFilteredPlaces;
  }, []);

  // Now the filteredPlaces useMemo can use the getFilteredPlaces function
  const filteredPlaces = useMemo(() => {
    if (!places || places.length === 0 || !user) {
      return [];
    }
    
    // First, get the categorized places using our consistent algorithm
    let categorizedPlaces = getFilteredPlaces(places, user.uid);
    console.log(`Initial categorized places: ${categorizedPlaces.length}`);
    
    // Now apply the standard filters on top of the categorized places
    let filtered = [...categorizedPlaces];
    const originalCount = filtered.length;
    
    // Apply category filter if not "all"
    if (selectedCategory !== 'all') {
      const beforeCount = filtered.length;
      filtered = filtered.filter(place => place.category === selectedCategory);
      console.log(`Category filter (${selectedCategory}): ${beforeCount} -> ${filtered.length}`);
    }

    // Apply country filter if selected
    if (selectedCountry && selectedCountry !== 'all') {
      const beforeCount = filtered.length;
      filtered = filtered.filter(place => {
        // For debugging
        if (!place.country) {
          console.log(`Place missing country: ${place.name || 'unnamed'} (ID: ${place.id})`);
        }
        return place.country === selectedCountry;
      });
      console.log(`Country filter (${selectedCountry}): ${beforeCount} -> ${filtered.length}`);
    }

    // Apply state filter if selected
    if (selectedState && selectedState !== 'all') {
      const beforeCount = filtered.length;
      filtered = filtered.filter(place => {
        // For debugging
        if (!place.state) {
          console.log(`Place missing state: ${place.name || 'unnamed'} (ID: ${place.id})`);
        }
        return place.state === selectedState;
      });
      console.log(`State filter (${selectedState}): ${beforeCount} -> ${filtered.length}`);
    }

    // Apply district filter if selected
    if (selectedDistrict && selectedDistrict !== 'all') {
      const beforeCount = filtered.length;
      filtered = filtered.filter(place => {
        // For debugging
        if (!place.district) {
          console.log(`Place missing district: ${place.name || 'unnamed'} (ID: ${place.id})`);
        }
        return place.district === selectedDistrict;
      });
      console.log(`District filter (${selectedDistrict}): ${beforeCount} -> ${filtered.length}`);
    }

    // Apply rating filter
    if (minRating > 0) {
      const beforeCount = filtered.length;
      filtered = filtered.filter(place => {
        const rating = place.averageRating || place.rating || 0;
        return rating >= minRating;
      });
      console.log(`Rating filter (${minRating}+): ${beforeCount} -> ${filtered.length}`);
    }

    // Set warning if filtering removed all or most results
    if (filtered.length === 0 && originalCount > 0) {
      // Don't set this warning here, as it would cause a re-render loop
      // We'll handle it in a useEffect instead
      console.log("All places filtered out - may need to adjust filters");
    }
    
    // Limit to selected number
    if (numRecommendations) {
      filtered = filtered.slice(0, parseInt(numRecommendations));
    }
    
    // Update badge tracking for UI
    const preferenceIds = filtered
      .filter(place => place.recommendationType === 'preference')
      .map(place => place.id);
      
    const similarityIds = filtered
      .filter(place => place.recommendationType === 'similarity')
      .map(place => place.id);
      
    const discoveryIds = filtered
      .filter(place => place.recommendationType === 'discovery')
      .map(place => place.id);
    
    // Use setTimeout to avoid state updates during render
    setTimeout(() => {
      setPreferenceBasedIds(preferenceIds);
      setSimilarityBasedIds(similarityIds);
      setRandomDiscoveryIds(discoveryIds);
    }, 0);
    
    return filtered;
  }, [places, numRecommendations, selectedCategory, minRating, selectedCountry, selectedState, selectedDistrict, user, getFilteredPlaces]);

  // Update the loading state when filteredPlaces is calculated
  useEffect(() => {
    if (filteredPlaces.length > 0) {
      setDoneFiltering(true);
      setIsFetching(false);
    }
  }, [filteredPlaces]);

  // Add an effect to handle filter warnings without causing re-render loops
  useEffect(() => {
    if (filteredPlaces.length === 0 && places.length > 0) {
      // Only show this warning if we have places but none match the filters
      setFilterWarning("No destinations match your selected filters. Try adjusting your criteria.");
    } else if (filterWarning && filteredPlaces.length > 0) {
      // Clear the warning if we now have results
      setFilterWarning(null);
    }
  }, [filteredPlaces.length, places.length, filterWarning]);

  // Create arrays of unique states and countries for the filter dropdowns
  const countries = ['all', ...getAllCountries()]
  
  // Get states based on selected country
  const getAvailableStates = () => {
    if (selectedCountry === 'all') {
      return [];
    } else if (selectedCountry === 'India') {
      return getAllStates();
    } else {
      // Get predefined states if available
      const predefinedStates = getStatesForCountry(selectedCountry);
      
      if (predefinedStates && predefinedStates.length > 0) {
        return predefinedStates;
      }
      
      // If no predefined states, extract from places data
      const statesFromData = [...new Set(
        places
          .filter(place => place.country === selectedCountry)
          .map(place => place.state)
          .filter(Boolean)
      )];
      
      console.log(`Extracted ${statesFromData.length} states from places data for ${selectedCountry}`);
      return statesFromData;
    }
  }
  
  const states = ['all', ...getAvailableStates()]

  // Create array of unique districts for the filter dropdown
  const getAvailableDistricts = () => {
    if (selectedState === 'all') {
      return [];
    } else if (selectedCountry === 'India') {
      const predefinedDistricts = getDistrictsForState(selectedState);
      if (predefinedDistricts && predefinedDistricts.length > 0) {
        return predefinedDistricts;
      }
    }
    
    // For any state (including Indian states with no predefined districts),
    // get districts from the places data
    const districtsFromData = [...new Set(
        places
          .filter(place => place.state === selectedState)
          .map(place => place.district)
          .filter(Boolean)
      )];
    
    console.log(`Extracted ${districtsFromData.length} districts from places data for ${selectedState}`);
    return districtsFromData;
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

  // Add click outside handler for dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.number-dropdown')) {
        setIsNumberDropdownOpen(false);
      }
      if (!event.target.closest('.category-dropdown')) {
        setIsCategoryDropdownOpen(false);
      }
      if (!event.target.closest('.rating-dropdown')) {
        setIsRatingDropdownOpen(false);
      }
      if (!event.target.closest('.country-dropdown')) {
        setIsCountryDropdownOpen(false);
      }
      if (!event.target.closest('.state-dropdown')) {
        setIsStateDropdownOpen(false);
      }
      if (!event.target.closest('.district-dropdown')) {
        setIsDistrictDropdownOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Fix the tooltip useEffect to prevent re-render loops
  const tooltipShownRef = useRef(false);
  
  useEffect(() => {
    // Check if tooltip has already been shown (using localStorage)
    const tooltipShown = localStorage.getItem('recommendationTooltipShown');
    
    if (!tooltipShown && !loading && places.length > 0 && selectedCategory === 'all') {
      // Mark that we've shown the tooltip in localStorage
      localStorage.setItem('recommendationTooltipShown', 'true');
      
      // Create and show the tooltip
      const helpText = document.createElement('div');
      helpText.className = 'fixed top-24 left-1/2 transform -translate-x-1/2 bg-white border border-blue-200 text-blue-700 px-4 py-3 rounded-md shadow-lg z-50 max-w-md recommendation-tooltip';
      helpText.innerHTML = `
        <div class="flex items-start">
          <i class="fas fa-info-circle text-blue-500 mt-1 mr-3 text-lg"></i>
          <div>
            <p class="text-sm font-medium">${t.personalizedRecommendations || 'Personalized Recommendations'}</p>
            <p class="text-xs mt-1">${t.recommendationExplanation || 'We\'ve personalized recommendations based on your preferences and bookmarks. Look for blue badges for preference matches, purple for similar places, and green for new discoveries.'}</p>
          </div>
          <button class="ml-3 text-gray-500 hover:text-gray-700" onclick="this.parentElement.parentElement.remove()">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;
      
      // Check if the tooltip already exists before adding it
      const existingTooltip = document.querySelector('.recommendation-tooltip');
      if (!existingTooltip) {
        document.body.appendChild(helpText);
        
        // Remove the tooltip after 10 seconds
        setTimeout(() => {
          if (document.body.contains(helpText)) {
            helpText.remove();
          }
        }, 10000);
      }
    }
  }, [places.length, loading, selectedCategory, language, t]);

  // Configure animation variants
  const pageVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.5 } },
    exit: { opacity: 0, transition: { duration: 0.3 } }
  };

  // Add comprehensive language change handler
  useEffect(() => {
    // Re-fetch places when language changes to update all translated content
    if (user && !loading) {
      fetchPlaces(user);
    }
    
    // Ensure all dropdowns are closed when language changes to prevent stale translations
    setIsNumberDropdownOpen(false);
    setIsCategoryDropdownOpen(false);
    setIsRatingDropdownOpen(false);
    setIsCountryDropdownOpen(false);
    setIsStateDropdownOpen(false);
    setIsDistrictDropdownOpen(false);
    
    console.log(`Language changed to: ${language}`);
    
  }, [language]); // Only re-run when language changes
  
  // Update translated categories when language changes
  useEffect(() => {
    if (places.length > 0) {
      // Update translated categories when language changes
      const updatedPlaces = places.map(place => ({
        ...place,
        translatedCategory: translateCategory(place.category, language)
      }));
      setPlaces(updatedPlaces);
    }
  }, [language, places.length]);

  // Add debug logging when filters change
  useEffect(() => {
    console.log("Filter changed - current filters:", { 
      category: selectedCategory, 
      country: selectedCountry,
      state: selectedState,
      district: selectedDistrict,
      rating: minRating,
      results: filteredPlaces.length
    });
    
    // Log fields of first few places to verify filter fields
    if (places.length > 0) {
      console.log("Sample place data for debugging filters:");
      console.log(places[0]);
    }
  }, [selectedCategory, selectedCountry, selectedState, selectedDistrict, minRating, filteredPlaces.length, places]);

  if (loading) {
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
        <LoadingScreen language={language} />
      </div>
    );
  }

  if (!isAuthenticated && !loading) {
    // Only navigate when loading is complete and user is not authenticated
    navigate('/auth');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-2xl text-gray-600">{t.redirectingToLogin || 'Redirecting to login...'}</div>
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
            {t.personalizedRecommendations || 'Personalized Recommendations'}
          </h1>
          <p className="text-gray-600">
            {t.placesTailoredToYourPreferences || 'Places tailored to your preferences'}
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

        <AnimatePresence>
          {filterWarning && (
        <motion.div 
              className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-start">
                <i className="fas fa-exclamation-triangle text-yellow-600 mt-1 mr-2"></i>
                <span>{filterWarning}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter bar with button-based dropdowns like Explore page */}
        <motion.div 
          className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-sm p-8 mb-8"
          variants={filterContainerVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="flex flex-wrap gap-6 items-center justify-between">
            <div className="flex flex-wrap items-center gap-4">
              {/* Number of recommendations dropdown */}
              <motion.div className="number-dropdown relative" variants={filterItemVariants}>
                <button
                  onClick={() => setIsNumberDropdownOpen(!isNumberDropdownOpen)}
                  className="px-6 py-3 rounded-md bg-white shadow-sm hover:shadow-md transition-all duration-300 flex items-center space-x-2 border border-gray-100 cursor-pointer whitespace-nowrap"
                >
                  <i className="fas fa-list-ol text-blue-500"></i>
                  <span className="text-gray-700 font-medium">
                    {numRecommendations} {t.places || 'Places'}
                  </span>
                  <i className={`fas fa-chevron-down text-gray-400 transition-transform duration-300 ${isNumberDropdownOpen ? 'transform rotate-180' : ''}`}></i>
                </button>

                {isNumberDropdownOpen && (
                  <div className="absolute mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-2 z-50">
                    {[3, 6, 12, 20].map((num) => (
                      <div
                        key={num}
                        onClick={() => {
                          setNumRecommendations(num);
                          setIsNumberDropdownOpen(false);
                        }}
                        className={`px-4 py-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between ${
                          numRecommendations === num ? 'bg-blue-50' : ''
                        }`}
                      >
                        <span>{num} {t.places || 'Places'}</span>
                        {numRecommendations === num && <i className="fas fa-check text-blue-600"></i>}
            </div>
                    ))}
                  </div>
                )}
          </motion.div>

              {/* Category dropdown */}
              <motion.div className="category-dropdown relative" variants={filterItemVariants}>
                <button
                  onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                  className="px-6 py-3 rounded-md bg-white shadow-sm hover:shadow-md transition-all duration-300 flex items-center space-x-2 border border-gray-100 cursor-pointer whitespace-nowrap"
                >
                  <i className="fas fa-tag text-blue-500"></i>
                  <span className="text-gray-700 font-medium">
                    {selectedCategory === 'all' 
                      ? (t.allCategories || 'All Categories')
                      : translateCategory(selectedCategory, language)}
                  </span>
                  <i className={`fas fa-chevron-down text-gray-400 transition-transform duration-300 ${isCategoryDropdownOpen ? 'transform rotate-180' : ''}`}></i>
                </button>

                {isCategoryDropdownOpen && (
                  <div className="absolute mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-2 z-50">
                    {['all', 'beach', 'mountain', 'cultural', 'adventure', 'city', 'nature'].map((category) => (
                      <div
                        key={category}
                        onClick={() => {
                          setSelectedCategory(category);
                          setIsCategoryDropdownOpen(false);
                        }}
                        className={`px-4 py-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between ${
                          selectedCategory === category ? 'bg-blue-50' : ''
                        }`}
                      >
                        <span>
                          {category === 'all' 
                            ? (t.allCategories || 'All Categories') 
                            : translateCategory(category, language)}
                        </span>
                        {selectedCategory === category && <i className="fas fa-check text-blue-600"></i>}
            </div>
                    ))}
                  </div>
                )}
          </motion.div>

              {/* Rating dropdown */}
              <motion.div className="rating-dropdown relative" variants={filterItemVariants}>
                <button
                  onClick={() => setIsRatingDropdownOpen(!isRatingDropdownOpen)}
                  className="px-6 py-3 rounded-md bg-white shadow-sm hover:shadow-md transition-all duration-300 flex items-center space-x-2 border border-gray-100 cursor-pointer whitespace-nowrap"
                >
                  <i className="fas fa-star text-yellow-400"></i>
                  <span className="text-gray-700 font-medium">
                    {minRating === 0 ? (t.allRatings || 'All Ratings') : `${minRating}+ ${t.stars || 'Stars'}`}
                  </span>
                  <i className={`fas fa-chevron-down text-gray-400 transition-transform duration-300 ${isRatingDropdownOpen ? 'transform rotate-180' : ''}`}></i>
                </button>

                {isRatingDropdownOpen && (
                  <div className="absolute mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-2 z-50">
                    {[0, 3, 4, 4.5].map((rating) => (
                      <div
                        key={rating}
                        onClick={() => {
                          setMinRating(rating);
                          setIsRatingDropdownOpen(false);
                        }}
                        className={`px-4 py-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between ${
                          minRating === rating ? 'bg-blue-50' : ''
                        }`}
                      >
                        <span>{rating === 0 ? (t.allRatings || 'All Ratings') : `${rating}+ ${t.stars || 'Stars'}`}</span>
                        {minRating === rating && <i className="fas fa-check text-blue-600"></i>}
            </div>
                    ))}
                  </div>
                )}
          </motion.div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {/* Country dropdown */}
              <motion.div className="country-dropdown relative" variants={filterItemVariants}>
                <button
                  onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                  className="px-6 py-3 rounded-md bg-white shadow-sm hover:shadow-md transition-all duration-300 flex items-center space-x-2 border border-gray-100 cursor-pointer whitespace-nowrap"
                >
                  <i className="fas fa-map-marker-alt text-red-500"></i>
                  <span className="text-gray-700 font-medium">
                    {selectedCountry === 'all' 
                      ? (t.allCountries || 'All Countries')
                      : (language === 'hi' ? getCountryTranslation(selectedCountry) : selectedCountry)}
                  </span>
                  <i className={`fas fa-chevron-down text-gray-400 transition-transform duration-300 ${isCountryDropdownOpen ? 'transform rotate-180' : ''}`}></i>
                </button>

                {isCountryDropdownOpen && (
                  <div className="absolute mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-2 z-50 max-h-64 overflow-y-auto">
                    {countries.map((country) => (
                      <div
                        key={country}
                        onClick={() => {
                          setSelectedCountry(country);
                          setSelectedState('all');
                          setSelectedDistrict('all');
                          setIsCountryDropdownOpen(false);
                        }}
                        className={`px-4 py-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between ${
                          selectedCountry === country ? 'bg-blue-50' : ''
                        }`}
                      >
                        <span>{language === 'hi' 
                          ? (country === 'all' ? t.allCountries || 'All Countries' : getCountryTranslation(country))
                          : (country === 'all' ? t.allCountries || 'All Countries' : country)}</span>
                        {selectedCountry === country && <i className="fas fa-check text-blue-600"></i>}
                      </div>
                    ))}
            </div>
                )}
          </motion.div>

              {/* State dropdown */}
              <motion.div className="state-dropdown relative" variants={filterItemVariants}>
                <button
                  onClick={() => selectedCountry !== 'all' && setIsStateDropdownOpen(!isStateDropdownOpen)}
                  className={`px-6 py-3 rounded-md bg-white shadow-sm hover:shadow-md transition-all duration-300 flex items-center space-x-2 border border-gray-100 cursor-pointer whitespace-nowrap ${
                    selectedCountry === 'all' ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
              disabled={selectedCountry === 'all'}
            >
                  <i className="fas fa-city text-blue-500"></i>
                  <span className="text-gray-700 font-medium">
                    {selectedState === 'all' 
                      ? (t.allStates || 'All States')
                      : (language === 'hi' ? getStateTranslation(selectedState) : selectedState)}
                  </span>
                  <i className={`fas fa-chevron-down text-gray-400 transition-transform duration-300 ${isStateDropdownOpen ? 'transform rotate-180' : ''}`}></i>
                </button>

                {isStateDropdownOpen && selectedCountry !== 'all' && (
                  <div className="absolute mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-2 z-50 max-h-64 overflow-y-auto">
                    {states.map((state) => (
                      <div
                        key={state}
                        onClick={() => {
                          setSelectedState(state);
                          setSelectedDistrict('all');
                          setIsStateDropdownOpen(false);
                        }}
                        className={`px-4 py-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between ${
                          selectedState === state ? 'bg-blue-50' : ''
                        }`}
                      >
                        <span>{language === 'hi' 
                          ? (state === 'all' ? t.allStates || 'All States' : getStateTranslation(state))
                          : (state === 'all' ? t.allStates || 'All States' : state)}</span>
                        {selectedState === state && <i className="fas fa-check text-blue-600"></i>}
            </div>
                    ))}
                  </div>
                )}
          </motion.div>

              {/* District dropdown */}
              <motion.div className="district-dropdown relative" variants={filterItemVariants}>
                <button
                  onClick={() => selectedState !== 'all' && setIsDistrictDropdownOpen(!isDistrictDropdownOpen)}
                  className={`px-6 py-3 rounded-md bg-white shadow-sm hover:shadow-md transition-all duration-300 flex items-center space-x-2 border border-gray-100 cursor-pointer whitespace-nowrap ${
                    selectedState === 'all' ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
              disabled={selectedState === 'all'}
            >
                  <i className="fas fa-map text-green-500"></i>
                  <span className="text-gray-700 font-medium">
                    {selectedDistrict === 'all' 
                      ? (t.allDistricts || 'All Districts') 
                      : selectedDistrict}
                  </span>
                  <i className={`fas fa-chevron-down text-gray-400 transition-transform duration-300 ${isDistrictDropdownOpen ? 'transform rotate-180' : ''}`}></i>
                </button>

                {isDistrictDropdownOpen && selectedState !== 'all' && (
                  <div className="absolute mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-2 z-50 max-h-64 overflow-y-auto">
                    {districts.map((district) => (
                      <div
                        key={district}
                        onClick={() => {
                          setSelectedDistrict(district);
                          setIsDistrictDropdownOpen(false);
                        }}
                        className={`px-4 py-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between ${
                          selectedDistrict === district ? 'bg-blue-50' : ''
                        }`}
                      >
                        <span>{district === 'all' ? (t.allDistricts || 'All Districts') : district}</span>
                        {selectedDistrict === district && <i className="fas fa-check text-blue-600"></i>}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </div>
            </div>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center min-h-[50vh] py-12">
            <LoadingScreen language={language} type="inline" size="small" />
          </div>
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
              {t.tryAgain || 'Try Again'}
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
                    className="relative"
                  >
                    {/* Recommendation badge - only show in "all" category mode */}
                    {selectedCategory === 'all' && (
                      <div className="absolute top-3 right-3 z-10 flex flex-col items-end">
                        {place.recommendationType === 'preference' && (
                          <div className="bg-blue-500 bg-opacity-85 text-white text-[9px] py-0.5 px-1.5 rounded-sm mb-1 shadow-sm flex items-center">
                            <i className="fas fa-thumbs-up mr-1 text-[8px]"></i>
                            <span className="truncate max-w-24">
                              {t.preferenceMatch || 'Preference Match'}
                            </span>
                          </div>
                        )}
                        {place.recommendationType === 'similarity' && (
                          <div className="bg-purple-500 bg-opacity-85 text-white text-[9px] py-0.5 px-1.5 rounded-sm mb-1 shadow-sm flex items-center">
                            <i className="fas fa-bookmark mr-1 text-[8px]"></i>
                            <span className="truncate max-w-24">
                              {t.similarToSaved || 'Similar to Saved'}
                            </span>
                          </div>
                        )}
                        {place.recommendationType === 'discovery' && (
                          <div className="bg-green-500 bg-opacity-85 text-white text-[9px] py-0.5 px-1.5 rounded-sm mb-1 shadow-sm flex items-center">
                            <i className="fas fa-compass mr-1 text-[8px]"></i>
                            <span className="truncate max-w-24">
                              {t.newDiscovery || 'New Discovery'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
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
                {t.noPlacesFoundForSelectedCriteria || 'No places found for the selected criteria'}
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