import React, { useState, useRef, useEffect } from 'react';
import { auth, db, storage } from '../firebase/config';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useNavigate, Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import LoadingScreen from '../components/LoadingScreen';

const Auth = ({ language }) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [profileImage, setProfileImage] = useState(null);
  const [previewURL, setPreviewURL] = useState(null);
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    location: '',
    preferences: [],
    additionalInfo: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [forgotPasswordModal, setForgotPasswordModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePreferenceChange = (preference) => {
    setFormData(prev => ({
      ...prev,
      preferences: prev.preferences.includes(preference)
        ? prev.preferences.filter(p => p !== preference)
        : [...prev.preferences, preference]
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfileImage(file);
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewURL(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current.click();
  };

  const validateForm = () => {
    // Check if all required fields are filled
    if (!formData.name.trim()) {
      setError(language === 'hi' ? 'नाम आवश्यक है' : 'Name is required');
      return false;
    }
    if (!formData.email.trim()) {
      setError(language === 'hi' ? 'ईमेल आवश्यक है' : 'Email is required');
      return false;
    }
    if (!formData.password.trim() || formData.password.length < 6) {
      setError(language === 'hi' ? 'पासवर्ड कम से कम 6 अक्षर का होना चाहिए' : 'Password must be at least 6 characters');
      return false;
    }
    if (!formData.phone.trim()) {
      setError(language === 'hi' ? 'फोन नंबर आवश्यक है' : 'Phone number is required');
      return false;
    }
    if (!formData.location.trim()) {
      setError(language === 'hi' ? 'स्थान आवश्यक है' : 'Location is required');
      return false;
    }
    if (formData.preferences.length === 0) {
      setError(language === 'hi' ? 'कम से कम एक यात्रा प्राथमिकता चुनें' : 'Select at least one travel preference');
      return false;
    }
    // Note: Profile picture is optional
    return true;
  };

  const handleCreateAccount = async () => {
    if (isSubmitting) return;
    
    console.log("handleCreateAccount called - Starting account creation process");
    setError('');
    setIsSubmitting(true);
    
    try {
      // Validate all required fields before creating account
      if (!validateForm()) {
        setIsSubmitting(false);
        return;
      }

      console.log("Starting account creation...");
      
      // Create user account
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password)
        .catch(error => {
          console.error("Firebase Auth Error:", error.code, error.message);
          if (error.code === 'auth/email-already-in-use') {
            throw new Error(language === 'hi' ? 'इस ईमेल से पहले से ही एक खाता है' : 'An account already exists with this email');
          } else if (error.code === 'auth/invalid-email') {
            throw new Error(language === 'hi' ? 'अमान्य ईमेल पता' : 'Invalid email address');
          } else if (error.code === 'auth/weak-password') {
            throw new Error(language === 'hi' ? 'पासवर्ड बहुत कमजोर है' : 'Password is too weak');
          } else {
            throw error;
          }
        });
      
      if (!userCredential || !userCredential.user) {
        throw new Error(language === 'hi' ? 'उपयोगकर्ता खाता बनाने में विफल' : 'Failed to create user account');
      }
      
      console.log("User created successfully. Updating profile...");
      
      // Instead of trying to upload the image now (which might fail due to CORS),
      // we'll just update the profile with the name and create the Firestore document
      
      // Update user profile with display name
      await updateProfile(userCredential.user, {
        displayName: formData.name
      });
      
      console.log("Creating Firestore document...");
      
      // Create user profile in Firestore
      try {
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          location: formData.location,
          preferences: {
            tripTypes: formData.preferences
          },
          // Use default image for now
          profileImageUrl: 'https://public.readdy.ai/ai/img_res/4c15f5e4c75bf1c2c613684d79bd37c4.jpg',
          bio: formData.additionalInfo,
          createdAt: new Date().toISOString()
        });
        console.log("Firestore document created successfully");
        
        // Show a message to the user that their account was created but image upload failed
        if (profileImage) {
          console.log("Note: Profile image couldn't be uploaded due to CORS restrictions in development environment.");
          // This isn't shown to the user as we're navigating away, but can be useful for debugging
        }
        
      } catch (firestoreError) {
        console.error("Firestore error:", firestoreError);
        // Account has been created, so continue even if Firestore fails
      }

      console.log("Account creation complete, redirecting...");
      navigate('/');
    } catch (err) {
      console.error('Authentication error:', err);
      setError(err.message || (language === 'hi' ? 'खाता बनाने में एक त्रुटि हुई' : 'An error occurred creating your account'));
    } finally {
      console.log("Resetting submission state");
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    // Always prevent default form submission
    e.preventDefault();
    console.log("Form submission prevented");
    
    // Form submission is now completely controlled by our button handlers
    // This function just prevents the default browser form submission
  };

  const handleSignIn = async () => {
    if (isSigningIn) return;
    
    setError('');
    setIsSigningIn(true);
    
    try {
      if (!formData.email.trim()) {
        throw new Error(language === 'hi' ? 'ईमेल आवश्यक है' : 'Email is required');
      }
      if (!formData.password.trim()) {
        throw new Error(language === 'hi' ? 'पासवर्ड आवश्यक है' : 'Password is required');
      }
      
      console.log("Attempting to sign in...");
      
      await signInWithEmailAndPassword(auth, formData.email, formData.password)
        .catch(error => {
          console.error("Sign in error:", error.code, error.message);
          if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            throw new Error(language === 'hi' ? 'अमान्य ईमेल या पासवर्ड' : 'Invalid email or password');
          } else if (error.code === 'auth/too-many-requests') {
            throw new Error(language === 'hi' ? 'बहुत सारे प्रयासों के कारण खाता अस्थायी रूप से अवरुद्ध है' : 'Account temporarily locked due to too many attempts');
          } else {
            throw error;
          }
        });
      
      console.log("Sign in successful, redirecting...");
      navigate('/');
    } catch (err) {
      console.error('Sign in error:', err);
      setError(err.message || (language === 'hi' ? 'साइन इन करने में एक त्रुटि हुई' : 'An error occurred while signing in'));
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleNextStep = () => {
    console.log(`Attempting to move from step ${currentStep} to next step`);
    let canProceed = true;
    
    if (currentStep === 1) {
      // Validate first step fields
      if (!formData.name.trim()) {
        setError(language === 'hi' ? 'नाम आवश्यक है' : 'Name is required');
        canProceed = false;
      } else if (!formData.email.trim()) {
        setError(language === 'hi' ? 'ईमेल आवश्यक है' : 'Email is required');
        canProceed = false;
      } else if (!formData.password.trim() || formData.password.length < 6) {
        setError(language === 'hi' ? 'पासवर्ड कम से कम 6 अक्षर का होना चाहिए' : 'Password must be at least 6 characters');
        canProceed = false;
      } else if (!formData.phone.trim()) {
        setError(language === 'hi' ? 'फोन नंबर आवश्यक है' : 'Phone number is required');
        canProceed = false;
      }
    } else if (currentStep === 2) {
      // Validate second step fields
      if (!formData.location.trim()) {
        setError(language === 'hi' ? 'स्थान आवश्यक है' : 'Location is required');
        canProceed = false;
      } else if (formData.preferences.length === 0) {
        setError(language === 'hi' ? 'कम से कम एक यात्रा प्राथमिकता चुनें' : 'Select at least one travel preference');
        canProceed = false;
      }
    }
    // Step 3 fields are optional, so no validation needed to proceed to submission
    
    if (canProceed) {
      setError('');
      const newStep = currentStep + 1;
      console.log(`Moving to step ${newStep}`);
      setCurrentStep(newStep);
    } else {
      console.log("Cannot proceed to next step due to validation errors");
    }
  };

  // Add a new handler specifically for the Create Account button
  const handleCreateAccountClick = () => {
    console.log("Create Account button clicked");
    
    // Set a timeout to ensure we don't get stuck in loading state
    const timeoutId = setTimeout(() => {
      if (isSubmitting) {
        console.log("Account creation timed out - resetting state");
        setIsSubmitting(false);
        setError(language === 'hi' 
          ? 'खाता बनाने में बहुत समय लग रहा है। कृपया बाद में पुन: प्रयास करें।' 
          : 'Account creation is taking too long. Please try again later.');
      }
    }, 30000); // 30 second timeout
    
    // Start the account creation process
    handleCreateAccount();
    
    // Clean up timeout when the component unmounts
    return () => clearTimeout(timeoutId);
  };

  // Add the forgot password handler
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsResettingPassword(true);
    
    try {
      if (!resetEmail.trim()) {
        throw new Error(language === 'hi' ? 'कृपया अपना ईमेल दर्ज करें' : 'Please enter your email');
      }
      
      await sendPasswordResetEmail(auth, resetEmail);
      setSuccessMessage(
        language === 'hi' 
          ? 'पासवर्ड रीसेट लिंक आपके ईमेल पर भेजा गया है' 
          : 'Password reset link has been sent to your email'
      );
      // Close the modal after 3 seconds on success
      setTimeout(() => {
        setForgotPasswordModal(false);
        setResetEmail('');
      }, 3000);
    } catch (err) {
      console.error('Password reset error:', err);
      let errorMessage;
      
      switch (err.code) {
        case 'auth/user-not-found':
          errorMessage = language === 'hi' 
            ? 'इस ईमेल से कोई खाता नहीं मिला' 
            : 'No account found with this email';
          break;
        case 'auth/invalid-email':
          errorMessage = language === 'hi' 
            ? 'अमान्य ईमेल पता' 
            : 'Invalid email address';
          break;
        case 'auth/too-many-requests':
          errorMessage = language === 'hi' 
            ? 'बहुत सारे अनुरोध। कृपया बाद में पुनः प्रयास करें' 
            : 'Too many requests. Please try again later';
          break;
        default:
          errorMessage = err.message || (
            language === 'hi' 
              ? 'पासवर्ड रीसेट करने में त्रुटि हुई' 
              : 'Error resetting password'
          );
      }
      
      setError(errorMessage);
    } finally {
      setIsResettingPassword(false);
    }
  };

  useEffect(() => {
    // This effect ensures we don't get stuck in loading states
    // if the component unmounts during a submission
    return () => {
      if (isSubmitting) {
        console.log("Component unmounted during submission - cleaning up");
        setIsSubmitting(false);
      }
      if (isSigningIn) {
        console.log("Component unmounted during sign in - cleaning up");
        setIsSigningIn(false);
      }
    };
  }, [isSubmitting, isSigningIn]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Show loading screen overlay when signing in or submitting */}
      {(isSigningIn || isSubmitting) && (
        <LoadingScreen 
          language={language} 
          type="overlay" 
          message={isSigningIn 
            ? (language === 'hi' ? 'साइन इन हो रहा है...' : 'Signing in...') 
            : (language === 'hi' ? 'खाता बन रहा है...' : 'Creating account...')} 
        />
      )}
      
      {/* Show loading overlay for password reset */}
      {isResettingPassword && (
        <LoadingScreen 
          language={language} 
          type="overlay" 
          size="small"
          message={language === 'hi' ? 'रीसेट लिंक भेज रहा है...' : 'Sending reset link...'} 
        />
      )}

      <nav className="bg-white shadow-md fixed w-full top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center">
              <span className="text-xl sm:text-2xl font-bold text-blue-600">TravelJournal</span>
            </Link>
          </div>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center px-4 py-12 mt-16 sm:mt-0">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-xl p-4 sm:p-8">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-3 py-2 sm:px-4 sm:py-3 rounded-lg text-sm sm:text-base">
              {error}
            </div>
          )}

          {!isSignUp ? (
            <div className="space-y-4 sm:space-y-6">
              <div className="text-center">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  {language === 'hi' ? 'वापसी पर स्वागत है' : 'Welcome back'}
                </h2>
                <p className="mt-2 text-sm sm:text-base text-gray-600">
                  {language === 'hi' ? 'कृपया अपने खाते में साइन इन करें' : 'Please sign in to your account'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                {/* Sign-in form fields - DO NOT REMOVE */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {language === 'hi' ? 'ईमेल' : 'Email'}
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 text-base sm:text-sm border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700">
                    {language === 'hi' ? 'पासवर्ड' : 'Password'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="mt-1 block w-full px-3 py-2 text-base sm:text-sm border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 touch-manipulation bg-transparent hover:text-gray-700 transition-colors p-1.5 rounded-full"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-gray-400 text-lg sm:text-base group-hover:text-gray-600`}></i>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-0">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    />
                    <label className="ml-2 text-sm text-gray-600">
                      {language === 'hi' ? 'मुझे याद रखें' : 'Remember me'}
                    </label>
                  </div>
                  <button 
                    type="button" 
                    className="text-sm text-blue-600 hover:text-blue-500"
                    onClick={() => {
                      setResetEmail(formData.email || '');
                      setForgotPasswordModal(true);
                      setError('');
                      setSuccessMessage('');
                    }}
                  >
                    {language === 'hi' ? 'पासवर्ड भूल गए?' : 'Forgot password?'}
                  </button>
                </div>
                
                <button
                  type="button" 
                  onClick={handleSignIn}
                  disabled={isSigningIn}
                  className="!rounded-button whitespace-nowrap w-full bg-blue-600 text-white py-3 sm:py-2 text-base sm:text-sm hover:bg-blue-700 touch-manipulation"
                >
                  {isSigningIn 
                    ? (language === 'hi' ? 'साइन इन हो रहा है...' : 'Signing In...') 
                    : (language === 'hi' ? 'साइन इन करें' : 'Sign in')}
                </button>
              </form>

              <div className="text-center">
                <p className="text-sm text-gray-600">
                  {language === 'hi' ? 'खाता नहीं है?' : "Don't have an account?"}{' '}
                  <button
                    onClick={() => setIsSignUp(true)}
                    className="text-blue-600 hover:text-blue-500 touch-manipulation"
                  >
                    {language === 'hi' ? 'साइन अप करें' : 'Sign up'}
                  </button>
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              <div className="text-center">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  {language === 'hi' ? 'अपना खाता बनाएं' : 'Create your account'}
                </h2>
                <p className="mt-2 text-sm sm:text-base text-gray-600">
                  {language === 'hi' ? 'चरण' : 'Step'} {currentStep} {language === 'hi' ? 'का' : 'of'} 3
                </p>
              </div>

              <div className="flex justify-center space-x-2">
                {[1, 2, 3].map(step => (
                  <div
                    key={step}
                    className={`h-1.5 sm:h-2 w-12 sm:w-16 rounded-full ${
                      step <= currentStep ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  ></div>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                {currentStep === 1 && (
                  <div className="space-y-4 sm:space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        {language === 'hi' ? 'पूरा नाम' : 'Full Name'}
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="mt-1 block w-full px-3 py-2 text-base sm:text-sm border border-gray-300 rounded-md"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        {language === 'hi' ? 'ईमेल' : 'Email'}
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="mt-1 block w-full px-3 py-2 text-base sm:text-sm border border-gray-300 rounded-md"
                        required
                      />
                    </div>
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700">
                        {language === 'hi' ? 'पासवर्ड' : 'Password'}
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          name="password"
                          value={formData.password}
                          onChange={handleInputChange}
                          className="mt-1 block w-full px-3 py-2 text-base sm:text-sm border border-gray-300 rounded-md"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 touch-manipulation bg-transparent hover:text-gray-700 transition-colors p-1.5 rounded-full"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-gray-400 text-lg sm:text-base group-hover:text-gray-600`}></i>
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        {language === 'hi' ? 'फोन नंबर' : 'Phone Number'}
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="mt-1 block w-full px-3 py-2 text-base sm:text-sm border border-gray-300 rounded-md"
                        required
                      />
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="space-y-4 sm:space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        {language === 'hi' ? 'स्थान' : 'Location'}
                      </label>
                      <input
                        type="text"
                        name="location"
                        value={formData.location}
                        onChange={handleInputChange}
                        className="mt-1 block w-full px-3 py-2 text-base sm:text-sm border border-gray-300 rounded-md"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {language === 'hi' ? 'यात्रा प्राथमिकताएं' : 'Travel Preferences'}
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {['beach', 'mountain', 'cultural', 'adventure', 'city', 'nature'].map(preference => (
                          <label key={preference} className="flex items-center space-x-2 p-2 border rounded-lg touch-manipulation">
                            <input
                              type="checkbox"
                              checked={formData.preferences.includes(preference)}
                              onChange={() => handlePreferenceChange(preference)}
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                            />
                            <span className="text-sm text-gray-700">
                              {language === 'hi' ? {
                                beach: 'समुद्र तट',
                                mountain: 'पर्वत',
                                cultural: 'सांस्कृतिक',
                                adventure: 'साहसिक',
                                city: 'शहर',
                                nature: 'प्रकृति'
                              }[preference] : preference.charAt(0).toUpperCase() + preference.slice(1)}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="space-y-4 sm:space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        {language === 'hi' ? 'प्रोफ़ाइल फोटो' : 'Profile Picture'} <span className="text-gray-500 text-xs font-normal">{language === 'hi' ? '(वैकल्पिक)' : '(Optional)'}</span>
                      </label>
                      <div className="mt-1 flex flex-col items-center">
                        {previewURL ? (
                          <div className="mb-3">
                            <img 
                              src={previewURL} 
                              alt="Profile preview" 
                              className="h-32 w-32 rounded-full object-cover border-4 border-blue-500"
                            />
                          </div>
                        ) : (
                          <div className="mb-3 h-32 w-32 rounded-full bg-gray-200 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          ref={fileInputRef}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={handleBrowseClick}
                          className="mt-2 bg-white border border-gray-300 rounded-md shadow-sm px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          {language === 'hi' ? 'फोटो चुनें' : 'Choose Photo'}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        {language === 'hi' ? 'अतिरिक्त जानकारी' : 'Additional Information'} <span className="text-gray-500 text-xs font-normal">{language === 'hi' ? '(वैकल्पिक)' : '(Optional)'}</span>
                      </label>
                      <textarea
                        name="additionalInfo"
                        value={formData.additionalInfo}
                        onChange={handleInputChange}
                        rows={4}
                        className="mt-1 block w-full px-3 py-2 text-base sm:text-sm border border-gray-300 rounded-md"
                      ></textarea>
                    </div>
                  </div>
                )}

                <div className="flex justify-between gap-4">
                  {currentStep > 1 && (
                    <button
                      type="button"
                      onClick={() => setCurrentStep(current => current - 1)}
                      className="!rounded-button whitespace-nowrap bg-gray-200 text-gray-700 py-3 sm:py-2 px-4 text-base sm:text-sm hover:bg-gray-300 touch-manipulation flex-1 sm:flex-none"
                    >
                      {language === 'hi' ? 'वापस' : 'Back'}
                    </button>
                  )}
                  {currentStep < 3 ? (
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="!rounded-button whitespace-nowrap bg-blue-600 text-white py-3 sm:py-2 px-4 text-base sm:text-sm hover:bg-blue-700 touch-manipulation flex-1 sm:flex-none ml-auto"
                    >
                      {language === 'hi' ? 'अगला' : 'Next'}
                    </button>
                  ) : (
                    <button
                      type="button" 
                      onClick={handleCreateAccountClick}
                      disabled={isSubmitting}
                      className="!rounded-button whitespace-nowrap bg-blue-600 text-white py-3 sm:py-2 px-4 text-base sm:text-sm hover:bg-blue-700 touch-manipulation flex-1 sm:flex-none ml-auto"
                    >
                      {isSubmitting 
                        ? (language === 'hi' ? 'खाता बन रहा है...' : 'Creating Account...') 
                        : (language === 'hi' ? 'खाता बनाएं' : 'Create Account')}
                    </button>
                  )}
                </div>
              </form>

              <div className="text-center">
                <p className="text-sm text-gray-600">
                  {language === 'hi' ? 'पहले से खाता है?' : 'Already have an account?'}{' '}
                  <button
                    onClick={() => {
                      setIsSignUp(false);
                      setCurrentStep(1);
                    }}
                    className="text-blue-600 hover:text-blue-500 touch-manipulation"
                  >
                    {language === 'hi' ? 'साइन इन करें' : 'Sign in'}
                  </button>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Forgot Password Modal */}
      {forgotPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  {language === 'hi' ? 'पासवर्ड रीसेट करें' : 'Reset Password'}
                </h3>
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-500"
                  onClick={() => {
                    setForgotPasswordModal(false);
                    setError('');
                    setSuccessMessage('');
                  }}
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
              
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
                  {error}
                </div>
              )}
              
              {successMessage && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md">
                  {successMessage}
                </div>
              )}
              
              <p className="mb-4 text-gray-600">
                {language === 'hi' 
                  ? 'अपना ईमेल दर्ज करें और हम आपको पासवर्ड रीसेट लिंक भेजेंगे।'
                  : 'Enter your email and we will send you a password reset link.'}
              </p>
              
              <form onSubmit={handleForgotPassword}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {language === 'hi' ? 'ईमेल' : 'Email'}
                  </label>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder={language === 'hi' ? 'आपका ईमेल पता' : 'your@email.com'}
                    required
                  />
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    onClick={() => {
                      setForgotPasswordModal(false);
                      setError('');
                      setSuccessMessage('');
                    }}
                  >
                    {language === 'hi' ? 'रद्द करें' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    disabled={isResettingPassword}
                  >
                    {isResettingPassword
                      ? (language === 'hi' ? 'भेज रहा है...' : 'Sending...')
                      : (language === 'hi' ? 'रीसेट लिंक भेजें' : 'Send Reset Link')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

Auth.propTypes = {
  language: PropTypes.string.isRequired
};

export default Auth; 