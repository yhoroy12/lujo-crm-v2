// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

// 1. ADICIONADO: where e getDocs no import do Firestore
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  doc,
  addDoc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  where,    // <--- ADICIONADO
  getDocs,   // <--- ADICIONADO
  limit,
  arrayUnion,
  runTransaction,
  serverTimestamp,
  Timestamp,
  startAfter

} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged,signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBk0quftYz1i0oxH0ZDiP7JyIlr58eTi7o",
  authDomain: "matheussistem-5282f.firebaseapp.com",
  projectId: "matheussistem-5282f",
  storageBucket: "matheussistem-5282f.firebasestorage.app",
  messagingSenderId: "454097711940",
  appId: "1:454097711940:web:7825bea96510ace7811d11"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

window.FirebaseApp = {
    db,
    auth,
    // 2. ADICIONADO: where e getDocs dentro do objeto fStore para ficarem visíveis no sistema
    fStore: { 
        collection, 
        onSnapshot, 
        doc,
        addDoc, 
        getDoc, 
        setDoc, 
        updateDoc, 
        deleteDoc, 
        query, 
        orderBy,
        where,    // <--- ADICIONADO
        getDocs,
        limit,
        arrayUnion,
        runTransaction,
        serverTimestamp,
        Timestamp,
        startAfter
        
    },
    fAuth: { 
        createUserWithEmailAndPassword,
        signInWithEmailAndPassword,
        signOut,
        onAuthStateChanged,
        signInAnonymously
    }
};
console.log("🔥 Firebase conectado com sucesso!");