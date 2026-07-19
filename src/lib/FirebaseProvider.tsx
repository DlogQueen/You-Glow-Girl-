import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

interface FirebaseContextType {
  user: User | null;
  loading: boolean;
  profile: any | null;
  updateProfile: (data: any) => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType>({ user: null, loading: true, profile: null });

export const useFirebase = () => useContext(FirebaseContext);

// Guests build a real profile (face scan, bio, goals) before ever signing in.
// It's cached in localStorage so a refresh doesn't wipe it, and merged into
// their Firestore doc the moment they connect Google instead of being discarded.
const GUEST_PROFILE_KEY = 'ygg_guest_profile';

const DEFAULT_PROFILE_BASE = {
  displayName: 'Guest Pioneer',
  photoURL: '',
  email: '',
  bio: "Glowing with absolute confidence on YOU GLOW GIRL! ✨",
  undertone: "Detecting...",
  confidenceScore: 0,
  facialMetrics: {
    faceShape: "Pending",
    eyeType: "Pending",
    skinUndertone: "Pending"
  },
  privacySettings: {
    localProcessing: true
  },
  lastScanAt: null,
  beautyGoal: "",
  themePreferences: {
    chatBubbleColor: 'bg-onyx',
    chatBgColor: 'bg-white/5'
  },
};

function loadGuestProfile(): any | null {
  try {
    const raw = localStorage.getItem(GUEST_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveGuestProfile(profile: any) {
  try {
    localStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // best-effort only
  }
}

function clearGuestProfile() {
  try {
    localStorage.removeItem(GUEST_PROFILE_KEY);
  } catch {
    // best-effort only
  }
}

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const updateProfile = async (data: any) => {
    setProfile((prev: any) => {
      const current = prev || { ...DEFAULT_PROFILE_BASE };
      const next = { ...current, ...data };
      if (!auth.currentUser) {
        saveGuestProfile(next);
      }
      return next;
    });
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), data);
    } catch (err) {
      console.error("Failed to update profile:", err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const userDoc = doc(db, 'users', firebaseUser.uid);
          const snap = await getDoc(userDoc);
          if (!snap.exists()) {
            // First time this account has synced - carry over any progress
            // made as a guest instead of overwriting it with a blank profile.
            const guestProfile = loadGuestProfile();
            const newProfile = {
              ...DEFAULT_PROFILE_BASE,
              ...(guestProfile || {}),
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || guestProfile?.displayName || 'Glow Pioneer',
              photoURL: firebaseUser.photoURL || guestProfile?.photoURL || '',
              email: firebaseUser.email || '',
              createdAt: serverTimestamp(),
            };
            await setDoc(userDoc, newProfile);
            setProfile(newProfile);
          } else {
            setProfile(snap.data());
          }
          clearGuestProfile();
        } catch (err) {
          console.error("Firestore profile sync failed, using local cache:", err);
          const guestProfile = loadGuestProfile();
          setProfile({
            ...DEFAULT_PROFILE_BASE,
            ...(guestProfile || {}),
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || 'Glow Pioneer',
            photoURL: firebaseUser.photoURL || '',
            email: firebaseUser.email || '',
            isOffline: true
          });
        }
      } else {
        setProfile(loadGuestProfile());
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <FirebaseContext.Provider value={{ user, loading, profile, updateProfile }}>
      {children}
    </FirebaseContext.Provider>
  );
};
