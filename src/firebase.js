import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Dán cấu hình của bạn vào đây
const firebaseConfig = {
  apiKey: "AIzaSyDJFBLGvpUH2gt7kTWA8adqoyQJo30FvQ8",
  authDomain: "techband-9640c.firebaseapp.com",
  projectId: "techband-9640c",
  storageBucket: "techband-9640c.firebasestorage.app",
  messagingSenderId: "555300280523",
  appId: "1:555300280523:web:89d221d7045bc7abdda34e",
  measurementId: "G-NGBKYH1TTB",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
