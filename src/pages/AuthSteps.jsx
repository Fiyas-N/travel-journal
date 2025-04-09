import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, db, generateRecaptchaVerifier } from '../firebase/config';
import { 
  createUserWithEmailAndPassword, 
  updateProfile, 
  PhoneAuthProvider, 
  signInWithPhoneNumber,
  linkWithCredential 
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import PropTypes from 'prop-types';
import translations from '../utils/translations';
import PhoneInput from 'react-phone-number-input';
import { isPossiblePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import 'react-phone-number-input/style.css';

const AuthSteps = ({ language }) => {
  // Get translations for the current language
  const t = translations[language] || translations.en;
  const navigate = useNavigate();
  
  // Form states
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    location: '',
    preferences: []
  });
  
  // Phone verification states
  const [phoneVerificationStep, setPhoneVerificationStep] = useState('not_started');
  const [verificationId, setVerificationId] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [phoneNumberValid, setPhoneNumberValid] = useState(false);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState(null);
  const [verificationMessage, setVerificationMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Refs
  const recaptchaContainerRef = useRef(null);
  
  // Country detection for phone input
  const [defaultCountry, setDefaultCountry] = useState('IN');
  const [phoneFieldTouched, setPhoneFieldTouched] = useState(false);
  
  // Detect user's country from browser language
  useEffect(() => {
    const detectCountry = () => {
      try {
        const browserLang = navigator.language || navigator.userLanguage;
        console.log('Browser language:', browserLang);
        
        // Extract country code from locale if possible
        if (browserLang && browserLang.includes('-')) {
          const country = browserLang.split('-')[1].toUpperCase();
          console.log('Detected country from browser:', country);
          
          // If we got a valid 2-letter country code, use it
          if (country && country.length === 2) {
            setDefaultCountry(country);
            return;
          }
        }
        
        // Default to India if detection fails
        setDefaultCountry('IN');
      } catch (error) {
        console.error('Error detecting country:', error);
        setDefaultCountry('IN');
      }
    };
    
    detectCountry();
  }, []);
  
  const handlePhoneChange = (value) => {
    // Update the form data with the new phone number
    setFormData({ ...formData, phone: value });
    
    // Log for debugging
    console.log('Phone number changed:', value);
    
    // Validate the phone number
    if (value) {
      try {
        const isPossible = isPossiblePhoneNumber(value);
        const isValid = isValidPhoneNumber(value);
        console.log('Phone validation:', { isPossible, isValid });
        
        // Update the validation state
        setPhoneNumberValid(isPossible && isValid);
        
        // If the phone number changes and is no longer valid, reset verification steps
        if (phoneVerificationStep !== 'not_started' && !(isPossible && isValid)) {
          setPhoneVerificationStep('not_started');
          if (recaptchaVerifier) {
            recaptchaVerifier.clear();
            setRecaptchaVerifier(null);
          }
        }
      } catch (error) {
        console.error('Phone validation error:', error);
        setPhoneNumberValid(false);
      }
    } else {
      // If the input is empty, reset validation state
      setPhoneNumberValid(false);
      if (phoneVerificationStep !== 'not_started') {
        setPhoneVerificationStep('not_started');
        if (recaptchaVerifier) {
          recaptchaVerifier.clear();
          setRecaptchaVerifier(null);
        }
      }
    }
    
    setPhoneFieldTouched(true);
  };

  const renderPhoneVerificationSection = () => {
    if (phoneVerificationStep === 'not_started') {
      return (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError(null);
              
              // Initialize reCAPTCHA if not already done
              if (!recaptchaVerifier) {
                generateRecaptchaVerifier('phone-verify-recaptcha', (verifier) => {
                  setRecaptchaVerifier(verifier);
                  
                  // Send verification code
                  signInWithPhoneNumber(auth, formData.phone, verifier)
                    .then((confirmationResult) => {
                      setVerificationId(confirmationResult.verificationId);
                      setPhoneVerificationStep('otp_sent');
                      setVerificationMessage(t.otpSent || 'Verification code sent!');
                      setLoading(false);
                    })
                    .catch((err) => {
                      console.error('Error sending verification code:', err);
                      setError(t.otpError || 'Error sending verification code. Please try again.');
                      setLoading(false);
                      if (verifier) {
                        verifier.clear();
                      }
                    });
                });
              } else {
                // Use existing reCAPTCHA verifier
                signInWithPhoneNumber(auth, formData.phone, recaptchaVerifier)
                  .then((confirmationResult) => {
                    setVerificationId(confirmationResult.verificationId);
                    setPhoneVerificationStep('otp_sent');
                    setVerificationMessage(t.otpSent || 'Verification code sent!');
                    setLoading(false);
                  })
                  .catch((err) => {
                    console.error('Error sending verification code:', err);
                    setError(t.otpError || 'Error sending verification code. Please try again.');
                    setLoading(false);
                    if (recaptchaVerifier) {
                      recaptchaVerifier.clear();
                      setRecaptchaVerifier(null);
                    }
                  });
              }
            }}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            disabled={loading || !phoneNumberValid}
          >
            {loading ? (
              <span>{t.sending || 'Sending...'}</span>
            ) : (
              <span>{t.verifyPhone || 'Verify Phone Number'}</span>
            )}
          </button>
          
          {/* Container for reCAPTCHA */}
          <div id="phone-verify-recaptcha" className="mt-3"></div>
          
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>
      );
    } else if (phoneVerificationStep === 'otp_sent') {
      return (
        <div className="mt-2">
          <p className="text-green-600 text-sm mb-2">{verificationMessage}</p>
          
          <div className="flex space-x-2">
            <input
              type="text"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder={t.enterOtp || "Enter verification code"}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              maxLength={6}
            />
            
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setError(null);
                
                // Create a credential with the verification ID and OTP code
                const credential = PhoneAuthProvider.credential(verificationId, otpCode);
                
                // Link the credential to the current user
                linkWithCredential(auth.currentUser, credential)
                  .then(() => {
                    setPhoneVerificationStep('completed');
                    setVerificationMessage(t.phoneVerified || 'Phone number verified successfully!');
                    setLoading(false);
                  })
                  .catch((err) => {
                    console.error('Error verifying OTP:', err);
                    setError(t.otpVerificationError || 'Invalid verification code. Please try again.');
                    setLoading(false);
                  });
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              disabled={loading || otpCode.length !== 6}
            >
              {loading ? (
                <span>{t.verifying || 'Verifying...'}</span>
              ) : (
                <span>{t.verify || 'Verify'}</span>
              )}
            </button>
            
            <button
              type="button"
              onClick={() => {
                // Reset OTP verification
                setPhoneVerificationStep('not_started');
                setOtpCode('');
                setVerificationMessage('');
                setError(null);
                if (recaptchaVerifier) {
                  recaptchaVerifier.clear();
                  setRecaptchaVerifier(null);
                }
              }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {t.cancel || 'Cancel'}
            </button>
          </div>
          
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>
      );
    } else if (phoneVerificationStep === 'completed') {
      return (
        <div className="mt-2">
          <p className="text-green-600 text-sm flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {verificationMessage}
          </p>
          
          <button
            type="button"
            onClick={() => {
              // Reset phone verification to allow changing the phone number
              setPhoneVerificationStep('not_started');
              setOtpCode('');
              setVerificationMessage('');
              setError(null);
            }}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800 focus:outline-none"
          >
            {t.changePhone || 'Change phone number'}
          </button>
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className="mb-4">
      <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
        {t.phoneNumber || 'Phone Number'}
        {phoneNumberValid && (
          <span className="valid-phone-indicator">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {t.valid || 'Valid'}
          </span>
        )}
      </label>
      
      <div className={`phone-input-container ${phoneNumberValid ? 'valid' : (formData.phone && phoneFieldTouched ? 'invalid' : '')}`}>
        <PhoneInput
          placeholder={t.phoneNumber || "Phone Number"}
          value={formData.phone}
          onChange={handlePhoneChange}
          defaultCountry={defaultCountry}
          countryCallingCodeEditable={true}
          international={true}
          smartCaret={true}
          limitMaxLength={true}
          withCountryCallingCode={true}
          disabled={phoneVerificationStep === 'otp_sent' || phoneVerificationStep === 'completed'}
          autoComplete="tel"
        />
      </div>
      
      {formData.phone && !phoneNumberValid && phoneFieldTouched && (
        <p className="text-red-500 text-xs mt-1">{t.enterValidPhone || 'Please enter a valid phone number'}</p>
      )}
      
      {/* Phone verification section */}
      {formData.phone && phoneNumberValid && renderPhoneVerificationSection()}
    </div>
  );
};

AuthSteps.propTypes = {
  language: PropTypes.string.isRequired,
};

export default AuthSteps;