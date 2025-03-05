import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth, db } from '../firebase/config'
import { collection, addDoc } from 'firebase/firestore'
import Navbar from '../components/Navbar'
import PropTypes from 'prop-types'

const AddPlace = ({ language, setLanguage, languages }) => {
  const navigate = useNavigate()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [images, setImages] = useState([])
  const [placeName, setPlaceName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState([])
  const [rating, setRating] = useState(0)
  const [location, setLocation] = useState('')
  const [inputTag, setInputTag] = useState('')
  const [showTagError, setShowTagError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [error, setError] = useState(null)

  const categories = [
    { value: 'beach', label: language === 'hi' ? 'समुद्र तट' : 'Beach' },
    { value: 'mountain', label: language === 'hi' ? 'पर्वत' : 'Mountain' },
    { value: 'cultural', label: language === 'hi' ? 'सांस्कृतिक' : 'Cultural' },
    { value: 'adventure', label: language === 'hi' ? 'साहसिक' : 'Adventure' },
    { value: 'city', label: language === 'hi' ? 'शहर' : 'City' },
    { value: 'nature', label: language === 'hi' ? 'प्रकृति' : 'Nature' }
  ]

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        navigate('/auth')
      } else {
        setIsAuthenticated(true)
      }
    })

    return () => unsubscribe()
  }, [navigate])

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target.result
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height
          
          // Calculate new dimensions while maintaining aspect ratio
          const maxDimension = 800
          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width)
              width = maxDimension
            }
          } else {
            if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height)
              height = maxDimension
            }
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, width, height)
          
          // Compress image to JPEG with reduced quality
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6)
          resolve(compressedBase64)
        }
      }
    })
  }

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files)
    
    if (files.length + images.length > 5) {
      setError('Maximum 5 images allowed')
      return
    }

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) { // Increased size limit since we'll compress
        setError('Each image must be less than 10MB')
        return
      }

      if (!file.type.startsWith('image/')) {
        setError('Please upload only image files')
        return
      }

      try {
        const compressedBase64 = await compressImage(file)
        setImages(prev => [...prev, compressedBase64])
      } catch (err) {
        console.error('Error processing image:', err)
        setError('Failed to process image')
      }
    }
    setError(null)
  }

  const handleRemoveImage = (indexToRemove) => {
    setImages(images.filter((_, index) => index !== indexToRemove))
  }

  const handleAddTag = () => {
    if (inputTag.trim() && !tags.includes(inputTag.trim())) {
      setTags([...tags, inputTag.trim()])
      setInputTag('')
      setShowTagError(false)
    } else {
      setShowTagError(true)
    }
  }

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (!auth.currentUser) {
        throw new Error('You must be logged in to add a place')
      }

      if (images.length === 0) {
        throw new Error('Please add at least one image')
      }

      if (!placeName.trim()) {
        throw new Error('Please enter a place name')
      }

      if (!description.trim()) {
        throw new Error('Please enter a description')
      }

      if (!category) {
        throw new Error('Please select a category')
      }

      if (!location.trim()) {
        throw new Error('Please enter a location')
      }

      if (rating === 0) {
        throw new Error('Please set a rating')
      }

      // Create place document with base64 images
      const placeData = {
        name: placeName.trim(),
        description: description.trim(),
        category,
        tags,
        rating,
        location: location.trim(),
        images: images, // Store base64 strings directly
        userId: auth.currentUser.uid,
        createdAt: new Date().toISOString(),
        likes: 0,
        averageRating: rating,
        ratings: {
          [auth.currentUser.uid]: rating
        }
      }

      const docRef = await addDoc(collection(db, 'places'), placeData)
      console.log('Document added successfully:', docRef.id)

      setShowSuccessMessage(true)
      setTimeout(() => {
        setShowSuccessMessage(false)
        navigate('/recommend')
      }, 2000)

      // Reset form
      setImages([])
      setPlaceName('')
      setDescription('')
      setCategory('')
      setTags([])
      setRating(0)
      setLocation('')
    } catch (error) {
      console.error('Error in handleSubmit:', error)
      setError(error.message || 'Failed to add place')
    } finally {
      setLoading(false)
    }
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
      <div className="max-w-7xl mx-auto px-4 py-8 pt-20">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {language === 'hi' ? 'नया स्थान जोड़ें' : 'Add New Destination'}
          </h1>
          <p className="text-gray-600 mt-2">
            {language === 'hi' ? 'समुदाय के साथ अपना यात्रा अनुभव साझा करें' : 'Share your travel experience with the community'}
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Images * (Add 1-5 images)
            </label>
            <div className="flex gap-2 mb-4">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>
            {images.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {images.map((base64String, index) => (
                  <div key={index} className="relative">
                    <img
                      src={base64String}
                      alt={`Image ${index + 1}`}
                      className="h-24 w-full object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                    >
                      <i className="fas fa-times text-xs"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 text-sm text-gray-500">
              Maximum 5 images, each less than 10MB
            </p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Place Name *
            </label>
            <input
              type="text"
              value={placeName}
              onChange={(e) => setPlaceName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              required
            >
              <option value="">
                {language === 'hi' ? 'श्रेणी चुनें' : 'Select a category'}
              </option>
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputTag}
                onChange={(e) => setInputTag(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                placeholder="Add a tag"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Add
              </button>
            </div>
            {showTagError && (
              <p className="text-red-500 text-sm mt-1">Tag already exists or is empty</p>
            )}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rating *
            </label>
            <div className="flex items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`text-2xl ${
                    star <= rating ? 'text-yellow-400' : 'text-gray-300'
                  }`}
                >
                  <i className="fas fa-star"></i>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location *
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Enter the name of the place (e.g. Kumarakom, Kerala)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              required
            />
            <p className="mt-1 text-sm text-gray-500">
              Enter the name of the location, city, or region
            </p>
          </div>

          <div className="flex justify-end gap-4">
            <button
              type="button"
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              onClick={() => navigate(-1)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center">
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Saving...
                </span>
              ) : (
                'Save Place'
              )}
            </button>
          </div>
        </form>
      </div>

      {showSuccessMessage && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg">
          {language === 'hi' ? 'स्थान सफलतापूर्वक जोड़ा गया!' : 'Place added successfully!'}
        </div>
      )}
    </div>
  )
}

AddPlace.propTypes = {
  language: PropTypes.string.isRequired,
  setLanguage: PropTypes.func.isRequired,
  languages: PropTypes.array.isRequired
}

export default AddPlace 