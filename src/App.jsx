import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import * as echarts from 'echarts'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Pagination, Autoplay } from 'swiper/modules'
import 'leaflet/dist/leaflet.css'
import './styles/App.css'

// Import your components
import Home from './pages/Home'
import Profile from './pages/Profile'
import Recommend from './pages/Recommend'
import AddPlace from './pages/AddPlace'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import DestinationDetails from './pages/DestinationDetails'
import { auth } from './firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import ProtectedRoute from './components/ProtectedRoute'
import Auth from './pages/Auth'
import Explore from './pages/Explore'

// Languages configuration
const languages = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'हिंदी' },
  { code: 'ml', name: 'മലയാളം' },
  { code: 'ta', name: 'தமிழ்' },
  { code: 'kn', name: 'ಕನ್ನಡ' }
]

// Create Material UI theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#2563EB', // blue-600
    },
    secondary: {
      main: '#DC2626', // red-600
    },
  },
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: '0.375rem',
        },
      },
    },
  },
})

// Page transition variants
const pageVariants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: 'easeOut',
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.3,
      ease: 'easeIn',
    },
  },
}

// AnimatedRoutes component for page transitions
const AnimatedRoutes = ({ user, language, setLanguage, languages }) => {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={pageVariants}
      >
        <Routes location={location}>
          <Route 
            path="/" 
            element={
              <Home 
                language={language} 
                setLanguage={setLanguage} 
                languages={languages} 
                user={user}
              />
            } 
          />
          <Route 
            path="/explore" 
            element={
              <Explore 
                language={language} 
                setLanguage={setLanguage} 
                languages={languages}
                user={user}
              />
            } 
          />
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute user={user}>
                <Profile 
                  language={language} 
                  setLanguage={setLanguage} 
                  languages={languages}
                />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/recommend" 
            element={
              <ProtectedRoute user={user}>
                <Recommend 
                  language={language} 
                  setLanguage={setLanguage} 
                  languages={languages}
                />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/add-place" 
            element={
              <ProtectedRoute user={user}>
                <AddPlace 
                  language={language} 
                  setLanguage={setLanguage} 
                  languages={languages}
                />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/destination/:id" 
            element={
              <DestinationDetails 
                language={language} 
                setLanguage={setLanguage} 
                languages={languages}
              />
            } 
          />
          <Route 
            path="/auth" 
            element={<Auth language={language} />} 
          />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [language, setLanguage] = useState('en')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const chartDom = document.getElementById('visitorsChart')
    if (chartDom) {
      const myChart = echarts.init(chartDom)
      // Your chart configuration...
    }
  }, [])

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <div className="min-h-screen flex flex-col">
          <main className="flex-grow">
            <AnimatedRoutes 
              user={user}
              language={language}
              setLanguage={setLanguage}
              languages={languages}
            />
          </main>
        </div>
      </Router>
    </ThemeProvider>
  )
}

export default App
