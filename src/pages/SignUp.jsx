import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { auth, db, storage } from '../firebase/config'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import PropTypes from 'prop-types'
import translations from '../utils/translations'

const SignUp = ({ language }) => {
  // Get translations for the current language
  const t = translations[language] || translations.en;

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    location: '',
    password: '',
    confirmPassword: '',
    preferences: []
  })
  const [profileImage, setProfileImage] = useState(null)
  const [previewURL, setPreviewURL] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef(null)
  const navigate = useNavigate()

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handlePreferenceChange = (e) => {
    const { value, checked } = e.target
    setFormData(prev => ({
      ...prev,
      preferences: checked 
        ? [...prev.preferences, value]
        : prev.preferences.filter(pref => pref !== value)
    }))
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setProfileImage(file)
      // Create preview URL
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewURL(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleBrowseClick = () => {
    fileInputRef.current.click()
  }

  const validateForm = () => {
    // Check all required fields
    if (!formData.name.trim()) {
      setError(t.nameRequired || 'Name is required')
      return false
    }
    
    if (!formData.email.trim()) {
      setError(t.emailRequired || 'Email is required')
      return false
    }
    
    if (!formData.phone.trim()) {
      setError(t.phoneRequired || 'Phone number is required')
      return false
    }
    
    if (!formData.location.trim()) {
      setError(t.locationRequired || 'Location is required')
      return false
    }
    
    if (formData.preferences.length === 0) {
      setError(t.preferencesRequired || 'Please select at least one travel preference')
      return false
    }
    
    if (!formData.password) {
      setError(t.passwordRequired || 'Password is required')
      return false
    }
    
    if (formData.password.length < 6) {
      setError(t.passwordLength || 'Password must be at least 6 characters')
      return false
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError(t.passwordsDoNotMatch || 'Passwords do not match')
      return false
    }
    
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Validate the form
    if (!validateForm()) {
      setLoading(false)
      return
    }

    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        formData.email, 
        formData.password
      )

      // Upload profile image if available
      let profileImageUrl = null
      if (profileImage) {
        const storageRef = ref(storage, `profile-images/${userCredential.user.uid}`)
        await uploadBytes(storageRef, profileImage)
        profileImageUrl = await getDownloadURL(storageRef)
        
        // Update user profile with photo URL
        await updateProfile(userCredential.user, {
          displayName: formData.name,
          photoURL: profileImageUrl
        })
      }

      // Store additional user data in Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        location: formData.location,
        profileImageUrl: profileImageUrl || 'https://public.readdy.ai/ai/img_res/4c15f5e4c75bf1c2c613684d79bd37c4.jpg',
        preferences: formData.preferences,
        createdAt: new Date().toISOString()
      })

      navigate('/profile')
    } catch (err) {
      setError(err.message)
      console.error('Sign up error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>{t.signUp || 'Sign Up'}</h2>
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group profile-image-upload">
            <label>{t.profilePicture || 'Profile Picture'} <span className="text-gray-500 text-xs font-normal">({t.optional || 'Optional'})</span></label>
            <div className="profile-image-container">
              {previewURL ? (
                <img 
                  src={previewURL} 
                  alt={t.profilePreview || 'Profile preview'} 
                  className="profile-image-preview" 
                />
              ) : (
                <div className="profile-image-placeholder">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12">
                    <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleImageChange}
                style={{ display: 'none' }}
              />
              <button 
                type="button" 
                onClick={handleBrowseClick}
                className="upload-button"
              >
                {t.choosePhoto || 'Choose Photo'}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="name">{t.name || 'Name'}</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">{t.email || 'Email'}</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">{t.phone || 'Phone Number'}</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="location">{t.location || 'Location'}</label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>{t.travelPreferences || 'Travel Preferences'}</label>
            <div className="preferences-grid">
              {['Adventure', 'Culture', 'Nature', 'Food', 'Relaxation'].map(pref => (
                <label key={pref} className="preference-item">
                  <input
                    type="checkbox"
                    value={pref}
                    checked={formData.preferences.includes(pref)}
                    onChange={handlePreferenceChange}
                  />
                  {t[pref.toLowerCase()] || pref}
                </label>
              ))}
            </div>
            {formData.preferences.length === 0 && (
              <small className="text-red-500">{t.preferencesRequired || 'Please select at least one preference'}</small>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password">{t.password || 'Password'}</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">{t.confirmPassword || 'Confirm Password'}</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
          </div>

          <button type="submit" disabled={loading} className="signup-button">
            {loading ? (t.creatingAccount || 'Creating Account...') : (t.signUp || 'Sign Up')}
          </button>
        </form>

        <p className="auth-redirect">
          {t.alreadyHaveAccount || 'Already have an account?'} <Link to="/signin">{t.signIn || 'Sign In'}</Link>
        </p>
      </div>
    </div>
  )
}

SignUp.propTypes = {
  language: PropTypes.string.isRequired
}

export default SignUp 