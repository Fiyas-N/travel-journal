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
        <LoadingScreen language={language} type="fullpage" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-red-600">{error}</div>
      </div>
    )
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

      <div className="pt-16">
        {/* Hero Section - Mobile Optimized */}
        <motion.div 
          className="relative h-[400px] sm:h-[600px] bg-blue-600 bg-cover bg-center" 
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <div className="absolute inset-0 bg-black bg-opacity-40"></div>
          <div className="relative max-w-7xl mx-auto px-4 h-full flex items-center">
            <motion.div 
              className="text-white max-w-xl"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <h1 className="text-3xl sm:text-5xl font-bold mb-4 sm:mb-6">
                {language === 'hi' ? 'अपनी अगली यात्रा की खोज करें' : 'Discover Your Next Adventure'}
              </h1>
              <p className="text-base sm:text-xl mb-8">
                {language === 'hi' 
                  ? 'दुनिया के सबसे खूबसूरत स्थलों की खोज करें और यादगार पल बनाएं।' 
                  : 'Explore the world\'s most beautiful destinations and create unforgettable memories.'}
              </p>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<ExploreIcon />}
                  onClick={() => navigate('/explore')}
                  sx={{
                    backgroundColor: 'white',
                    color: '#2563EB',
                    '&:hover': {
                      backgroundColor: '#f8fafc',
                    },
                    px: 4,
                    py: 1.5,
                    fontSize: '1.1rem',
                  }}
                >
                  {t.exploreMore || 'Start Exploring'}
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Trending Places Section - Mobile Optimized */}
      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-16">
        <div className="flex items-center mb-2 sm:mb-3">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold">
            {language === 'hi' ? 'ट्रेंडिंग स्थान' : 'Trending Destinations'}
          </h2>
          <div className="ml-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white text-xs font-medium py-1 px-3 rounded-full shadow-sm flex items-center">
            <i className="fas fa-fire mr-1.5"></i>
            <span>{language === 'hi' ? 'लोकप्रिय' : 'Hot'}</span>
          </div>
        </div>
        <p className="text-gray-600 mb-4 sm:mb-8">
          {language === 'hi' 
            ? 'सबसे अधिक बुकमार्क किए गए और यात्रियों के बीच लोकप्रिय स्थान' 
            : 'Most bookmarked destinations popular among travelers'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {places.map((place, index) => (
            <div key={place.id} className="relative">
              {/* Special badge for the top trending place */}
              {index === 0 && (
                <div className="absolute top-11 right-3 z-10 bg-yellow-400 bg-opacity-90 text-white text-[8px] py-0.5 px-1 rounded-sm shadow-sm flex items-center">
                  <i className="fas fa-crown mr-1 text-[7px]"></i>
                  <span className="truncate">{language === 'hi' ? 'नंबर 1' : 'Top Pick'}</span>
                </div>
              )}
              <DestinationCard 
                destination={place} 
                language={language} 
                onBookmarkToggle={toggleBookmark}
                savedDestinations={savedDestinations}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Recommended Places Section - Mobile Optimized */}
      <div className="py-8 sm:py-16 bg-gray-100">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-8">
            {t.recommendedForYou || 'Recommended for You'}
            {!user && (
              <span className="ml-2 text-sm font-normal text-blue-600">
                <Link to="/auth" className="hover:underline">
                  {t.signIn || 'Sign in'}
                </Link> {t.forMorePersonalizedRecommendations || 'for more personalized recommendations'}
              </span>
            )}
          </h2>
          <Swiper
            modules={[Pagination, Autoplay]}
            spaceBetween={24}
            slidesPerView={1}
            breakpoints={{
              640: {
                slidesPerView: 2,
                spaceBetween: 24,
              },
              1024: {
                slidesPerView: 3,
                spaceBetween: 24,
              },
            }}
            pagination={{ clickable: true }}
            autoplay={{ delay: 3000 }}
            className="pb-12"
          >
            {recommendedPlaces.map(place => (
              <SwiperSlide key={place.id}>
                <div className="relative">
                  {/* Recommendation badges - only show for authenticated users */}
                  {user && (
                    <div className="absolute top-3 right-3 z-10 flex flex-col items-end">
                      {place.recommendationType === 'preference' && (
                        <div className="bg-blue-500 bg-opacity-85 text-white text-[9px] py-0.5 px-1.5 rounded-sm mb-1 shadow-sm flex items-center">
                          <i className="fas fa-thumbs-up mr-1 text-[8px]"></i>
                          <span className="truncate max-w-24">
                            {language === 'hi' ? 'पसंद अनुसार' : 'Preference Match'}
                          </span>
                        </div>
                      )}
                      {place.recommendationType === 'similarity' && (
                        <div className="bg-purple-500 bg-opacity-85 text-white text-[9px] py-0.5 px-1.5 rounded-sm mb-1 shadow-sm flex items-center">
                          <i className="fas fa-bookmark mr-1 text-[8px]"></i>
                          <span className="truncate max-w-24">
                            {language === 'hi' ? 'समान स्थान' : 'Similar to Saved'}
                          </span>
                        </div>
                      )}
                      {place.recommendationType === 'discovery' && (
                        <div className="bg-green-500 bg-opacity-85 text-white text-[9px] py-0.5 px-1.5 rounded-sm mb-1 shadow-sm flex items-center">
                          <i className="fas fa-compass mr-1 text-[8px]"></i>
                          <span className="truncate max-w-24">
                            {language === 'hi' ? 'नई खोज' : 'New Discovery'}
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
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>

      {/* Loading and Error States - Mobile Optimized */}
      {loading && (
        <div className="flex items-center justify-center min-h-[50vh]">
          <LoadingScreen language={language} type="inline" size="small" />
        </div>
      )}

      {error && (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="text-lg sm:text-xl text-red-600 text-center">{error}</div>
        </div>
      )}
    </div>
  )
}

Home.propTypes = {
  language: PropTypes.string.isRequired,
  setLanguage: PropTypes.func.isRequired,
  languages: PropTypes.array.isRequired,
  user: PropTypes.object
}

export default Home

