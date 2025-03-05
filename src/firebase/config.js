import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getAnalytics } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: "AIzaSyAOMuKK71_-QVipM3eeZZdBYFsyi3CgEVw",
  authDomain: "travel-journal-b209d.firebaseapp.com",
  projectId: "travel-journal-b209d",
  storageBucket: "travel-journal-b209d.appspot.com",
  messagingSenderId: "150977921302",
  appId: "1:150977921302:web:f50448c69604b6ea1b9037",
  measurementId: "G-31K3849RT2"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase services
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

// Only initialize analytics if window is available (browser environment)
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null

export default app 