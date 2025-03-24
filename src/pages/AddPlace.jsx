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

  useEffect(() => {
    const fetchUserDestinations = async () => {
      if (!auth.currentUser) return;
      
      try {
        setLoading(true);
        const userDestinationsQuery = query(
          collection(db, 'places'),
          where('userId', '==', auth.currentUser.uid)
        );
        
        const snapshot = await getDocs(userDestinationsQuery);
        const destinations = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setUserDestinations(destinations);
        setError(null);
      } catch (err) {
        console.error('Error fetching user destinations:', err);
        setError('Failed to load your destinations. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchUserDestinations();
  }, []);

  useEffect(() => {
    if (state === 'India') {
      const stateDistricts = getDistrictsForState(state);
      if (district && !stateDistricts.includes(district)) {
        setDistrict('');
      }
    }
  }, [state]);

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

  const handleEditClick = (e, destination) => {
    e.stopPropagation();
    setDestinationToEdit(destination);
    setEditMode(true);
    
    setPlaceName(destination.name || '');
    setDescription(destination.description || '');
    setCategory(destination.category || '');
    setTags(destination.tags || []);
    setRating(destination.rating || 0);
    setDistrict(destination.district || '');
    setState(destination.state || '');
    setCountry(destination.country || '');
    setImages(destination.images || []);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteClick = (e, destination) => {
    e.stopPropagation();
    setDestinationToDelete(destination);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!destinationToDelete) return;
    
    try {
      setLoading(true);
      await deleteDoc(doc(db, 'places', destinationToDelete.id));
      
      setUserDestinations(prev => prev.filter(d => d.id !== destinationToDelete.id));
      
      setShowSuccessMessage(true);
      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 2000);
    } catch (err) {
      console.error('Error deleting destination:', err);
      setError('Failed to delete destination. Please try again.');
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
      setDestinationToDelete(null);
    }
  };

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

      // Check if a destination with the same name and location already exists
      const nameToCheck = placeName.trim().toLowerCase();
      const countryToCheck = country.trim().toLowerCase();
      const stateToCheck = state.trim().toLowerCase();
      const districtToCheck = district.trim().toLowerCase();
      
      // Only check for duplicates if we're adding a new place (not editing)
      if (!editMode) {
        // Get places by the current user to check for duplicates (more efficient than fetching all places)
        const placesQuery = query(
          collection(db, 'places'),
          where('userId', '==', auth.currentUser.uid)
        );
        
        const placesSnapshot = await getDocs(placesQuery);
        
        // Check if the user already has a place with the same name and location (case-insensitive)
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

  const renderUserDestinations = () => {
    if (loading && userDestinations.length === 0) {
      return (
        <div className="flex justify-center py-8">
          <LoadingScreen language={language} type="inline" size="small" message={language === 'hi' ? 'आपके स्थान लोड हो रहे हैं...' : 'Loading your destinations...'} />
        </div>
      );
    }

    if (error && userDestinations.length === 0) {
      return <div className="text-center py-4 text-red-500">{error}</div>;
    }

    if (userDestinations.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          {language === 'hi' 
            ? 'आपने अभी तक कोई स्थान नहीं जोड़ा है'
            : 'You haven\'t added any destinations yet'}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {userDestinations.map((destination, index) => (
          <motion.div 
            key={destination.id} 
            className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 cursor-pointer"
            onClick={() => navigate(`/destination/${destination.id}`)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ 
              duration: 0.4, 
              delay: index * 0.1,
              ease: "easeOut" 
            }}
            whileHover={{ 
              scale: 1.03,
              transition: { duration: 0.2 }
            }}
          >
            <div className="relative h-48 overflow-hidden group">
              <img 
                src={destination.images?.[0] || destination.image} 
                alt={destination.name} 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              {(destination.likes || 0) > 100 && (
                <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1">
                  <i className="fas fa-fire"></i>
                  <span>{language === 'hi' ? 'ट्रेंडिंग' : 'Trending'}</span>
                </div>
              )}
              
              <div className="absolute top-2 right-2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <button
                  onClick={(e) => handleEditClick(e, destination)}
                  className="bg-white p-2 rounded-full shadow-md hover:bg-blue-50 transition-colors"
                  aria-label="Edit"
                >
                  <i className="fas fa-edit text-blue-600"></i>
                </button>
                <button
                  onClick={(e) => handleDeleteClick(e, destination)}
                  className="bg-white p-2 rounded-full shadow-md hover:bg-red-50 transition-colors"
                  aria-label="Delete"
                >
                  <i className="fas fa-trash-alt text-red-600"></i>
                </button>
              </div>
            </div>
            <div className="p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{destination.name}</h3>
              <p className="text-gray-600 mb-4 line-clamp-2 whitespace-pre-line">{destination.description}</p>
              <div className="flex items-center gap-1 text-gray-700">
                <i className="fas fa-star text-yellow-400"></i>
                <span className="font-semibold">{(destination.averageRating || destination.rating || 0).toFixed(1)}</span>
                <span className="text-gray-500">({getReviewCount(destination)} reviews)</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    );
  };

  const renderDeleteModal = () => {
    if (!showDeleteModal) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <motion.div 
          className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <h3 className="text-xl font-bold mb-4">
            {language === 'hi' ? 'स्थान हटाएं' : 'Delete Destination'}
          </h3>
          <p className="mb-6">
            {language === 'hi' 
              ? `क्या आप वाकई "${destinationToDelete?.name}" को हटाना चाहते हैं?`
              : `Are you sure you want to delete "${destinationToDelete?.name}"?`}
          </p>
          <div className="flex justify-end space-x-4">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              {language === 'hi' ? 'रद्द करें' : 'Cancel'}
            </button>
            <button
              onClick={confirmDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center">
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  {language === 'hi' ? 'हटा रहा है...' : 'Deleting...'}
                </span>
              ) : (
                language === 'hi' ? 'हटाएं' : 'Delete'
              )}
            </button>
          </div>
        </motion.div>
      </div>
    );
  };

  const formTitle = editMode 
    ? (language === 'hi' ? 'स्थान संपादित करें' : 'Edit Destination') 
    : (language === 'hi' ? 'नया स्थान जोड़ें' : 'Add New Destination');

  const renderCancelEditButton = () => {
    if (!editMode) return null;
    
    return (
      <button
        type="button"
        onClick={resetForm}
        className="ml-4 text-blue-600 hover:text-blue-800"
      >
        {language === 'hi' ? 'संपादन रद्द करें' : 'Cancel Edit'}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {loading && (
        <LoadingScreen 
          language={language}
          type="overlay"
          message={editMode 
            ? (language === 'hi' ? 'स्थान अपडेट हो रहा है...' : 'Updating place...') 
            : (language === 'hi' ? 'स्थान जोड़ा जा रहा है...' : 'Adding place...')}
        />
      )}
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
        <div className="mb-8 flex items-center">
          <h1 className="text-3xl font-bold text-gray-900">
            {formTitle}
          </h1>
          {renderCancelEditButton()}
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
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              placeholder="Describe this place in detail. Include what makes it special, best times to visit, etc."
              required
            />
            <p className="mt-1 text-sm text-gray-500">
              {language === 'hi' 
                ? 'स्थान का विस्तृत विवरण दें। आप पंक्ति विराम (Enter) का उपयोग कर सकते हैं।'
                : 'Provide a detailed description. You can use line breaks (Enter).'}
            </p>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  required
                />
              )}
            </div>
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

        <motion.div 
          className="mt-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <motion.h2 
            className="text-2xl font-bold mb-6"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            {language === 'hi' ? 'आपके द्वारा जोड़े गए स्थान' : 'Your Added Destinations'}
          </motion.h2>
          {renderUserDestinations()}
        </motion.div>

        {renderDeleteModal()}

        {showSuccessMessage && (
          <div className="fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg">
            {editMode 
              ? (language === 'hi' ? 'स्थान सफलतापूर्वक अपडेट किया गया!' : 'Destination updated successfully!') 
              : (language === 'hi' ? 'स्थान सफलतापूर्वक जोड़ा गया!' : 'Destination added successfully!')}
          </div>
        )}
      </div>
    </div>
  )
}

AddPlace.propTypes = {
  language: PropTypes.string.isRequired,
  setLanguage: PropTypes.func.isRequired,
  languages: PropTypes.array.isRequired
}

export default AddPlace