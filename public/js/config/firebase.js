import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
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
  updateDoc,
  limit,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCkO-9Dc6bX16rsA9h-k0mmQB67z_Fv8CU",
  authDomain: "kool-click.firebaseapp.com",
  projectId: "kool-click",
  storageBucket: "kool-click.firebasestorage.app",
  messagingSenderId: "125288037274",
  appId: "1:125288037274:web:bc9cad0df5dc9f82159823",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
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
  updateDoc,
  limit,
  writeBatch,
};
