import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { db, auth } from '../firebase/config'
import { doc, getDoc, updateDoc, collection, addDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore'
import PropTypes from 'prop-types'
import '../styles/DestinationDetails.css'
import Map from '../components/Map'
import Navbar from '../components/Navbar'
import { getReviewCount } from '../utils/ratings'
import translations from '../utils/translations'
import LoadingScreen from '../components/LoadingScreen'

const DestinationDetails = ({ language, setLanguage, languages, user }) => {
  const navigate = useNavigate()
  const { id } = useParams()
  const [place, setPlace] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeImage, setActiveImage] = useState(0)
  const [comment, setComment] = useState('')
  const [comments, setComments] = useState([])
  const [userRating, setUserRating] = useState(0)
  const [hasLiked, setHasLiked] = useState(false)
  const [showFullDescription, setShowFullDescription] = useState(false)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [rating, setRating] = useState(4.8)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showImageModal, setShowImageModal] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [imageLoadError, setImageLoadError] = useState({})
  const [imageLoading, setImageLoading] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showShortcutsInfo, setShowShortcutsInfo] = useState(false)

  // Get translations for the current language
  const t = translations[language] || translations.en

  useEffect(() => {
    fetchPlaceDetails()
    fetchComments()
    if (user) {
      checkUserLike()
    }
  }, [id, user])

  // Handle keyboard navigation for image modal
  useEffect(() => {
    if (!showImageModal) return;
    
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        // Don't manually close modal on ESC if in fullscreen mode
        // The fullscreen exit will be handled by the browser, and our fullscreen change listener
        if (!isFullscreen) {
          setShowImageModal(false);
        }
      } else if (e.key === 'ArrowRight' && place?.images?.length > 1) {
        const nextIndex = selectedImageIndex === place.images.length - 1 ? 0 : selectedImageIndex + 1;
        changeModalImage(nextIndex);
      } else if (e.key === 'ArrowLeft' && place?.images?.length > 1) {
        const prevIndex = selectedImageIndex === 0 ? place.images.length - 1 : selectedImageIndex - 1;
        changeModalImage(prevIndex);
      } else if (e.key === 'f' || e.key === 'F') {
        // Toggle fullscreen with F key
        toggleFullscreen();
      }
    };
    
    // Handle mouse wheel for image navigation
    const handleWheel = (e) => {
      if (place?.images?.length <= 1) return;
      
      // Prevent default to avoid page scrolling
      e.preventDefault();
      
      if (e.deltaY > 0 || e.deltaX > 0) {
        // Scroll down or right - next image
        const nextIndex = selectedImageIndex === place.images.length - 1 ? 0 : selectedImageIndex + 1;
        changeModalImage(nextIndex);
      } else if (e.deltaY < 0 || e.deltaX < 0) {
        // Scroll up or left - previous image
        const prevIndex = selectedImageIndex === 0 ? place.images.length - 1 : selectedImageIndex - 1;
        changeModalImage(prevIndex);
      }
    };
    
    // Handle touch events for swipe gestures
    let touchStartX = 0;
    let touchStartY = 0;
    
    const handleTouchStart = (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };
    
    const handleTouchEnd = (e) => {
      if (place?.images?.length <= 1) return;
      
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      
      const diffX = touchStartX - touchEndX;
      const diffY = touchStartY - touchEndY;
      
      // Only handle horizontal swipes that are significant enough (> 50px)
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
        if (diffX > 0) {
          // Swipe left - next image
          const nextIndex = selectedImageIndex === place.images.length - 1 ? 0 : selectedImageIndex + 1;
          changeModalImage(nextIndex);
        } else {
          // Swipe right - previous image
          const prevIndex = selectedImageIndex === 0 ? place.images.length - 1 : selectedImageIndex - 1;
          changeModalImage(prevIndex);
        }
      }
    };
    
    const modalElement = document.getElementById('imageModalContainer');
    if (modalElement) {
      modalElement.addEventListener('wheel', handleWheel, { passive: false });
      modalElement.addEventListener('touchstart', handleTouchStart, { passive: true });
      modalElement.addEventListener('touchend', handleTouchEnd, { passive: true });
    }
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (modalElement) {
        modalElement.removeEventListener('wheel', handleWheel);
        modalElement.removeEventListener('touchstart', handleTouchStart);
        modalElement.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [showImageModal, place?.images?.length, selectedImageIndex, isFullscreen]);

  // Redirect unauthorized users to login page
  useEffect(() => {
    if (!user) {
      navigate('/auth')
    }
  }, [user, navigate])

  const fetchPlaceDetails = async () => {
    try {
      const placeDoc = await getDoc(doc(db, 'places', id))
      if (placeDoc.exists()) {
        setPlace({ id: placeDoc.id, ...placeDoc.data() })
      } else {
        setError('Place not found')
      }
      setLoading(false)
    } catch (err) {
      console.error('Error fetching place:', err)
      setError('Failed to load destination details. Please try again.')
      setLoading(false)
    }
  }

  const fetchComments = async () => {
    try {
      const commentsQuery = query(
        collection(db, 'comments'),
        where('placeId', '==', id)
      )
      const snapshot = await getDocs(commentsQuery)
      const commentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setComments(commentsData)
    } catch (err) {
      console.error('Error fetching comments:', err)
    }
  }

  const checkUserLike = async () => {
    if (!user) return
    try {
      const likesQuery = query(
        collection(db, 'likes'),
        where('placeId', '==', id),
        where('userId', '==', user.uid)
      )
      const snapshot = await getDocs(likesQuery)
      setHasLiked(!snapshot.empty)
    } catch (err) {
      console.error('Error checking like status:', err)
    }
  }

  const handleImageChange = (index) => {
    setActiveImage(index)
  }

  // Updated function to open image modal
  const openImageModal = (index) => {
    setSelectedImageIndex(index);
    setImageLoading(true);
    setShowImageModal(true);
    setShowShortcutsInfo(true);
    
    // Hide the shortcuts info after 5 seconds
    setTimeout(() => {
      setShowShortcutsInfo(false);
    }, 5000);
  }
  
  // Updated function to change images in the modal
  const changeModalImage = (index) => {
    setImageLoading(true);
    setSelectedImageIndex(index);
  }

  // Handle fullscreen mode
  const toggleFullscreen = () => {
    if (!document.fullscreenElement && 
        !document.mozFullScreenElement && 
        !document.webkitFullscreenElement && 
        !document.msFullscreenElement) {
      // Enter fullscreen mode
      const modalElement = document.getElementById('imageModalContainer');
      if (modalElement) {
        if (modalElement.requestFullscreen) {
          modalElement.requestFullscreen();
        } else if (modalElement.msRequestFullscreen) {
          modalElement.msRequestFullscreen();
        } else if (modalElement.mozRequestFullScreen) {
          modalElement.mozRequestFullScreen();
        } else if (modalElement.webkitRequestFullscreen) {
          modalElement.webkitRequestFullscreen();
        }
        setIsFullscreen(true);
      }
    } else {
      // Exit fullscreen mode
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
      setIsFullscreen(false);
    }
  }

  // Listen to fullscreen changes from outside our button (like Escape key)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        !!(document.fullscreenElement || 
          document.mozFullScreenElement || 
          document.webkitFullscreenElement || 
          document.msFullscreenElement)
      );
    };

    // Add the animation style for fade-out
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeOut {
        0%, 20% { opacity: 1; }
        90%, 100% { opacity: 0; }
      }
      .animate-fade-out {
        animation: fadeOut 5s forwards;
      }
    `;
    document.head.appendChild(style);

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      document.head.removeChild(style);
    };
  }, []);

  const handleCommentSubmit = async (e) => {
    e.preventDefault()
    if (!user) {
      navigate('/auth')
      return
    }

    try {
      // Get user's profile data to ensure we have the most up-to-date name
      const userDoc = await getDoc(doc(db, 'users', user.uid))
      const userData = userDoc.data()
      
      // Use user's name from profile, or display name from auth, or email as fallback
      const userName = userData?.name || user.displayName || user.email?.split('@')[0] || 'User'

      const newComment = {
        placeId: id,
        userId: user.uid,
        userName: userName,
        userImage: userData?.profileImage || null, // Include user's profile image if available
        text: comment,
        likes: 0,
        createdAt: new Date().toISOString()
      }

      await addDoc(collection(db, 'comments'), newComment)
      setComment('')
      fetchComments() // Refresh comments
    } catch (err) {
      console.error('Error adding comment:', err)
      setError('Failed to post comment. Please try again.')
    }
  }

  const handleLike = async () => {
    if (!user) {
      navigate('/auth')
      return
    }

    try {
      const placeRef = doc(db, 'places', id)
      await updateDoc(placeRef, {
        likes: hasLiked ? (place.likes || 0) - 1 : (place.likes || 0) + 1
      })
      
      if (hasLiked) {
        const likesQuery = query(
          collection(db, 'likes'),
          where('placeId', '==', id),
          where('userId', '==', user.uid)
        )
        const snapshot = await getDocs(likesQuery)
        snapshot.docs.forEach(async (doc) => {
          await doc.ref.delete()
        })
      } else {
        await addDoc(collection(db, 'likes'), {
          placeId: id,
          userId: user.uid,
          createdAt: new Date().toISOString()
        })
      }

      setHasLiked(!hasLiked)
      setPlace(prev => ({
        ...prev,
        likes: hasLiked ? (prev.likes || 0) - 1 : (prev.likes || 0) + 1
      }))
    } catch (err) {
      console.error('Error updating like:', err)
    }
  }

  const handleRating = (value) => {
    if (!user) {
      setShowLoginModal(true)
      return
    }
    setUserRating(value)
    setShowRatingModal(true)
  }

  const submitRating = async () => {
    if (!user) return
    
    try {
      const placeRef = doc(db, 'places', id)
      const currentRatings = place.ratings || {}
      currentRatings[user.uid] = userRating
      
      // Calculate new average rating
      const ratings = Object.values(currentRatings)
      const newRating = ratings.reduce((a, b) => a + b, 0) / ratings.length

      await updateDoc(placeRef, {
        ratings: currentRatings,
        averageRating: newRating
      })

      setPlace(prev => ({
        ...prev,
        ratings: currentRatings,
        averageRating: newRating
      }))
      setShowRatingModal(false)
    } catch (err) {
      console.error('Error submitting rating:', err)
    }
  }

  const handleDeleteComment = async (commentId) => {
    if (!user) return;
    
    try {
      await deleteDoc(doc(db, 'comments', commentId));
      // Refresh comments after deletion
      fetchComments();
    } catch (err) {
      console.error('Error deleting comment:', err);
      setError('Failed to delete comment. Please try again.');
    }
  };

  const handleCommentLike = async (commentId) => {
    if (!user) {
      setShowLoginModal(true)
      return
    }

    try {
      const commentRef = doc(db, 'comments', commentId)
      const commentDoc = await getDoc(commentRef)
      const currentLikes = commentDoc.data().likes || 0
      const likedBy = commentDoc.data().likedBy || []
      const userId = user.uid

      if (likedBy.includes(userId)) {
        // Unlike
        await updateDoc(commentRef, {
          likes: currentLikes - 1,
          likedBy: likedBy.filter(id => id !== userId)
        })
      } else {
        // Like
        await updateDoc(commentRef, {
          likes: currentLikes + 1,
          likedBy: [...likedBy, userId]
        })
      }

      // Refresh comments to update UI
      fetchComments()
    } catch (err) {
      console.error('Error updating comment like:', err)
      setError('Failed to update like. Please try again.')
    }
  }

  // Helper function to get translated category name
  const getTranslatedCategory = (category) => {
    if (!category) return '';
    return t[category] || category;
  }

  // Helper function to get translated content
  const getTranslatedContent = (content) => {
    if (!content) return '';
    return content;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar 
          language={language}
          setLanguage={setLanguage}
          languages={languages}
          user={user}
        />
        <LoadingScreen language={language} />
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

  if (!place) return null

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
        <div className="relative h-[500px]">
          <img
            src={place.images?.[0] || ''}
            className="w-full h-full object-cover"
            alt={place.name}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent"></div>
          <div className="absolute bottom-0 left-0 p-8 text-white max-w-2xl">
            <h1 className="text-5xl font-bold mb-4">{place.name}</h1>
            <div className="flex items-center space-x-4 mb-4">
              <div className="flex items-center space-x-2">
                <div className="flex items-center">
                  <i className="fas fa-star text-yellow-400 mr-1"></i>
                  <span className="text-xl">{place.averageRating?.toFixed(1) || '0.0'}</span>
                </div>
                <div className="flex items-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => handleRating(star)}
                      className="text-xl px-1 focus:outline-none bg-transparent"
                    >
                      <i className={`${userRating >= star ? 'fas' : 'far'} fa-star text-yellow-400 [text-shadow:_0_1px_2px_rgba(0,0,0,0.3)]`}></i>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center">
                <i className="fas fa-map-marker-alt mr-2"></i>
                <span>{place.district}, {place.state}, {place.country}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showRatingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-xl font-bold mb-4">{t.submitReview}</h3>
            <div className="flex justify-center mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <i
                  key={star}
                  className={`${userRating >= star ? 'fas' : 'far'} fa-star text-yellow-400 text-2xl mx-1`}
                ></i>
              ))}
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowRatingModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 rounded-md whitespace-nowrap"
              >
                {t.cancel}
              </button>
              <button
                onClick={submitRating}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md whitespace-nowrap"
              >
                {t.submit}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
              <h2 className="text-2xl font-bold mb-4">{t.description}</h2>
              <div className="text-gray-700 mb-6 whitespace-pre-line">
                {getTranslatedContent(place.description)}
              </div>
              <div className="flex flex-wrap gap-2 mb-6">
                {place.tags?.map((tag, index) => (
                  <span key={index} className="px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-sm">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">{t.reviews}</h2>
                <button
                  className="rounded-md whitespace-nowrap flex items-center text-blue-600"
                  onClick={handleLike}
                >
                  <i className={`${hasLiked ? 'fas' : 'far'} fa-heart mr-2`}></i>
                  {hasLiked ? t.liked || 'Liked' : t.like || 'Like'}
                </button>
              </div>
              <div className="mb-6">
                <textarea
                  className="w-full p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:border-blue-500"
                  rows={3}
                  placeholder={t.writeReview}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                ></textarea>
                <button 
                  onClick={handleCommentSubmit}
                  className="rounded-md whitespace-nowrap mt-2 bg-blue-600 text-white px-6 py-2 hover:bg-blue-700"
                >
                  {t.submitReview}
                </button>
              </div>
              <div className="space-y-6">
                {comments.map(comment => (
                  <div key={comment.id} className="flex space-x-4">
                    <img 
                      src={comment.userImage || 'https://public.readdy.ai/ai/img_res/c2e32c0833fb59a69945f4c0b2ca442d.jpg'} 
                      alt={comment.userName} 
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h3 className="font-semibold">{comment.userName}</h3>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">
                            {new Date(comment.createdAt).toLocaleDateString()}
                          </span>
                          {user && comment.userId === user.uid && (
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="text-red-500 hover:text-red-700 transition-colors p-1 rounded-full hover:bg-red-50"
                              title={t.delete}
                            >
                              <i className="fas fa-trash-alt text-sm"></i>
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-gray-600 mt-1">{comment.text}</p>
                      <div className="flex items-center mt-2 text-sm text-gray-500">
                        <button 
                          onClick={() => handleCommentLike(comment.id)}
                          className="flex items-center hover:text-blue-600 transition-colors"
                        >
                          <i className={`${comment.likedBy?.includes(user?.uid) ? 'fas text-blue-600' : 'far'} fa-heart mr-1`}></i>
                          {comment.likes || 0}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
              <h2 className="text-xl font-bold mb-4">{t.location}</h2>
              <div className="text-gray-700 mb-4">
                <div className="flex items-center mb-2">
                  <i className="fas fa-map-marker-alt text-red-500 mr-2"></i>
                  <span>{place.district}, {place.state}, {place.country}</span>
                </div>
                <div className="flex items-center mb-2">
                  <i className="fas fa-tag text-blue-500 mr-2"></i>
                  <span>{getTranslatedCategory(place.category)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
              <h2 className="text-xl font-bold mb-4">{t.imageNotAvailable ? t.imageNotAvailable.replace('not available', 'Gallery') : 'Photo Gallery'}</h2>
              {place.images && place.images.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    {place.images.slice(0, 4).map((image, index) => (
                      <div 
                        key={index}
                        className="relative aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => openImageModal(index)}
                      >
                        <img
                          src={image}
                          alt={`${place.name} - Image ${index + 1}`}
                          className="w-full h-full object-cover"
                          onError={() => {
                            setImageLoadError(prev => ({ ...prev, [index]: true }))
                          }}
                        />
                        {imageLoadError[index] && (
                          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                            <i className="fas fa-image text-gray-400 text-3xl"></i>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {place.images.length > 4 && (
                    <button
                      onClick={() => openImageModal(0)}
                      className="w-full mt-4 text-blue-600 hover:text-blue-700 text-sm"
                    >
                      {t.viewAll ? `${t.viewAll} ${place.images.length - 4} ${t.more || 'more photos'}` : `View ${place.images.length - 4} more photos`}
                    </button>
                  )}
                </>
              ) : (
                <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <i className="fas fa-image text-3xl mb-2"></i>
                    <p>{t.imageNotAvailable}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Image Modal/Lightbox */}
      {showImageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center p-4" id="imageModalContainer">
          <div className={`relative w-full max-w-6xl mx-auto h-full max-h-[90vh] flex flex-col ${isFullscreen ? 'max-w-none max-h-none' : ''}`}>
            {/* Header with controls and image counter - improved styling */}
            <div className="flex justify-between items-center py-3 px-4 text-white mb-3 bg-black bg-opacity-50 backdrop-blur-sm rounded-t-lg">
              <div className="flex items-center">
                <i className="fas fa-images mr-2 text-blue-300"></i>
                <div className="text-sm md:text-base font-medium">
                  <span className="bg-blue-900 bg-opacity-70 px-2 py-1 rounded">
                    {selectedImageIndex + 1} / {place.images.length}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {/* Fullscreen toggle button */}
                <button
                  onClick={toggleFullscreen}
                  className="text-white hover:text-blue-400 z-10 px-3 py-2 transition-all bg-black bg-opacity-70 hover:bg-opacity-90 rounded-lg flex items-center justify-center border border-white border-opacity-30"
                  aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                  title={isFullscreen ? "Exit fullscreen (F)" : "Enter fullscreen (F)"}
                >
                  <i className={`fas ${isFullscreen ? 'fa-compress' : 'fa-expand'} mr-1.5`}></i>
                  <span className="text-sm hidden sm:inline">{isFullscreen ? (language === 'hi' ? 'पूर्ण स्क्रीन से बाहर निकलें' : 'Exit Fullscreen') : (language === 'hi' ? 'पूर्ण स्क्रीन' : 'Fullscreen')}</span>
                </button>
                {/* Close button */}
                <button
                  onClick={() => setShowImageModal(false)}
                  className="text-white hover:text-red-400 z-10 px-3 py-2 transition-all bg-black bg-opacity-70 hover:bg-opacity-90 rounded-lg flex items-center justify-center border border-white border-opacity-30"
                  aria-label="Close image viewer"
                  title="Close (ESC)"
                >
                  <i className="fas fa-times mr-1.5"></i>
                  <span className="text-sm hidden sm:inline">{language === 'hi' ? 'बंद करें' : 'Close'}</span>
                </button>
              </div>
            </div>
            
            {/* Main image container with improved design */}
            <div className={`relative flex-1 overflow-hidden flex items-center justify-center ${isFullscreen ? 'h-screen' : ''}`}>
              {imageLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
                  <LoadingScreen language={language} type="overlay" size="small" message={language === 'hi' ? 'छवि लोड हो रही है...' : 'Loading image...'} />
                </div>
              )}
              <img
                src={place.images[selectedImageIndex]}
                alt={`${place.name} - Image ${selectedImageIndex + 1}`}
                className={`max-w-full max-h-full object-contain transition-transform duration-200 ${isFullscreen ? 'scale-[0.98]' : ''}`}
                onLoad={() => setImageLoading(false)}
                onError={(e) => {
                  setImageLoading(false);
                  setImageLoadError(prev => ({ ...prev, [selectedImageIndex]: true }));
                  e.target.src = 'https://via.placeholder.com/800x600?text=Image+Not+Available';
                }}
              />
              {imageLoadError[selectedImageIndex] && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
                  <div className="text-white text-center p-4">
                    <i className="fas fa-exclamation-circle text-4xl mb-2"></i>
                    <p>{language === 'hi' ? 'छवि लोड करने में समस्या हुई' : 'Error loading image'}</p>
                  </div>
                </div>
              )}
              
              {/* Keyboard shortcuts info (only shown briefly on open) */}
              {showShortcutsInfo && (
                <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white text-xs md:text-sm px-4 py-3 rounded-lg pointer-events-none transition-opacity duration-300">
                  <div className="text-center mb-2">
                    <span className="font-medium">{language === 'hi' ? 'कीबोर्ड शॉर्टकट' : 'Keyboard Shortcuts'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div className="flex items-center">
                      <span className="bg-white bg-opacity-20 rounded px-1.5 py-0.5 mr-2">←</span>
                      <span>{language === 'hi' ? 'पिछला चित्र' : 'Previous image'}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="bg-white bg-opacity-20 rounded px-1.5 py-0.5 mr-2">→</span>
                      <span>{language === 'hi' ? 'अगला चित्र' : 'Next image'}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="bg-white bg-opacity-20 rounded px-1.5 py-0.5 mr-2">F</span>
                      <span>{language === 'hi' ? 'फुलस्क्रीन टॉगल' : 'Toggle fullscreen'}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="bg-white bg-opacity-20 rounded px-1.5 py-0.5 mr-2">ESC</span>
                      <span>{language === 'hi' ? 'बंद करें' : 'Close viewer'}</span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Navigation arrows with improved design */}
              {place.images.length > 1 && (
                <>
                  <button
                    onClick={() => {
                      const prevIndex = selectedImageIndex === 0 ? place.images.length - 1 : selectedImageIndex - 1;
                      changeModalImage(prevIndex);
                    }}
                    className="absolute left-2 md:left-4 p-3 md:p-4 rounded-full bg-black bg-opacity-70 hover:bg-opacity-90 text-white transition-all transform hover:scale-110 border border-white border-opacity-30"
                    aria-label="Previous image"
                    title="Previous image (Left arrow)"
                  >
                    <i className="fas fa-chevron-left text-xl md:text-2xl"></i>
                  </button>
                  <button
                    onClick={() => {
                      const nextIndex = selectedImageIndex === place.images.length - 1 ? 0 : selectedImageIndex + 1;
                      changeModalImage(nextIndex);
                    }}
                    className="absolute right-2 md:right-4 p-3 md:p-4 rounded-full bg-black bg-opacity-70 hover:bg-opacity-90 text-white transition-all transform hover:scale-110 border border-white border-opacity-30"
                    aria-label="Next image"
                    title="Next image (Right arrow)"
                  >
                    <i className="fas fa-chevron-right text-xl md:text-2xl"></i>
                  </button>
                </>
              )}
            </div>
            
            {/* Thumbnail strip - hidden in fullscreen mode */}
            {place.images.length > 1 && !isFullscreen && (
              <div className="pt-4 px-4 flex justify-center">
                <div className="flex overflow-x-auto gap-2 pb-2 max-w-full">
                  {place.images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => changeModalImage(index)}
                      className={`flex-shrink-0 w-16 h-16 rounded-md overflow-hidden transition-all ${
                        index === selectedImageIndex 
                          ? 'border-2 border-blue-500 opacity-100 scale-105' 
                          : 'border border-gray-600 opacity-60 hover:opacity-90'
                      }`}
                      aria-label={`View image ${index + 1}`}
                    >
                      <img 
                        src={image} 
                        alt={`Thumbnail ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Mobile-friendly dot indicators - hidden in fullscreen mode */}
            {place.images.length > 1 && !isFullscreen && (
              <div className="md:hidden pt-2 pb-4 flex justify-center">
                <div className="flex gap-2">
                  {place.images.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => changeModalImage(index)}
                      className={`w-2.5 h-2.5 rounded-full transition-all ${
                        index === selectedImageIndex ? 'bg-blue-500 scale-110' : 'bg-gray-400'
                      }`}
                      aria-label={`Go to image ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

DestinationDetails.propTypes = {
  language: PropTypes.string.isRequired,
  setLanguage: PropTypes.func.isRequired,
  languages: PropTypes.array.isRequired,
  user: PropTypes.object
}

export default DestinationDetails