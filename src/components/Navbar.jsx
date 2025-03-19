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
      const searchTerms = value.toLowerCase().split(' ');
      
      // Get all places and filter in memory for better search
      const snapshot = await getDocs(query(placesRef, orderBy('name'), limit(20)));
      const places = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter places based on search terms
      const filtered = places.filter(place => {
        const searchableText = `${place.name} ${place.location} ${place.description} ${place.category}`.toLowerCase();
        return searchTerms.every(term => searchableText.includes(term));
      });

      setSearchResults(filtered.slice(0, 5));
      setShowSearchResults(true);
    } catch (error) {
      console.error('Error searching places:', error);
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
    setLanguage(code);
    setShowLanguageDropdown(false);
  };

  // Get translations for the current language
  const t = translations[language] || translations.en;

  return (
    <nav className="fixed top-0 w-full bg-white shadow-md z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="text-2xl font-bold text-blue-600">
              TravelJournal
            </Link>
          </div>

          {/* Main Navigation */}
          <div className="hidden md:flex items-center space-x-8">
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
          <div className="flex items-center space-x-4">
            <div className="relative hidden sm:block" ref={searchRef}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={t.searchDestinations}
                className="w-48 sm:w-64 px-4 py-2 rounded-full border-2 border-gray-200 focus:border-blue-500 focus:outline-none text-sm"
              />
              <i className={`fas ${isSearching ? 'fa-spinner fa-spin' : 'fa-search'} absolute right-4 top-3 text-gray-400`}></i>
              
              {/* Search Results Dropdown */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-y-auto z-50">
                  {searchResults.map((place) => (
                    <button
                      key={place.id}
                      onClick={() => handleResultClick(place.id)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center space-x-3 border-b border-gray-100 last:border-b-0"
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={place.images?.[0] || place.image}
                          alt={place.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{place.name}</p>
                        <p className="text-xs text-gray-500 truncate">{place.location}</p>
                        <div className="flex items-center mt-1">
                          <i className="fas fa-star text-yellow-400 text-xs mr-1"></i>
                          <span className="text-xs text-gray-600">{place.averageRating?.toFixed(1) || '0.0'}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {showSearchResults && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                <div className="absolute mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-200 p-4 text-center text-gray-500 text-sm">
                  {t.noResultsFound}
                </div>
              )}
            </div>

            {/* Language Selector */}
            <div className="relative hidden sm:block" ref={languageRef}>
              <button 
                onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                className="flex items-center space-x-1 px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors duration-200"
              >
                <span className="text-sm font-medium">{languages.find(lang => lang.code === language)?.name || 'English'}</span>
                <i className={`fas fa-chevron-${showLanguageDropdown ? 'up' : 'down'} text-xs text-gray-500`}></i>
              </button>
              
              {showLanguageDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => handleLanguageChange(lang.code)}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-50 ${language === lang.code ? 'bg-blue-50 text-blue-600' : 'text-gray-700'}`}
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
                className="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 transition-colors duration-200"
              >
                {t.logout}
              </button>
            ) : (
              <Link
                to="/auth"
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors duration-200"
              >
                {t.signIn}
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-blue-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            >
              <span className="sr-only">Open main menu</span>
              <i className={`fas ${isMenuOpen ? 'fa-times' : 'fa-bars'}`}></i>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <div className={`md:hidden ${isMenuOpen ? 'block' : 'hidden'}`}>
          <div className="px-2 pt-2 pb-3 space-y-2">
            <Link
              to="/"
              className="block px-4 py-3 rounded-md text-lg font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 active:bg-gray-100"
              onClick={() => setIsMenuOpen(false)}
            >
              <i className="fas fa-home mr-3"></i> {t.home}
            </Link>
            <Link
              to="/explore"
              className="block px-4 py-3 rounded-md text-lg font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 active:bg-gray-100"
              onClick={() => setIsMenuOpen(false)}
            >
              <i className="fas fa-compass mr-3"></i> {t.explore}
            </Link>
            <Link
              to="/profile"
              className="block px-4 py-3 rounded-md text-lg font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 active:bg-gray-100"
              onClick={() => setIsMenuOpen(false)}
            >
              <i className="fas fa-user mr-3"></i> {t.profile}
            </Link>
            <Link
              to="/recommend"
              className="block px-4 py-3 rounded-md text-lg font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 active:bg-gray-100"
              onClick={() => setIsMenuOpen(false)}
            >
              <i className="fas fa-thumbs-up mr-3"></i> {t.recommend}
            </Link>
            <Link
              to="/add-place"
              className="block px-4 py-3 rounded-md text-lg font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 active:bg-gray-100"
              onClick={() => setIsMenuOpen(false)}
            >
              <i className="fas fa-plus-circle mr-3"></i> {t.addPlace}
            </Link>
            {user && (
              <button
                onClick={() => {
                  handleLogout();
                  setIsMenuOpen(false);
                }}
                className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-600 hover:text-red-700 hover:bg-gray-50"
              >
                {t.logout}
              </button>
            )}
            
            {/* Mobile Language Selector */}
            <div className="px-3 py-2">
              <p className="text-sm font-medium text-gray-500 mb-2">{t.selectLanguage}</p>
              <div className="grid grid-cols-2 gap-2">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      handleLanguageChange(lang.code);
                      setIsMenuOpen(false);
                    }}
                    className={`px-3 py-2 text-sm rounded-md ${language === lang.code ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-700'}`}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
            </div>
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