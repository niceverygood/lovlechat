// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD92M6cUbsFWPDm6OHCtLYAzNlo-x8TEZc",
  authDomain: "lovlechat-cc9c4.firebaseapp.com",
  projectId: "lovlechat-cc9c4",
  storageBucket: "lovlechat-cc9c4.firebasestorage.app",
  messagingSenderId: "1052630351111",
  appId: "1:1052630351111:web:766154f7f4631273fc19a2",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export const signInWithGoogle = () => signInWithPopup(auth, provider);
export const signOutUser = () => signOut(auth);
export { auth };
