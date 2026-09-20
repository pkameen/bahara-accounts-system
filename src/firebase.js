import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

// Firebase Configuration
// If you have your own Firebase project API Key, replace "YOUR_API_KEY" below.
// The Realtime Database URL is already live and functioning for data persistence.
const firebaseConfig = {
  apiKey: "[GCP_API_KEY]",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://bahara-accounts-system-default-rtdb.firebaseio.com/",
  projectId: "Bahara-Accounts",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = getDatabase(app);
export const auth = getAuth(app);

// Secondary app instance to create employee Auth accounts without logging out current Admin
const secondaryApp = getApps().find(a => a.name === 'SecondaryApp') || initializeApp(firebaseConfig, 'SecondaryApp');
export const secondaryAuth = getAuth(secondaryApp);
