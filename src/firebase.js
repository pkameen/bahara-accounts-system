import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

// Read Firebase Config from Vite Environment Variables with fallback defaults
const envApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const isPlaceholderKey = !envApiKey || envApiKey.includes('[GCP_API_KEY]') || envApiKey.startsWith('[');

if (isPlaceholderKey && typeof window !== 'undefined') {
  console.warn(
    '[Firebase Configuration] VITE_FIREBASE_API_KEY environment variable is missing or placeholder. ' +
    'Please set VITE_FIREBASE_API_KEY in your .env or .env.local file to enable full Auth Identity Toolkit functionality.'
  );
}

const firebaseConfig = {
  apiKey: isPlaceholderKey ? 'AIzaSyDummyKeyForLocalDevOnly12345' : envApiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'bahara-accounts-system.firebaseapp.com',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://bahara-accounts-system-default-rtdb.firebaseio.com/',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'Bahara-Accounts',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'bahara-accounts-system.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1234567890:web:1234567890'
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = getDatabase(app);
export const auth = getAuth(app);

// Secondary app instance to create employee Auth accounts without logging out current Admin
const secondaryApp = getApps().find(a => a.name === 'SecondaryApp') || initializeApp(firebaseConfig, 'SecondaryApp');
export const secondaryAuth = getAuth(secondaryApp);
