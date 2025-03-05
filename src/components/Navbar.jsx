import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { auth, db } from '../firebase/config';
import { signOut } from 'firebase/auth';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

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
  const searchRef = useRef(null);

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
              Home
            </Link>
            <Link
              to="/explore"
              className="text-gray-700 hover:text-blue-600 transition-colors duration-200"
            >
              Explore
            </Link>
            <Link
              to="/profile"
              className="text-gray-700 hover:text-blue-600 transition-colors duration-200"
            >
              Profile
            </Link>
            <Link
              to="/recommend"
              className="text-gray-700 hover:text-blue-600 transition-colors duration-200"
            >
              Recommend
            </Link>
            <Link
              to="/add-place"
              className="text-gray-700 hover:text-blue-600 transition-colors duration-200"
            >
              Add Place
            </Link>
          </div>

          {/* Search and Auth */}
          <div className="flex items-center space-x-4">
            <div className="relative" ref={searchRef}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={language === 'hi' ? 'गंतव्य खोजें...' : 'Search destinations...'}
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
                  {language === 'hi' ? 'कोई परिणाम नहीं मिला' : 'No results found'}
                </div>
              )}
            </div>

            {user ? (
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 transition-colors duration-200"
              >
                {language === 'hi' ? 'लॉग आउट' : 'Logout'}
              </button>
            ) : (
              <Link
                to="/auth"
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors duration-200"
              >
                {language === 'hi' ? 'साइन इन करें' : 'Sign In'}
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
          <div className="px-2 pt-2 pb-3 space-y-1">
            <Link
              to="/"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
              onClick={() => setIsMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              to="/explore"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
              onClick={() => setIsMenuOpen(false)}
            >
              Explore
            </Link>
            <Link
              to="/profile"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
              onClick={() => setIsMenuOpen(false)}
            >
              Profile
            </Link>
            <Link
              to="/recommend"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
              onClick={() => setIsMenuOpen(false)}
            >
              Recommend
            </Link>
            <Link
              to="/add-place"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
              onClick={() => setIsMenuOpen(false)}
            >
              Add Place
            </Link>
            {user && (
              <button
                onClick={() => {
                  handleLogout();
                  setIsMenuOpen(false);
                }}
                className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-600 hover:text-red-700 hover:bg-gray-50"
              >
                {language === 'hi' ? 'लॉग आउट' : 'Logout'}
              </button>
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