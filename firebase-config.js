// ================================
// FIREBASE A PLAN (USER-BASED DB)
// ================================

// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { 
    getFirestore,
    collection,
    doc,
    setDoc,
    getDocs,
    addDoc,
    deleteDoc,
    updateDoc,
    query,
    where 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


// ================================
// YOUR FIREBASE CONFIG
// ================================
const firebaseConfig = {
    apiKey: "AIzaSyAsT6vzHfChTyAXht7X2Bcl9qSi2j3KlmA",
    authDomain: "danisantakip-1150f.firebaseapp.com",
    projectId: "danisantakip-1150f",
    storageBucket: "danisantakip-1150f.firebasestorage.app",
    messagingSenderId: "1018903532193",
    appId: "1:1018903532193:web:69ec20c64286f0eefe56e0",
    measurementId: "G-PFRMNSTMV5"
};

// Initialize
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);


// ================================
// AUTH FUNCTIONS
// ================================

// Register
export async function registerUser(email, password) {
    const user = await createUserWithEmailAndPassword(auth, email, password);
    return user;
}

// Login
export async function loginUser(email, password) {
    const user = await signInWithEmailAndPassword(auth, email, password);
    return user;
}

// Logout
export async function logoutUser() {
    return await signOut(auth);
}

// Auth listener
export function onAuthChange(callback) {
    onAuthStateChanged(auth, callback);
}


// ================================
// FIRESTORE HELPERS
// ================================

// Firestore path helper → /users/{uid}/collectionName/
function userCollection(userId, collectionName) {
    return collection(db, "users", userId, collectionName);
}

// Firestore doc helper → /users/{uid}/{collection}/{docId}
function userDoc(userId, collectionName, docId) {
    return doc(db, "users", userId, collectionName, docId);
}


// ================================
// CRUD FUNCTIONS FOR A PLAN
// ================================
//
// Each data type is stored under:
// /users/{uid}/{collection}/documentID
//
// clients
// sessions
// packages
// payments
//
// Nothing is in shared collections.
// ================================


// ========== CLIENTS ==========
export async function addClient(userId, data) {
    const ref = await addDoc(userCollection(userId, "clients"), data);
    return ref.id;
}

// Deterministic ID (recommended for this project)
export async function upsertClient(userId, clientId, data) {
    await setDoc(userDoc(userId, "clients", clientId), data, { merge: true });
    return clientId;
}

export async function getClients(userId) {
    const snap = await getDocs(userCollection(userId, "clients"));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function deleteClient(userId, clientId) {
    await deleteDoc(doc(db, "users", userId, "clients", clientId));
}

export async function updateClient(userId, clientId, partial) {
    await updateDoc(userDoc(userId, "clients", clientId), partial);
}


// ========== SESSIONS ==========
export async function addSession(userId, data) {
    const ref = await addDoc(userCollection(userId, "sessions"), data);
    return ref.id;
}

export async function upsertSession(userId, sessionId, data) {
    await setDoc(userDoc(userId, "sessions", sessionId), data, { merge: true });
    return sessionId;
}

export async function getSessions(userId) {
    const snap = await getDocs(userCollection(userId, "sessions"));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function deleteSession(userId, sessionId) {
    await deleteDoc(doc(db, "users", userId, "sessions", sessionId));
}

export async function updateSession(userId, sessionId, partial) {
    await updateDoc(userDoc(userId, "sessions", sessionId), partial);
}


// ========== PACKAGES ==========
export async function addPackage(userId, data) {
    const ref = await addDoc(userCollection(userId, "packages"), data);
    return ref.id;
}

export async function upsertPackage(userId, packageId, data) {
    await setDoc(userDoc(userId, "packages", packageId), data, { merge: true });
    return packageId;
}

export async function getPackages(userId) {
    const snap = await getDocs(userCollection(userId, "packages"));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function deletePackage(userId, packageId) {
    await deleteDoc(doc(db, "users", userId, "packages", packageId));
}

export async function updatePackage(userId, packageId, partial) {
    await updateDoc(userDoc(userId, "packages", packageId), partial);
}


// ========== PAYMENTS ==========
export async function addPayment(userId, data) {
    const ref = await addDoc(userCollection(userId, "payments"), data);
    return ref.id;
}

export async function upsertPayment(userId, paymentId, data) {
    await setDoc(userDoc(userId, "payments", paymentId), data, { merge: true });
    return paymentId;
}

export async function getPayments(userId) {
    const snap = await getDocs(userCollection(userId, "payments"));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function deletePayment(userId, paymentId) {
    await deleteDoc(doc(db, "users", userId, "payments", paymentId));
}

export async function updatePayment(userId, paymentId, partial) {
    await updateDoc(userDoc(userId, "payments", paymentId), partial);
}


// ========== BUSINESS PROFILE ==========
// /users/{uid}/profile/main  (tek döküman)

export async function saveProfile(userId, data) {
    await setDoc(doc(db, "users", userId, "profile", "main"), data, { merge: true });
}

export async function getProfile(userId) {
    const snap = await getDocs(collection(db, "users", userId, "profile"));
    const found = snap.docs.find(d => d.id === "main");
    return found ? found.data() : null;
}

