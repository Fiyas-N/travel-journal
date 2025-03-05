import React, { useState, useEffect } from 'react'
import { db, auth } from '../firebase/config'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import PropTypes from 'prop-types'
import { Link, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'

const Profile = ({ language, setLanguage, languages }) => {
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    location: '',
    profileImage: 'https://img.freepik.com/free-photo/user-front-side-with-white-background_187299-40007.jpg',
    bio: '',
    preferences: {
      tripTypes: []
    }
  })

  const tripTypes = [
    { value: 'beach', label: language === 'hi' ? 'समुद्र तट' : 'Beach' },
    { value: 'mountain', label: language === 'hi' ? 'पर्वत' : 'Mountain' },
    { value: 'cultural', label: language === 'hi' ? 'सांस्कृतिक' : 'Cultural' },
    { value: 'adventure', label: language === 'hi' ? 'साहसिक' : 'Adventure' },
    { value: 'city', label: language === 'hi' ? 'शहर' : 'City' },
    { value: 'nature', label: language === 'hi' ? 'प्रकृति' : 'Nature' }
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
        setProfile({
          ...profile,
          ...userDoc.data()
        })
      }
      setError(null)
    } catch (err) {
      console.error('Error fetching user data:', err)
      setError('Failed to load profile data')
    } finally {
      setLoading(false)
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
                  {language === 'hi' ? 'प्रोफ़ाइल जानकारी' : 'Profile Information'}
                </h2>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="rounded-md bg-blue-600 text-white px-4 py-2 text-sm sm:text-base hover:bg-blue-700 transition-colors"
                >
                  {isEditing 
                    ? (language === 'hi' ? 'रद्द करें' : 'Cancel')
                    : (language === 'hi' ? 'संपादित करें' : 'Edit')}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {language === 'hi' ? 'नाम' : 'Name'}
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
                    {language === 'hi' ? 'ईमेल' : 'Email'}
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
                    {language === 'hi' ? 'फ़ोन' : 'Phone'}
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
                    {language === 'hi' ? 'स्थान' : 'Location'}
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
                  {language === 'hi' ? 'बायो' : 'Bio'}
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
                {language === 'hi' ? 'यात्रा प्राथमिकताएं' : 'Trip Preferences'}
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

            {/* Action Buttons - Mobile Optimized */}
            {isEditing && (
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
                <button
                  onClick={handleSave}
                  className="w-full sm:w-auto rounded-md bg-blue-600 text-white px-6 py-2.5 text-base font-medium hover:bg-blue-700 transition-colors touch-manipulation"
                >
                  {language === 'hi' ? 'परिवर्तन सहेजें' : 'Save Changes'}
                </button>
                <button
                  onClick={handleCancel}
                  className="w-full sm:w-auto rounded-md bg-gray-100 text-gray-700 px-6 py-2.5 text-base font-medium hover:bg-gray-200 transition-colors touch-manipulation"
                >
                  {language === 'hi' ? 'रद्द करें' : 'Cancel'}
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