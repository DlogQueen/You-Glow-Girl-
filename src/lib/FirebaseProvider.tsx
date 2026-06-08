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

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const updateProfile = async (data: any) => {
    setProfile((prev: any) => {
      const current = prev || {
        displayName: 'Guest Pioneer',
        photoURL: '',
        email: '',
        bio: "Glowing with absolute confidence on YOU GLOW GIRL! ✨",
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
      return { ...current, ...data };
    });
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), data);
    } catch (err) {
      console.error("Failed to update profile:", err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          // Sync profile
          const userDoc = doc(db, 'users', user.uid);
          const snap = await getDoc(userDoc);
          if (!snap.exists()) {
            const newProfile = {
              uid: user.uid,
              displayName: user.displayName || 'Glow Pioneer',
              photoURL: user.photoURL || '',
              email: user.email || '',
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
              createdAt: serverTimestamp(),
              beautyGoal: "",
              themePreferences: {
                chatBubbleColor: 'bg-onyx',
                chatBgColor: 'bg-white/5'
              },
            };
            await setDoc(userDoc, newProfile);
            setProfile(newProfile);
          } else {
            setProfile(snap.data());
          }
        } catch (err) {
          console.warn("Firestore profile sync bypassed (offline sandbox fallback applied):", err);
          // Set an offline-ready profile fallback
          setProfile({
            uid: user.uid,
            displayName: user.displayName || 'Glow Pioneer',
            photoURL: user.photoURL || '',
            email: user.email || '',
            bio: "Glowing with absolute confidence on YOU GLOW GIRL! ✨ (Offline Mode)",
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
            isOffline: true
          });
        }
      } else {
        setProfile(null);
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
