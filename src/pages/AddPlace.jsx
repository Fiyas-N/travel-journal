import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth, db } from '../firebase/config'
import { collection, addDoc, query, where, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore'
import Navbar from '../components/Navbar'
import PropTypes from 'prop-types'
import { getReviewCount } from '../utils/ratings'
import { motion } from 'framer-motion'
import { getAllCountries } from '../utils/countries'
import { getAllStates, getDistrictsForState } from '../utils/indiaLocations'
import LoadingScreen from '../components/LoadingScreen'
import translations from '../utils/translations'

const AddPlace = ({ language, setLanguage, languages }) => {
  const navigate = useNavigate()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [images, setImages] = useState([])
  const [placeName, setPlaceName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState([])
  const [rating, setRating] = useState(0)
  const [district, setDistrict] = useState('')
  const [state, setState] = useState('')
  const [country, setCountry] = useState('')
  const [inputTag, setInputTag] = useState('')
  const [showTagError, setShowTagError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [error, setError] = useState(null)
  const [userDestinations, setUserDestinations] = useState([])
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [destinationToDelete, setDestinationToDelete] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [destinationToEdit, setDestinationToEdit] = useState(null)
  const [fetchingUserDestinations, setFetchingUserDestinations] = useState(false)
  const [viewMode, setViewMode] = useState('add')

  const t = translations[language] || translations.en

  const categories = [
    { value: 'beach', label: language === 'hi' ? 'समुद्र तट' : 'Beach' },
    { value: 'mountain', label: language === 'hi' ? 'पर्वत' : 'Mountain' },
    { value: 'cultural', label: language === 'hi' ? 'सांस्कृतिक' : 'Cultural' },
    { value: 'adventure', label: language === 'hi' ? 'साहसिक' : 'Adventure' },
    { value: 'city', label: language === 'hi' ? 'शहर' : 'City' },
    { value: 'nature', label: language === 'hi' ? 'प्रकृति' : 'Nature' }
  ]

  useEffect(() => {
    if (auth.currentUser) {
        setIsAuthenticated(true)
      fetchUserDestinations()
      }
  }, [])

    const fetchUserDestinations = async () => {
    if (!auth.currentUser) return
      
      try {
      setFetchingUserDestinations(true)
      const placesQuery = query(
          collection(db, 'places'),
        where('addedBy', '==', auth.currentUser.uid)
      )
        
      const placesSnapshot = await getDocs(placesQuery)
      const placesData = placesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
      }))
      
      placesData.sort((a, b) => {
        const dateA = a.updatedAt || a.createdAt;
        const dateB = b.updatedAt || b.createdAt;
        return new Date(dateB) - new Date(dateA);
      });
      
      setUserDestinations(placesData)
      } catch (err) {
      console.error('Error fetching user destinations:', err)
      setError('Failed to load your destinations')
      } finally {
      setFetchingUserDestinations(false)
    }
  }

  const handleEditClick = (destination) => {
    setDestinationToEdit(destination)
    setEditMode(true)
    setViewMode('add')
    
    setPlaceName(destination.name || '')
    setDescription(destination.description || '')
    setCategory(destination.category || '')
    setTags(destination.tags || [])
    setRating(destination.rating || 0)
    setDistrict(destination.district || '')
    setState(destination.state || '')
    setCountry(destination.country || '')
    setImages(destination.images || [])
    
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }

  const handleDeleteClick = (destination) => {
    setDestinationToDelete(destination)
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!destinationToDelete) return
    
    try {
      setLoading(true)
      await deleteDoc(doc(db, 'places', destinationToDelete.id))
      
      setUserDestinations(prev => prev.filter(d => d.id !== destinationToDelete.id))
      
      setShowDeleteModal(false)
      setDestinationToDelete(null)
      
      setShowSuccessMessage(true)
      setTimeout(() => {
        setShowSuccessMessage(false)
      }, 2000)
    } catch (err) {
      console.error('Error deleting destination:', err)
      setError('Failed to delete destination')
    } finally {
      setLoading(false)
    }
  }

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
      if (file.size > 10 * 1024 * 1024) {
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
    setError(null)
    setLoading(true)

    try {
      const nameToCheck = placeName.trim().toLowerCase()
      const districtToCheck = district.trim().toLowerCase()
      const stateToCheck = state.trim().toLowerCase()
      const countryToCheck = country.trim().toLowerCase()

      if (!nameToCheck) {
        throw new Error('Please enter a place name')
      }

      if (!editMode) {
        const placesQuery = query(
          collection(db, 'places'),
          where('userId', '==', auth.currentUser.uid)
        );
        
        const placesSnapshot = await getDocs(placesQuery);
        
        const duplicatePlace = placesSnapshot.docs.find(doc => {
          const placeData = doc.data();
          return (
            placeData.name.trim().toLowerCase() === nameToCheck &&
            placeData.country.trim().toLowerCase() === countryToCheck &&
            placeData.state.trim().toLowerCase() === stateToCheck &&
            placeData.district.trim().toLowerCase() === districtToCheck
          );
        });
        
        if (duplicatePlace) {
          throw new Error(
            language === 'hi'
              ? 'यह स्थान पहले से ही जोड़ा गया है। कृपया कोई अन्य स्थान जोड़ें।'
              : 'This destination already exists with the same name and location. Please add a different place.'
          );
        }
      }

      if (!description.trim()) {
        throw new Error('Please enter a description')
      }

      if (!category) {
        throw new Error('Please select a category')
      }

      if (!district.trim()) {
        throw new Error('Please enter a district')
      }

      if (!state.trim()) {
        throw new Error('Please enter a state')
      }

      if (!country.trim()) {
        throw new Error('Please enter a country')
      }

      if (rating === 0) {
        throw new Error('Please set a rating')
      }

      const placeData = {
        name: placeName.trim(),
        description: description.trim(),
        category,
        tags,
        rating,
        district: district.trim(),
        state: state.trim(),
        country: country.trim(),
        images: images,
        userId: auth.currentUser.uid,
        addedBy: auth.currentUser.uid,
        updatedAt: new Date().toISOString()
      };
      
      if (editMode && destinationToEdit) {
        await updateDoc(doc(db, 'places', destinationToEdit.id), placeData);
        
        setUserDestinations(prev => 
          prev.map(d => d.id === destinationToEdit.id ? { ...d, ...placeData, id: destinationToEdit.id } : d)
        );
        
        setShowSuccessMessage(true);
        setTimeout(() => {
          setShowSuccessMessage(false);
        }, 2000);
      } else {
        placeData.createdAt = new Date().toISOString();
        placeData.likes = 0;
        placeData.averageRating = rating;
        placeData.ratings = {
          [auth.currentUser.uid]: rating
        };
        
        const docRef = await addDoc(collection(db, 'places'), placeData);
        
        setUserDestinations(prev => [...prev, { id: docRef.id, ...placeData }]);
        
        setShowSuccessMessage(true);
        setTimeout(() => {
          setShowSuccessMessage(false);
        }, 2000);
      }
      
      resetForm();
    } catch (error) {
      console.error('Error in handleSubmit:', error)
      setError(error.message || 'Failed to save place')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setImages([]);
    setPlaceName('');
    setDescription('');
    setCategory('');
    setTags([]);
    setRating(0);
    setDistrict('');
    setState('');
    setCountry('');
    setInputTag('');
    setEditMode(false);
    setDestinationToEdit(null);
  }

  if (!isAuthenticated) {
      return (
      <div className="min-h-screen bg-gray-100">
        <Navbar 
          language={language} 
          setLanguage={setLanguage} 
          languages={languages}
          user={auth.currentUser}
          isMenuOpen={isMenuOpen}
          setIsMenuOpen={setIsMenuOpen}
          isProfileOpen={isProfileOpen}
          setIsProfileOpen={setIsProfileOpen}
          setShowLoginModal={setShowLoginModal}
        />
        <div className="flex flex-col items-center justify-center p-4 pt-24 sm:pt-28 md:pt-32 min-h-[80vh]">
          <p className="text-xl text-gray-700 mb-4">Please sign in to add or manage destinations</p>
                <button
            onClick={() => navigate('/auth')}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Sign In
                </button>
              </div>
            </div>
    )
  }
    
    return (
    <div className="min-h-screen bg-gray-100">
      <Navbar 
        language={language}
        setLanguage={setLanguage}
        languages={languages}
        user={auth.currentUser}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        isProfileOpen={isProfileOpen}
        setIsProfileOpen={setIsProfileOpen}
        setShowLoginModal={setShowLoginModal}
      />
      
      <div className="max-w-6xl mx-auto p-4 sm:p-6 pt-24 sm:pt-28 md:pt-32">
        <div className="flex mb-6">
          <button
            onClick={() => setViewMode('add')}
            className={`flex-1 py-3 rounded-l-lg font-medium text-center text-sm sm:text-base transition-colors ${
              viewMode === 'add' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {editMode ? t.editDestination || 'Edit Destination' : t.addNewDestination || 'Add New Destination'}
          </button>
          <button
            onClick={() => {
              setViewMode('list')
              if (editMode) {
                resetForm()
              }
            }}
            className={`flex-1 py-3 rounded-r-lg font-medium text-center text-sm sm:text-base transition-colors ${
              viewMode === 'list' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {t.myDestinations || 'My Destinations'}
          </button>
        </div>
        
        {viewMode === 'add' ? (
          <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold mb-6">
              {editMode ? t.editDestination || 'Edit Destination' : t.addNewDestination || 'Add New Destination'}
            </h1>

        {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
                <p className="text-red-700">{error}</p>
              </div>
            )}
            
            {showSuccessMessage && (
              <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
                <p className="text-green-700">
                  {editMode 
                    ? t.destinationUpdated || 'Destination updated successfully!' 
                    : t.destinationAdded || 'Destination added successfully!'}
                </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-4 sm:p-8">
          <div className="mb-6 sm:mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Images * (Add 1-5 images)
            </label>
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="flex-1 px-2 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm sm:text-base"
              />
            </div>
            {images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                {images.map((base64String, index) => (
                  <div key={index} className="relative">
                    <img
                      src={base64String}
                      alt={`Image ${index + 1}`}
                      className="h-20 sm:h-24 w-full object-cover rounded-lg"
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
            <p className="mt-2 text-xs sm:text-sm text-gray-500">
              Maximum 5 images, each less than 10MB
            </p>
          </div>

          <div className="mb-5 sm:mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Place Name *
            </label>
            <input
              type="text"
              value={placeName}
              onChange={(e) => setPlaceName(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm sm:text-base"
              required
            />
          </div>

          <div className="mb-5 sm:mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm sm:text-base"
              placeholder="Describe this place in detail. Include what makes it special, best times to visit, etc."
              required
            />
            <p className="mt-1 text-xs sm:text-sm text-gray-500">
              {language === 'hi' 
                ? 'स्थान का विस्तृत विवरण दें। आप पंक्ति विराम (Enter) का उपयोग कर सकते हैं।'
                : 'Provide a detailed description. You can use line breaks (Enter).'}
            </p>
          </div>

          <div className="mb-5 sm:mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm sm:text-base"
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

          <div className="mb-5 sm:mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs sm:text-sm flex items-center"
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
                className="flex-1 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm sm:text-base"
                placeholder="Add a tag"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-blue-700 text-sm sm:text-base min-w-[70px]"
              >
                Add
              </button>
            </div>
            {showTagError && (
              <p className="text-red-500 text-xs sm:text-sm mt-1">Tag already exists or is empty</p>
            )}
          </div>

          <div className="mb-5 sm:mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rating *
            </label>
            <div className="flex items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`text-xl sm:text-2xl px-1 ${
                    star <= rating ? 'text-yellow-400' : 'text-gray-300'
                  }`}
                >
                  <i className="fas fa-star"></i>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {language === 'hi' ? 'देश' : 'Country'} *
              </label>
              <select
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  setState('');
                  setDistrict('');
                }}
                className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm sm:text-base"
                required
              >
                <option value="">{language === 'hi' ? 'देश चुनें' : 'Select Country'}</option>
                {getAllCountries().map(countryOption => (
                  <option key={countryOption} value={countryOption}>{countryOption}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {language === 'hi' ? 'राज्य' : 'State'} *
              </label>
              {country === 'India' ? (
                <select
                  value={state}
                  onChange={(e) => {
                    setState(e.target.value);
                    setDistrict('');
                  }}
                  className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm sm:text-base"
                  required
                >
                  <option value="">{language === 'hi' ? 'राज्य चुनें' : 'Select State'}</option>
                  {getAllStates().map(stateOption => (
                    <option key={stateOption} value={stateOption}>{stateOption}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder={language === 'hi' ? 'राज्य दर्ज करें' : 'Enter state/province'}
                  className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm sm:text-base"
                  required
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {language === 'hi' ? 'जिला' : 'District'} *
              </label>
              {country === 'India' && state ? (
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm sm:text-base"
                  required
                >
                  <option value="">{language === 'hi' ? 'जिला चुनें' : 'Select District'}</option>
                  {getDistrictsForState(state).map(districtOption => (
                    <option key={districtOption} value={districtOption}>{districtOption}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder={language === 'hi' ? 'जिला दर्ज करें' : 'Enter district/city'}
                  className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm sm:text-base"
                  required
                />
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:justify-end gap-3 sm:gap-4">
            <button
              type="button"
              className="w-full sm:w-auto order-2 sm:order-1 px-4 sm:px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm sm:text-base"
              onClick={() => navigate(-1)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto order-1 sm:order-2 bg-blue-600 text-white px-4 sm:px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-sm sm:text-base"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center">
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
        ) : (
          <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
            <h1 className="text-2xl sm:text-3xl font-bold mb-6">{t.myDestinations || 'My Destinations'}</h1>
            
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
                <p className="text-red-700">{error}</p>
              </div>
            )}
            
            {showSuccessMessage && (
              <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
                <p className="text-green-700">{t.destinationDeleted || 'Destination deleted successfully!'}</p>
              </div>
            )}
            
            {fetchingUserDestinations ? (
              <div className="flex justify-center py-12">
                <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              </div>
            ) : userDestinations.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-lg text-gray-600 mb-4">{t.noDestinationsYet || "You haven't added any destinations yet."}</p>
                <button
                  onClick={() => setViewMode('add')}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  {t.addFirstDestination || 'Add Your First Destination'}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {userDestinations.map(destination => (
                  <div key={destination.id} className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <div className="h-48 bg-gray-200 relative">
                      {destination.images && destination.images[0] ? (
                        <img 
                          src={destination.images[0]} 
                          alt={destination.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.src = 'https://via.placeholder.com/500x300?text=No+Image';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-200">
                          <span className="text-gray-500">
                            <i className="fas fa-image text-3xl"></i>
                          </span>
                        </div>
                      )}
                      <div className="absolute top-2 right-2 bg-white bg-opacity-80 px-2 py-1 rounded text-sm">
                        <i className="fas fa-star text-yellow-500 mr-1"></i>
                        {destination.averageRating ? destination.averageRating.toFixed(1) : destination.rating.toFixed(1)}
                      </div>
                    </div>
                    
                    <div className="p-4">
                      <h3 className="text-xl font-semibold text-gray-800 mb-2 line-clamp-1">{destination.name}</h3>
                      
                      <div className="flex mb-3">
                        <span className="text-sm text-gray-600 mr-4">
                          <i className="fas fa-map-marker-alt text-red-500 mr-1"></i>
                          {destination.district}, {destination.state}
                        </span>
                        <span className="text-sm text-gray-600">
                          <i className="fas fa-tag text-blue-500 mr-1"></i>
                          {destination.category}
                        </span>
                      </div>
                      
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">{destination.description}</p>
                      
                      <div className="flex flex-wrap gap-2 mb-4">
                        {destination.tags && destination.tags.slice(0, 3).map((tag, index) => (
                          <span 
                            key={index} 
                            className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                        {destination.tags && destination.tags.length > 3 && (
                          <span className="text-gray-500 text-xs">+{destination.tags.length - 3} more</span>
                        )}
                      </div>
                      
                      <div className="flex justify-between mt-4">
                        <button
                          onClick={() => navigate(`/destination/${destination.id}`)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          <i className="fas fa-eye mr-1"></i> {t.view || 'View'}
                        </button>
                        
                        <div className="flex space-x-3">
                          <button
                            onClick={() => handleEditClick(destination)}
                            className="text-gray-600 hover:text-blue-600 text-sm font-medium"
                          >
                            <i className="fas fa-edit mr-1"></i> {t.edit || 'Edit'}
                          </button>
                          
                          <button
                            onClick={() => handleDeleteClick(destination)}
                            className="text-gray-600 hover:text-red-600 text-sm font-medium"
                          >
                            <i className="fas fa-trash-alt mr-1"></i> {t.delete || 'Delete'}
                          </button>
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-500 mt-3">
                        {t.added || 'Added'}: {new Date(destination.createdAt).toLocaleDateString()}
                        {destination.updatedAt && destination.updatedAt !== destination.createdAt && 
                          ` · ${t.updated || 'Updated'}: ${new Date(destination.updatedAt).toLocaleDateString()}`
                        }
                      </div>
                    </div>
                  </div>
                ))}
          </div>
        )}
      </div>
        )}
      </div>
      
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 sm:mx-auto">
            <h3 className="text-xl font-bold mb-4">{t.confirmDelete || 'Confirm Delete'}</h3>
            <p className="mb-6">
              {t.deleteDestinationConfirm || 'Are you sure you want to delete this destination?'} 
              <span className="font-semibold">{destinationToDelete?.name}</span>
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDestinationToDelete(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                disabled={loading}
              >
                {t.cancel || 'Cancel'}
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                disabled={loading}
              >
                {loading ? 
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t.deleting || 'Deleting...'}
                  </span> 
                  : t.delete || 'Delete'
                }
              </button>
            </div>
          </div>
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
