import React, { useState, useEffect, useRef } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Pagination, Autoplay } from 'swiper/modules'
import PropTypes from 'prop-types'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../firebase/config'
import { collection, query, orderBy, limit, getDocs, where, doc, getDoc, setDoc } from 'firebase/firestore'
import Navbar from '../components/Navbar'
import 'swiper/css'
import 'swiper/css/pagination'
import 'swiper/css/autoplay'
import { motion } from 'framer-motion'
import { Button } from '@mui/material'
import ExploreIcon from '@mui/icons-material/Explore'
import { getReviewCount } from '../utils/ratings'
import DestinationCard from '../components/DestinationCard'
import translations from '../utils/translations'
import LoadingScreen from '../components/LoadingScreen'

const Home = ({ language, setLanguage, languages, user }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [places, setPlaces] = useState([])
  const [recommendedPlaces, setRecommendedPlaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [savedDestinations, setSavedDestinations] = useState([])
  const [preferenceBasedIds, setPreferenceBasedIds] = useState([]);
  const [similarityBasedIds, setSimilarityBasedIds] = useState([]);
  const [discoveryIds, setDiscoveryIds] = useState([]);
  const navigate = useNavigate()
  
  // Get translations for the current language
  const t = translations[language] || translations.en

  // Add ref to track if tooltip has been shown
  const tooltipShownRef = useRef(false);
  
  // Add effect to show tooltip explaining the recommendation system when the page loads
  useEffect(() => {
    // Only show the tooltip if the user is logged in and we have recommendations
    // and it hasn't been shown before (checking localStorage)
    const tooltipShown = localStorage.getItem('recommendationTooltipShown');
    
    if (user && recommendedPlaces.length > 0 && !tooltipShown) {
      // Mark that we've shown the tooltip in localStorage so it persists across sessions
      localStorage.setItem('recommendationTooltipShown', 'true');
      
      // Create and show the tooltip
      const helpText = document.createElement('div');
      helpText.className = 'fixed top-24 left-1/2 transform -translate-x-1/2 bg-white border border-blue-200 text-blue-700 px-4 py-3 rounded-md shadow-lg z-50 max-w-md home-recommendation-tooltip';
      helpText.innerHTML = `
        <div class="flex items-start">
          <i class="fas fa-info-circle text-blue-500 mt-1 mr-3 text-lg"></i>
          <div>
            <p class="text-sm font-medium">${language === 'hi' ? 'व्यक्तिगत अनुशंसाएँ' : 'Personalized Recommendations'}</p>
            <p class="text-xs mt-1">${language === 'hi' 
              ? 'हमने आपकी पसंद, बुकमार्क और इसी तरह के स्थानों के आधार पर अनुशंसाएँ तैयार की हैं। नीले बैज आपकी पसंद का स्थान, बैंगनी बैज समान स्थान और हरे बैज नई खोज दिखाते हैं।' 
              : 'We\'ve personalized recommendations based on your preferences and bookmarks. Look for blue badges for preference matches, purple for similar places, and green for new discoveries.'}</p>
          </div>
          <button class="ml-3 text-gray-500 hover:text-gray-700" onclick="this.parentElement.parentElement.remove()">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;
      
      // Check if the tooltip already exists before adding it
      const existingTooltip = document.querySelector('.home-recommendation-tooltip');
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
  }, [recommendedPlaces.length, user, language]);

  useEffect(() => {
    const fetchPlaces = async () => {
      try {
        setLoading(true);
        
        // Fetch all places first
        const placesSnapshot = await getDocs(collection(db, 'places'))
        let allPlaces = placesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          bookmarkCount: 0 // Initialize bookmark count for each place
        }))

        if (allPlaces.length === 0) {
          setError('No places found. Try adding some destinations!')
          setLoading(false)
          return
        }

        // Get bookmark counts by checking all users' savedDestinations
        console.log('Fetching bookmark counts for trending places calculation...');
        try {
          const usersSnapshot = await getDocs(collection(db, 'users'));
          
          // Count how many times each place is bookmarked
          usersSnapshot.forEach(userDoc => {
            const userData = userDoc.data();
            const userSavedDestinations = userData.savedDestinations || [];
            
            // Increment bookmark count for each place this user has saved
            userSavedDestinations.forEach(placeId => {
              const place = allPlaces.find(p => p.id === placeId);
              if (place) {
                place.bookmarkCount = (place.bookmarkCount || 0) + 1;
              }
            });
          });
          
          console.log('Bookmark counts calculated for all places');
          
          // Sort by bookmark count for trending places (instead of likes)
          const trendingPlaces = [...allPlaces]
            .sort((a, b) => (b.bookmarkCount || 0) - (a.bookmarkCount || 0))
            .slice(0, 3)
            .map(place => ({
              ...place,
              trending: true  // Explicitly mark as trending
            }));
            
          console.log('Trending places selected based on bookmark counts');
          trendingPlaces.forEach(place => {
            console.log(`- ${place.name}: ${place.bookmarkCount} bookmarks`);
          });
          
          setPlaces(trendingPlaces);
        } catch (err) {
          console.error('Error calculating bookmark counts:', err);
          
          // Fall back to likes-based trending if there's an error
          console.log('Falling back to likes-based trending places');
          const trendingPlaces = [...allPlaces]
            .sort((a, b) => (b.likes || 0) - (a.likes || 0))
            .slice(0, 3)
            .map(place => ({
              ...place,
              trending: true  // Explicitly mark as trending
            }));
          setPlaces(trendingPlaces);
        }

        // Enhanced recommendation system
        if (user) {
          console.log('Building personalized recommendations for user:', user.uid);
          
          // 1. FILTER OUT USER-ADDED PLACES
          // Remove places added by the current user
          allPlaces = allPlaces.filter(place => {
            const isAddedByUser = 
              (place.userId && place.userId === user.uid) || 
              (place.addedBy && place.addedBy === user.uid);
            
            if (isAddedByUser) {
              console.log(`Filtering out user-added place: ${place.name}`);
            }
            return !isAddedByUser;
          });
          
          console.log(`${allPlaces.length} places available after filtering out user-added places`);
          
          try {
            // 2. GET USER PREFERENCES AND SAVED DESTINATIONS
            // Get user preferences and saved destinations
            const userDoc = await getDoc(doc(db, 'users', user.uid))
            const userPrefs = userDoc.data()?.preferences?.tripTypes || []
            const savedDestinationIds = userDoc.data()?.savedDestinations || []
            
            console.log('User preferences:', userPrefs);
            console.log('User saved destinations:', savedDestinationIds.length);
            
            // Get details of saved destinations for similarity calculation
            const savedDestinations = allPlaces.filter(place => 
              savedDestinationIds.includes(place.id)
            );
            
            // 3. CALCULATE SIMILARITY SCORES
            // Add similarity score to each place based on preferences and saved destinations
            allPlaces = allPlaces.map(place => {
              let similarityScore = 0;
              
              // Add points for matching user preferences
              if (userPrefs.includes(place.category)) {
                similarityScore += 10;
              }
              
              // Add points for similarity to saved destinations
              savedDestinations.forEach(savedPlace => {
                if (place.id !== savedPlace.id) { // Don't compare with itself
                  if (place.country === savedPlace.country) similarityScore += 3;
                  if (place.state === savedPlace.state) similarityScore += 4;
                  if (place.district === savedPlace.district) similarityScore += 5;
                  if (place.category === savedPlace.category) similarityScore += 8;
                }
              });
              
              return {
                ...place,
                similarityScore
              };
            });
            
            // 4. CREATE PERSONALIZED RECOMMENDATION MIX
            // Create a balanced mix of recommendations
            
            // Preference-based recommendations (40%)
            const preferenceBasedPlaces = allPlaces
              .filter(place => userPrefs.includes(place.category))
              .sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
            
            // Similarity-based recommendations (40%)
            const similarityBasedPlaces = allPlaces
              .filter(place => place.similarityScore > 5)
              .sort((a, b) => b.similarityScore - a.similarityScore);
            
            // High-rated discovery places (20%)
            const discoveryPlaces = allPlaces
              .filter(place => !userPrefs.includes(place.category) && place.similarityScore <= 5)
              .sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
            
            console.log(`Found ${preferenceBasedPlaces.length} preference-based places`);
            console.log(`Found ${similarityBasedPlaces.length} similarity-based places`);
            console.log(`Found ${discoveryPlaces.length} discovery places`);
            
            // Build the final recommendation mix (total of 5 places for the carousel)
            const prefCount = Math.min(2, preferenceBasedPlaces.length);
            const simCount = Math.min(2, similarityBasedPlaces.length);
            const discCount = 5 - prefCount - simCount;
            
            // Add the recommendationType property to each place
            const prefPlaces = preferenceBasedPlaces.slice(0, prefCount).map(place => ({
              ...place,
              recommendationType: 'preference'
            }));
            
            const simPlaces = similarityBasedPlaces.slice(0, simCount).map(place => ({
              ...place,
              recommendationType: 'similarity'
            }));
            
            let personalizedRecommendations = [
              ...prefPlaces,
              ...simPlaces
            ];
            
            // For UI badges (keeping these for backwards compatibility)
            const newPreferenceBasedIds = prefPlaces.map(place => place.id);
            const newSimilarityBasedIds = simPlaces.map(place => place.id);
            let newDiscoveryIds = [];
            
            // Add unique discovery places to fill the remaining slots
            const existingIds = new Set(personalizedRecommendations.map(place => place.id));
            const discoveryRecommendations = [];
            
            for (const place of discoveryPlaces) {
              if (!existingIds.has(place.id)) {
                const placeWithType = {
                  ...place,
                  recommendationType: 'discovery'
                };
                personalizedRecommendations.push(placeWithType);
                discoveryRecommendations.push(placeWithType);
                existingIds.add(place.id);
                newDiscoveryIds.push(place.id);
                if (personalizedRecommendations.length >= 5) break;
              }
            }
            
            // If we still don't have enough, add highest rated places
            if (personalizedRecommendations.length < 5) {
              const highestRated = allPlaces
                .filter(place => !existingIds.has(place.id))
                .sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0))
                .slice(0, 5 - personalizedRecommendations.length)
                .map(place => ({
                  ...place,
                  recommendationType: 'discovery'
                }));
              
              personalizedRecommendations = [...personalizedRecommendations, ...highestRated];
              // These are also considered discoveries
              newDiscoveryIds = [...newDiscoveryIds, ...highestRated.map(place => place.id)];
            }
            
            // Update state with recommendation type IDs
            setPreferenceBasedIds(newPreferenceBasedIds);
            setSimilarityBasedIds(newSimilarityBasedIds);
            setDiscoveryIds(newDiscoveryIds);
            
            console.log(`Final personalized recommendations: ${personalizedRecommendations.length} places`);
            console.log('Preference based:', newPreferenceBasedIds.length);
            console.log('Similarity based:', newSimilarityBasedIds.length);
            console.log('Discovery:', newDiscoveryIds.length);
            setRecommendedPlaces(personalizedRecommendations);
            
          } catch (err) {
            console.error('Error building personalized recommendations:', err);
            // Fall back to highest rated if there's an error
            const highestRated = allPlaces
              .sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0))
              .slice(0, 5);
            setRecommendedPlaces(highestRated);
          }
        } else {
          // For non-authenticated users, show highest rated places
          const highestRated = allPlaces
            .sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0))
            .slice(0, 5);
          setRecommendedPlaces(highestRated);
        }

        setError(null);
      } catch (err) {
        console.error('Error fetching places:', err);
        setError('Failed to load places. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchPlaces();
  }, [user]);

  // Fetch user's saved destinations
  useEffect(() => {
    const fetchSavedDestinations = async () => {
      if (!user) {
        setSavedDestinations([])
        return
      }
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        if (userDoc.exists()) {
          setSavedDestinations(userDoc.data().savedDestinations || [])
        }
      } catch (err) {
        console.error('Error fetching saved destinations:', err)
      }
    }

    fetchSavedDestinations()
  }, [user])

  // Toggle bookmark for a destination
  const toggleBookmark = async (placeId, e) => {
    e.stopPropagation()
    
    if (!user) {
      setShowLoginModal(true)
      return
    }

    try {
      const userRef = doc(db, 'users', user.uid)
      const userDoc = await getDoc(userRef)
      
      if (!userDoc.exists()) {
        await setDoc(userRef, { savedDestinations: [placeId] })
        setSavedDestinations([placeId])
        return
      }
      
      const currentSaved = userDoc.data()?.savedDestinations || []
      
      const newSaved = currentSaved.includes(placeId)
        ? currentSaved.filter(savedId => savedId !== placeId)
        : [...currentSaved, placeId]

      await setDoc(userRef, { savedDestinations: newSaved }, { merge: true })
      setSavedDestinations(newSaved)
    } catch (err) {
      console.error('Error updating saved destinations:', err)
    }
  }

  if (loading) {
    return <LoadingScreen language={language} />;
  }

  // Title component for section headers with consistent styling
  const SectionTitle = ({ children, withViewAll, link }) => (
    <div className="flex items-center justify-between mb-4 sm:mb-6">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{children}</h2>
      {withViewAll && (
        <Link to={link} className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 flex items-center">
          {t.viewAll} <i className="fas fa-arrow-right ml-1 text-xs"></i>
        </Link>
      )}
    </div>
  );

  return (
    <div className="bg-gray-50 min-h-screen pb-20">
      <Navbar
        language={language}
        setLanguage={setLanguage}
        languages={languages}
        user={user}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        isProfileOpen={isProfileOpen}
        setIsProfileOpen={setIsProfileOpen}
        setShowLoginModal={setShowLoginModal}
      />

      <main className="pt-16 sm:pt-20">
        {/* Hero Section */}
        <section className="relative bg-blue-700 text-white">
          <div className="absolute inset-0 opacity-20 bg-pattern"></div>
          <div className="relative responsive-container py-8 sm:py-12 md:py-16">
            <div className="max-w-xl">
              <h1 className="text-responsive-xl font-bold mb-3 sm:mb-4">
                {language === 'hi' ? 'अपनी यात्रा का अनुभव साझा करें' : language === 'ml' ? 'നിങ്ങളുടെ യാത്രാനുഭവങ്ങൾ പങ്കിടുക' : 'Share Your Travel Experience'}
              </h1>
              <p className="text-responsive-base mb-6 sm:mb-8 text-blue-100">
                {language === 'hi' 
                  ? 'अपने यात्रा अनुभवों को दर्ज करें, अद्भुत स्थलों का पता लगाएँ, और दुनिया भर के यात्रियों से जुड़ें।'
                  : language === 'ml'
                  ? 'നിങ്ങളുടെ യാത്രാനുഭവങ്ങൾ രേഖപ്പെടുത്തുക, മനോഹരമായ സ്ഥലങ്ങൾ കണ്ടെത്തുക, ലോകമെമ്പാടുമുള്ള സഞ്ചാരികളുമായി ബന്ധപ്പെടുക.'
                  : 'Document your travel experiences, discover amazing places, and connect with travelers from around the world.'}
              </p>
              <div className="flex flex-wrap gap-3 sm:gap-4">
                <Link 
                  to="/explore" 
                  className="bg-white text-blue-700 hover:bg-blue-50 px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium text-sm sm:text-base shadow-sm transition-colors duration-200 flex items-center"
                >
                  <ExploreIcon className="mr-2" fontSize="small" />
                  {t.exploreMore}
                </Link>
                <Link 
                  to="/add-place" 
                  className="bg-blue-600 text-white hover:bg-blue-500 px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium text-sm sm:text-base shadow-sm transition-colors duration-200"
                >
                  {t.addPlace}
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Main Content */}
        <div className="responsive-container py-6 sm:py-8">
          {/* Trending Destinations */}
          <section className="mb-8 sm:mb-12">
            <SectionTitle withViewAll link="/explore">
              {t.trendingDestinations}
            </SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {places.length > 0 ? (
                places.map(place => (
                  <DestinationCard 
                    key={place.id} 
                    destination={place} 
                    language={language} 
                    onBookmarkToggle={toggleBookmark}
                    savedDestinations={savedDestinations}
                  />
                ))
              ) : (
                <div className="col-span-full text-center py-12 bg-white rounded-lg shadow-sm">
                  <p className="text-gray-500 mb-4">{t.noPlacesFound}</p>
                  <Link to="/add-place" className="text-blue-600 hover:text-blue-800">
                    {t.addPlace}
                  </Link>
                </div>
              )}
            </div>
          </section>

          {/* Recommended Destinations */}
          <section className="mb-8 sm:mb-12">
            <SectionTitle withViewAll link="/recommend">
              {t.recommendedForYou}
            </SectionTitle>

            {recommendedPlaces.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {recommendedPlaces.map(place => (
                  <div key={place.id} className="relative">
                    <DestinationCard 
                      destination={place} 
                      language={language} 
                      onBookmarkToggle={toggleBookmark}
                      savedDestinations={savedDestinations}
                    />
                    {/* Recommendation badges */}
                    <div className="absolute top-2 left-2 z-10 flex gap-1">
                      {preferenceBasedIds.includes(place.id) && (
                        <div className="bg-blue-600 text-white text-[8px] py-0.5 px-1.5 rounded-sm shadow-sm flex items-center">
                          <i className="fas fa-check-circle mr-1 text-[7px]"></i>
                          <span className="truncate max-w-[60px]">{t.preferenceMatch}</span>
                        </div>
                      )}
                      {similarityBasedIds.includes(place.id) && (
                        <div className="bg-purple-600 text-white text-[8px] py-0.5 px-1.5 rounded-sm shadow-sm flex items-center">
                          <i className="fas fa-clone mr-1 text-[7px]"></i>
                          <span className="truncate max-w-[60px]">{t.similarToSaved}</span>
                        </div>
                      )}
                      {discoveryIds.includes(place.id) && (
                        <div className="bg-green-600 text-white text-[8px] py-0.5 px-1.5 rounded-sm shadow-sm flex items-center">
                          <i className="fas fa-compass mr-1 text-[7px]"></i>
                          <span className="truncate max-w-[60px]">{t.newDiscovery}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-6 text-center">
                <p className="text-gray-500 mb-4">
                  {user ? t.noPlacesFoundForSelectedCriteria : t.forMorePersonalizedRecommendations}
                </p>
                {!user && (
                  <Link to="/auth" className="text-blue-600 hover:text-blue-800">
                    {t.signIn}
                  </Link>
                )}
              </div>
            )}
          </section>

          {/* Saved Destinations - Only show if user has saved destinations */}
          {user && savedDestinations.length > 0 && (
            <section>
              <SectionTitle withViewAll link="/profile">
                {t.savedDestinations}
              </SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {savedDestinations.slice(0, 3).map(destination => (
                  <DestinationCard 
                    key={destination} 
                    destination={places.find(p => p.id === destination) || recommendedPlaces.find(p => p.id === destination) || { id: destination }}
                    language={language} 
                    onBookmarkToggle={toggleBookmark}
                    savedDestinations={savedDestinations}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

Home.propTypes = {
  language: PropTypes.string.isRequired,
  setLanguage: PropTypes.func.isRequired,
  languages: PropTypes.array.isRequired,
  user: PropTypes.object
}

export default Home

