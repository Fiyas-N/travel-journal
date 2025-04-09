import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import Navbar from '../components/Navbar';
import { db } from '../firebase/config';
import { collection, getDocs, doc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import LoadingScreen from '../components/LoadingScreen';
import translations from '../utils/translations';

// Admin page tabs
const TABS = {
  DESTINATIONS: 'destinations',
  USERS: 'users',
  MODERATION: 'moderation',
  REPORTS: 'reports',
  STATISTICS: 'statistics',
  SETTINGS: 'settings'
};

// Add this component before the return statement in the main component
const AlertMessage = () => {
  if (!alert.show) return null;
  
  return (
    <div className={`fixed top-16 right-4 max-w-sm p-4 rounded-md shadow-lg ${
      alert.type === 'success' ? 'bg-green-100 border-l-4 border-green-500 text-green-700' :
      alert.type === 'error' ? 'bg-red-100 border-l-4 border-red-500 text-red-700' :
      'bg-blue-100 border-l-4 border-blue-500 text-blue-700'
    } transition-opacity duration-300 ease-in-out`}>
      <div className="flex items-center">
        <div className="flex-shrink-0">
          {alert.type === 'success' && <i className="fas fa-check-circle"></i>}
          {alert.type === 'error' && <i className="fas fa-exclamation-circle"></i>}
          {alert.type === 'info' && <i className="fas fa-info-circle"></i>}
        </div>
        <div className="ml-3">
          <p className="text-sm font-medium">{alert.message}</p>
        </div>
        <div className="ml-auto pl-3">
          <button
            onClick={() => setAlert(prev => ({ ...prev, show: false }))}
            className="inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:text-gray-500"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

const Admin = ({ language, setLanguage, languages, user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [activeTab, setActiveTab] = useState(TABS.DESTINATIONS);
  const [destinations, setDestinations] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({
    totalDestinations: 0,
    totalUsers: 0,
    totalBookmarks: 0,
    totalComments: 0
  });
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetailMode, setUserDetailMode] = useState('profile');
  const [filterActive, setFilterActive] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [reportedContent, setReportedContent] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [reportType, setReportType] = useState('activity');
  const [timeFrame, setTimeFrame] = useState('week');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [alert, setAlert] = useState({
    type: null,
    message: '',
    show: false
  });
  
  // Get translations
  const t = translations[language] || translations.en;

  // Check if user is admin
  useEffect(() => {
    const checkAdminAccess = async () => {
      // Check if user is logged in
      if (!user) {
        navigate('/auth');
        return;
      }
      
      // Check if user has admin email
      if (user.email !== 'traveljournal914@gmail.com') {
        console.log('Access denied: Not an admin user');
        navigate('/');
        return;
      }
      
      // User is admin, continue loading admin page
      await fetchData();
    };
    
    checkAdminAccess();
  }, [user, navigate]);
  
  // Fetch all necessary data
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);  // Reset error state before fetching
      
      // Fetch destinations
      const destinationsSnapshot = await getDocs(collection(db, 'places'));
      const fetchedDestinations = destinationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDestinations(fetchedDestinations);
      
      // Fetch users
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const fetchedUsers = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(fetchedUsers);
      
      // Calculate statistics
      const totalBookmarks = fetchedUsers.reduce((total, user) => 
        total + (user.savedDestinations?.length || 0), 0);
      
      // Find all comments across all destinations
      let commentCount = 0;
      fetchedDestinations.forEach(dest => {
        if (dest.comments && Array.isArray(dest.comments)) {
          commentCount += dest.comments.length;
        }
      });
      
      setStats({
        totalDestinations: fetchedDestinations.length,
        totalUsers: fetchedUsers.length,
        totalBookmarks: totalBookmarks,
        totalComments: commentCount
      });
    } catch (err) {
      console.error("Error fetching admin data:", err);
      setError("Failed to load admin data. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  // Handle destination deletion
  const handleDeleteDestination = async (id) => {
    if (!window.confirm("Are you sure you want to delete this destination? This action cannot be undone.")) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Delete the destination document
      await deleteDoc(doc(db, 'places', id));
      
      // Update local state
      setDestinations(prev => prev.filter(dest => dest.id !== id));
      
      // Update statistics
      setStats(prev => ({
        ...prev,
        totalDestinations: prev.totalDestinations - 1
      }));
      
      alert("Destination deleted successfully!");
    } catch (err) {
      console.error("Error deleting destination:", err);
      alert("Failed to delete destination. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  // Handle feature/unfeature destination
  const handleToggleFeature = async (id, currentStatus) => {
    try {
      setLoading(true);
      
      // Update the destination document
      await updateDoc(doc(db, 'places', id), {
        featured: !currentStatus
      });
      
      // Update local state
      setDestinations(prev => prev.map(dest => 
        dest.id === id ? { ...dest, featured: !currentStatus } : dest
      ));
      
      alert(`Destination ${!currentStatus ? "featured" : "unfeatured"} successfully!`);
    } catch (err) {
      console.error("Error updating destination:", err);
      alert("Failed to update destination. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  // Handle user suspension
  const handleToggleSuspension = async (userId, isSuspended) => {
    try {
      setLoading(true);
      
      // Update user's suspension status in Firestore
      // In a real implementation, this would actually update the user's account
      await updateDoc(doc(db, 'users', userId), {
        suspended: !isSuspended,
        suspendedAt: !isSuspended ? new Date().toISOString() : null
      });
      
      // Update local state
      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, suspended: !isSuspended, suspendedAt: !isSuspended ? new Date().toISOString() : null } : user
      ));
      
      // If viewing the user details and the user was updated, update selectedUser
      if (selectedUser && selectedUser.id === userId) {
        setSelectedUser(prev => ({ ...prev, suspended: !isSuspended, suspendedAt: !isSuspended ? new Date().toISOString() : null }));
      }
      
      alert(`User ${!isSuspended ? "suspended" : "reactivated"} successfully!`);
    } catch (err) {
      console.error("Error updating user:", err);
      alert("Failed to update user status. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  // Render destinations tab content
  const renderDestinationsTab = () => {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
          <div>
            <h2 className="text-xl font-semibold">{t.manageDestinations || 'Manage Destinations'}</h2>
            <div className="text-sm text-gray-500">{t.total || 'Total'}: {destinations.length}</div>
          </div>
          
          <div className="flex items-center">
            <button 
              onClick={fetchData}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded flex items-center"
            >
              <i className="fas fa-sync-alt mr-1.5"></i>
              {t.refresh || 'Refresh'}
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.name || 'Name'}</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.location || 'Location'}</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.rating || 'Rating'}</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.addedBy || 'Added By'}</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.featured || 'Featured'}</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.actions || 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {destinations.map(destination => (
                <tr key={destination.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0">
                        <img 
                          className="h-10 w-10 rounded-full object-cover" 
                          src={destination.images?.[0] || 'https://via.placeholder.com/40?text=No+Image'} 
                          alt={destination.name || t.unnamed || 'Unnamed'} 
                          onError={(e) => { e.target.src = 'https://via.placeholder.com/40?text=Error' }}
                        />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{destination.name || t.unnamed || 'Unnamed'}</div>
                        <div className="text-sm text-gray-500">{destination.category || t.uncategorized || 'Uncategorized'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{destination.location || 'Unknown'}</div>
                    <div className="text-xs text-gray-500">
                      {[destination.district, destination.state, destination.country]
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <i className="fas fa-star text-yellow-400 mr-1 text-xs"></i>
                      <span className="text-sm text-gray-900">{(destination.averageRating || 0).toFixed(1)}</span>
                      <span className="text-xs text-gray-500 ml-1">
                        ({destination.ratings ? Object.keys(destination.ratings).length : 0})
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {destination.addedByName || destination.addedBy || 'System'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${destination.featured ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {destination.featured ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                    <button 
                      onClick={() => navigate(`/destination/${destination.id}`)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      View
                    </button>
                    <button 
                      onClick={() => handleToggleFeature(destination.id, destination.featured || false)}
                      className="text-indigo-600 hover:text-indigo-900 mr-3"
                    >
                      {destination.featured ? 'Unfeature' : 'Feature'}
                    </button>
                    <button 
                      onClick={() => handleDeleteDestination(destination.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Render users tab content
  const renderUsersTab = () => {
    // Filter users based on status and search query
    const filteredUsers = users.filter(user => {
      // Filter by status (all, active, suspended)
      if (filterActive !== 'all') {
        const isSuspended = user.suspended === true;
        if (filterActive === 'active' && isSuspended) return false;
        if (filterActive === 'suspended' && !isSuspended) return false;
      }
      
      // Filter by search query
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        return (
          (user.name || '').toLowerCase().includes(query) ||
          (user.email || '').toLowerCase().includes(query) ||
          (user.location || '').toLowerCase().includes(query)
        );
      }
      
      return true;
    });
    
    // Find user's destinations
    const getUserDestinations = (userId) => {
      return destinations.filter(dest => dest.addedBy === userId || dest.addedByUid === userId);
    };

    // Generate a random activity log for users (for demo purposes)
    const generateActivityLog = (userId) => {
      const activities = [
        { type: 'login', message: t.userLoggedIn || 'User logged in', timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) },
        { type: 'bookmark', message: t.bookmarkedDestination || 'Bookmarked a destination', timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) },
        { type: 'comment', message: t.addedComment || 'Added a comment', timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) },
        { type: 'rating', message: t.ratedDestination || 'Rated a destination', timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) },
        { type: 'profile', message: t.updatedProfile || 'Updated profile', timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) },
        { type: 'destination', message: t.addedDestination || 'Added a new destination', timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) },
      ];
      
      // Generate 5-12 random activities
      const numActivities = 5 + Math.floor(Math.random() * 8);
      const log = [];
      
      for (let i = 0; i < numActivities; i++) {
        const randomActivity = activities[Math.floor(Math.random() * activities.length)];
        log.push({
          ...randomActivity,
          id: `activity-${userId}-${i}`,
          timestamp: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000)
        });
      }
      
      // Sort by timestamp (newest first)
      return log.sort((a, b) => b.timestamp - a.timestamp);
    };
    
    // Render user details panel
    const renderUserDetails = () => {
      if (!selectedUser) return null;
      
      const userDestinations = getUserDestinations(selectedUser.id);
      const activityLog = generateActivityLog(selectedUser.id);
      
      return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center border-b px-6 py-4">
              <h3 className="text-lg font-medium">User Details</h3>
              <button 
                onClick={() => setSelectedUser(null)}
                className="text-gray-400 hover:text-gray-500"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="flex flex-col sm:flex-row border-b">
              <div className="p-6 flex-shrink-0 border-b sm:border-b-0 sm:border-r border-gray-200 sm:w-64">
                <div className="flex flex-col items-center">
                  <div className="h-24 w-24 rounded-full overflow-hidden mb-4">
                    <img 
                      src={selectedUser.profileImageUrl || 'https://via.placeholder.com/96?text=No+Image'} 
                      alt={selectedUser.name} 
                      className="h-full w-full object-cover"
                      onError={(e) => { e.target.src = 'https://via.placeholder.com/96?text=Error' }}
                    />
                  </div>
                  <h4 className="text-lg font-medium">{selectedUser.name || 'Unnamed User'}</h4>
                  <p className="text-sm text-gray-500 mb-2">{selectedUser.email}</p>
                  <p className="text-xs text-gray-500">{selectedUser.location || 'No location'}</p>
                  
                  <div className="mt-4 w-full">
                    <div className="flex justify-between text-xs mb-1">
                      <span>Status:</span>
                      <span className={selectedUser.suspended ? 'text-red-600' : 'text-green-600'}>
                        {selectedUser.suspended ? 'Suspended' : 'Active'}
                      </span>
                    </div>
                    
                    <div className="flex justify-between text-xs mb-1">
                      <span>Joined:</span>
                      <span>{selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : 'Unknown'}</span>
                    </div>
                    
                    <div className="flex justify-between text-xs mb-1">
                      <span>Destinations:</span>
                      <span>{userDestinations.length}</span>
                    </div>
                    
                    <div className="flex justify-between text-xs mb-1">
                      <span>Bookmarks:</span>
                      <span>{selectedUser.savedDestinations?.length || 0}</span>
                    </div>
                  </div>
                  
                  <div className="mt-6 w-full">
                    <button
                      onClick={() => handleToggleSuspension(selectedUser.id, selectedUser.suspended)}
                      className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                        selectedUser.suspended ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                      }`}
                    >
                      {selectedUser.suspended ? 'Reactivate User' : 'Suspend User'}
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="border-b border-gray-200">
                  <nav className="flex -mb-px">
                    <button
                      onClick={() => setUserDetailMode('profile')}
                      className={`py-4 px-6 text-sm font-medium ${
                        userDetailMode === 'profile'
                          ? 'border-b-2 border-blue-500 text-blue-600'
                          : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {t.profile || 'Profile'}
                    </button>
                    <button
                      onClick={() => setUserDetailMode('activity')}
                      className={`py-4 px-6 text-sm font-medium ${
                        userDetailMode === 'activity'
                          ? 'border-b-2 border-blue-500 text-blue-600'
                          : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {t.activity || 'Activity'}
                    </button>
                    <button
                      onClick={() => setUserDetailMode('destinations')}
                      className={`py-4 px-6 text-sm font-medium ${
                        userDetailMode === 'destinations'
                          ? 'border-b-2 border-blue-500 text-blue-600'
                          : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {t.destinations || 'Destinations'}
                    </button>
                  </nav>
                </div>
                
                <div className="p-6 overflow-y-auto" style={{ maxHeight: '60vh' }}>
                  {userDetailMode === 'profile' && (
                    <div>
                      <h4 className="text-lg font-medium mb-4">User Profile</h4>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                          <div className="p-3 bg-gray-50 rounded-md text-sm min-h-[5rem]">
                            {selectedUser.bio || 'No bio available'}
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Travel Preferences</label>
                          <div className="flex flex-wrap gap-2">
                            {selectedUser.preferences?.length > 0 ? (
                              selectedUser.preferences.map(pref => (
                                <span key={pref} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {pref}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-gray-500">No preferences set</span>
                            )}
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Email Preferences</label>
                          <div className="space-y-2">
                            <div className="flex items-center">
                              <input type="checkbox" className="h-4 w-4 text-blue-600 border-gray-300 rounded" checked disabled />
                              <label className="ml-2 block text-sm text-gray-900">System notifications</label>
                            </div>
                            <div className="flex items-center">
                              <input type="checkbox" className="h-4 w-4 text-blue-600 border-gray-300 rounded" checked disabled />
                              <label className="ml-2 block text-sm text-gray-900">Marketing emails</label>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {userDetailMode === 'activity' && (
                    <div>
                      <h4 className="text-lg font-medium mb-4">Activity Log</h4>
                      
                      <div className="space-y-3">
                        {activityLog.map(activity => (
                          <div key={activity.id} className="flex items-start p-3 border-b border-gray-100 last:border-b-0">
                            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                              activity.type === 'login' ? 'bg-blue-100 text-blue-600' :
                              activity.type === 'bookmark' ? 'bg-green-100 text-green-600' :
                              activity.type === 'comment' ? 'bg-purple-100 text-purple-600' :
                              activity.type === 'rating' ? 'bg-yellow-100 text-yellow-600' :
                              activity.type === 'profile' ? 'bg-gray-100 text-gray-600' :
                              'bg-indigo-100 text-indigo-600'
                            }`}>
                              <i className={`fas ${
                                activity.type === 'login' ? 'fa-sign-in-alt' :
                                activity.type === 'bookmark' ? 'fa-bookmark' :
                                activity.type === 'comment' ? 'fa-comment' :
                                activity.type === 'rating' ? 'fa-star' :
                                activity.type === 'profile' ? 'fa-user-edit' :
                                'fa-map-marked-alt'
                              } text-xs`}></i>
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium">{activity.message}</div>
                              <div className="text-xs text-gray-500">{activity.timestamp.toLocaleString()}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {userDetailMode === 'destinations' && (
                    <div>
                      <h4 className="text-lg font-medium mb-4">Added Destinations</h4>
                      
                      {userDestinations.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                          <i className="fas fa-map-pin text-4xl mb-3 text-gray-300"></i>
                          <p>No destinations added by this user</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {userDestinations.map(destination => (
                            <div key={destination.id} className="border rounded-lg overflow-hidden">
                              <div className="h-32 bg-gray-100 relative">
                                {destination.images?.[0] ? (
                                  <img 
                                    src={destination.images[0]} 
                                    alt={destination.name} 
                                    className="w-full h-full object-cover"
                                    onError={(e) => { e.target.src = 'https://via.placeholder.com/300x150?text=No+Image' }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <i className="fas fa-image text-gray-400 text-2xl"></i>
                                  </div>
                                )}
                                
                                {destination.featured && (
                                  <div className="absolute top-2 right-2 bg-yellow-100 text-yellow-800 text-xs py-0.5 px-2 rounded-sm">
                                    Featured
                                  </div>
                                )}
                              </div>
                              <div className="p-3">
                                <h5 className="font-medium mb-1">{destination.name || 'Unnamed Place'}</h5>
                                <div className="flex items-center text-sm text-gray-600">
                                  <i className="fas fa-star text-yellow-400 mr-1 text-xs"></i>
                                  <span>{(destination.averageRating || 0).toFixed(1)}</span>
                                  <span className="mx-2">•</span>
                                  <i className="fas fa-map-marker-alt mr-1 text-xs"></i>
                                  <span className="truncate">{destination.location || 'Unknown location'}</span>
                                </div>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/destination/${destination.id}`);
                                  }}
                                  className="mt-2 text-blue-600 hover:text-blue-800 text-sm flex items-center"
                                >
                                  <i className="fas fa-external-link-alt mr-1"></i>
                                  {t.viewDetails || 'View Details'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    };
    
    return (
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h2 className="text-xl font-semibold">{t.manageUsers || 'Manage Users'}</h2>
            <div className="text-sm text-gray-500">{t.total || 'Total'}: {users.length}</div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative flex-1 sm:w-64">
              <input
                type="text"
                placeholder={t.searchUsers || "Search users..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i className="fas fa-search text-gray-400"></i>
              </div>
            </div>
            
            <div>
              <select
                value={filterActive}
                onChange={(e) => setFilterActive(e.target.value)}
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value="all">{t.allUsers || 'All Users'}</option>
                <option value="active">{t.activeOnly || 'Active Only'}</option>
                <option value="suspended">{t.suspendedOnly || 'Suspended Only'}</option>
              </select>
            </div>
          </div>
        </div>
        
        {filteredUsers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <i className="fas fa-users text-4xl mb-3 text-gray-300"></i>
            <p>{t.noUsersFound || 'No users found matching your criteria'}</p>
            <button 
              onClick={() => {setSearchQuery(''); setFilterActive('all');}}
              className="mt-4 text-blue-600 hover:text-blue-800 underline text-sm"
            >
              {t.clearFilters || 'Clear filters'}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Saved Places</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                          <img 
                            className="h-10 w-10 rounded-full object-cover" 
                            src={user.profileImageUrl || 'https://via.placeholder.com/40?text=No+Image'} 
                            alt={user.name} 
                            onError={(e) => { e.target.src = 'https://via.placeholder.com/40?text=Error' }}
                          />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{user.name || 'Unknown'}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{user.location || 'Unknown'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.savedDestinations?.length || 0} places
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.suspended ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {user.suspended ? 'Suspended' : 'Active'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button 
                        onClick={() => {
                          setSelectedUser(user);
                          setUserDetailMode('profile');
                        }}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        {t.view || 'View'}
                      </button>
                      
                      {user.email !== 'traveljournal914@gmail.com' && (
                        <button 
                          onClick={() => handleToggleSuspension(user.id, user.suspended)}
                          className={user.suspended ? "text-green-600 hover:text-green-900" : "text-red-600 hover:text-red-900"}
                        >
                          {user.suspended ? (t.reactivate || 'Reactivate') : (t.suspend || 'Suspend')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* User Details Modal */}
        {selectedUser && renderUserDetails()}
      </div>
    );
  };

  // Render statistics tab content
  const renderStatisticsTab = () => {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-xl font-semibold mb-6">Platform Statistics</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-blue-50 rounded-lg p-3 sm:p-4 shadow-sm">
            <div className="text-blue-500 text-xs sm:text-sm font-medium uppercase">{t.destinations || 'Destinations'}</div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-800 mt-1 sm:mt-2">{stats.totalDestinations}</div>
            <div className="text-blue-700 flex items-center mt-1 sm:mt-2">
              <i className="fas fa-map-marked-alt mr-1"></i>
              <span className="text-xs sm:text-sm">{t.placesInPlatform || 'Places in the platform'}</span>
            </div>
          </div>
          
          <div className="bg-purple-50 rounded-lg p-3 sm:p-4 shadow-sm">
            <div className="text-purple-500 text-xs sm:text-sm font-medium uppercase">{t.users || 'Users'}</div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-800 mt-1 sm:mt-2">{stats.totalUsers}</div>
            <div className="text-purple-700 flex items-center mt-1 sm:mt-2">
              <i className="fas fa-users mr-1"></i>
              <span className="text-xs sm:text-sm">Registered travelers</span>
            </div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-3 sm:p-4 shadow-sm">
            <div className="text-green-500 text-xs sm:text-sm font-medium uppercase">{t.bookmarks || 'Bookmarks'}</div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-800 mt-1 sm:mt-2">{stats.totalBookmarks}</div>
            <div className="text-green-700 flex items-center mt-1 sm:mt-2">
              <i className="fas fa-bookmark mr-1"></i>
              <span className="text-xs sm:text-sm">Saved destinations</span>
            </div>
          </div>
          
          <div className="bg-yellow-50 rounded-lg p-3 sm:p-4 shadow-sm">
            <div className="text-yellow-500 text-xs sm:text-sm font-medium uppercase">{t.comments || 'Comments'}</div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-800 mt-1 sm:mt-2">{stats.totalComments}</div>
            <div className="text-yellow-700 flex items-center mt-1 sm:mt-2">
              <i className="fas fa-comments mr-1"></i>
              <span className="text-xs sm:text-sm">Traveler reviews</span>
            </div>
          </div>
        </div>
        
        <div className="mt-8">
          <h3 className="text-lg font-medium mb-4">Most Popular Destinations</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destination</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bookmarks</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comments</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {destinations
                  .sort((a, b) => (b.bookmarkCount || 0) - (a.bookmarkCount || 0))
                  .slice(0, 5)
                  .map(destination => (
                    <tr key={destination.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 flex-shrink-0">
                            <img 
                              className="h-8 w-8 rounded object-cover" 
                              src={destination.images?.[0] || 'https://via.placeholder.com/32?text=No+Image'} 
                              alt={destination.name} 
                              onError={(e) => { e.target.src = 'https://via.placeholder.com/32?text=Error' }}
                            />
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">{destination.name || 'Unnamed'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {destination.bookmarkCount || 0}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          <i className="fas fa-star text-yellow-400 mr-1 text-xs"></i>
                          {(destination.averageRating || 0).toFixed(1)} 
                          <span className="text-xs text-gray-500 ml-1">
                            ({destination.ratings ? Object.keys(destination.ratings).length : 0})
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {destination.comments?.length || 0}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // Render settings tab content
  const renderSettingsTab = () => {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-xl font-semibold mb-6">Admin Settings</h2>
        
        <div className="max-w-xl">
          <div className="mb-8">
            <h3 className="text-lg font-medium mb-4">{t.currentAdminAccount || 'Current Admin Account'}</h3>
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center">
                <div className="h-12 w-12 flex-shrink-0">
                  <img 
                    src={user?.photoURL || 'https://via.placeholder.com/48?text=Admin'} 
                    alt="Admin profile" 
                    className="h-12 w-12 rounded-full object-cover"
                    key={`admin-${user?.uid}`}
                    onError={(e) => { e.target.src = 'https://via.placeholder.com/48?text=Admin' }}
                  />
                </div>
                <div className="ml-4">
                  <div className="text-sm font-medium text-gray-900">{user?.displayName || 'Admin User'}</div>
                  <div className="text-sm text-gray-500">{user?.email}</div>
                </div>
              </div>
              <div className="mt-4 text-sm text-gray-600">
                Admin privileges are granted to this email address only. You can manage destinations, 
                view user data, and access platform statistics.
              </div>
            </div>
          </div>
          
          <div className="mb-8">
            <h3 className="text-lg font-medium mb-4">{t.databaseInformation || 'Database Information'}</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-600">Database provider:</span>
                <span className="text-sm font-medium">Firebase Firestore</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-600">Storage provider:</span>
                <span className="text-sm font-medium">Firebase Storage</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Authentication provider:</span>
                <span className="text-sm font-medium">Firebase Auth</span>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-4">{t.adminActions || 'Admin Actions'}</h3>
            <div className="space-y-3">
              <button className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-md flex items-center justify-center transition-colors">
                <i className="fas fa-sync-alt mr-2"></i>
                <span>{t.refreshDatabaseCache || 'Refresh Database Cache'}</span>
              </button>
              
              <button 
                onClick={fetchData}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md flex items-center justify-center transition-colors"
              >
                <i className="fas fa-download mr-2"></i>
                <span>{t.reloadAdminData || 'Reload Admin Data'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render moderation tab content
  const renderModerationTab = () => {
    // Ensure we have mock data for the moderation tab
    useEffect(() => {
      const generateMockReportedContent = () => {
      if (reportedContent.length === 0) {
          console.log("Generating mock reported content");
          
          // Create some mock comment reports
          const commentReports = destinations
            .filter(dest => dest.comments && Array.isArray(dest.comments) && dest.comments.length > 0)
            .flatMap(destination => {
              return (destination.comments || [])
                .filter((_, index) => index % 5 === 0) // Take every 5th comment
            .map(comment => ({
                  id: comment.id || `comment-${Math.random().toString(36).substring(2, 9)}`,
              type: 'comment',
                  content: comment.text || 'Comment content',
              reportedBy: users[Math.floor(Math.random() * users.length)]?.name || 'Anonymous',
              reportReason: ['Inappropriate content', 'Spam', 'Offensive language', 'Harassment'][Math.floor(Math.random() * 4)],
              timestamp: comment.timestamp || new Date().toISOString(),
              parentId: destination.id,
              parentName: destination.name || 'Unknown destination'
            }));
        });
        
          // Create some mock review reports (just for demonstration)
          const reviewReports = destinations
            .slice(0, 3) // Just use a few destinations
            .map(destination => ({
              id: `review-${Math.random().toString(36).substring(2, 9)}`,
              type: 'review',
              content: 'This review contains inappropriate content that needs moderation.',
              reportedBy: users[Math.floor(Math.random() * users.length)]?.name || 'Anonymous',
              reportReason: ['Inappropriate content', 'Spam', 'Offensive language', 'Harassment'][Math.floor(Math.random() * 4)],
              timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
              parentId: destination.id,
              parentName: destination.name || 'Unknown destination'
            }));
          
          // Combine and set the reported content
          const mockContent = [...commentReports, ...reviewReports];
          
          if (mockContent.length > 0) {
            setReportedContent(mockContent);
          }
        }
      };
      
      generateMockReportedContent();
    }, [destinations, users, reportedContent.length]);
    
    // Handle approving content (removing report flag)
    const handleApproveContent = (id) => {
      try {
        // In a real app, this would make an API call
        // For now, we'll just update our local state
        setReportedContent(prev => prev.filter(item => item.id !== id));
        
        // Show success message
        setAlert({
          type: 'success',
          message: t.contentApproved || 'Content has been approved and report dismissed',
          show: true
        });
        
        // Hide alert after 3 seconds
        setTimeout(() => {
          setAlert(prev => ({ ...prev, show: false }));
        }, 3000);
      } catch (error) {
        console.error('Error approving content:', error);
        setAlert({
          type: 'error',
          message: t.errorApprovingContent || 'Error approving content',
          show: true
        });
        
        // Hide alert after 3 seconds
        setTimeout(() => {
          setAlert(prev => ({ ...prev, show: false }));
        }, 3000);
      }
    };
    
    // Handle removing content
    const handleRemoveContent = (id) => {
      try {
        // In a real app, confirm with the user before removing
        if (window.confirm(t.confirmRemoveContent || 'Are you sure you want to remove this content? This action cannot be undone.')) {
          // In a real app, this would make an API call to remove the content
          // For now, we'll just update our local state
          setReportedContent(prev => prev.filter(item => item.id !== id));
          
          // Show success message
          setAlert({
            type: 'success',
            message: t.contentRemoved || 'Content has been removed successfully',
            show: true
          });
          
          // Hide alert after 3 seconds
          setTimeout(() => {
            setAlert(prev => ({ ...prev, show: false }));
          }, 3000);
        }
      } catch (error) {
        console.error('Error removing content:', error);
        setAlert({
          type: 'error',
          message: t.errorRemovingContent || 'Error removing content',
          show: true
        });
        
        // Hide alert after 3 seconds
        setTimeout(() => {
          setAlert(prev => ({ ...prev, show: false }));
        }, 3000);
      }
    };
    
    // Improve the moderation content type recognition function
    const getContentTypeBadge = (type) => {
      const bgColor = type === 'comment' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800';
      const label = type === 'comment' ? (t.comment || 'Comment') : (t.review || 'Review');
      
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgColor}`}>
          {label}
        </span>
      );
    };
    
    // In the renderModerationTab function, let's add a filtered items constant
    // and use it to determine what to display
    const filteredItems = reportedContent.filter(item => 
      filterType === 'all' || item.type === filterType
    );

    return (
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{t.contentModeration || 'Content Moderation'}</h2>
          <div className="text-sm text-gray-500">{t.reportedItems || 'Reported Items'}: {reportedContent.length}</div>
        </div>
        
        {/* Filter buttons */}
        <div className="flex space-x-2 mb-4">
          <button
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-md transition-colors ${
              filterType === 'all'
                ? 'bg-blue-600 text-white font-medium shadow-md'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            {t.all || 'All'} 
            {reportedContent.length > 0 && 
              <span className="ml-2 px-2 py-0.5 text-xs bg-white text-blue-600 rounded-full">
                {reportedContent.length}
              </span>
            }
          </button>
          <button
            onClick={() => setFilterType('comment')}
            className={`px-4 py-2 rounded-md transition-colors ${
              filterType === 'comment'
                ? 'bg-blue-600 text-white font-medium shadow-md'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            {t.comments || 'Comments'}
            {reportedContent.filter(item => item.type === 'comment').length > 0 && 
              <span className="ml-2 px-2 py-0.5 text-xs bg-white text-blue-600 rounded-full">
                {reportedContent.filter(item => item.type === 'comment').length}
              </span>
            }
          </button>
          <button
            onClick={() => setFilterType('review')}
            className={`px-4 py-2 rounded-md transition-colors ${
              filterType === 'review'
                ? 'bg-blue-600 text-white font-medium shadow-md'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            {t.reviews || 'Reviews'}
            {reportedContent.filter(item => item.type === 'review').length > 0 && 
              <span className="ml-2 px-2 py-0.5 text-xs bg-white text-blue-600 rounded-full">
                {reportedContent.filter(item => item.type === 'review').length}
              </span>
            }
          </button>
        </div>
        
        {/* Filtered content display */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <i className="fas fa-check-circle text-4xl mb-3 text-green-500"></i>
            <p>{t.noReportedContent || 'No reported content to moderate'}</p>
            {reportedContent.length > 0 && filterType !== 'all' && (
              <button 
                onClick={() => setFilterType('all')}
                className="mt-4 text-blue-600 hover:text-blue-800 underline text-sm"
              >
                {t.showAllContent || 'Show all content'}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" 
                      aria-label={t.type || "Type"}>
                      <span className="md:hidden">{t.typeShort || "Type"}</span>
                      <span className="hidden md:inline">{t.type || "Type"}</span>
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t.content || "Content"}
                    </th>
                    <th scope="col" className="hidden sm:table-cell px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t.reportedBy || "Reported By"}
                    </th>
                    <th scope="col" className="hidden md:table-cell px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t.reason || "Reason"}
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t.date || "Date"}
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t.actions || "Actions"}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredItems.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3 whitespace-nowrap">
                        {getContentTypeBadge(item.type)}
                      </td>
                      <td className="px-3 py-3">
                        <div 
                          className="text-sm text-gray-900 line-clamp-2 cursor-pointer hover:text-blue-700"
                          onClick={() => alert(item.content)}
                          title={t.clickToViewFull || "Click to view full content"}
                        >
                          {item.content}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {t.on || 'On'}: <span className="font-medium">{item.parentName}</span>
                        </div>
                        <div className="sm:hidden text-xs text-gray-500 mt-1">
                          {t.by || 'By'}: {item.reportedBy}
                        </div>
                        <div className="md:hidden text-xs text-gray-500 mt-1">
                          {t.reason || 'Reason'}: {item.reportReason}
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                        {item.reportedBy}
                      </td>
                      <td className="hidden md:table-cell px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                        {item.reportReason}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex flex-col">
                          <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                          <span className="text-xs text-gray-400">{new Date(item.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm font-medium">
                        <div className="flex flex-wrap gap-2">
                          <button 
                            onClick={() => handleApproveContent(item.id)}
                            className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded bg-green-100 text-green-800 hover:bg-green-200"
                            aria-label={`${t.approve || 'Approve'} ${item.type}`}
                          >
                            <i className="fas fa-check mr-1.5"></i>
                            {t.approve || 'Approve'}
                          </button>
                          <button 
                            onClick={() => handleRemoveContent(item.id)}
                            className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded bg-red-100 text-red-800 hover:bg-red-200"
                            aria-label={`${t.remove || 'Remove'} ${item.type}`}
                          >
                            <i className="fas fa-trash-alt mr-1.5"></i>
                            {t.remove || 'Remove'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render reports tab content
  const renderReportsTab = () => {
    const [reportType, setReportType] = useState('userActivity');
    const [timeFrame, setTimeFrame] = useState('lastWeek');
    const [reportData, setReportData] = useState([]);
    const [reportGenerated, setReportGenerated] = useState(false);
    
    // Mock report types
    const reportTypes = [
      { id: 'userActivity', name: t.userActivity || 'User Activity' },
      { id: 'contentCreation', name: t.contentCreation || 'Content Creation' },
      { id: 'popularDestinations', name: t.popularDestinations || 'Popular Destinations' },
      { id: 'reportedContent', name: t.reportedContent || 'Reported Content' }
    ];
    
    // Mock time frames
    const timeFrames = [
      { id: 'today', name: t.today || 'Today' },
      { id: 'lastWeek', name: t.lastWeek || 'Last Week' },
      { id: 'lastMonth', name: t.lastMonth || 'Last Month' },
      { id: 'lastYear', name: t.lastYear || 'Last Year' }
    ];
    
    // Mock data generation
    const generateReportData = () => {
      setGeneratingReport(true);
      
      // Simulate API call delay
      setTimeout(() => {
        let mockData = [];
        
        // Generate different mock data based on report type
        if (reportType === 'userActivity') {
          mockData = [
            { id: 1, username: 'traveler123', action: 'login', timestamp: new Date(Date.now() - 3600000).toISOString() },
            { id: 2, username: 'explorer456', action: 'created_post', timestamp: new Date(Date.now() - 7200000).toISOString() },
            { id: 3, username: 'wanderlust789', action: 'updated_profile', timestamp: new Date(Date.now() - 14400000).toISOString() },
            { id: 4, username: 'nomad101', action: 'added_review', timestamp: new Date(Date.now() - 28800000).toISOString() },
            { id: 5, username: 'globetrotter55', action: 'login', timestamp: new Date(Date.now() - 43200000).toISOString() }
          ];
        } else if (reportType === 'contentCreation') {
          mockData = [
            { id: 1, type: 'destination', creator: 'admin', title: 'Paris, France', timestamp: new Date(Date.now() - 3600000).toISOString() },
            { id: 2, type: 'review', creator: 'traveler123', destination: 'Tokyo, Japan', rating: 5, timestamp: new Date(Date.now() - 7200000).toISOString() },
            { id: 3, type: 'comment', creator: 'explorer456', destination: 'New York, USA', timestamp: new Date(Date.now() - 14400000).toISOString() },
            { id: 4, type: 'destination', creator: 'admin', title: 'Cairo, Egypt', timestamp: new Date(Date.now() - 28800000).toISOString() },
            { id: 5, type: 'review', creator: 'wanderlust789', destination: 'Rome, Italy', rating: 4, timestamp: new Date(Date.now() - 43200000).toISOString() }
          ];
        } else if (reportType === 'popularDestinations') {
          mockData = [
            { id: 1, destination: 'Tokyo, Japan', views: 1245, favorites: 89, reviews: 32 },
            { id: 2, destination: 'Paris, France', views: 987, favorites: 76, reviews: 28 },
            { id: 3, destination: 'New York, USA', views: 856, favorites: 67, reviews: 24 },
            { id: 4, destination: 'Rome, Italy', views: 754, favorites: 58, reviews: 21 },
            { id: 5, destination: 'Cairo, Egypt', views: 612, favorites: 45, reviews: 18 }
          ];
        } else if (reportType === 'reportedContent') {
          mockData = [
            { id: 1, type: 'comment', reporter: 'traveler123', reported: 'nomad101', reason: 'inappropriate', timestamp: new Date(Date.now() - 3600000).toISOString() },
            { id: 2, type: 'review', reporter: 'explorer456', reported: 'traveler123', reason: 'spam', timestamp: new Date(Date.now() - 7200000).toISOString() },
            { id: 3, type: 'comment', reporter: 'wanderlust789', reported: 'explorer456', reason: 'offensive', timestamp: new Date(Date.now() - 14400000).toISOString() },
            { id: 4, type: 'review', reporter: 'nomad101', reported: 'wanderlust789', reason: 'inappropriate', timestamp: new Date(Date.now() - 28800000).toISOString() },
            { id: 5, type: 'comment', reporter: 'globetrotter55', reported: 'nomad101', reason: 'offensive', timestamp: new Date(Date.now() - 43200000).toISOString() }
          ];
        }
        
        setReportData(mockData);
        setReportGenerated(true);
        setGeneratingReport(false);
        
        // Show success alert
        setAlert({
          type: 'success',
          message: t.reportGenerated || 'Report generated successfully',
          show: true
        });
        
        // Hide alert after 3 seconds
        setTimeout(() => {
          setAlert(prev => ({ ...prev, show: false }));
        }, 3000);
      }, 1500); // Simulate 1.5s delay for API call
    };
    
    // Mock function to download CSV
    const downloadCSV = () => {
      // In a real app, this would convert the data to CSV format
      // For now, just show an alert
      setAlert({
        type: 'info',
        message: t.downloadStarted || 'Download started. Your file will be ready shortly.',
        show: true
      });
      
      // Hide alert after 3 seconds
      setTimeout(() => {
        setAlert(prev => ({ ...prev, show: false }));
      }, 3000);
    };
    
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">{t.generateReports || 'Generate Reports'}</h2>
        
        <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.reportType || 'Report Type'}
            </label>
                <select 
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
              className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              {reportTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
                </select>
              </div>
              
              <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.timeFrame || 'Time Frame'}
            </label>
                <select 
                  value={timeFrame}
                  onChange={(e) => setTimeFrame(e.target.value)}
              className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              {timeFrames.map((frame) => (
                <option key={frame.id} value={frame.id}>
                  {frame.name}
                </option>
              ))}
                </select>
          </div>
              </div>
              
        <div className="flex justify-center mb-6">
              <button
            onClick={generateReportData}
                disabled={generatingReport}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingReport ? (
              <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                {t.generating || 'Generating...'}
              </>
                ) : (
              <>
                <i className="fas fa-chart-line mr-2"></i>
                {t.generateReport || 'Generate Report'}
              </>
                )}
              </button>
          </div>
          
        {reportGenerated && reportData.length > 0 && (
          <div className="mt-6">
              <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">
                {reportTypes.find(type => type.id === reportType)?.name} - {timeFrames.find(frame => frame.id === timeFrame)?.name}
              </h3>
                <button 
                onClick={downloadCSV}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                <i className="fas fa-download mr-1.5"></i>
                {t.downloadCSV || 'Download CSV'}
                </button>
              </div>
              
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {reportType === 'userActivity' && (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.username || 'Username'}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.action || 'Action'}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.timestamp || 'Timestamp'}</th>
                      </>
                    )}
                    {reportType === 'contentCreation' && (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.type || 'Type'}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.creator || 'Creator'}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.details || 'Details'}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.timestamp || 'Timestamp'}</th>
                      </>
                    )}
                    {reportType === 'popularDestinations' && (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.destination || 'Destination'}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.views || 'Views'}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.favorites || 'Favorites'}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.reviews || 'Reviews'}</th>
                      </>
                    )}
                    {reportType === 'reportedContent' && (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.type || 'Type'}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.reporter || 'Reporter'}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.reported || 'Reported User'}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.reason || 'Reason'}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.timestamp || 'Timestamp'}</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.map((item) => (
                    <tr key={item.id}>
                      {reportType === 'userActivity' && (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.username}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.action}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(item.timestamp).toLocaleString()}</td>
                        </>
                      )}
                      {reportType === 'contentCreation' && (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.type}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.creator}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.type === 'destination' ? item.title : item.destination}
                            {item.type === 'review' && ` (${item.rating}★)`}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(item.timestamp).toLocaleString()}</td>
                        </>
                      )}
                      {reportType === 'popularDestinations' && (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.destination}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.views}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.favorites}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.reviews}</td>
                        </>
                      )}
                      {reportType === 'reportedContent' && (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.type}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.reporter}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.reported}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.reason}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(item.timestamp).toLocaleString()}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
                </div>
                  </div>
        )}
        
        {reportGenerated && reportData.length === 0 && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mt-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <i className="fas fa-exclamation-triangle text-yellow-400"></i>
                  </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  {t.noDataFound || 'No data found for the selected report type and time frame.'}
                </p>
                  </div>
                  </div>
                  </div>
        )}
      </div>
    );
  };

  // Render active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case TABS.DESTINATIONS:
        return renderDestinationsTab();
      case TABS.USERS:
        return renderUsersTab();
      case TABS.MODERATION:
        return renderModerationTab();
      case TABS.REPORTS:
        return renderReportsTab();
      case TABS.STATISTICS:
        return renderStatisticsTab();
      case TABS.SETTINGS:
        return renderSettingsTab();
      default:
        return renderDestinationsTab();
    }
  };
  
  // Access denied message
  if (!user || user.email !== 'traveljournal914@gmail.com') {
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
        <div className="pt-20 px-4 sm:px-6 max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="text-red-500 text-6xl mb-4">
              <i className="fas fa-lock"></i>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600 mb-6">
              You don't have permission to access this page. This area is restricted to administrators only.
            </p>
            <button 
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Return to Homepage
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Add a scroll-to-top button for long pages
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  return (
    <div className="min-h-screen bg-gray-100">
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
      
      <div className="pt-20 pb-10 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{t.adminDashboard || 'Admin Dashboard'}</h1>
            <p className="text-gray-600 text-sm sm:text-base">{t.adminDescription || 'Manage destinations, users, and view statistics'}</p>
          </div>
          
          <div className="mt-2 sm:mt-0">
            <button 
              onClick={fetchData}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center text-sm"
            >
              <i className="fas fa-sync-alt mr-2"></i>
              <span>{t.refreshData || 'Refresh Data'}</span>
            </button>
          </div>
        </div>
        
        {/* Tab navigation */}
        <div className="flex overflow-x-auto mb-6 bg-white rounded-lg shadow-sm admin-tabs" role="tablist">
          {Object.values(TABS).map(tab => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`${tab}-panel`}
              id={`${tab}-tab`}
              className={`px-4 sm:px-6 py-3 text-xs sm:text-sm font-medium whitespace-nowrap relative ${
                activeTab === tab
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
              onClick={() => setActiveTab(tab)}
            >
              <i className={`mr-1 sm:mr-2 ${
                tab === TABS.DESTINATIONS ? 'fas fa-map-marked-alt' : 
                tab === TABS.USERS ? 'fas fa-users' : 
                tab === TABS.MODERATION ? 'fas fa-comment-dots' :
                tab === TABS.REPORTS ? 'fas fa-chart-bar' :
                tab === TABS.STATISTICS ? 'fas fa-chart-line' : 
                'fas fa-cog'
              }`} aria-hidden="true"></i>
              <span className="hidden sm:inline">{t[tab] || tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
              <span className="sm:hidden">{t[`${tab}Short`] || (tab === TABS.DESTINATIONS ? 'Dest' : 
                  tab === TABS.STATISTICS ? 'Stats' : 
                  tab === TABS.MODERATION ? 'Mod' : 
                  tab.slice(0, 4))}</span>
              
              {/* Notification indicator for moderation tab */}
              {tab === TABS.MODERATION && reportedContent.length > 0 && (
                <span className="absolute top-2 right-1 h-4 w-4 bg-red-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">{reportedContent.length > 9 ? '9+' : reportedContent.length}</span>
                </span>
              )}
            </button>
          ))}
        </div>
        
        {/* Loading state */}
        {loading ? (
          <div className="bg-white rounded-lg shadow-sm p-6 sm:p-12 flex justify-center">
            <div className="text-center">
              <div className="inline-flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p className="mt-4 text-gray-600">{t.loadingAdminData || 'Loading admin data...'}</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <div className="text-red-500 text-4xl mb-4">
              <i className="fas fa-exclamation-circle"></i>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Data</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button 
              onClick={fetchData}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : (
          // Tab content
          <div
            role="tabpanel" 
            id={`${activeTab}-panel`}
            aria-labelledby={`${activeTab}-tab`}
          >
            {renderTabContent()}
          </div>
        )}
        
        {/* Add a scroll-to-top button for long pages */}
        {showScrollTop && (
          <button
            onClick={handleScrollToTop}
            className="fixed bottom-4 right-4 w-10 h-10 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            aria-label={t.scrollToTop || "Scroll to top"}
          >
            <i className="fas fa-arrow-up"></i>
          </button>
        )}
      </div>
      <AlertMessage />
    </div>
  );
};

Admin.propTypes = {
  language: PropTypes.string.isRequired,
  setLanguage: PropTypes.func.isRequired,
  languages: PropTypes.array.isRequired,
  user: PropTypes.object
};

export default Admin; 