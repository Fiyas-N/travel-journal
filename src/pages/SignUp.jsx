import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { auth, db, generateRecaptchaVerifier } from '../firebase/config'
import { 
  createUserWithEmailAndPassword, 
  updateProfile, 
  PhoneAuthProvider, 
  signInWithPhoneNumber,
  linkWithCredential 
} from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import PropTypes from 'prop-types'
import translations from '../utils/translations'
import PhoneInput, { getCountryCallingCode } from 'react-phone-number-input'
import { isPossiblePhoneNumber, isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js'
import 'react-phone-number-input/style.css'

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
  const recaptchaContainerRef = useRef(null)
  
  // New states for OTP verification
  const [phoneVerificationStep, setPhoneVerificationStep] = useState('not_started')
  const [verificationId, setVerificationId] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [phoneNumberValid, setPhoneNumberValid] = useState(false)
  const [recaptchaVerifier, setRecaptchaVerifier] = useState(null)
  const [verificationMessage, setVerificationMessage] = useState('')
  
  // New state for country detection
  const [defaultCountry, setDefaultCountry] = useState('IN')
  const [currentCountry, setCurrentCountry] = useState('IN')
  const [countrySelectOpen, setCountrySelectOpen] = useState(false)
  const [phoneFieldTouched, setPhoneFieldTouched] = useState(false)
  
  // New state for location suggestions
  const [locationSuggestions, setLocationSuggestions] = useState([])
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false)
  
  // Get user's browser language to detect country
  useEffect(() => {
    const detectCountry = () => {
      try {
        // Force default country to be India (IN)
        setDefaultCountry('IN');
        setCurrentCountry('IN');
        console.log('Default country set to India (IN)');
      } catch (error) {
        console.error('Error setting default country:', error);
        // Fallback to India if there's an error
        setDefaultCountry('IN');
        setCurrentCountry('IN');
      }
    }
    
    detectCountry()
  }, [])

  // Initial effect to set phone with India country code
  useEffect(() => {
    // Set initial phone value with India country code if empty
    if (!formData.phone) {
      setFormData(prev => ({
        ...prev,
        phone: '+91'
      }));
    }
  }, []);

  useEffect(() => {
    // Clean up the recaptcha verifier when component unmounts
    return () => {
      if (recaptchaVerifier) {
        try {
          recaptchaVerifier.clear();
        } catch (error) {
          console.error('Error clearing recaptcha:', error);
        }
      }
    };
  }, [recaptchaVerifier]);

  // Effect to update country when phone number changes
  useEffect(() => {
    if (formData.phone) {
      try {
        const phoneNumber = parsePhoneNumber(formData.phone);
        if (phoneNumber && phoneNumber.country) {
          setCurrentCountry(phoneNumber.country);
        }
      } catch (error) {
        console.error('Error parsing phone number:', error);
      }
    }
  }, [formData.phone]);

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    
    // Handle location suggestions
    if (name === 'location' && value.trim().length > 2) {
      // In a real app, you would call a location API here
      // For now, we'll use a simple simulation of location suggestions
      const commonLocations = [
        'New York, USA',
        'London, UK',
        'Mumbai, India',
        'Tokyo, Japan',
        'Paris, France',
        'Berlin, Germany',
        'Sydney, Australia',
        'Toronto, Canada',
        'Dubai, UAE',
        'Singapore',
        'Delhi, India',
        'Chennai, India',
        'Kolkata, India',
        'Bangalore, India',
        'Hyderabad, India'
      ]
      
      const filteredSuggestions = commonLocations
        .filter(location => location.toLowerCase().includes(value.toLowerCase()))
        .slice(0, 5)
      
      setLocationSuggestions(filteredSuggestions)
      setShowLocationSuggestions(filteredSuggestions.length > 0)
    } else if (name === 'location' && value.trim().length <= 2) {
      setLocationSuggestions([])
      setShowLocationSuggestions(false)
    }
  }

  const handlePhoneChange = (value) => {
    // Mark field as touched when user changes it (except initial load)
    if (!phoneFieldTouched && value !== '+91') {
      setPhoneFieldTouched(true);
    }
    
    // Update the form data
    setFormData(prev => ({
      ...prev,
      phone: value || ''
    }));
    
    // Validate phone number
    if (value) {
      try {
        // Use libphonenumber-js validation
        const isPossible = isPossiblePhoneNumber(value);
        const isValid = isValidPhoneNumber(value);
        
        // Check for both validation criteria
        const isValidNumber = isPossible && isValid;
        
        // Log validation status for debugging
        console.log(`Phone validation: Possible=${isPossible}, Valid=${isValid}, Value=${value}`);
        
        // Update validation state
        setPhoneNumberValid(isValidNumber);
        
        // Update country based on phone number
        try {
          const phoneNumber = parsePhoneNumber(value);
          if (phoneNumber && phoneNumber.country) {
            setCurrentCountry(phoneNumber.country);
          }
        } catch (countryError) {
          console.error('Error extracting country from phone number:', countryError);
        }
        
        // Reset verification steps if phone number changes and is no longer valid
        if (!isValidNumber && phoneVerificationStep !== 'not_started') {
          setPhoneVerificationStep('not_started');
          setOtpSent(false);
          setVerificationId('');
          setOtpCode('');
          
          // Clear recaptcha if it exists
          if (recaptchaVerifier) {
            try {
              recaptchaVerifier.clear();
            } catch (error) {
              console.error('Error clearing recaptcha:', error);
            }
            setRecaptchaVerifier(null);
          }
        }
      } catch (error) {
        console.error('Error validating phone number:', error);
        setPhoneNumberValid(false);
      }
    } else {
      // Reset if empty
      setPhoneNumberValid(false);
      
      // Reset verification if phone number is cleared
      if (phoneVerificationStep !== 'not_started') {
        setPhoneVerificationStep('not_started');
        setOtpSent(false);
        setVerificationId('');
        setOtpCode('');
        
        // Clear recaptcha
        if (recaptchaVerifier) {
          try {
            recaptchaVerifier.clear();
          } catch (error) {
            console.error('Error clearing recaptcha:', error);
          }
          setRecaptchaVerifier(null);
        }
      }
    }
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

    if (!phoneNumberValid) {
      setError(t.enterValidPhone || 'Please enter a valid phone number')
      return false
    }
    
    if (phoneVerificationStep !== 'completed') {
      setError(t.phoneVerificationRequired || 'Please verify your phone number')
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

  const initializeRecaptcha = () => {
    try {
      const verifier = generateRecaptchaVerifier('recaptcha-container', () => {
        console.log('reCAPTCHA verified');
        setVerificationMessage(t.recaptchaVerified || 'reCAPTCHA verified. You can now send OTP.');
      });
      setRecaptchaVerifier(verifier);
      return verifier;
    } catch (error) {
      console.error('Error initializing recaptcha:', error);
      setError('Error initializing verification. Please refresh the page and try again.');
      return null;
    }
  };

  const sendVerificationCode = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!phoneNumberValid) {
        setError(t.enterValidPhone || 'Please enter a valid phone number');
        setLoading(false);
        return;
      }
      
      // Initialize recaptcha if not already initialized
      const verifier = recaptchaVerifier || initializeRecaptcha();
      if (!verifier) {
        setLoading(false);
        return;
      }
      
      // Send verification code
      const confirmationResult = await signInWithPhoneNumber(
        auth, 
        formData.phone, 
        verifier
      );
      
      setVerificationId(confirmationResult.verificationId);
      setOtpSent(true);
      setPhoneVerificationStep('otp_sent');
      setVerificationMessage(t.otpSent || 'OTP has been sent to your phone. Please enter the code to verify.');
      setLoading(false);
    } catch (error) {
      console.error('Error sending verification code:', error);
      setError(`Error sending verification code: ${error.message}. Please try again.`);
      setLoading(false);
      
      // Reset recaptcha
      if (recaptchaVerifier) {
        try {
          recaptchaVerifier.clear();
        } catch (clearError) {
          console.error('Error clearing recaptcha:', clearError);
        }
      }
      setRecaptchaVerifier(null);
    }
  };

  const verifyOTP = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!otpCode || otpCode.length !== 6) {
        setError(t.invalidOtp || 'Please enter a valid 6-digit OTP code');
        setLoading(false);
        return;
      }
      
      // Create credentials
      const credential = PhoneAuthProvider.credential(verificationId, otpCode);
      
      // Verify OTP
      // We don't actually link the credential yet - we'll do that after email/password account is created
      
      setPhoneVerificationStep('completed');
      setVerificationMessage(t.phoneVerified || 'Phone number verified successfully!');
      setLoading(false);
      
      // Store credential for later use
      window.phoneCredential = credential;
    } catch (error) {
      console.error('Error verifying OTP:', error);
      setError(`Error verifying OTP: ${error.message}. Please try again.`);
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!validateForm()) {
      setLoading(false)
      return
    }

    try {
      console.log("Starting user account creation process");

      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        formData.email, 
        formData.password
      )
      console.log("User auth account created successfully");

      // Default profile image URL to use if upload fails
      const defaultProfileImage = 'https://public.readdy.ai/ai/img_res/4c15f5e4c75bf1c2c613684d79bd37c4.jpg';
      let profileImageUrl = defaultProfileImage;

      // Upload profile image if available
      if (profileImage) {
        try {
          console.log("Starting profile image encoding process");
          
          // Convert file to base64 string for Firestore only
          const reader = new FileReader();
          reader.readAsDataURL(profileImage);
          
          await new Promise((resolve, reject) => {
            reader.onload = () => {
              profileImageUrl = reader.result;
              console.log("Profile image encoded as base64");
              resolve();
            };
            reader.onerror = (error) => {
              console.error("Error encoding image:", error);
              reject(error);
            };
          });
          
          console.log("Profile image encoded successfully");
          
          // Update user profile with display name only (not the photo URL)
          await updateProfile(userCredential.user, {
            displayName: formData.name
            // We're not setting photoURL here to avoid the "invalid-profile-attribute" error
          });
          console.log("User profile updated with display name");
        } catch (uploadError) {
          console.error('Error processing profile image:', uploadError);
          // Continue with account creation even if image processing fails
          profileImageUrl = defaultProfileImage;
        }
      } else {
        // Update user profile with display name only
        await updateProfile(userCredential.user, {
          displayName: formData.name
        });
      }

      // Link phone credential to the account
      try {
        if (window.phoneCredential) {
          await linkWithCredential(userCredential.user, window.phoneCredential);
          // Clear the stored credential
          window.phoneCredential = null;
          console.log("Phone credential linked successfully");
        }
      } catch (linkError) {
        console.error('Error linking phone credential:', linkError);
        // Continue with account creation even if linking fails
      }

      // Create user data for Firestore
      const userData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        phoneVerified: phoneVerificationStep === 'completed',
        location: formData.location,
        profileImage: profileImageUrl,
        preferences: formData.preferences,
        savedDestinations: [],
        createdAt: new Date().toISOString()
      };
      
      console.log('Storing user data in Firestore:', userData);
      
      // Store in Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), userData);
      console.log('User data stored in Firestore successfully');

      // Navigate to profile after successful signup
      navigate('/profile');
    } catch (err) {
      console.error('Sign up error:', err);
      setError(err.message || 'Error creating account. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const renderPhoneVerificationForm = () => {
    switch (phoneVerificationStep) {
      case 'not_started':
        return (
          <div className="bg-gray-50 p-5 rounded-lg shadow-sm border border-gray-200 mt-4 transition-all duration-300">
            <div className="flex items-center mb-3">
              <div className="p-2 bg-blue-100 rounded-full mr-3">
                <i className="fas fa-mobile-alt text-blue-600"></i>
              </div>
              <h4 className="text-lg font-medium text-gray-800">{t.verifyYourPhone || 'Verify your phone'}</h4>
            </div>
            
            <p className="text-gray-600 text-sm mb-4">
              {t.verificationHelp || 'To protect your account, we need to verify your phone number through a one-time code.'}
            </p>
            
            <div id="recaptcha-container" ref={recaptchaContainerRef} className="mb-4 flex justify-center bg-white p-2 rounded-md"></div>
            
            {verificationMessage && (
              <div className="text-sm text-blue-600 mb-3 p-2 bg-blue-50 rounded-md border border-blue-100">
                <i className="fas fa-info-circle mr-2"></i>
                {verificationMessage}
              </div>
            )}
            
            <button 
              type="button"
              onClick={sendVerificationCode}
              disabled={!phoneNumberValid || loading}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-300 flex items-center justify-center"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t.sending || 'Sending...'}
                </>
              ) : (
                <>
                  <i className="fas fa-paper-plane mr-2"></i>
                  {t.sendVerificationCode || 'Send Verification Code'}
                </>
              )}
            </button>
          </div>
        );
      
      case 'otp_sent':
        return (
          <div className="bg-gray-50 p-5 rounded-lg shadow-sm border border-gray-200 mt-4 transition-all duration-300">
            <div className="flex items-center mb-3">
              <div className="p-2 bg-blue-100 rounded-full mr-3">
                <i className="fas fa-key text-blue-600"></i>
              </div>
              <h4 className="text-lg font-medium text-gray-800">{t.enterOtp || 'Enter verification code'}</h4>
            </div>
            
            {verificationMessage && (
              <div className="text-sm text-green-600 mb-4 p-3 bg-green-50 rounded-md border border-green-100">
                <i className="fas fa-check-circle mr-2"></i>
                {verificationMessage}
              </div>
            )}
            
            <p className="text-gray-600 text-sm mb-3">
              {t.otpInstructions || 'Enter the 6-digit code sent to your phone'}:
            </p>
            
            <div className="otp-input-container mb-4">
              <input
                type="text"
                id="otp"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder="------"
                pattern="[0-9]*"
                inputMode="numeric"
                maxLength={6}
                className="w-full text-center tracking-widest text-xl px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                autoComplete="one-time-code"
              />
              
              {/* Visual OTP digit display */}
              <div className="otp-display">
                {[...Array(6)].map((_, index) => (
                  <div 
                    key={index} 
                    className={`otp-digit ${index < otpCode.length ? 'filled' : ''}`}
                  >
                    {otpCode[index] || ''}
                  </div>
                ))}
              </div>
              
              <div className="flex justify-between mt-2">
                <span className="text-xs text-gray-500">
                  {t.didNotReceiveCode || "Didn't receive a code?"}
                </span>
                <button 
                  type="button" 
                  onClick={sendVerificationCode}
                  className="text-xs text-blue-600 hover:text-blue-800"
                  disabled={loading}
                >
                  {t.resendCode || "Resend Code"}
                </button>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button 
                type="button"
                onClick={verifyOTP}
                disabled={otpCode.length !== 6 || loading}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:bg-blue-300 flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t.verifying || 'Verifying...'}
                  </>
                ) : (
                  <>
                    <i className="fas fa-check-circle mr-2"></i>
                    {t.verifyOtp || 'Verify Code'}
                  </>
                )}
              </button>
              
              <button 
                type="button"
                onClick={() => {
                  setPhoneVerificationStep('not_started');
                  if (recaptchaVerifier) {
                    try {
                      recaptchaVerifier.clear();
                    } catch (error) {
                      console.error('Error clearing recaptcha:', error);
                    }
                  }
                  setRecaptchaVerifier(null);
                }}
                className="px-4 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors focus:outline-none"
              >
                <i className="fas fa-times mr-2"></i>
                {t.cancel || 'Cancel'}
              </button>
            </div>
          </div>
        );
      
      case 'completed':
        return (
          <div className="bg-green-50 p-5 rounded-lg shadow-sm border border-green-200 mt-4 transition-all duration-300">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-full mr-3">
                <i className="fas fa-shield-alt text-green-600"></i>
              </div>
              <div>
                <h4 className="text-lg font-medium text-gray-800">{t.verificationComplete || 'Verification Complete'}</h4>
                <p className="text-green-600 text-sm mt-1">
                  {verificationMessage || t.phoneVerified || 'Phone number verified successfully!'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center mt-3 p-3 bg-white rounded-md border border-green-100">
              <div className="p-2 bg-green-100 rounded-full mr-2">
                <i className="fas fa-check text-green-600 text-sm"></i>
              </div>
              <span className="text-sm text-gray-600">{formData.phone}</span>
              <button 
                type="button"
                onClick={() => {
                  setPhoneVerificationStep('not_started');
                  if (recaptchaVerifier) {
                    try {
                      recaptchaVerifier.clear();
                    } catch (error) {
                      console.error('Error clearing recaptcha:', error);
                    }
                  }
                  setRecaptchaVerifier(null);
                }}
                className="ml-auto text-xs text-blue-600 hover:underline"
              >
                {t.change || 'Change'}
              </button>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  const handleLocationSelect = (location) => {
    setFormData(prev => ({
      ...prev,
      location
    }))
    setShowLocationSuggestions(false)
  }

  return (
    <div className="auth-container" style={{ marginTop: "100px", paddingTop: "30px" }}>
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
            <label className="flex items-center text-gray-700 font-bold mb-2" htmlFor="phone">
              {t.phone || 'Phone Number'}
              {phoneNumberValid && (
                <span className="valid-phone-indicator">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {t.valid}
                </span>
              )}
            </label>
            <div className={`phone-input-container ${phoneNumberValid ? 'valid' : formData.phone ? 'invalid' : ''}`}>
              <div className="relative">
                <PhoneInput
                  id="phone"
                  international
                  defaultCountry="IN"
                  key="phone-input-IN" 
                  value={formData.phone || '+91'}
                  onChange={handlePhoneChange}
                  countryCallingCodeEditable={true}
                  disabled={phoneVerificationStep === 'otp_sent' || phoneVerificationStep === 'completed'}
                  required
                  className="phone-input"
                  smartCaret={true}
                  limitMaxLength={true}
                  withCountryCallingCode={true}
                  onCountryChange={(country) => setCurrentCountry(country)}
                  countrySelectProps={{
                    'aria-label': t.selectCountry || 'Select country'
                  }}
                  autoComplete="tel"
                />
                {phoneNumberValid && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-500">
                    <i className="fas fa-check-circle"></i>
                  </div>
                )}
              </div>
            </div>
            {formData.phone && !phoneNumberValid && phoneFieldTouched && (
              <p className="text-red-500 text-xs mt-1">
                <i className="fas fa-exclamation-circle mr-1"></i>
                {t.enterValidPhone || 'Please enter a valid phone number'}
              </p>
            )}
            
            {/* Phone verification section */}
            {formData.phone && phoneNumberValid && renderPhoneVerificationForm()}
          </div>

          <div className="form-group">
            <label htmlFor="location">{t.location || 'Location'}</label>
            <div className="relative">
              <input
                type="text"
                id="location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                onFocus={() => formData.location.trim().length > 2 && setShowLocationSuggestions(true)}
                onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 200)}
                required
                className="w-full"
                placeholder={t.enterYourLocation || "Enter your city or region"}
              />
              {showLocationSuggestions && (
                <div className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
                  {locationSuggestions.map((location, index) => (
                    <button
                      key={index}
                      type="button"
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                      onClick={() => handleLocationSelect(location)}
                    >
                      <i className="fas fa-map-marker-alt text-gray-500 mr-2"></i>
                      {location}
                    </button>
                  ))}
                </div>
              )}
            </div>
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

          <button type="submit" disabled={loading || phoneVerificationStep !== 'completed'} className="signup-button">
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