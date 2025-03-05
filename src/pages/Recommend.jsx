import React, { useState, useEffect } from 'react'
import { auth, db } from '../firebase/config'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, doc, getDoc } from 'firebase/firestore'
import PropTypes from 'prop-types'
import Navbar from '../components/Navbar'

const Recommend = ({ language, setLanguage, languages }) => {
  const navigate = useNavigate()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [recommendationCount, setRecommendationCount] = useState(6)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedRating, setSelectedRating] = useState(0)
  const [places, setPlaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setIsAuthenticated(true)
        setUser(currentUser)
        await fetchPlaces(currentUser)
      } else {
        setIsAuthenticated(false)
        setUser(null)
        navigate('/auth')
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [navigate])

  const fetchPlaces = async (currentUser) => {
    try {
      setLoading(true)
      setError(null)

      // First, get user preferences
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid))
      const userPrefs = userDoc.data()?.preferences?.tripTypes || []

      // Fetch all places
      const placesSnapshot = await getDocs(collection(db, 'places'))
      let fetchedPlaces = placesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      if (fetchedPlaces.length === 0) {
        setError('No places found in the database')
        setLoading(false)
        return
      }

      // Sort places by rating
      fetchedPlaces = fetchedPlaces.sort((a, b) => {
        const ratingA = a.averageRating || a.rating || 0
        const ratingB = b.averageRating || b.rating || 0
        return ratingB - ratingA
      })

      // If user has preferences, prioritize those places
      if (userPrefs.length > 0) {
        fetchedPlaces = [
          ...fetchedPlaces.filter(place => userPrefs.includes(place.category)),
          ...fetchedPlaces.filter(place => !userPrefs.includes(place.category))
        ]
      }

      setPlaces(fetchedPlaces)
      setError(null)
    } catch (err) {
      console.error('Error fetching places:', err)
      setError('Failed to load recommendations. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const filteredPlaces = places.filter(place => {
    const categoryMatch = selectedCategory === 'all' || place.category === selectedCategory
    const rating = place.averageRating || place.rating || 0
    const ratingMatch = selectedRating === 0 || rating >= selectedRating
    return categoryMatch && ratingMatch
  }).slice(0, recommendationCount)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-2xl text-gray-600">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    navigate('/auth')
    return null
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

      <main className="max-w-7xl mx-auto px-4 py-8 pt-20">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h1 className="text-3xl font-bold mb-6">
            {language === 'hi' ? 'व्यक्तिगत अनुशंसाएँ' : 'Personalized Recommendations'}
          </h1>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-4 mb-8">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">
                {language === 'hi' ? 'अनुशंसाओं की संख्या:' : 'Number of recommendations:'}
              </label>
              <select
                value={recommendationCount}
                onChange={(e) => setRecommendationCount(Number(e.target.value))}
                className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                {[3, 6, 9, 12].map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">
                  {language === 'hi' ? 'श्रेणी:' : 'Category:'}
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="all">{language === 'hi' ? 'सभी श्रेणियां' : 'All Categories'}</option>
                  <option value="beach">{language === 'hi' ? 'समुद्र तट' : 'Beach'}</option>
                  <option value="mountain">{language === 'hi' ? 'पर्वत' : 'Mountain'}</option>
                  <option value="cultural">{language === 'hi' ? 'सांस्कृतिक' : 'Cultural'}</option>
                  <option value="adventure">{language === 'hi' ? 'साहसिक' : 'Adventure'}</option>
                  <option value="city">{language === 'hi' ? 'शहर' : 'City'}</option>
                  <option value="nature">{language === 'hi' ? 'प्रकृति' : 'Nature'}</option>
                </select>
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">
                  {language === 'hi' ? 'न्यूनतम रेटिंग:' : 'Minimum Rating:'}
                </label>
                <select
                  value={selectedRating}
                  onChange={(e) => setSelectedRating(Number(e.target.value))}
                  className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value={0}>{language === 'hi' ? 'सभी रेटिंग' : 'All Ratings'}</option>
                  <option value={3}>3+ {language === 'hi' ? 'स्टार' : 'Stars'}</option>
                  <option value={4}>4+ {language === 'hi' ? 'स्टार' : 'Stars'}</option>
                  <option value={4.5}>4.5+ {language === 'hi' ? 'स्टार' : 'Stars'}</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPlaces.map(place => (
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

          {filteredPlaces.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {language === 'hi' 
                ? 'चयनित मापदंडों के लिए कोई स्थान नहीं मिला'
                : 'No places found for the selected criteria'}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

Recommend.propTypes = {
  language: PropTypes.string.isRequired,
  setLanguage: PropTypes.func.isRequired,
  languages: PropTypes.array.isRequired
}

export default Recommend 