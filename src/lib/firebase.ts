import { initializeApp, getApps, getApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { Auth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Extracting to avoid TS errors if definition is missing but runtime is OK
const { initializeAuth, getReactNativePersistence, getAuth } = FirebaseAuth as any;

const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

console.log('FIREBASE_LIB: Initializing service...');

let app;
if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApp();
}

let auth: Auth;
try {
    auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage)
    });
    console.log('FIREBASE_LIB: Auth initialized with persistence');
} catch (e) {
    // If already initialized, get the existing auth
    auth = getAuth(app);
    console.log('FIREBASE_LIB: Using existing Auth instance');
}

export { auth };
export default app;
