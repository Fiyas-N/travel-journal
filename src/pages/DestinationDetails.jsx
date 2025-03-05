import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { db, auth } from '../firebase/config'
import { doc, getDoc, updateDoc, collection, addDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore'
import PropTypes from 'prop-types'
import '../styles/DestinationDetails.css'
import Map from '../components/Map'
import Navbar from '../components/Navbar'

const DestinationDetails = ({ language, setLanguage, languages }) => {
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

  useEffect(() => {
    fetchPlaceDetails()
    fetchComments()
    checkUserLike()
  }, [id])

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
      setError('Failed to load destination details')
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
    if (!auth.currentUser) return
    try {
      const likesQuery = query(
        collection(db, 'likes'),
        where('placeId', '==', id),
        where('userId', '==', auth.currentUser.uid)
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

  const handleCommentSubmit = async (e) => {
    e.preventDefault()
    if (!auth.currentUser) {
      setShowLoginModal(true)
      return
    }

    try {
      // Get user's profile data to ensure we have the most up-to-date name
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid))
      const userData = userDoc.data()
      
      // Use user's name from profile, or display name from auth, or email as fallback
      const userName = userData?.name || auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'User'

      const newComment = {
        placeId: id,
        userId: auth.currentUser.uid,
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
    if (!auth.currentUser) {
      setShowLoginModal(true)
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
          where('userId', '==', auth.currentUser.uid)
        )
        const snapshot = await getDocs(likesQuery)
        snapshot.docs.forEach(async (doc) => {
          await doc.ref.delete()
        })
      } else {
        await addDoc(collection(db, 'likes'), {
          placeId: id,
          userId: auth.currentUser.uid,
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
    if (!auth.currentUser) {
      setShowLoginModal(true)
      return
    }
    setUserRating(value)
    setShowRatingModal(true)
  }

  const submitRating = async () => {
    try {
      const placeRef = doc(db, 'places', id)
      const currentRatings = place.ratings || {}
      currentRatings[auth.currentUser.uid] = userRating
      
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
    if (!auth.currentUser) return;

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
    if (!auth.currentUser) {
      setShowLoginModal(true)
      return
    }

    try {
      const commentRef = doc(db, 'comments', commentId)
      const commentDoc = await getDoc(commentRef)
      const currentLikes = commentDoc.data().likes || 0
      const likedBy = commentDoc.data().likedBy || []
      const userId = auth.currentUser.uid

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

  if (!place) return null

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
                <span>{place.location}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showRatingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Submit Your Rating</h3>
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
                Cancel
              </button>
              <button
                onClick={submitRating}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md whitespace-nowrap"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
              <h2 className="text-2xl font-bold mb-4">About Destination</h2>
              <p className="text-gray-600 leading-relaxed mb-6">
                {place.description}
              </p>
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
                <h2 className="text-2xl font-bold">Reviews & Comments</h2>
                <button
                  className="rounded-md whitespace-nowrap flex items-center text-blue-600"
                  onClick={handleLike}
                >
                  <i className={`${hasLiked ? 'fas' : 'far'} fa-heart mr-2`}></i>
                  {hasLiked ? 'Liked' : 'Like'}
                </button>
              </div>
              <div className="mb-6">
                <textarea
                  className="w-full p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:border-blue-500"
                  rows={3}
                  placeholder={language === 'hi' ? 'अपना अनुभव साझा करें...' : 'Share your experience...'}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                ></textarea>
                <button 
                  onClick={handleCommentSubmit}
                  className="rounded-md whitespace-nowrap mt-2 bg-blue-600 text-white px-6 py-2 hover:bg-blue-700"
                >
                  {language === 'hi' ? 'टिप्पणी पोस्ट करें' : 'Post Comment'}
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
                          {auth.currentUser && comment.userId === auth.currentUser.uid && (
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="text-red-500 hover:text-red-700 transition-colors p-1 rounded-full hover:bg-red-50"
                              title={language === 'hi' ? 'टिप्पणी हटाएं' : 'Delete comment'}
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
                          <i className={`${comment.likedBy?.includes(auth.currentUser?.uid) ? 'fas text-blue-600' : 'far'} fa-heart mr-1`}></i>
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
              <h2 className="text-xl font-bold mb-4">Photo Gallery</h2>
              {place.images && place.images.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    {place.images.slice(0, 4).map((image, index) => (
                      <div 
                        key={index}
                        className="relative aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => {
                          setSelectedImageIndex(index)
                          setShowImageModal(true)
                        }}
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
                      onClick={() => {
                        setSelectedImageIndex(0)
                        setShowImageModal(true)
                      }}
                      className="w-full mt-4 text-blue-600 hover:text-blue-700 text-sm"
                    >
                      {language === 'hi' 
                        ? `+${place.images.length - 4} और छवियां देखें`
                        : `View ${place.images.length - 4} more photos`}
                    </button>
                  )}
                </>
              ) : (
                <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <i className="fas fa-image text-3xl mb-2"></i>
                    <p>{language === 'hi' ? 'कोई छवि उपलब्ध नहीं है' : 'No images available'}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Image Modal/Lightbox */}
      {showImageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-6xl mx-auto">
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
            >
              <i className="fas fa-times text-2xl"></i>
            </button>
            
            <div className="relative aspect-video">
              <img
                src={place.images[selectedImageIndex]}
                alt={`${place.name} - Image ${selectedImageIndex + 1}`}
                className="w-full h-full object-contain"
              />
            </div>
            
            {place.images.length > 1 && (
              <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2">
                {place.images.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImageIndex(index)}
                    className={`w-2 h-2 rounded-full ${
                      index === selectedImageIndex ? 'bg-white' : 'bg-gray-400'
                    }`}
                  />
                ))}
              </div>
            )}
            
            {place.images.length > 1 && (
              <>
                <button
                  onClick={() => setSelectedImageIndex(prev => 
                    prev === 0 ? place.images.length - 1 : prev - 1
                  )}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300"
                >
                  <i className="fas fa-chevron-left text-2xl"></i>
                </button>
                <button
                  onClick={() => setSelectedImageIndex(prev => 
                    prev === place.images.length - 1 ? 0 : prev + 1
                  )}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300"
                >
                  <i className="fas fa-chevron-right text-2xl"></i>
                </button>
              </>
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
  languages: PropTypes.array.isRequired
}

export default DestinationDetails 