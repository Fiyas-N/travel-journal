import React, { useState, useEffect } from 'react'
import { db, auth } from '../firebase/config'
import { doc, getDoc, updateDoc, collection, getDocs, setDoc } from 'firebase/firestore'
import PropTypes from 'prop-types'
import { Link, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { motion } from 'framer-motion'
import { getReviewCount } from '../utils/ratings'
import translations from '../utils/translations'

const Profile = ({ language, setLanguage, languages }) => {
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [bookmarkedDestinations, setBookmarkedDestinations] = useState([])
  const [loadingBookmarks, setLoadingBookmarks] = useState(true)
  
  // Get translations for the current language
  const t = translations[language] || translations.en
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    location: '',
    profileImage: 'https://img.freepik.com/free-photo/user-front-side-with-white-background_187299-40007.jpg',
    bio: '',
    preferences: {
      tripTypes: []
    },
    savedDestinations: []
  })

  const tripTypes = [
    { value: 'beach', label: t.beach || 'Beach' },
    { value: 'mountain', label: t.mountain || 'Mountain' },
    { value: 'cultural', label: t.cultural || 'Cultural' },
    { value: 'adventure', label: t.adventure || 'Adventure' },
    { value: 'city', label: t.city || 'City' },
    { value: 'nature', label: t.nature || 'Nature' }
  ]

  const fetchUserData = async () => {
    if (!auth.currentUser) {
      setError('Please sign in to view your profile')
      setLoading(false)
      navigate('/auth')
      return
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid))
      if (userDoc.exists()) {
        const userData = userDoc.data()
        setProfile({
          ...profile,
          ...userData
        })
        
        // Fetch bookmarked destinations
        if (userData.savedDestinations && userData.savedDestinations.length > 0) {
          fetchBookmarkedDestinations(userData.savedDestinations)
        } else {
          setLoadingBookmarks(false)
        }
      }
      setError(null)
    } catch (err) {
      console.error('Error fetching user data:', err)
      setError('Failed to load profile data')
    } finally {
      setLoading(false)
    }
  }

  const fetchBookmarkedDestinations = async (savedIds) => {
    try {
      setLoadingBookmarks(true)
      const destinations = []
      
      // Fetch each destination by ID
      for (const id of savedIds) {
        const destDoc = await getDoc(doc(db, 'places', id))
        if (destDoc.exists()) {
          const data = destDoc.data()
          destinations.push({
            id: destDoc.id,
            ...data,
            // Calculate review count
            reviewCount: data.ratings ? Object.keys(data.ratings).length : 0
          })
        }
      }
      
      setBookmarkedDestinations(destinations)
    } catch (err) {
      console.error('Error fetching bookmarked destinations:', err)
    } finally {
      setLoadingBookmarks(false)
    }
  }

  const removeBookmark = async (destinationId) => {
    if (!auth.currentUser) return
    
    try {
      // Remove from state
      const newSavedDestinations = profile.savedDestinations.filter(id => id !== destinationId)
      
      // Update Firestore
      const userRef = doc(db, 'users', auth.currentUser.uid)
      await setDoc(userRef, { savedDestinations: newSavedDestinations }, { merge: true })
      
      // Update local state
      setProfile(prev => ({
        ...prev,
        savedDestinations: newSavedDestinations
      }))
      
      // Remove from bookmarked destinations
      setBookmarkedDestinations(prev => prev.filter(dest => dest.id !== destinationId))
    } catch (err) {
      console.error('Error removing bookmark:', err)
      setError('Failed to remove bookmark')
    }
  }

  useEffect(() => {
    fetchUserData()
  }, [])

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const MAX_SIZE = 800
          let width = img.width
          let height = img.height

          if (width > height && width > MAX_SIZE) {
            height = (height * MAX_SIZE) / width
            width = MAX_SIZE
          } else if (height > MAX_SIZE) {
            width = (width * MAX_SIZE) / height
            height = MAX_SIZE
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', 0.6))
        }
        img.src = e.target.result
      }
      reader.readAsDataURL(file)
    })
  }

  const handleImageChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size should be less than 5MB')
      return
    }

    try {
      const compressedImage = await compressImage(file)
      setProfile(prev => ({
        ...prev,
        profileImage: compressedImage
      }))
      setError(null)
    } catch (err) {
      console.error('Error processing image:', err)
      setError('Failed to process image')
    }
  }

  const handlePreferenceChange = (tripType) => {
    setProfile(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        tripTypes: prev.preferences.tripTypes.includes(tripType)
          ? prev.preferences.tripTypes.filter(type => type !== tripType)
          : [...prev.preferences.tripTypes, tripType]
      }
    }))
  }

  const handleSave = async () => {
    if (!auth.currentUser) return

    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        ...profile
      })
      setIsEditing(false)
      setError(null)
    } catch (err) {
      console.error('Error updating profile:', err)
      setError('Failed to update profile')
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    fetchUserData()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-2xl text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar 
        language={language}
        setLanguage={setLanguage}
        languages={languages}
        user={auth.currentUser}
        setShowLoginModal={setShowLoginModal}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        isProfileOpen={isProfileOpen}
        setIsProfileOpen={setIsProfileOpen}
      />

      <div className="pt-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mt-8">
          {error && (
            <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md shadow-md z-50 w-[90%] sm:w-auto">
              <p className="text-sm text-center">{error}</p>
            </div>
          )}

          {/* Profile Header - Mobile Optimized */}
          <div className="relative bg-blue-600 px-4 py-6 sm:px-6 sm:py-8">
            <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6">
              <div className="relative group w-32 h-32 sm:w-40 sm:h-40">
                <img
                  src={profile.profileImage}
                  alt="Profile"
                  className="w-full h-full rounded-full object-cover border-4 border-white shadow-lg"
                />
                {isEditing && (
                  <label className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full cursor-pointer group-hover:bg-opacity-60 transition-all">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                    <i className="fas fa-camera text-white text-2xl"></i>
                  </label>
                )}
              </div>
              <div className="text-center sm:text-left">
                <h1 className="text-2xl sm:text-3xl font-bold text-white">{profile.name}</h1>
                <p className="text-blue-100 mt-1">{profile.location}</p>
              </div>
            </div>
          </div>

          {/* Profile Content - Mobile Optimized */}
          <div className="p-4 sm:p-6 space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                  {t.editProfile || 'Profile Information'}
                </h2>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="rounded-md bg-blue-600 text-white px-4 py-2 text-sm sm:text-base hover:bg-blue-700 transition-colors"
                >
                  {isEditing 
                    ? (t.cancel || 'Cancel')
                    : (t.edit || 'Edit')}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t.name || 'Name'}
                  </label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t.email || 'Email'}
                  </label>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t.phone || 'Phone'}
                  </label>
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t.location || 'Location'}
                  </label>
                  <input
                    type="text"
                    value={profile.location}
                    onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.bio || 'Bio'}
                </label>
                <textarea
                  value={profile.bio}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                  disabled={!isEditing}
                  rows={4}
                  className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 resize-none"
                />
              </div>
            </div>

            {/* Trip Preferences - Mobile Optimized */}
            <div className="space-y-4">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                {t.tripTypes || 'Trip Preferences'}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {tripTypes.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => isEditing && handlePreferenceChange(type.value)}
                    disabled={!isEditing}
                    className={`p-3 rounded-lg text-sm sm:text-base text-center transition-colors touch-manipulation
                      ${profile.preferences.tripTypes.includes(type.value)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
                      ${!isEditing && 'cursor-default'}
                    `}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bookmarked Destinations Section */}
            <div className="space-y-4 pt-4 border-t border-gray-200">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                {t.bookmarkedDestinations || 'Bookmarked Destinations'}
              </h2>
              
              {loadingBookmarks ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : bookmarkedDestinations.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bookmarkedDestinations.map((destination) => (
                    <div 
                      key={destination.id}
                      className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 cursor-pointer"
                      onClick={() => navigate(`/destination/${destination.id}`)}
                    >
                      <div className="relative h-48 overflow-hidden group">
                        <img 
                          src={destination.images?.[0] || destination.image || 'https://via.placeholder.com/400x300?text=No+Image'} 
                          alt={destination.name} 
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                        {(destination.likes || 0) > 100 && (
                          <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1">
                            <i className="fas fa-fire"></i>
                            <span>{t.trending || 'Trending'}</span>
                          </div>
                        )}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            removeBookmark(destination.id);
                          }}
                          className="absolute top-4 left-4 bg-white text-red-500 p-2 rounded-full hover:bg-red-50 transition-all"
                          title={t.delete || 'Remove Bookmark'}
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </div>
                      <div className="p-6">
                        <h3 className="text-2xl font-semibold text-gray-900 mb-2">{destination.name}</h3>
                        <p className="text-gray-600 mb-4 line-clamp-1">{destination.description}</p>
                        <div className="flex items-center gap-1 text-gray-700">
                          <i className="fas fa-star text-yellow-400"></i>
                          <span className="font-semibold">{(destination.averageRating || destination.rating || 0).toFixed(1)}</span>
                          <span className="text-gray-500">({getReviewCount(destination) || 0} {t.reviews || 'reviews'})</span>
                          <span className="ml-auto text-gray-500 text-xs">
                            <i className="fas fa-map-marker-alt mr-1"></i>
                            {destination.location || `${destination.district || ''}, ${destination.state || ''}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <i className="far fa-bookmark text-4xl mb-2"></i>
                  <p>
                    {t.noBookmarks || 'You haven\'t bookmarked any destinations yet'}
                  </p>
                  <Link 
                    to="/explore" 
                    className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    {t.explore || 'Explore Destinations'}
                  </Link>
                </div>
              )}
            </div>

            {/* Action Buttons - Mobile Optimized */}
            {isEditing && (
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
                <button
                  onClick={handleSave}
                  className="w-full sm:w-auto rounded-md bg-blue-600 text-white px-6 py-2.5 text-base font-medium hover:bg-blue-700 transition-colors touch-manipulation"
                >
                  {t.saveChanges || 'Save Changes'}
                </button>
                <button
                  onClick={handleCancel}
                  className="w-full sm:w-auto rounded-md bg-gray-100 text-gray-700 px-6 py-2.5 text-base font-medium hover:bg-gray-200 transition-colors touch-manipulation"
                >
                  {t.cancel || 'Cancel'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

Profile.propTypes = {
  language: PropTypes.string.isRequired,
  setLanguage: PropTypes.func.isRequired,
  languages: PropTypes.array.isRequired
}

export default Profile