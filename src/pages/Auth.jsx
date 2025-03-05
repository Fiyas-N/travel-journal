import React, { useState } from 'react';
import { auth, db } from '../firebase/config';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import PropTypes from 'prop-types';

const Auth = ({ language }) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    location: '',
    preferences: [],
    profilePicture: '',
    additionalInfo: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePreferenceChange = (preference) => {
    setFormData(prev => ({
      ...prev,
      preferences: prev.preferences.includes(preference)
        ? prev.preferences.filter(p => p !== preference)
        : [...prev.preferences, preference]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (isSignUp) {
        // Create user account
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        
        // Create user profile in Firestore
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          location: formData.location,
          preferences: {
            tripTypes: formData.preferences
          },
          profileImage: formData.profilePicture || 'https://public.readdy.ai/ai/img_res/4c15f5e4c75bf1c2c613684d79bd37c4.jpg',
          bio: formData.additionalInfo,
          createdAt: new Date().toISOString()
        });

        navigate('/');
      } else {
        // Sign in existing user
        await signInWithEmailAndPassword(auth, formData.email, formData.password);
        navigate('/');
      }
    } catch (err) {
      console.error('Authentication error:', err);
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
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
                    className="absolute right-3 top-8 touch-manipulation"
                  >
                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-gray-400 text-lg sm:text-base`}></i>
                  </button>
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
                  <a href="#" className="text-sm text-blue-600 hover:text-blue-500">
                    {language === 'hi' ? 'पासवर्ड भूल गए?' : 'Forgot password?'}
                  </a>
                </div>

                <button
                  type="submit"
                  className="!rounded-button whitespace-nowrap w-full bg-blue-600 text-white py-3 sm:py-2 text-base sm:text-sm hover:bg-blue-700 touch-manipulation"
                >
                  {language === 'hi' ? 'साइन इन करें' : 'Sign in'}
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
                        className="absolute right-3 top-8 touch-manipulation"
                      >
                        <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-gray-400 text-lg sm:text-base`}></i>
                      </button>
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
                        {language === 'hi' ? 'प्रोफ़ाइल फोटो URL' : 'Profile Picture URL'}
                      </label>
                      <input
                        type="url"
                        name="profilePicture"
                        value={formData.profilePicture}
                        onChange={handleInputChange}
                        className="mt-1 block w-full px-3 py-2 text-base sm:text-sm border border-gray-300 rounded-md"
                        placeholder="https://example.com/image.jpg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        {language === 'hi' ? 'अतिरिक्त जानकारी' : 'Additional Information'}
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
                      onClick={() => setCurrentStep(current => current + 1)}
                      className="!rounded-button whitespace-nowrap bg-blue-600 text-white py-3 sm:py-2 px-4 text-base sm:text-sm hover:bg-blue-700 touch-manipulation flex-1 sm:flex-none ml-auto"
                    >
                      {language === 'hi' ? 'अगला' : 'Next'}
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="!rounded-button whitespace-nowrap bg-blue-600 text-white py-3 sm:py-2 px-4 text-base sm:text-sm hover:bg-blue-700 touch-manipulation flex-1 sm:flex-none ml-auto"
                    >
                      {language === 'hi' ? 'खाता बनाएं' : 'Create Account'}
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
    </div>
  );
};

Auth.propTypes = {
  language: PropTypes.string.isRequired
};

export default Auth; 