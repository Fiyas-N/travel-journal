import React, { useState, useEffect } from 'react'
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

const Home = ({ language, setLanguage, languages, user }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [places, setPlaces] = useState([])
  const [recommendedPlaces, setRecommendedPlaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [savedDestinations, setSavedDestinations] = useState([])
  const navigate = useNavigate()
  
  // Get translations for the current language
  const t = translations[language] || translations.en

  useEffect(() => {
    const fetchPlaces = async () => {
      try {
        // Fetch all places first
        const placesSnapshot = await getDocs(collection(db, 'places'))
        const allPlaces = placesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))

        if (allPlaces.length === 0) {
          setError('No places found. Try adding some destinations!')
          setLoading(false)
          return
        }

        // Sort by likes for trending places
        const trendingPlaces = [...allPlaces]
          .sort((a, b) => (b.likes || 0) - (a.likes || 0))
          .slice(0, 3)
        setPlaces(trendingPlaces)

        // Handle recommended places
        let recommendedPlaces = []
        if (user) {
          try {
            // Get user preferences
            const userDoc = await getDoc(doc(db, 'users', user.uid))
            const userPrefs = userDoc.data()?.preferences?.tripTypes || []

            if (userPrefs.length > 0) {
              // Filter by user preferences
              recommendedPlaces = allPlaces
                .filter(place => userPrefs.includes(place.category))
                .sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0))
                .slice(0, 5)
            }
          } catch (err) {
            console.error('Error fetching user preferences:', err)
            // If there's an error fetching user preferences, fall back to highest rated
            recommendedPlaces = []
          }
        }
        // For non-authenticated users, we'll show highest rated places below

        // If no recommended places based on preferences, show highest rated
        if (recommendedPlaces.length === 0) {
          recommendedPlaces = [...allPlaces]
            .sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0))
            .slice(0, 5)
        }

        setRecommendedPlaces(recommendedPlaces)
        setError(null)
        setLoading(false)
      } catch (err) {
        console.error('Error fetching places:', err)
        setError('Failed to load places. Please try again later.')
        setLoading(false)
      }
    }

    fetchPlaces()
  }, [user])

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-2xl text-gray-600">Loading...</div>
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
          className="relative h-[400px] sm:h-[600px] bg-cover bg-center" 
          style={{
            backgroundImage: `url('https://public.readdy.ai/ai/img_res/8a9844b96745fc1985b650b381ccf05f.jpg')`
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
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-8">
          {t.trendingDestinations || 'Trending Destinations'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {places.map(place => (
            <DestinationCard 
              key={place.id} 
              destination={place} 
              language={language} 
              onBookmarkToggle={toggleBookmark}
              savedDestinations={savedDestinations}
            />
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
                <DestinationCard 
                  destination={place} 
                  language={language} 
                  onBookmarkToggle={toggleBookmark}
                  savedDestinations={savedDestinations}
                />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>

      {/* Loading and Error States - Mobile Optimized */}
      {loading && (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="text-xl sm:text-2xl text-gray-600 text-center">{t.loading || 'Loading...'}</div>
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

