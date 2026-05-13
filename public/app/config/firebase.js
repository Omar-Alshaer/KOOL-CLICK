import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  runTransaction,
  onSnapshot,
  updateDoc,
  limit,
  writeBatch,
  startAfter,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";

const firebaseConfig = {
  apiKey: "AIzaSyDloCZn8x3ztqg3rLHw0HjuE8SXmz5ZMRc",
  authDomain: "kool-clicker.firebaseapp.com",
  projectId: "kool-clicker",
  storageBucket: "kool-clicker.firebasestorage.app",
  messagingSenderId: "247898351186",
  appId: "1:247898351186:web:c7c579654308124038618b",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, "us-central1");

export {
  auth,
  db,
  functions,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  runTransaction,
  onSnapshot,
  updateDoc,
  limit,
  writeBatch,
  startAfter,
  httpsCallable,
};
