import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { auth, db } from '../firebase/config';
import { signOut } from 'firebase/auth';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import translations from '../utils/translations';

const Navbar = ({ 
  language, 
  setLanguage, 
  languages, 
  user, 
  setShowLoginModal,
  isMenuOpen,
  setIsMenuOpen,
  isProfileOpen,
  setIsProfileOpen 
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const searchRef = useRef(null);
  const languageRef = useRef(null);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleSearch = async (value) => {
    setSearchQuery(value);
    if (value.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const placesRef = collection(db, 'places');
      const searchTerms = value.toLowerCase().split(' ').filter(term => term.trim() !== '');
      
      // Get more places from the database for better search results
      const snapshot = await getDocs(query(placesRef, orderBy('name'), limit(50)));
      
      if (snapshot.empty) {
        console.log('No places found in the database');
        setSearchResults([]);
        setShowSearchResults(true);
        return;
      }
      
      const places = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Improved case-insensitive search on multiple fields
      const filtered = places.filter(place => {
        // Create a combined text from all searchable fields, ensuring they exist
        const name = (place.name || '').toLowerCase();
        const location = (place.location || '').toLowerCase();
        const description = (place.description || '').toLowerCase();
        const category = (place.category || '').toLowerCase();
        const district = (place.district || '').toLowerCase();
        const state = (place.state || '').toLowerCase();
        
        const searchableText = `${name} ${location} ${description} ${category} ${district} ${state}`;
        
        // Check if all search terms are included in the searchable text
        return searchTerms.every(term => searchableText.includes(term));
      });

      console.log(`Found ${filtered.length} search results for "${value}"`);
      setSearchResults(filtered.slice(0, 5));
      setShowSearchResults(true);
    } catch (error) {
      console.error('Error searching places:', error);
      // Show an error message to the user or handle gracefully
      setSearchResults([]);
      setShowSearchResults(true);
    } finally {
      setIsSearching(false);
    }
  };

  const handleClickOutside = (event) => {
    if (searchRef.current && !searchRef.current.contains(event.target)) {
      setShowSearchResults(false);
    }
    if (languageRef.current && !languageRef.current.contains(event.target)) {
      setShowLanguageDropdown(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleResultClick = (placeId) => {
    setShowSearchResults(false);
    setSearchQuery('');
    navigate(`/destination/${placeId}`);
  };

  const handleLanguageChange = (code) => {
    console.log('Language change requested:', code);
    // Ensure code is valid
    if (languages.some(lang => lang.code === code)) {
      setLanguage(code);
      // Save to localStorage for persistence
      localStorage.setItem('preferredLanguage', code);
      console.log('Language changed to:', code);
      
      // Force re-render via a small state change
      setShowLanguageDropdown(false);
      
      // Log current translations
      console.log('Current translations for', code, ':', translations[code] ? Object.keys(translations[code]) : 'Not available');
    } else {
      console.error('Invalid language code:', code);
    }
  };

  // Get translations for the current language
  const t = translations[language] || translations.en;

  return (
    <nav className="fixed top-0 w-full bg-white shadow-md z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        <div className="flex justify-between items-center h-14 sm:h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="text-xl sm:text-2xl font-bold text-blue-600">
              TravelJournal
            </Link>
          </div>

          {/* Main Navigation */}
          <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
            <Link
              to="/"
              className="text-gray-700 hover:text-blue-600 transition-colors duration-200"
            >
              {t.home}
            </Link>
            <Link
              to="/explore"
              className="text-gray-700 hover:text-blue-600 transition-colors duration-200"
            >
              {t.explore}
            </Link>
            {user && (
              <>
                <Link
                  to="/profile"
                  className="text-gray-700 hover:text-blue-600 transition-colors duration-200"
                >
                  {t.profile}
                </Link>
                <Link
                  to="/recommend"
                  className="text-gray-700 hover:text-blue-600 transition-colors duration-200"
                >
                  {t.recommend}
                </Link>
                <Link
                  to="/add-place"
                  className="text-gray-700 hover:text-blue-600 transition-colors duration-200"
                >
                  {t.addPlace}
                </Link>
              </>
            )}
          </div>

          {/* Search, Language Selector and Auth */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="relative hidden sm:block" ref={searchRef}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={t.searchDestinations}
                className="w-36 sm:w-48 md:w-64 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border-2 border-gray-200 focus:border-blue-500 focus:outline-none text-xs sm:text-sm"
              />
              <i className={`fas ${isSearching ? 'fa-spinner fa-spin' : 'fa-search'} absolute right-3 sm:right-4 top-1.5 sm:top-3 text-gray-400 text-xs sm:text-sm`}></i>
              
              {/* Search Results Dropdown */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute mt-1 sm:mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-200 max-h-72 sm:max-h-96 overflow-y-auto z-50">
                  {searchResults.map((place) => (
                    <button
                      key={place.id}
                      onClick={() => handleResultClick(place.id)}
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 text-left hover:bg-gray-50 flex items-center space-x-2 sm:space-x-3 border-b border-gray-100 last:border-b-0"
                    >
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                        {place.images?.[0] || place.image ? (
                          <img
                            src={place.images?.[0] || place.image}
                            alt={place.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'https://via.placeholder.com/48?text=No+Image';
                            }}
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <i className="fas fa-image text-gray-400"></i>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{place.name || t.unnamedPlace || 'Unnamed Place'}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {place.location || `${place.district ? place.district + ', ' : ''}${place.state || ''}`}
                        </p>
                        <div className="flex items-center mt-0.5 sm:mt-1">
                          <i className="fas fa-star text-yellow-400 text-[10px] sm:text-xs mr-1"></i>
                          <span className="text-[10px] sm:text-xs text-gray-600">{place.averageRating?.toFixed(1) || place.rating?.toFixed(1) || '0.0'}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {showSearchResults && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                <div className="absolute mt-1 sm:mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-200 p-3 sm:p-4 text-center text-xs sm:text-sm">
                  <p className="text-gray-500 mb-1">{t.noResultsFound}</p>
                  <p className="text-[10px] sm:text-xs text-gray-400">
                    {language === 'hi' ? 'कृपया अपनी खोज संशोधित करें या नए स्थान जोड़ें' : 'Try modifying your search or add new places'}
                  </p>
                </div>
              )}
            </div>

            {/* Language Selector */}
            <div className="relative hidden sm:block" ref={languageRef}>
              <button 
                onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                className="flex items-center space-x-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors duration-200"
              >
                <span className="text-xs sm:text-sm font-medium">{languages.find(lang => lang.code === language)?.name || 'English'}</span>
                <i className={`fas fa-chevron-${showLanguageDropdown ? 'up' : 'down'} text-[8px] sm:text-xs text-gray-500`}></i>
              </button>
              
              {showLanguageDropdown && (
                <div className="absolute right-0 mt-1 sm:mt-2 w-36 sm:w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => handleLanguageChange(lang.code)}
                      className={`w-full text-left px-3 sm:px-4 py-2 hover:bg-gray-50 text-xs sm:text-sm ${language === lang.code ? 'bg-blue-50 text-blue-600' : 'text-gray-700'}`}
                    >
                      {lang.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {user ? (
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-3 sm:px-4 md:px-6 py-1.5 sm:py-2 rounded-md hover:bg-red-700 transition-colors duration-200 text-xs sm:text-sm"
              >
                <span className="hidden sm:inline">{t.logout}</span>
                <i className="fas fa-sign-out-alt sm:hidden"></i>
              </button>
            ) : (
              <Link
                to="/auth"
                className="bg-blue-600 text-white px-3 sm:px-4 md:px-6 py-1.5 sm:py-2 rounded-md hover:bg-blue-700 transition-colors duration-200 text-xs sm:text-sm"
              >
                <span className="hidden sm:inline">{t.signIn}</span>
                <i className="fas fa-sign-in-alt sm:hidden"></i>
              </Link>
            )}

            {/* Mobile search button */}
            <button 
              className="sm:hidden flex items-center justify-center p-2 rounded-full text-gray-700 hover:bg-gray-100"
              onClick={() => navigate('/explore')}
              aria-label="Search"
            >
              <i className="fas fa-search"></i>
            </button>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex md:hidden items-center justify-center p-2 rounded-md text-gray-700 hover:text-blue-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              aria-expanded={isMenuOpen}
              aria-label="Main menu"
            >
              <span className="sr-only">Open main menu</span>
              <i className={`fas ${isMenuOpen ? 'fa-times' : 'fa-bars'}`}></i>
            </button>
          </div>
        </div>

        {/* Mobile menu - Better animation and organization */}
        <div 
          className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
            isMenuOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="px-2 pt-2 pb-3 space-y-1">
            <Link
              to="/"
              className="block px-4 py-3 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 active:bg-gray-100 flex items-center"
              onClick={() => setIsMenuOpen(false)}
            >
              <i className="fas fa-home mr-3 w-5 text-center"></i> {t.home}
            </Link>
            <Link
              to="/explore"
              className="block px-4 py-3 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 active:bg-gray-100 flex items-center"
              onClick={() => setIsMenuOpen(false)}
            >
              <i className="fas fa-compass mr-3 w-5 text-center"></i> {t.explore}
            </Link>
            {user && (
              <>
                <Link
                  to="/profile"
                  className="block px-4 py-3 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 active:bg-gray-100 flex items-center"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <i className="fas fa-user mr-3 w-5 text-center"></i> {t.profile}
                </Link>
                <Link
                  to="/recommend"
                  className="block px-4 py-3 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 active:bg-gray-100 flex items-center"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <i className="fas fa-thumbs-up mr-3 w-5 text-center"></i> {t.recommend}
                </Link>
                <Link
                  to="/add-place"
                  className="block px-4 py-3 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 active:bg-gray-100 flex items-center"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <i className="fas fa-plus-circle mr-3 w-5 text-center"></i> {t.addPlace}
                </Link>
              </>
            )}
          </div>
          
          <div className="border-t border-gray-100 pt-4 pb-3">
            {/* Mobile Language Selector */}
            <div className="px-4 py-2">
              <p className="text-xs font-medium text-gray-500 mb-2">{t.selectLanguage}</p>
              <div className="grid grid-cols-3 gap-2">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      handleLanguageChange(lang.code);
                      setIsMenuOpen(false);
                    }}
                    className={`px-3 py-2 text-xs rounded-md ${language === lang.code ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-700'}`}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
            </div>
            
            {user && (
              <div className="mt-3 px-4">
                <button
                  onClick={() => {
                    handleLogout();
                    setIsMenuOpen(false);
                  }}
                  className="flex items-center justify-center w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none"
                >
                  <i className="fas fa-sign-out-alt mr-2"></i>
                  {t.logout}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

Navbar.propTypes = {
  language: PropTypes.string.isRequired,
  setLanguage: PropTypes.func.isRequired,
  languages: PropTypes.array.isRequired,
  user: PropTypes.object,
  setShowLoginModal: PropTypes.func.isRequired,
  isMenuOpen: PropTypes.bool.isRequired,
  setIsMenuOpen: PropTypes.func.isRequired,
  isProfileOpen: PropTypes.bool.isRequired,
  setIsProfileOpen: PropTypes.func.isRequired
};

export default Navbar;