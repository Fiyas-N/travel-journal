import React, { useState, useEffect } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Pagination, Autoplay } from 'swiper/modules'
import PropTypes from 'prop-types'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../firebase/config'
import { collection, query, orderBy, limit, getDocs, where, doc, getDoc } from 'firebase/firestore'
import Navbar from '../components/Navbar'
import 'swiper/css'
import 'swiper/css/pagination'
import 'swiper/css/autoplay'
import { motion } from 'framer-motion'
import { Button } from '@mui/material'
import ExploreIcon from '@mui/icons-material/Explore'

const Home = ({ language, setLanguage, languages, user }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [places, setPlaces] = useState([])
  const [recommendedPlaces, setRecommendedPlaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

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
          }
        }

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
                  {language === 'hi' ? 'खोज शुरू करें' : 'Start Exploring'}
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Trending Places Section - Mobile Optimized */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:py-16">
        <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8">
          {language === 'hi' ? 'ट्रेंडिंग गंतव्य' : 'Trending Destinations'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {places.map(place => (
            <div 
              key={place.id} 
              className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 cursor-pointer"
              onClick={() => navigate(`/destination/${place.id}`)}
            >
              <div className="relative h-48 overflow-hidden group">
                <img 
                  src={place.images?.[0] || place.image} 
                  alt={place.name} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                {(place.likes || 0) > 100 && (
                  <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1">
                    <i className="fas fa-fire"></i>
                    <span>{language === 'hi' ? 'ट्रेंडिंग' : 'Trending'}</span>
                  </div>
                )}
              </div>
              <div className="p-6">
                <h3 className="text-2xl font-semibold text-gray-900 mb-2">{place.name}</h3>
                <p className="text-gray-600 mb-4 line-clamp-1">{place.description}</p>
                <div className="flex items-center gap-1 text-gray-700">
                  <i className="fas fa-star text-yellow-400"></i>
                  <span className="font-semibold">{(place.averageRating || place.rating || 0).toFixed(1)}</span>
                  <span className="text-gray-500">({place.reviews || 0} reviews)</span>
                  <button 
                    className="ml-auto text-gray-400 hover:text-gray-600"
                    aria-label="Bookmark"
                  >
                    <i className="far fa-bookmark"></i>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommended Places Section - Mobile Optimized */}
      <div className="py-8 sm:py-16 bg-gray-100">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8">
            {language === 'hi' ? 'आपके लिए अनुशंसित' : 'Recommended for You'}
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
                <div 
                  className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 h-full cursor-pointer"
                  onClick={() => navigate(`/destination/${place.id}`)}
                >
                  <div className="relative h-48 overflow-hidden group">
                    <img 
                      src={place.images?.[0] || place.image} 
                      alt={place.name} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    {(place.likes || 0) > 100 && (
                      <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1">
                        <i className="fas fa-fire"></i>
                        <span>{language === 'hi' ? 'ट्रेंडिंग' : 'Trending'}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-6">
                    <h3 className="text-2xl font-semibold text-gray-900 mb-2">{place.name}</h3>
                    <p className="text-gray-600 mb-4 line-clamp-1">{place.description}</p>
                    <div className="flex items-center gap-1 text-gray-700">
                      <i className="fas fa-star text-yellow-400"></i>
                      <span className="font-semibold">{(place.averageRating || place.rating || 0).toFixed(1)}</span>
                      <span className="text-gray-500">({place.reviews || 0} reviews)</span>
                      <button 
                        className="ml-auto text-gray-400 hover:text-gray-600"
                        aria-label="Bookmark"
                      >
                        <i className="far fa-bookmark"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>

      {/* Loading and Error States - Mobile Optimized */}
      {loading && (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="text-xl sm:text-2xl text-gray-600 text-center">Loading...</div>
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

