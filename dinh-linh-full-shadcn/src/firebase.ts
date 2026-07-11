import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCZ_b1SNkurKXlbRGoGucn-9Rz0u6KsFac",
  authDomain: "dinglinhtt-d6743.firebaseapp.com",
  projectId: "dinglinhtt-d6743",
  storageBucket: "dinglinhtt-d6743.firebasestorage.app",
  messagingSenderId: "726159631882",
  appId: "1:726159631882:web:e1040d7f61220f64b161f3",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
