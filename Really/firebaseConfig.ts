import { initializeApp, getApp, getApps } from "firebase/app";
// @ts-ignore
import { initializeAuth, getReactNativePersistence, getAuth, Auth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
    apiKey: "AIzaSyD31xgIau4gb_XPPByE2G6OrQSfwnbPzOs",
    authDomain: "really-55e7a.firebaseapp.com",
    projectId: "really-55e7a",
    storageBucket: "really-55e7a.firebasestorage.app",
    messagingSenderId: "792558876496",
    appId: "1:792558876496:web:959932e6437112e41bde55",
    measurementId: "G-NYMVY948ZP"
};

let app;
if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApp();
}

let auth: Auth;
try {
    // @ts-ignore
    auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage)
    });
} catch (e: any) {
    // If auth is already initialized, use the existing instance
    auth = getAuth(app);
}

const db = getFirestore(app);

export { auth, db };
