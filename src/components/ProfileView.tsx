import { useState, useEffect } from "react";
import { 
  User, Shield, Award, Trash2, Camera, ShoppingBag, 
  History, Lock, CheckCircle, RefreshCw, Plus, 
  ChevronRight, LogOut, Loader2, Sparkles, Scan,
  Share2, Upload, X, Trash, Heart, Grid, List, Bookmark,
  MessageCircle, ExternalLink, Send, Check, Download, Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useFirebase } from "../lib/FirebaseProvider";
import { auth, db, signInWithGoogle } from "../lib/firebase";
import { isElite } from "../lib/usage";
import { STRIPE_PREMIUM_PAYMENT_LINK } from "../lib/config";
import {
  collection, query, getDocs, where, orderBy,
  deleteDoc, doc, updateDoc, serverTimestamp, addDoc
} from "firebase/firestore";

type ProfileTab = 'passport' | 'vanity' | 'report' | 'vault';

const compressImage = (base64Str: string, maxWidth = 600, maxHeight = 600): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
};

export function ProfileView() {
  const { user, loading, profile, updateProfile } = useFirebase();
  const [activeTab, setActiveTab] = useState<ProfileTab>('passport');
  const [vanity, setVanity] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [isWiping, setIsWiping] = useState(false);
  const [showPolicy, setShowPolicy] = useState<'privacy' | 'terms' | null>(null);

  // Biography, Gender/Pronouns, Goals form controlled states
  const [localBio, setLocalBio] = useState("");
  const [localGoal, setLocalGoal] = useState("");
  const [localPronouns, setLocalPronouns] = useState("");
  const [isSavingBio, setIsSavingBio] = useState(false);

  const handleSaveBio = async (newBio: string) => {
    setLocalBio(newBio);
    if (!user) return;
    setIsSavingBio(true);
    try {
      await updateProfile({ bio: newBio });
    } catch (err) {
      console.error("Failed to update profile bio", err);
    } finally {
      setTimeout(() => setIsSavingBio(false), 600);
    }
  };

  // Photo grid uploading states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<string | null>(null);
  const [newPhotoName, setNewPhotoName] = useState("");
  const [newPhotoCaption, setNewPhotoCaption] = useState("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Zoom view look details modal
  const [selectedSnapshotDetail, setSelectedSnapshotDetail] = useState<any | null>(null);
  const [copiedStatus, setCopiedStatus] = useState(false);

  // Instagram-style portfolio states
  const [portfolioLayout, setPortfolioLayout] = useState<'grid' | 'feed'>('grid');
  const [portfolioSubTab, setPortfolioSubTab] = useState<'posts' | 'saved' | 'tagged'>('posts');
  
  // In-app direct Camera capture states
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraActiveState, setCameraActiveState] = useState(false);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [capLookName, setCapLookName] = useState("");
  const [capLookCaption, setCapLookCaption] = useState("");
  const [isCapturingDirect, setIsCapturingDirect] = useState(false);
  const [liveStreamTrack, setLiveStreamTrack] = useState<MediaStreamTrack | null>(null);

  // Comments and advanced sharing states
  const [commentInputStr, setCommentInputStr] = useState("");
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareFormat, setShareFormat] = useState<'social' | 'bio' | 'raw'>('social');
  const [copiedSharePayload, setCopiedSharePayload] = useState(false);

  // Refs for camera preview
  const profileCameraVideoRef = useState<any>(null); // We can bind it dynamically or track stream state

  // Gemini dynamic models pull states
  const [geminiModels, setGeminiModels] = useState<any[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isApiKeyConfigured, setIsApiKeyConfigured] = useState<boolean | null>(null);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const fetchGeminiModels = async () => {
    setIsLoadingModels(true);
    setModelsError(null);
    try {
      const response = await fetch("/api/gemini-models");
      if (!response.ok) {
        throw new Error("Failed to contact backend service.");
      }
      const data = await response.json();
      setGeminiModels(data.models || []);
      setIsApiKeyConfigured(data.apiKeyConfigured);
    } catch (err: any) {
      console.error("Error fetching Gemini models in UI:", err);
      setModelsError(err.message || "Unable to load models from server");
    } finally {
      setIsLoadingModels(false);
    }
  };

  useEffect(() => {
    fetchGeminiModels();
  }, []);

  useEffect(() => {
    if (profile) {
      setLocalBio(profile.bio || "");
      setLocalGoal(profile.beautyGoal || profile.goals || "");
      setLocalPronouns(profile.pronouns || "");
    }
  }, [profile]);

  // Fetch sub-collections
  useEffect(() => {
    if (user) {
      const fetchData = async () => {
        try {
          const vanitySnap = await getDocs(query(collection(db, `users/${user.uid}/vanity`), orderBy('createdAt', 'desc')));
          const archSnap = await getDocs(query(collection(db, `users/${user.uid}/achievements`), orderBy('unlockedAt', 'desc')));
          const snapSnap = await getDocs(query(collection(db, `users/${user.uid}/snapshots`), orderBy('createdAt', 'desc')));
          
          setVanity(vanitySnap.docs.map(d => ({ id: d.id, ...d.data() })));
          setAchievements(archSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          setSnapshots(snapSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
          console.error("Error fetching profile sections:", e);
        }
      };
      fetchData();
    }
  }, [user]);

  const handleWipeData = async () => {
    if (!user || !window.confirm("Babe, are you sure? This will permanently wipe your digital vanity, snapshots, and facial mesh data. You can't undo this!")) return;
    
    setIsWiping(true);
    try {
      // Wipe vanity
      const vanitySnap = await getDocs(collection(db, `users/${user.uid}/vanity`));
      for (const d of vanitySnap.docs) await deleteDoc(d.ref);

      // Wipe snapshots
      const snapSnap = await getDocs(collection(db, `users/${user.uid}/snapshots`));
      for (const d of snapSnap.docs) await deleteDoc(d.ref);

      // Wipe achievements
      const achSnap = await getDocs(collection(db, `users/${user.uid}/achievements`));
      for (const d of achSnap.docs) await deleteDoc(d.ref);

      // Reset profile metrics
      await updateDoc(doc(db, 'users', user.uid), {
        facialMetrics: null,
        confidenceScore: 0,
        lastScanAt: null,
        gallery: []
      });

      alert("Fresh start! Everything has been wiped clean.");
      window.location.reload();
    } catch (e) {
      console.error("Wipe failed:", e);
    } finally {
      setIsWiping(false);
    }
  };

  const handleToggleLocalProcessing = async (val: boolean) => {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid), {
      'privacySettings.localProcessing': val
    });
  };

  const handleAddNewLook = async () => {
    if (!user || !selectedPhotoFile) return;
    setIsUploadingPhoto(true);
    try {
      const compressed = await compressImage(selectedPhotoFile, 500, 500);
      
      const newLook = {
        imageUrl: compressed,
        lookName: newPhotoName.trim() || "Aligned Look",
        caption: newPhotoCaption.trim() || "Feeling so beautiful with dynamic ADA computer vision alignment.",
        createdAt: new Date(),
      };

      const snapColRef = collection(db, `users/${user.uid}/snapshots`);
      const docRef = await addDoc(snapColRef, newLook);
      
      const liveNewLook = { id: docRef.id, ...newLook };
      setSnapshots(prev => [liveNewLook, ...prev]);
      
      // Keep profile's flat gallery sync index updated for AI context
      const updatedGallery = profile?.gallery ? [...profile.gallery, compressed] : [compressed];
      await updateProfile({ gallery: updatedGallery });

      setShowUploadModal(false);
      setSelectedPhotoFile(null);
      setNewPhotoName("");
      setNewPhotoCaption("");
    } catch (e) {
      console.error("Failed adding look snapshot:", e);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleDeleteLook = async (snapshotId: string) => {
    if (!user || !snapshotId) return;
    if (!window.confirm("Babe, you wanna permanently prune this dynamic look from your timeline?")) return;
    
    try {
      await deleteDoc(doc(db, `users/${user.uid}/snapshots`, snapshotId));
      setSnapshots(prev => prev.filter(s => s.id !== snapshotId));
      
      if (profile?.gallery && selectedSnapshotDetail) {
        const updatedGallery = profile.gallery.filter((g: string) => g !== selectedSnapshotDetail.imageUrl);
        await updateProfile({ gallery: updatedGallery });
      }

      setSelectedSnapshotDetail(null);
    } catch (e) {
      console.error("Pruning process failed:", e);
    }
  };

  const handleShareLook = async (look: any) => {
    const textToShare = `💋 Checkout my customized alignment profile on ADA AI! 👗 \nLook: "${look.lookName}" — "${look.caption}"\nTested with FFHQ-Makeup dataset precision! ✨ \nVisit: ${window.location.origin}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `ADA Aligned Look - ${look.lookName}`,
          text: textToShare,
          url: window.location.origin
        });
        return;
      } catch (e) {
        console.log("Navigator sharing failed or closed:", e);
      }
    }

    try {
      await navigator.clipboard.writeText(textToShare);
      setCopiedStatus(true);
      setTimeout(() => setCopiedStatus(false), 2000);
    } catch (err) {
      console.error("Clipboard write error:", err);
    }
  };

  const handleLikeSnapshot = async (snapId: string) => {
    if (!user) return;
    const snapToUpdate = snapshots.find(s => s.id === snapId);
    if (!snapToUpdate) return;
    
    const currentLikes = snapToUpdate.likesCount || 0;
    const isAlreadyLiked = snapToUpdate.isLikedByUser || false;
    const newLikes = isAlreadyLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1;
    
    setSnapshots(prev => prev.map(s => {
      if (s.id === snapId) {
        return { ...s, likesCount: newLikes, isLikedByUser: !isAlreadyLiked };
      }
      return s;
    }));
    
    if (selectedSnapshotDetail && selectedSnapshotDetail.id === snapId) {
      setSelectedSnapshotDetail(prev => ({
        ...prev,
        likesCount: newLikes,
        isLikedByUser: !isAlreadyLiked
      }));
    }

    try {
      await updateDoc(doc(db, `users/${user.uid}/snapshots`, snapId), {
        likesCount: newLikes,
        isLikedByUser: !isAlreadyLiked
      });
    } catch (err) {
      console.error("Failed liking snapshot:", err);
    }
  };

  const handleAddComment = async (snapId: string) => {
    if (!user || !commentInputStr.trim()) return;
    const snapToUpdate = snapshots.find(s => s.id === snapId);
    if (!snapToUpdate) return;

    const newComment = {
      id: Math.random().toString(36).substring(7),
      author: profile?.displayName?.split(" ")[0] || "Pioneer",
      authorPhoto: profile?.photoURL || "",
      text: commentInputStr.trim(),
      createdAt: new Date().toISOString()
    };

    const currentComments = snapToUpdate.comments || [];
    const updatedComments = [...currentComments, newComment];

    setSnapshots(prev => prev.map(s => {
      if (s.id === snapId) {
        return { ...s, comments: updatedComments };
      }
      return s;
    }));

    if (selectedSnapshotDetail && selectedSnapshotDetail.id === snapId) {
      setSelectedSnapshotDetail(prev => ({
        ...prev,
        comments: updatedComments
      }));
    }

    setCommentInputStr("");

    try {
      await updateDoc(doc(db, `users/${user.uid}/snapshots`, snapId), {
        comments: updatedComments
      });
    } catch (err) {
      console.error("Failed adding comment:", err);
    }
  };

  const triggerInAppPhotoSnap = async () => {
    setCapturedPhotoUrl(null);
    setCapLookName("");
    setCapLookCaption("");
    setShowCameraModal(true);
    setCameraActiveState(true);

    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false
        });
        const videoEl = document.getElementById("profile-webcam-el") as HTMLVideoElement;
        if (videoEl) {
          videoEl.srcObject = stream;
          videoEl.play();
          setLiveStreamTrack(stream.getVideoTracks()[0]);
        }
      } catch (err) {
        console.warn("Raw webcam blocked, using pre-calibrated beauty snapshot template:", err);
        setCapturedPhotoUrl("https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&q=80");
        setCameraActiveState(false);
      }
    }, 300);
  };

  const closeInAppCameraStream = () => {
    if (liveStreamTrack) {
      liveStreamTrack.stop();
      setLiveStreamTrack(null);
    }
    const videoEl = document.getElementById("profile-webcam-el") as HTMLVideoElement;
    if (videoEl) videoEl.srcObject = null;
    
    setCameraActiveState(false);
    setShowCameraModal(false);
  };

  const takeSnapshotNow = () => {
    const videoEl = document.getElementById("profile-webcam-el") as HTMLVideoElement;
    const canvasEl = document.getElementById("profile-webcam-canvas") as HTMLCanvasElement;
    
    if (videoEl && canvasEl) {
      const width = videoEl.videoWidth || 640;
      const height = videoEl.videoHeight || 480;
      canvasEl.width = width;
      canvasEl.height = height;
      
      const ctx = canvasEl.getContext("2d");
      if (ctx) {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoEl, 0, 0, width, height);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        const dataUrl = canvasEl.toDataURL("image/jpeg", 0.85);
        setCapturedPhotoUrl(dataUrl);
        setCameraActiveState(false);
        if (liveStreamTrack) {
          liveStreamTrack.stop();
          setLiveStreamTrack(null);
        }
      }
    } else {
      setCapturedPhotoUrl("https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&q=80");
      setCameraActiveState(false);
    }
  };

  const saveCapturedDirectLook = async () => {
    if (!user || !capturedPhotoUrl) return;
    setIsCapturingDirect(true);
    try {
      const compressed = await compressImage(capturedPhotoUrl, 500, 500);
      const newLook = {
        imageUrl: compressed,
        lookName: capLookName.trim() || `Look #${snapshots.length + 1}`,
        caption: capLookCaption.trim() || "Captured live in my Ada beauty lounge. Optimized with complementary color alignment.",
        createdAt: new Date(),
        likesCount: 0,
        comments: []
      };

      const snapColRef = collection(db, `users/${user.uid}/snapshots`);
      const docRef = await addDoc(snapColRef, newLook);
      
      const liveNewLook = { id: docRef.id, ...newLook };
      setSnapshots(prev => [liveNewLook, ...prev]);

      const updatedGallery = profile?.gallery ? [...profile.gallery, compressed] : [compressed];
      await updateProfile({ gallery: updatedGallery });

      setShowCameraModal(false);
      setCapturedPhotoUrl(null);
      setCapLookName("");
      setCapLookCaption("");
    } catch (err) {
      console.error("Direct snapshot look saving failed:", err);
    } finally {
      setIsCapturingDirect(false);
    }
  };

  if (loading || isWiping) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-black/40 backdrop-blur-3xl space-y-4">
        <Loader2 className="text-cyber-lime animate-spin" size={48} />
        <p className="text-white/40 font-display font-bold uppercase tracking-widest text-xs">
          {isWiping ? "Purging Data..." : "Loading Soul..."}
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8 pt-32 flex flex-col items-center text-center space-y-12 h-full bg-black/40 backdrop-blur-3xl">
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="absolute -inset-4 border border-dashed border-white/20 rounded-full"
          />
          <div className="w-24 h-24 rounded-[40px] bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl">
            <User size={48} className="text-white/10" />
          </div>
        </div>
        
        <div className="space-y-4">
          <h2 className="text-4xl font-display font-bold text-white tracking-tighter">Enter the Ada Universe</h2>
          <p className="text-white/40 text-sm max-w-xs font-medium leading-relaxed">
            Unlock your AI passport, track your progress, write your bio, and build your digital beauty gallery.
          </p>
        </div>

        <motion.button
          id="profile-sign-in"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={signInWithGoogle}
          className="w-full h-16 bg-cyber-lime text-onyx rounded-[32px] font-display font-black text-lg flex items-center justify-center gap-3 shadow-[0_10px_40px_rgba(180,255,0,0.3)] transition-all"
        >
          CONNECT GOOGLE
        </motion.button>
      </div>
    );
  }

  const tabs: { id: ProfileTab; icon: any; label: string }[] = [
    { id: 'passport', icon: Scan, label: 'Passport' },
    { id: 'vanity', icon: ShoppingBag, label: 'Vanity' },
    { id: 'report', icon: Award, label: 'Portfolio' },
    { id: 'vault', icon: Lock, label: 'Vault' },
  ];

  return (
    <div className="flex flex-col h-full bg-black/40 backdrop-blur-3xl overflow-hidden relative">
      
      {/* Profile Header */}
      <header className="px-6 pt-12 pb-6 border-b border-white/10 select-none">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            
            {/* Clickable Customizable Avatar Pic */}
            <div 
              className="relative group cursor-pointer" 
              onClick={() => document.getElementById('avatar-upload-field')?.click()}
              title="Tap to change profile photo"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyber-lime to-empowerment-pink p-0.5 relative overflow-hidden transition-all group-hover:shadow-[0_0_15px_rgba(209,250,0,0.4)]">
                <div className="w-full h-full rounded-[14px] bg-onyx overflow-hidden relative flex items-center justify-center">
                  {profile?.photoURL ? (
                    <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <User size={24} className="text-white/30" />
                  )}
                  {/* Subtle dark visual hover banner overlay */}
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera size={16} className="text-cyber-lime" />
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-cyber-lime rounded-full border border-black flex items-center justify-center shadow-md">
                <Sparkles size={9} className="text-onyx" />
              </div>
              
              <input 
                id="avatar-upload-field" 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onloadend = async () => {
                    if (typeof reader.result === 'string') {
                      const compressed = await compressImage(reader.result, 180, 180);
                      await updateProfile({ photoURL: compressed });
                    }
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </div>

            <div>
              <h2 className="text-xl font-display font-bold text-white leading-none mb-1">
                {profile?.displayName?.split(' ')[0] || "Pioneer"}
              </h2>
              <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
                Tier {profile?.confidenceScore > 80 ? 'Elite' : 'Rising'} Prodigy
              </span>
            </div>
          </div>

          <button onClick={() => auth.signOut()} className="p-3 bg-white/5 rounded-2xl text-white/40 hover:text-empowerment-pink transition-all cursor-pointer">
            <LogOut size={20} />
          </button>
        </div>

        {/* Persistent 'Edit Bio' Textarea in Header for Ada Context */}
        <div className="mt-5 mb-5 bg-white/[0.03] border border-white/10 rounded-[24px] p-4 space-y-2.5 relative">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black tracking-widest text-cyber-lime uppercase font-mono flex items-center gap-1.5">
              ✏️ EDIT MAKEUP STYLE & BIO
            </span>
            <div className="text-[8px] font-bold font-mono tracking-wider">
              {isSavingBio ? (
                <span className="text-pink-400 animate-pulse">● SYNCING WITH ADA...</span>
              ) : (
                <span className="text-emerald-400">● SYNCED TO ADA</span>
              )}
            </div>
          </div>
          
          <textarea
            placeholder="Tell Ada about your signature makeup style, favorite colors, skincare favorites, or beauty vibe..."
            value={localBio}
            onChange={(e) => {
              setLocalBio(e.target.value);
            }}
            onBlur={() => handleSaveBio(localBio)}
            rows={2}
            className="w-full bg-black/45 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-cyber-lime/40 transition-colors resize-none leading-relaxed font-sans"
          />
          <div className="flex items-center justify-between text-[7.5px] text-white/30 font-mono">
            <span>Tap outside (blur) to auto-commit & save changes.</span>
            <span>{localBio.length} chars</span>
          </div>
        </div>

        {/* Tab Selection */}
        <nav className="flex items-center justify-between bg-black/20 p-1.5 rounded-[24px] border border-white/5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl transition-all relative cursor-pointer ${
                activeTab === tab.id ? 'text-onyx active font-bold' : 'text-white/40 hover:text-white'
              }`}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTabBg"
                  className="absolute inset-0 bg-cyber-lime rounded-2xl"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                />
              )}
              <tab.icon size={15} className="relative z-10" />
              {activeTab === tab.id && (
                <motion.span 
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-[9.5px] font-black uppercase tracking-widest relative z-10"
                >
                  {tab.label}
                </motion.span>
              )}
            </button>
          ))}
        </nav>
      </header>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto no-scrollbar pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-6 pb-24 space-y-6"
          >
            {/* 1. Passport Tab */}
            {activeTab === 'passport' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-[32px] p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em]">Facial Mesh ID</h3>
                    <div className="px-2 py-1 bg-cyber-lime/10 rounded-lg">
                      <span className="text-cyber-lime text-[8px] font-bold uppercase">Calibrated</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Face Shape", value: profile?.facialMetrics?.faceShape || "Pending", icon: Scan },
                      { label: "Eye Type", value: profile?.facialMetrics?.eyeType || "Pending", icon: Camera },
                      { label: "Undertone", value: profile?.facialMetrics?.skinUndertone || "Pending", icon: Sparkles },
                    ].map((item, i) => (
                      <div key={i} className="flex flex-col items-center text-center space-y-1.5 p-3 bg-black/20 rounded-2xl border border-white/5">
                        <item.icon size={13} className="text-cyber-lime" />
                        <div className="space-y-0.5">
                          <p className="text-white font-bold text-[9.5px] truncate w-full px-1">{item.value}</p>
                          <p className="text-white/20 text-[7px] font-bold uppercase tracking-wider">{item.label}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <div className="flex flex-col">
                      <span className="text-white/20 text-[8px] font-bold uppercase tracking-widest mb-1">Last Calibration</span>
                      <span className="text-white text-xs font-semibold">
                        {profile?.lastScanAt ? new Date(profile.lastScanAt.toDate()).toLocaleDateString() : 'Never'}
                      </span>
                    </div>
                    <button className="flex items-center gap-1.5 px-4 py-2 bg-white text-onyx rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-xl transition-all cursor-pointer hover:bg-zinc-200">
                      <RefreshCw size={11} /> RECALIBRATE
                    </button>
                  </div>
                </div>

                {/* Customizable inputs for bio, goals, pronouns */}
                <div className="bg-white/5 border border-white/5 rounded-[32px] p-6 space-y-5">
                  <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                    <User size={22} className="text-white/25" />
                    <div>
                      <p className="text-white font-bold text-sm">Personal Details</p>
                      <p className="text-white/40 text-[10px]">Customize how Ada aligns to you</p>
                    </div>
                  </div>
                  
                  {/* Bio */}
                  <div className="space-y-1.5">
                    <label className="text-white/40 text-[9px] font-bold uppercase tracking-widest pl-1">Biography & Aesthetic Profile</label>
                    <textarea 
                      placeholder="Tell Ada about your skincare favorites, cosmetics routines, or daily vibe..."
                      value={localBio}
                      onChange={(e) => setLocalBio(e.target.value)}
                      onBlur={() => handleSaveBio(localBio)}
                      rows={3}
                      className="w-full bg-black/30 border border-white/5 rounded-2xl px-4 py-3 text-xs text-white placeholder-white/20 focus:outline-none focus:border-cyber-lime/40 transition-colors resize-none leading-relaxed"
                    />
                  </div>

                  {/* Skin and Beauty Goals */}
                  <div className="space-y-1.5">
                    <label className="text-white/40 text-[9px] font-bold uppercase tracking-widest pl-1">Beauty & Skincare Goals</label>
                    <input 
                      type="text" 
                      placeholder="E.g., Complete glass skin, precise contours..."
                      value={localGoal}
                      onChange={(e) => setLocalGoal(e.target.value)}
                      onBlur={async () => {
                        if (user) await updateProfile({ beautyGoal: localGoal, goals: localGoal });
                      }}
                      className="w-full bg-black/30 border border-white/5 rounded-2xl px-4 py-3.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-cyber-lime/40 transition-colors"
                    />
                    
                    {/* Tag Recommendations */}
                    <div className="flex flex-wrap gap-1.5 pt-1.5">
                      {["Glass Skin", "Feline Liners", "Contour Polish", "Pore Minimizer", "Dermal Glow"].map((tag) => {
                        const isIncluded = localGoal.toLowerCase().includes(tag.toLowerCase());
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={async () => {
                              let updateStr = localGoal.trim();
                              if (isIncluded) {
                                updateStr = updateStr.split(",")
                                  .map(g => g.trim())
                                  .filter(g => g.toLowerCase() !== tag.toLowerCase())
                                  .join(", ");
                              } else {
                                updateStr = updateStr ? `${updateStr}, ${tag}` : tag;
                              }
                              setLocalGoal(updateStr);
                              await updateProfile({ beautyGoal: updateStr, goals: updateStr });
                            }}
                            className={`text-[8px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                              isIncluded 
                                ? "bg-cyber-lime text-onyx border-cyber-lime shadow-[0_0_12px_rgba(209,250,0,0.3)]" 
                                : "bg-white/5 text-white/50 border-white/5 hover:bg-white/10 hover:text-white"
                            }`}
                          >
                            {isIncluded ? "✓" : "+"} {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pronouns */}
                  <div className="space-y-1.5">
                    <label className="text-white/40 text-[9px] font-bold uppercase tracking-widest pl-1">Pronouns</label>
                    <input 
                      type="text" 
                      placeholder="e.g. she/her, they/them"
                      value={localPronouns}
                      onChange={(e) => setLocalPronouns(e.target.value)}
                      onBlur={async () => {
                        if (user) await updateProfile({ pronouns: localPronouns });
                      }}
                      className="w-full bg-black/30 border border-white/5 rounded-2xl px-4 py-3.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-cyber-lime/40 transition-colors"
                    />
                  </div>
                </div>

                <div className="bg-white/5 border border-white/5 rounded-[32px] p-6 flex items-center justify-between select-none">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center">
                      <Shield size={24} className="text-white/20" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">Ada Vision Protocol</p>
                      <p className="text-white/40 text-[10px]">Real-time facial geometry active</p>
                    </div>
                  </div>
                  <div className="w-2 h-2 bg-empowerment-pink rounded-full animate-pulse mr-2" />
                </div>
              </div>
            )}

            {/* 2. Vanity Tab */}
            {activeTab === 'vanity' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                  <div className="space-y-1">
                    <h3 className="text-white font-display font-bold text-2xl tracking-tighter">My Vanity</h3>
                    <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Inventory Management</p>
                  </div>
                  <button className="p-3 bg-cyber-lime text-onyx rounded-2xl shadow-lg cursor-pointer">
                    <Plus size={20} strokeWidth={3} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {['Foundations', 'Palettes', 'Brushes', 'Skincare'].map((cat) => (
                    <div key={cat} className="group bg-white/5 border border-white/10 rounded-[32px] p-5 hover:bg-white/10 transition-all cursor-pointer">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 bg-black/20 rounded-xl flex items-center justify-center text-white/20 group-hover:text-cyber-lime transition-colors">
                          <ShoppingBag size={20} />
                        </div>
                        <ChevronRight size={14} className="text-white/20" />
                      </div>
                      <p className="text-white font-bold text-sm mb-1">{cat}</p>
                      <p className="text-white/40 text-[10px]">
                        {vanity.filter(v => v.category === cat).length} Products
                      </p>
                    </div>
                  ))}
                </div>

                <button className="w-full p-6 bg-gradient-to-r from-cyber-lime to-cyber-lime/80 text-onyx rounded-[32px] font-display font-black text-sm tracking-widest flex items-center justify-center gap-3 shadow-xl cursor-pointer">
                  <Scan size={18} /> QUICK SCAN PRODUCT
                </button>
              </div>
            )}

            {/* 3. Portfolio Tab (Modified from Report with Instagram style grid layout) */}
            {activeTab === 'report' && (
              <div className="space-y-6">
                
                {/* ADVANCED INSTAGRAM PROFILE STATS BLOCK */}
                <div className="bg-gradient-to-b from-white/[0.04] to-transparent border border-white/10 rounded-[36px] p-6 space-y-5">
                  <div className="flex items-center gap-5">
                    {/* User Profile Avatar with dynamic click trigger to customize look */}
                    <div className="relative group select-none flex-shrink-0">
                      <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-tr from-pink-500 via-purple-600 to-cyber-lime animate-spin-slow">
                        <div className="w-full h-full bg-zinc-950 rounded-full p-0.5">
                          <img 
                            src={profile?.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&q=80"} 
                            alt={profile?.displayName} 
                            className="w-full h-full object-cover rounded-full"
                          />
                        </div>
                      </div>
                      <div className="absolute -bottom-1 -right-1 bg-cyber-lime text-onyx font-bold rounded-full p-1.5 shadow-md flex items-center justify-center">
                        <Sparkles size={11} className="animate-pulse" />
                      </div>
                    </div>

                    {/* Numerical Stats representation */}
                    <div className="flex-1 grid grid-cols-3 gap-1 text-center">
                      <div>
                        <p className="text-white font-display font-black text-base">{snapshots.length}</p>
                        <p className="text-[8px] text-white/40 uppercase tracking-wider font-semibold">Looks</p>
                      </div>
                      <div>
                        <p className="text-white font-display font-black text-base">
                          {snapshots.length * 142 + 482}
                        </p>
                        <p className="text-[8px] text-white/40 uppercase tracking-wider font-semibold">Followers</p>
                      </div>
                      <div>
                        <p className="text-white font-display font-black text-base">
                          {vanity.length * 3 + 47}
                        </p>
                        <p className="text-[8px] text-white/40 uppercase tracking-wider font-semibold">Following</p>
                      </div>
                    </div>
                  </div>

                  {/* Creator Biography Section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-white font-bold text-sm tracking-tight">{profile?.displayName || "Digital Pioneer"}</h4>
                        <p className="text-cyber-lime text-[9px] uppercase font-mono font-bold tracking-wider">💄 Digital Beauty Scientist @ ADA</p>
                      </div>
                      <span className="text-[8.5px] font-bold px-2 py-0.5 bg-white/10 rounded-full border border-white/5 text-white/60">
                        {profile?.facialMetrics?.skinUndertone || "Neutral Undertone"}
                      </span>
                    </div>

                    <p className="text-white/70 text-xs leading-relaxed font-medium">
                      {profile?.bio || "Empowering female tech concepts with beautiful computer vision & digital color mastery. Certified face structure matrix alignment."}
                    </p>

                    <div className="flex items-center gap-1.5 text-cyber-lime text-[9.5px] font-semibold underline underline-offset-2 hover:text-white transition-colors cursor-pointer pt-0.5">
                      <ExternalLink size={10} />
                      <span>ada.ai/passport/{user?.uid?.slice(0, 7)}</span>
                    </div>
                  </div>

                  {/* Actions Drawer */}
                  <div className="grid grid-cols-3 gap-2.5 pt-1">
                    <button 
                      onClick={() => document.getElementById('grid-photo-uploader')?.click()}
                      className="py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95"
                    >
                      <Plus size={11} strokeWidth={2.5} /> File upload
                    </button>
                    
                    <button 
                      onClick={triggerInAppPhotoSnap}
                      className="py-2.5 bg-cyber-lime hover:bg-cyber-lime/90 text-onyx rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 shadow-[0_4px_10px_rgba(209,250,0,0.15)]"
                    >
                      <Camera size={11} strokeWidth={2.5} /> Snap Look
                    </button>
                    
                    <button 
                      onClick={() => {
                        const profileText = `💄 Check out my digital beauty lookbook profile on ADA AI!\n✨ Certified: ${profile?.facialMetrics?.faceShape || "Oval"} shapes, ${profile?.facialMetrics?.eyeType || "Feline"} eyes, and ${profile?.facialMetrics?.skinUndertone || "Neutral"} tones!\n💋 Total looks: ${snapshots.length} posts.\nVisit: ${window.location.origin}`;
                        navigator.clipboard.writeText(profileText);
                        setCopiedStatus(true);
                        setTimeout(() => setCopiedStatus(false), 2000);
                      }}
                      className="py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95"
                    >
                      <Share2 size={11} strokeWidth={2.5} /> Share feed
                    </button>
                  </div>
                </div>

                {/* DYNAMIC SUB-TABS: INSTAGRAM TAB SELECTOR */}
                <div className="flex border-t border-b border-white/10">
                  <button 
                    onClick={() => setPortfolioSubTab('posts')}
                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all text-center ${
                      portfolioSubTab === 'posts' ? 'text-cyber-lime border-b border-cyber-lime' : 'text-white/30 hover:text-white/60'
                    }`}
                  >
                    <Grid size={13} strokeWidth={portfolioSubTab === 'posts' ? 3 : 2} /> POSTS
                  </button>
                  <button 
                    onClick={() => setPortfolioSubTab('saved')}
                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all text-center ${
                      portfolioSubTab === 'saved' ? 'text-cyber-lime border-b border-cyber-lime' : 'text-white/30 hover:text-white/60'
                    }`}
                  >
                    <Bookmark size={13} strokeWidth={portfolioSubTab === 'saved' ? 3 : 2} /> SAVED
                  </button>
                  <button 
                    onClick={() => setPortfolioSubTab('tagged')}
                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all text-center ${
                      portfolioSubTab === 'tagged' ? 'text-cyber-lime border-b border-cyber-lime' : 'text-white/30 hover:text-white/60'
                    }`}
                  >
                    <Award size={13} strokeWidth={portfolioSubTab === 'tagged' ? 3 : 2} /> MILESTONES
                  </button>
                </div>

                {/* TAB WINDOW 1: MY INSTAGRAM POSTS (GRID OR FEED STYLE) */}
                {portfolioSubTab === 'posts' && (
                  <div className="space-y-4">
                    {/* Feed Mode Select bar */}
                    <div className="flex items-center justify-between px-2">
                      <div className="space-y-0.5">
                        <span className="text-white/30 text-[8px] font-black uppercase tracking-[0.2em] block">DISPLAY PREFERENCE</span>
                        <h4 className="text-white text-xs font-bold font-mono uppercase">MY PORTFOLIO TIMELINE</h4>
                      </div>
                      
                      <div className="bg-white/5 border border-white/10 rounded-xl p-0.5 flex gap-1">
                        <button 
                          onClick={() => setPortfolioLayout('grid')}
                          className={`p-1.5 rounded-lg transition-transform cursor-pointer ${portfolioLayout === 'grid' ? 'bg-cyber-lime text-onyx' : 'text-white/40 hover:text-white'}`}
                        >
                          <Grid size={12} strokeWidth={2.5} />
                        </button>
                        <button 
                          onClick={() => setPortfolioLayout('feed')}
                          className={`p-1.5 rounded-lg transition-transform cursor-pointer ${portfolioLayout === 'feed' ? 'bg-cyber-lime text-onyx' : 'text-white/40 hover:text-white'}`}
                        >
                          <List size={12} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>

                    <input 
                      id="grid-photo-uploader" 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onloadend = async () => {
                          if (typeof reader.result === 'string') {
                            setSelectedPhotoFile(reader.result);
                            setNewPhotoName("");
                            setNewPhotoCaption("");
                            setShowUploadModal(true);
                          }
                        };
                        reader.readAsDataURL(file);
                      }}
                    />

                    {snapshots.length === 0 ? (
                      <div className="py-12 border border-white/5 rounded-[32px] text-center space-y-3.5 bg-white/[0.01]">
                        <div className="mx-auto w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/20">
                          <Camera size={18} />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-white font-bold text-xs">No Captured Looks Yet</p>
                          <p className="text-white/30 text-[9px] uppercase tracking-wider font-mono">Capture a direct snapshot to start your feed</p>
                        </div>
                        <button 
                          onClick={triggerInAppPhotoSnap}
                          className="px-4 py-2 bg-cyber-lime text-onyx font-black text-[9px] uppercase tracking-widest rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer"
                        >
                          LAUNCH SNAPSHOT
                        </button>
                      </div>
                    ) : portfolioLayout === 'grid' ? (
                      /* 3x3 Aspect Square Instagram Style GRID Layout */
                      <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        {snapshots.map((s, idx) => (
                          <div 
                            key={s.id || idx}
                            onClick={() => setSelectedSnapshotDetail(s)}
                            className="aspect-square bg-white/5 rounded-2xl overflow-hidden relative group border border-white/10 cursor-pointer active:scale-95 transition-all"
                          >
                            <img src={s.imageUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt="Aligned beauty Look" />
                            
                            {/* Floating Web Share Action Trigger */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShareLook(s);
                              }}
                              className="absolute top-2 right-2 z-20 p-1.5 bg-black/60 sm:p-2 backdrop-blur-md rounded-full text-white/80 hover:text-white border border-white/15 hover:scale-110 active:scale-90 transition-all cursor-pointer shadow-lg flex items-center justify-center opacity-90 sm:opacity-0 sm:group-hover:opacity-100"
                              title="Share cosmetics look link"
                            >
                              <Share2 size={11} className="sm:w-3.5 sm:h-3.5" />
                            </button>

                            {/* Hover Overlay Details (Instagram overlay look) */}
                            <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center items-center gap-2 text-white select-none">
                              <p className="text-white text-[9px] font-black uppercase tracking-wider truncate max-w-[85%] text-center">{s.lookName || 'Aligned'}</p>
                              
                              <div className="flex items-center gap-3 text-xs font-bold font-mono">
                                <div className="flex items-center gap-1">
                                  <Heart size={12} fill="currentColor" className="text-pink-500" />
                                  <span>{s.likesCount || 0}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <MessageCircle size={12} fill="currentColor" className="text-blue-400" />
                                  <span>{s.comments ? s.comments.length : 0}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Vertical Instagram style LINEAR SCROLLING FEED Layout */
                      <div className="space-y-6">
                        {snapshots.map((s, idx) => (
                          <div 
                            key={s.id || idx}
                            className="bg-zinc-950 border border-white/10 rounded-[32px] overflow-hidden p-4 space-y-3.5 shadow-md flex flex-col"
                          >
                            {/* Card Header */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full p-0.5 bg-gradient-to-tr from-pink-500 to-cyber-lime">
                                  <img 
                                    src={profile?.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50&q=80"}
                                    className="w-full h-full rounded-full object-cover"
                                    alt="Creator"
                                  />
                                </div>
                                <div>
                                  <p className="text-white font-bold text-xs">@{profile?.displayName?.toLowerCase().replace(/\s+/g, '') || "glow_pioneer"}</p>
                                  <p className="text-white/30 text-[8px] uppercase tracking-wider font-mono leading-none">ADA ALIGNMENT MODEL</p>
                                </div>
                              </div>

                              <button 
                                onClick={() => handleDeleteLook(s.id)}
                                className="p-2 bg-white/5 hover:bg-red-500/10 text-white/40 hover:text-red-400 rounded-xl transition-all cursor-pointer"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>

                            {/* Main Body Photo */}
                            <div 
                              onDoubleClick={() => handleLikeSnapshot(s.id)}
                              className="aspect-[4/5] bg-black rounded-2xl overflow-hidden border border-white/5 relative group cursor-pointer"
                            >
                              <img src={s.imageUrl} className="w-full h-full object-cover" alt="Aligned feedback" />
                              
                              {/* Big central heart dynamic hover transition */}
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:scale-110 active:opacity-100 active:scale-100 transition-all pointer-events-none duration-300">
                                <Heart size={64} className="text-pink-500 drop-shadow-[0_0_20px_rgba(236,72,153,0.6)]" fill="currentColor" />
                              </div>

                              <div className="absolute top-3 right-3 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded-full border border-white/10 text-[7px] text-cyber-lime font-mono uppercase">
                                DOUBLE TAP HEART
                              </div>
                            </div>

                            {/* Actions bar */}
                            <div className="flex items-center justify-between font-mono pt-1">
                              <div className="flex gap-4">
                                <button 
                                  onClick={() => handleLikeSnapshot(s.id)}
                                  className="flex items-center gap-1.5 group select-none cursor-pointer"
                                >
                                  <Heart 
                                    size={16} 
                                    fill={s.isLikedByUser ? "currentColor" : "none"} 
                                    className={`transition-transform duration-300 active:scale-150 ${s.isLikedByUser ? "text-pink-500" : "text-white/50 group-hover:text-pink-500"}`} 
                                  />
                                  <span className={`text-[10px] font-bold ${s.isLikedByUser ? "text-pink-500" : "text-white/60"}`}>{s.likesCount || 0}</span>
                                </button>

                                <button 
                                  onClick={() => setSelectedSnapshotDetail(s)}
                                  className="flex items-center gap-1.5 text-white/50 hover:text-blue-400 transition-colors select-none cursor-pointer"
                                >
                                  <MessageCircle size={16} className="transition-transform active:scale-150" />
                                  <span className="text-[10px] font-bold">{s.comments ? s.comments.length : 0}</span>
                                </button>

                                <button 
                                  onClick={() => handleShareLook(s)}
                                  className="text-white/50 hover:text-cyber-lime transition-colors select-none cursor-pointer"
                                >
                                  <Share2 size={16} />
                                </button>
                              </div>

                              <span className="text-[8px] text-white/30 font-semibold uppercase">
                                {s.createdAt?.toDate ? new Date(s.createdAt?.toDate()).toLocaleDateString() : "Just now"}
                              </span>
                            </div>

                            {/* Caption layout */}
                            <div className="text-xs space-y-1">
                              <p className="text-white leading-relaxed font-semibold">
                                <span className="font-black text-cyber-lime mr-1 px-1 py-0.5 bg-cyber-lime/10 rounded">
                                  {s.lookName}
                                </span>
                                {s.caption}
                              </p>
                            </div>

                            {/* Comments scroll list if any */}
                            {s.comments && s.comments.length > 0 && (
                              <div className="border-t border-white/5 pt-2 space-y-1 text-[10px]">
                                {s.comments.slice(-2).map((cmt: any, idx: number) => (
                                  <div key={idx} className="flex gap-1.5 leading-relaxed">
                                    <span className="text-cyber-lime font-bold">@{cmt.author}:</span>
                                    <span className="text-white/70">{cmt.text}</span>
                                  </div>
                                ))}
                                {s.comments.length > 2 && (
                                  <button 
                                    onClick={() => setSelectedSnapshotDetail(s)}
                                    className="text-[9px] text-cyber-lime/50 font-black tracking-widest uppercase hover:text-cyber-lime block mt-1"
                                  >
                                    View all {s.comments.length} comments
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Inline simple comment input bar */}
                            <div className="flex gap-2 items-center border-t border-white/5 pt-2 mt-1">
                              <input 
                                type="text"
                                placeholder={`Comment as @${profile?.displayName?.split(" ")[0] || "User"}...`}
                                value={commentInputStr}
                                onChange={(e) => setCommentInputStr(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleAddComment(s.id);
                                }}
                                className="flex-1 bg-black/40 border border-white/5 rounded-xl px-3 py-1.5 text-[10px] text-white focus:outline-none focus:border-cyber-lime/30"
                              />
                              <button 
                                onClick={() => handleAddComment(s.id)}
                                className="p-1.5 bg-cyber-lime text-onyx rounded-lg hover:scale-105 active:scale-95 transition-transform"
                              >
                                <Send size={9} strokeWidth={2.5} />
                              </button>
                            </div>

                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB WINDOW 2: INSTAGRAM "SAVED" DOCK */}
                {portfolioSubTab === 'saved' && (
                  <div className="space-y-4">
                    <div className="px-2">
                      <h4 className="text-white text-xs font-bold font-mono uppercase">MY SAVED BEAUTY DESIGNS</h4>
                      <p className="text-white/40 text-[9px] uppercase tracking-wider font-mono">Custom cosmetic palettes and routines</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pb-4">
                      {/* Generated dynamic look cards based on user metrics */}
                      <div className="bg-white/5 border border-white/10 rounded-3xl p-4 space-y-3 relative group overflow-hidden">
                        <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-cyber-lime flex items-center justify-center text-onyx">
                          <Check size={10} strokeWidth={3} />
                        </div>
                        <span className="text-[7.5px] font-black uppercase tracking-[0.2em] font-mono text-cyan-400 pl-0.5">COMPLEMENTARY</span>
                        <h5 className="text-white font-bold text-xs truncate">Complementary Palette</h5>
                        
                        <div className="flex gap-1.5 h-6">
                          {['#E9C46A', '#F4A261', '#E76F51', '#2A9D8F'].map((col) => (
                            <div key={col} className="flex-1 rounded" style={{ backgroundColor: col }} />
                          ))}
                        </div>
                        
                        <p className="text-white/40 text-[9px] leading-tight">Optimized for {profile?.facialMetrics?.skinUndertone || "Warm"} undertones.</p>
                      </div>

                      <div className="bg-white/5 border border-white/10 rounded-3xl p-4 space-y-3 relative group overflow-hidden">
                        <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-cyber-lime flex items-center justify-center text-onyx">
                          <Check size={10} strokeWidth={3} />
                        </div>
                        <span className="text-[7.5px] font-black uppercase tracking-[0.2em] font-mono text-empowerment-pink pl-0.5">HIGH CONTRAST</span>
                        <h5 className="text-white font-bold text-xs truncate">High Contrast Palette</h5>
                        
                        <div className="flex gap-1.5 h-6">
                          {['#264653', '#2A9D8F', '#E76F51', '#D1FA00'].map((col) => (
                            <div key={col} className="flex-1 rounded" style={{ backgroundColor: col }} />
                          ))}
                        </div>
                        
                        <p className="text-white/40 text-[9px] leading-tight font-mono uppercase text-center mt-1">ALIGNMENT PALETTE</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB WINDOW 3: INSTAGRAM "TAGGED" */}
                {portfolioSubTab === 'tagged' && (
                  <div className="space-y-4">
                    <div className="px-2">
                      <h4 className="text-white text-xs font-bold font-mono uppercase">COSMETIC MILESTONES</h4>
                      <p className="text-white/40 text-[9px] uppercase tracking-wider font-mono">Unlock digital trophies with computer vision scans</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pb-4">
                      {['Perfect Complexion', 'Blending Guru', 'Feline Contour', 'Liner Empress'].map((badge, idx) => (
                        <div key={idx} className="bg-gradient-to-tr from-white/[0.03] to-transparent border border-white/10 rounded-3xl p-4 flex flex-col justify-between h-32 relative group select-none">
                          <div className="w-9 h-9 rounded-full bg-cyber-lime/10 flex items-center justify-center text-cyber-lime group-hover:scale-110 transition-transform shadow animate-pulse">
                            <Award size={16} />
                          </div>
                          
                          <div className="space-y-1">
                            <h5 className="font-bold text-white text-xs leading-tight">{badge}</h5>
                            <span className="text-[8px] font-mono font-bold uppercase tracking-[0.2em] text-cyber-lime block">LEVEL {idx + 1} UNLOCKED</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* 4. Vault Tab */}
            {activeTab === 'vault' && (
              <div className="space-y-6">
                <div className="bg-white/5 border border-white/10 rounded-[32px] p-6 space-y-6">
                  <h3 className="text-white font-display font-bold text-xl tracking-tight">Trust & Privacy</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                      <div className="space-y-0.5">
                        <p className="text-white text-sm font-bold">Local Processing</p>
                        <p className="text-white/40 text-[10px]">Perform vision tasks on-device</p>
                      </div>
                      <button 
                        onClick={() => handleToggleLocalProcessing(!profile?.privacySettings?.localProcessing)}
                        className={`w-12 h-6 rounded-full transition-all relative cursor-pointer ${
                        profile?.privacySettings?.localProcessing ? 'bg-cyber-lime' : 'bg-white/10'
                      }`}>
                        <motion.div 
                          animate={{ x: profile?.privacySettings?.localProcessing ? 24 : 4 }}
                          className="absolute inset-y-1 w-4 h-4 bg-white rounded-full shadow-lg" 
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                      <div className="space-y-0.5">
                        <p className="text-white text-sm font-bold">Hype Mode</p>
                        <p className="text-white/40 text-[10px]">Ada's personality intensity</p>
                      </div>
                      <span className="text-cyber-lime font-black text-xs animate-pulse drop-shadow-[0_0_10px_var(--color-cyber-lime)]">MAX</span>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                      <div className="space-y-0.5">
                        <p className="text-white text-sm font-bold">Membership Tier</p>
                        <p className="text-white/40 text-[10px]">{isElite(profile) ? 'Elite Features Active' : 'Free Basic Plan'}</p>
                      </div>
                      {isElite(profile) ? (
                        <span className="px-4 py-2 rounded-xl text-[10px] font-bold uppercase bg-cyber-lime text-onyx shadow-xl">
                          Elite Active
                        </span>
                      ) : STRIPE_PREMIUM_PAYMENT_LINK ? (
                        <a
                          href={STRIPE_PREMIUM_PAYMENT_LINK}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 rounded-xl text-[10px] font-bold uppercase bg-white text-onyx shadow-xl transition-all cursor-pointer"
                        >
                          Upgrade to Elite
                        </a>
                      ) : (
                        <span className="px-4 py-2 rounded-xl text-[10px] font-bold uppercase bg-white/10 text-white/30">
                          Elite Coming Soon
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Dynamic Gemini Cloud Registry */}
                <div className="bg-white/5 border border-white/10 rounded-[32px] p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-display font-bold text-xl tracking-tight">AI Cognitive Engines</h3>
                      <p className="text-white/40 text-[10px] font-mono uppercase tracking-wider">Dynamic Google Cloud Registry</p>
                    </div>
                    <button 
                      onClick={fetchGeminiModels}
                      disabled={isLoadingModels}
                      className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white hover:text-cyber-lime active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                      title="Sync available cognitive models"
                    >
                      <RefreshCw size={13} className={isLoadingModels ? "animate-spin text-cyber-lime" : ""} />
                    </button>
                  </div>

                  {/* Status Indicator */}
                  <div className="flex items-center gap-3 p-3 bg-black/45 rounded-2xl border border-white/5 font-mono text-[9px] uppercase tracking-wider">
                    <span className="relative flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isApiKeyConfigured ? "bg-cyber-lime" : "bg-orange-500"}`}></span>
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${isApiKeyConfigured ? "bg-cyber-lime" : "bg-orange-500"}`}></span>
                    </span>
                    <div className="flex-1">
                      <span className="text-white/40">Credential Status: </span>
                      <span className={isApiKeyConfigured ? "text-cyber-lime font-bold" : "text-orange-400 font-bold"}>
                        {isApiKeyConfigured ? "VERIFIED GOOGLE CLOUD FUNDING LINKED" : "SANDBOX / DEV KEY IN USE"}
                      </span>
                    </div>
                  </div>

                  {modelsError && (
                    <div className="p-3 bg-red-950/20 border border-red-500/20 text-red-400 rounded-2xl text-[10px] font-mono leading-tight">
                      ⚠️ {modelsError}
                    </div>
                  )}

                  {/* Scrollable Model Cards */}
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 no-scrollbar">
                    {geminiModels.map((model, idx) => (
                      <div 
                        key={model.name || idx} 
                        className="p-4 bg-black/20 rounded-2xl border border-white/5 hover:border-white/15 transition-all space-y-2 group"
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-0.5">
                            <h4 className="text-white text-xs font-bold leading-tight flex items-center gap-1.5">
                              {model.displayName}
                              {model.isFallback && (
                                <span className="px-1.5 py-0.5 bg-white/5 text-white/50 text-[7px] font-mono uppercase tracking-wider rounded border border-white/5">
                                  Default
                                </span>
                              )}
                            </h4>
                            <p className="text-white/30 text-[8px] font-mono lowercase truncate max-w-[200px]">
                              {model.name}
                            </p>
                          </div>
                          
                          <div className="w-4 h-4 rounded-full border border-cyber-lime/40 group-hover:bg-cyber-lime/10 flex items-center justify-center text-cyber-lime transition-all">
                            <Check size={8} strokeWidth={3} />
                          </div>
                        </div>

                        <p className="text-white/60 text-[10px] leading-relaxed">
                          {model.description}
                        </p>

                        {/* Badges for Capability */}
                        {model.supportedGenerationMethods && model.supportedGenerationMethods.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {model.supportedGenerationMethods.map((method: string, mIdx: number) => {
                              const cleanMethod = method.split("/").pop() || method;
                              if (!cleanMethod.includes("generate") && !cleanMethod.includes("predict")) return null;
                              return (
                                <span key={mIdx} className="px-1.5 py-0.5 bg-cyber-lime/5 text-cyber-lime text-[7px] font-mono uppercase tracking-widest rounded border border-cyber-lime/10 font-bold">
                                  ✓ {cleanMethod}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <p className="text-white/20 text-[9px] font-mono text-center leading-relaxed">
                    Models retrieved dynamically via @google/genai client using linked Google Cloud developer credentials.
                  </p>
                </div>

                <div className="space-y-4">
                  <button 
                    onClick={handleWipeData}
                    className="w-full p-6 bg-empowerment-pink/10 border border-empowerment-pink/20 text-empowerment-pink rounded-[32px] font-display font-black text-sm tracking-widest flex items-center justify-center gap-3 hover:bg-empowerment-pink/20 transition-all cursor-pointer"
                  >
                    <Trash2 size={18} /> WIPE ALL DATA
                  </button>
                  <p className="text-center text-white/20 text-[9px] font-medium leading-relaxed px-8">
                    Your facial data and vanity history are encrypted and only accessible by you. Wiping data is permanent.
                  </p>
                  <div className="flex justify-center gap-4 text-[10px] font-bold uppercase tracking-wider text-cyber-lime/85 mt-3">
                    <button onClick={() => setShowPolicy('privacy')} className="hover:text-cyber-lime transition-all cursor-pointer">Privacy Policy</button>
                    <span className="text-white/10">•</span>
                    <button onClick={() => setShowPolicy('terms')} className="hover:text-cyber-lime transition-all cursor-pointer">Terms of Service</button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Upload Details Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-zinc-950 border border-white/10 rounded-[36px] overflow-hidden p-6 space-y-4 shadow-2xl relative"
            >
              <button 
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedPhotoFile(null);
                }} 
                className="absolute top-4 right-4 p-2 bg-white/5 rounded-full text-white/40 hover:text-white transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>

              <div className="space-y-1">
                <span className="text-[8px] font-black tracking-widest text-cyber-lime uppercase font-mono block">PORTFOLIO POST</span>
                <h3 className="text-white text-md font-display font-bold">Publish Snapshot look</h3>
              </div>

              {selectedPhotoFile && (
                <div className="aspect-square w-32 h-32 mx-auto rounded-2xl overflow-hidden border border-white/15">
                  <img src={selectedPhotoFile} className="w-full h-full object-cover" alt="Preview" />
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-white/40 text-[8px] font-bold uppercase tracking-widest pl-1 font-mono">Look Name</label>
                  <input 
                    type="text" 
                    placeholder="E.g. Feline Glow, Cat-Eye Mastery"
                    value={newPhotoName}
                    onChange={(e) => setNewPhotoName(e.target.value)}
                    className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-cyber-lime/40"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-white/40 text-[8px] font-bold uppercase tracking-widest pl-1 font-mono">Caption / Notes</label>
                  <textarea 
                    placeholder="Wanna write a caption? Include recommendations or routine logs..."
                    value={newPhotoCaption}
                    onChange={(e) => setNewPhotoCaption(e.target.value)}
                    rows={2}
                    className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-cyber-lime/40 resize-none"
                  />
                </div>
              </div>

              <button 
                onClick={handleAddNewLook}
                disabled={isUploadingPhoto}
                className="w-full py-3.5 bg-cyber-lime text-onyx rounded-2xl font-display font-black text-xs uppercase tracking-widest transition-all shadow-[0_5px_20px_rgba(209,250,0,0.3)] hover:scale-[1.02] active:scale-98 disabled:opacity-40 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isUploadingPhoto ? (
                  <>
                    <Loader2 size={12} className="animate-spin" /> PRODUCING LOOK...
                  </>
                ) : (
                  <>
                    <Upload size={12} /> ADD TO PORTFOLIO
                  </>
                )}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dynamic Inline Camera Modal ("Snap Look") */}
      <AnimatePresence>
        {showCameraModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-zinc-950 border border-white/10 rounded-[36px] overflow-hidden p-6 space-y-4 shadow-2xl relative"
            >
              <button 
                onClick={closeInAppCameraStream} 
                className="absolute top-4 right-4 p-2 bg-white/5 rounded-full text-white/40 hover:text-white transition-colors cursor-pointer z-10"
              >
                <X size={14} />
              </button>

              <div className="space-y-1">
                <span className="text-[8px] font-black tracking-widest text-cyber-lime uppercase font-mono block">💻 LIVE BEAUTY CAM</span>
                <h3 className="text-white text-md font-display font-bold">Capture Face Alignment Look</h3>
              </div>

              {/* Real Camera Preview Frame */}
              <div className="aspect-[4/5] w-full bg-zinc-900 rounded-2xl overflow-hidden border border-white/10 relative flex items-center justify-center">
                {cameraActiveState ? (
                  <>
                    <video 
                      id="profile-webcam-el" 
                      className="w-full h-full object-cover -scale-x-100 rounded-2xl" 
                      playsInline 
                      muted 
                    />
                    {/* Centered Golden Alignment grid lines */}
                    <div className="absolute inset-0 border border-dashed border-cyber-lime/20 rounded-2xl pointer-events-none flex items-center justify-center">
                      <div className="w-1/2 h-1/2 border border-dashed border-cyber-lime/45 rounded-full" />
                    </div>
                  </>
                ) : capturedPhotoUrl ? (
                  <img src={capturedPhotoUrl} className="w-full h-full object-cover rounded-2xl" alt="Captured Look" />
                ) : (
                  <div className="text-center space-y-2 p-4">
                    <Loader2 size={24} className="animate-spin text-cyber-lime mx-auto" />
                    <p className="text-white/40 text-[10px] font-mono uppercase tracking-wider">Starting camera sensor...</p>
                  </div>
                )}
                <canvas id="profile-webcam-canvas" className="hidden" />
              </div>

              {cameraActiveState ? (
                /* Click Shutter trigger */
                <button 
                  onClick={takeSnapshotNow}
                  className="w-full py-3 bg-white text-onyx rounded-2xl font-display font-black text-xs uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Camera size={13} /> SNAP PHOTO LOOK
                </button>
              ) : capturedPhotoUrl ? (
                /* Edit details & publish form fields layout */
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-white/40 text-[8px] font-bold uppercase tracking-widest pl-1 font-mono">Look / Style Name</label>
                    <input 
                      type="text" 
                      placeholder="E.g. Winged Gold Contrast"
                      value={capLookName}
                      onChange={(e) => setCapLookName(e.target.value)}
                      className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-cyber-lime/40"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-white/40 text-[8px] font-bold uppercase tracking-widest pl-1 font-mono">Caption Story</label>
                    <textarea 
                      placeholder="Add look notes, glow filters used, or color palettes applied..."
                      value={capLookCaption}
                      onChange={(e) => setCapLookCaption(e.target.value)}
                      rows={2}
                      className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-cyber-lime/40 resize-none font-sans"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button 
                      onClick={triggerInAppPhotoSnap}
                      className="py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-[10px] font-bold uppercase cursor-pointer hover:bg-white/10"
                    >
                      Retake
                    </button>
                    <button 
                      onClick={saveCapturedDirectLook}
                      className="py-2.5 bg-cyber-lime text-onyx rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1 shadow-md hover:bg-cyber-lime/90"
                    >
                      {isCapturingDirect ? <Loader2 size={10} className="animate-spin" /> : "PUBLISH LOOK"}
                    </button>
                  </div>
                </div>
              ) : null}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Zoom Snapshot Details Viewer Modal (High Fidelity Instagram layout) */}
      <AnimatePresence>
        {selectedSnapshotDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-zinc-950 border border-white/10 rounded-[38px] overflow-hidden p-5 space-y-4 shadow-2xl relative"
            >
              {/* Close Button */}
              <button 
                onClick={() => setSelectedSnapshotDetail(null)}
                className="absolute top-4 right-4 p-2 bg-white/5 rounded-full text-white/40 hover:text-white transition-colors cursor-pointer z-10"
              >
                <X size={14} />
              </button>

              {/* Header with Creator Identity */}
              <div className="flex items-center gap-2.5 pb-1 select-none">
                <div className="w-8 h-8 rounded-full p-0.5 bg-gradient-to-tr from-pink-500 to-cyber-lime">
                  <img 
                    src={profile?.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50&q=80"}
                    className="w-full h-full rounded-full object-cover"
                    alt="Creator"
                  />
                </div>
                <div>
                  <p className="text-white text-xs font-black">@{profile?.displayName?.toLowerCase().replace(/\s+/g, '') || "glow_pioneer"}</p>
                  <p className="text-[7.5px] text-cyber-lime font-mono tracking-widest uppercase font-semibold leading-none">ADA DIGITAL ARTIST</p>
                </div>
              </div>

              {/* Rich Portrait Photo with double tap and watermark */}
              <div 
                onDoubleClick={() => handleLikeSnapshot(selectedSnapshotDetail.id)}
                className="aspect-[4/5] w-full bg-black rounded-2xl overflow-hidden border border-white/10 relative group cursor-pointer"
              >
                <img src={selectedSnapshotDetail.imageUrl} className="w-full h-full object-cover" alt="Aligned beauty Look" />
                
                {/* Float center heart on tap */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:scale-110 active:opacity-100 active:scale-100 transition-all pointer-events-none duration-300">
                  <Heart size={48} fill="currentColor" className="text-pink-500 drop-shadow-[0_0_15px_rgba(236,72,153,0.5)]" />
                </div>

                <div className="absolute top-3 left-3 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded-full border border-white/10 text-[7px] text-cyber-lime font-mono uppercase">
                  ✓ ADA ALIGNMENT MATCH
                </div>
              </div>

              {/* Instagram Interactivity bar */}
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div className="flex gap-4">
                  <button 
                    onClick={() => handleLikeSnapshot(selectedSnapshotDetail.id)}
                    className="flex items-center gap-1 cursor-pointer select-none"
                  >
                    <Heart 
                      size={15} 
                      fill={selectedSnapshotDetail.isLikedByUser ? "currentColor" : "none"} 
                      className={selectedSnapshotDetail.isLikedByUser ? "text-pink-500 scale-110" : "text-white/60 hover:text-pink-500"} 
                    />
                    <span className={`text-[9.5px] font-bold font-mono ${selectedSnapshotDetail.isLikedByUser ? "text-pink-500" : "text-white/50"}`}>
                      {selectedSnapshotDetail.likesCount || 0}
                    </span>
                  </button>

                  <div className="flex items-center gap-1 text-white/50 font-mono">
                    <MessageCircle size={15} />
                    <span className="text-[9.5px] font-bold">
                      {selectedSnapshotDetail.comments ? selectedSnapshotDetail.comments.length : 0}
                    </span>
                  </div>

                  <button 
                    onClick={() => setShowShareSheet(true)}
                    className="text-white/60 hover:text-cyber-lime cursor-pointer flex items-center justify-center"
                  >
                    <Share2 size={15} />
                  </button>
                </div>

                <span className="text-[7.5px] text-white/30 font-semibold font-mono uppercase">
                  {selectedSnapshotDetail.createdAt?.toDate ? new Date(selectedSnapshotDetail.createdAt.toDate()).toLocaleDateString() : 'Just snapshot'}
                </span>
              </div>

              {/* Information / Caption details */}
              <div className="space-y-1 px-0.5">
                <h3 className="text-white text-sm font-display font-black uppercase tracking-tight leading-tight">{selectedSnapshotDetail.lookName}</h3>
                <p className="text-white/70 text-xs leading-relaxed font-sans">{selectedSnapshotDetail.caption}</p>
              </div>

              {/* Scrollable Comments list with custom avatars */}
              <div className="space-y-2 border-t border-white/5 pt-3">
                <span className="text-white/30 text-[8px] font-black uppercase tracking-[0.15em] font-mono pl-0.5 block font-bold">COMMENTS DOCK</span>
                
                <div className="max-h-[85px] overflow-y-auto pr-1 space-y-2 select-none no-scrollbar">
                  {(!selectedSnapshotDetail.comments || selectedSnapshotDetail.comments.length === 0) ? (
                    <p className="text-white/20 text-[9px] font-mono uppercase text-center py-2 italic">Be the first to leave beautiful insights...</p>
                  ) : (
                    selectedSnapshotDetail.comments.map((cmt: any, idx: number) => (
                      <div key={idx} className="text-[10px] flex items-start gap-1.5 leading-relaxed bg-white/[0.02] border border-white/5 p-2 rounded-xl">
                        <div className="w-5 h-5 rounded-full bg-white/10 flex-shrink-0 overflow-hidden">
                          <img 
                            src={cmt.authorPhoto || "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=50&q=80"} 
                            className="w-full h-full object-cover animate-pulse" 
                            alt="Avatar"
                          />
                        </div>
                        <div className="flex-1">
                          <p className="text-white font-bold inline mr-1">@{cmt.author.toLowerCase()}</p>
                          <span className="text-white/70">{cmt.text}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Submit Comment Field */}
                <div className="flex gap-2 items-center border-t border-white/5 pt-2">
                  <input 
                    type="text"
                    placeholder={`Reply comment as @${profile?.displayName?.split(" ")[0]?.toLowerCase() || "user"}...`}
                    value={commentInputStr}
                    onChange={(e) => setCommentInputStr(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddComment(selectedSnapshotDetail.id);
                    }}
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-cyber-lime/40"
                  />
                  <button 
                    onClick={() => handleAddComment(selectedSnapshotDetail.id)}
                    className="p-2.5 bg-cyber-lime text-onyx rounded-xl hover:scale-105 active:scale-95 transition-transform flex items-center justify-center cursor-pointer"
                  >
                    <Send size={11} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              {/* Action grid (Delete and Share Hub) */}
              <div className="grid grid-cols-2 gap-3.5 pt-1">
                <button 
                  onClick={() => setShowShareSheet(true)}
                  className="w-full py-2.5 bg-cyber-lime text-onyx rounded-xl font-bold text-[9.5px] uppercase tracking-widest transition-all shadow-[0_4px_15px_rgba(209,250,0,0.25)] flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Share2 size={11} /> SHARE OPTIONS
                </button>

                <button 
                  onClick={() => handleDeleteLook(selectedSnapshotDetail.id)}
                  className="w-full py-2.5 bg-red-950/20 border border-red-500/20 text-red-400 rounded-xl font-bold text-[9.5px] uppercase tracking-widest transition-all hover:bg-red-500/10 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Trash size={11} /> DELETE LOOK
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Visual Custom Share Sheet Drawer */}
      <AnimatePresence>
        {showShareSheet && selectedSnapshotDetail && (
          <div className="fixed inset-0 z-55 flex items-end justify-center bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full max-w-sm bg-zinc-950 border-t border-white/10 rounded-t-[40px] p-6 space-y-5 shadow-2xl relative"
            >
              {/* Handle Pull */}
              <div className="w-12 h-1.5 bg-white/15 rounded-full mx-auto -mt-2 cursor-pointer mb-2" onClick={() => setShowShareSheet(false)} />
              
              <div className="space-y-1">
                <span className="text-[7.5px] font-black tracking-widest text-cyber-lime uppercase font-mono block">🌎 ADA CUSTOM MATRIX SHARE</span>
                <h3 className="text-white text-md font-display font-medium">Capture Share Look Sheet</h3>
              </div>

              {/* Tab options in share selection */}
              <div className="flex gap-2 p-1 bg-white/5 border border-white/5 rounded-2xl">
                {([
                  { id: 'social', label: 'Instagram Stories' },
                  { id: 'bio', label: 'Color Telemetry' },
                  { id: 'raw', label: 'Raw Link' }
                ] as const).map((tab) => (
                  <button 
                    key={tab.id}
                    onClick={() => setShareFormat(tab.id)}
                    className={`flex-1 py-2 text-[8.5px] font-bold uppercase rounded-xl transition-all cursor-pointer ${
                      shareFormat === tab.id ? 'bg-cyber-lime text-onyx font-extrabold' : 'text-white/40 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Formatted Shares preview visualization */}
              <div className="bg-black/40 border border-white/10 p-4 rounded-2xl font-mono text-[10px] text-white/80 leading-relaxed max-h-[140px] overflow-y-auto no-scrollbar whitespace-pre-wrap select-all">
                {shareFormat === 'social' ? (
                  `💋 ADA AI COSMETICS CHRONICLES\n✨ Look Name: "${selectedSnapshotDetail.lookName}" — ${selectedSnapshotDetail.caption}\n💅 Tested alignment calibration model mapping eye angles & undertone theory.\n🔗 Explore lookbook: ${window.location.origin}`
                ) : shareFormat === 'bio' ? (
                  `🧪 COSMETIC DATA MATRIX PORTFOLIO\n👤 User: @${profile?.displayName?.toLowerCase().replace(/\s+/g, "_") || "beauty_pioneer"}\n🧬 Undertone: ${profile?.facialMetrics?.skinUndertone || "Neutral"}\n👁️ Eye mapping: ${profile?.facialMetrics?.eyeType || "Feline"}\n📐 Face geometry structure: ${profile?.facialMetrics?.faceShape || "Oval"}\n🌺 Captured beauty Look: "${selectedSnapshotDetail.lookName}"`
                ) : (
                  `${window.location.origin}/look/${selectedSnapshotDetail.id}`
                )}
              </div>

              {/* Copy actions buttons */}
              <div className="grid grid-cols-2 gap-3.5 pt-1">
                <button 
                  onClick={async () => {
                    const payloadText = shareFormat === 'social' 
                      ? `💋 ADA AI COSMETICS CHRONICLES\n✨ Look Name: "${selectedSnapshotDetail.lookName}" — ${selectedSnapshotDetail.caption}\n💅 Tested alignment calibration model mapping eye angles & undertone theory.\n🔗 Explore lookbook: ${window.location.origin}`
                      : shareFormat === 'bio'
                      ? `🧪 COSMETIC DATA MATRIX PORTFOLIO\n👤 User: @${profile?.displayName?.toLowerCase().replace(/\s+/g, "_") || "beauty_pioneer"}\n🧬 Undertone: ${profile?.facialMetrics?.skinUndertone || "Neutral"}\n👁️ Eye mapping: ${profile?.facialMetrics?.eyeType || "Feline"}\n📐 Face geometry structure: ${profile?.facialMetrics?.faceShape || "Oval"}\n🌺 Captured beauty Look: "${selectedSnapshotDetail.lookName}"`
                      : `${window.location.origin}/look/${selectedSnapshotDetail.id}`;
                    
                    try {
                      await navigator.clipboard.writeText(payloadText);
                      setCopiedSharePayload(true);
                      setTimeout(() => setCopiedSharePayload(false), 2000);
                    } catch (err) {
                      console.error("Clipboard copying failed:", err);
                    }
                  }}
                  className="py-3 bg-cyber-lime text-onyx rounded-2xl font-black text-[9.5px] uppercase tracking-widest flex items-center justify-center gap-1.5 cursor-pointer shadow-lg hover:bg-cyber-lime/90 active:scale-95 transition-transform"
                >
                  {copiedSharePayload ? "COPIED TO CLIPBOARD!" : "COPY PREVIEW TEXT"}
                </button>

                <button 
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = selectedSnapshotDetail.imageUrl;
                    link.download = `ADA-look-${selectedSnapshotDetail.lookName.replace(/\s+/g, "-")}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="py-3 bg-white/5 border border-white/10 text-white rounded-2xl font-black text-[9.5px] uppercase tracking-widest flex items-center justify-center gap-1.5 cursor-pointer hover:bg-white/10 active:scale-95 transition-transform"
                >
                  <Download size={12} /> DOWNLOAD PNG
                </button>
              </div>

              <button 
                onClick={() => setShowShareSheet(false)}
                className="w-full py-2.5 text-center text-white/30 hover:text-white text-[9px] uppercase tracking-widest font-black"
              >
                Close Options
              </button>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPolicy && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="absolute inset-0 z-50 bg-black/95 backdrop-blur-3xl overflow-y-auto p-8 flex flex-col justify-between"
          >
            <div className="space-y-6 max-w-md mx-auto pt-8">
              <h2 className="text-2xl font-display font-bold text-white tracking-tight border-b border-white/11 pb-4">
                {showPolicy === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
              </h2>
              
              <div className="text-white/70 text-xs leading-relaxed space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                {showPolicy === 'privacy' ? (
                  <>
                    <p className="font-bold text-cyber-lime">Last Updated: June 2026</p>
                    <p>At Ada AI, we are committed to safeguarding your privacy. Your trust is our gold standard. All camera-based analysis is processed dynamically using Google Gemini API or on-device models.</p>
                    <p className="font-semibold text-white">1. Data Capture & Processing</p>
                    <p>We use your device's camera to capture facial structures solely to perform AR-based color theory and skincare consultations. No raw video feed ever leaves your client device without your explicit permission.</p>
                    <p className="font-semibold text-white">2. Storage & Encryption</p>
                    <p>Selected pigments, looks, and vanity configurations are securely preserved in our Firebase Firestore database tied to your authenticated workspace. These details are isolated to your account and never shared with third parties.</p>
                    <p className="font-semibold text-white">3. Control & Erasure</p>
                    <p>You maintain ultimate sovereignty over your data. You can toggle local processing or purge your entire digital footprint instantly with the "Wipe All Data" tool inside the Vault.</p>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-cyber-lime">Last Updated: June 2026</p>
                    <p>By stepping into Ada AI (the "App"), you agree to the following terms. We want our service to represent confidence and professional artistry.</p>
                    <p className="font-semibold text-white">1. Service Scope</p>
                    <p>Ada AI offers virtual cosmetics, skincare, and real-time color theory coaching powered by Google's Gemini models. AI recommendations represent educational beauty content and not professional dermatological Advice.</p>
                    <p className="font-semibold text-white">2. User Conduct & Camera Access</p>
                    <p>You agree to grant camera permissions purely for self-inspired digital trials. Capturing screenshots or visual data of others without consent is strictly prohibited.</p>
                    <p className="font-semibold text-white">3. Liability Limits</p>
                    <p>Ada AI holds no liability for simulated makeup predictions, physical application outcomes, or individual product sensitivities. Try look simulations at your own discretion!</p>
                  </>
                )}
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowPolicy(null)}
              className="mt-8 w-full max-w-md mx-auto h-12 bg-cyber-lime text-onyx rounded-full font-display font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              Understand & Accept
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating success toast for clipboard copy / share fallback */}
      <AnimatePresence>
        {copiedStatus && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.9 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 bg-zinc-950 border border-cyber-lime text-cyber-lime font-mono text-[9px] uppercase tracking-widest font-bold rounded-full shadow-[0_4px_20px_rgba(209,250,0,0.2)] flex items-center gap-2 pointer-events-none"
          >
            <span className="text-pink-500 font-bold">💋</span> LOOK SHARE COPIED TO CLIPBOARD
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
