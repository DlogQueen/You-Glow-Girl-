/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CameraMirror, CameraMirrorHandle } from "./components/CameraMirror";
import { ChatOverlay } from "./components/ChatOverlay";
import { RingLight } from "./components/RingLight";
import { FeedView } from "./components/FeedView";
import { TryOnView } from "./components/TryOnView";
import { ProfileView } from "./components/ProfileView";
import { Onboarding } from "./components/Onboarding";
import { AdaLiveView } from "./components/AdaLiveView";
import { DashboardView } from "./components/DashboardView";
import { useFirebase } from "./lib/FirebaseProvider";
import { Message } from "./types";
import { Sparkles, Download, LayoutGrid, Palette, Camera, MessageCircle, User, Home } from "lucide-react";
import { useSpeech } from "./hooks/useSpeech";
import { UpgradeModal } from "./components/UpgradeModal";
import { getChatUsageStatus, recordChatUsage, isElite } from "./lib/usage";
import { MEMORY_CONSOLIDATION_CHUNK_SIZE, buildTranscript, addMemory } from "./lib/memory";

const LOADING_QUOTES = [
  "Waking up Ada... She is currently downloading her digital coffee. Let the progress bar finish, or you're going to deal with some serious digital attitude.",
  "Ada is initializing: Processing pixels, blending pigments, and applying a fresh coat of code.",
  "Syncing pixels and pigments. Good code takes time.",
  "Almost ready... Ada is overthinking her outfit choice right now. It's a girl thing, even for an AI."
];

export default function App() {
  const { user, profile, loading: authLoading, updateProfile } = useFirebase();
  const [upgradeModalReason, setUpgradeModalReason] = useState<"chat-limit" | "live-locked" | null>(null);
  const [bootProgress, setBootProgress] = useState(0);
  const [isBooting, setIsBooting] = useState(true);
  
  // WAKE WORD LISTENER
  const [isWakeWordListening, setIsWakeWordListening] = useState(false);
  const wakeWordSpeech = useSpeech({
    onResult: (text) => {
      if (text.toLowerCase().includes("hey ada")) {
        console.log("Wake word detected!");
        if (!isElite(profile)) {
          setUpgradeModalReason("live-locked");
          return;
        }
        setActiveTab("live");
        // We need a way to trigger activateLive in AdaLiveView.
        // For now, let's just switch tab. The user can hit the mic.
        // If we want it automatic, we'd need a ref or state.
      }
    }
  });

  useEffect(() => {
    // Only listen for wake word when on dashboard or home
    if (!isWakeWordListening && !isBooting) {
        wakeWordSpeech.startListening();
        setIsWakeWordListening(true);
    }
    return () => {
        wakeWordSpeech.stopListening();
    }
  }, [isBooting, isWakeWordListening]);

  // Progressive startup loading quote sequence
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isBooting) {
      interval = setInterval(() => {
        setBootProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              setIsBooting(false);
            }, 550);
            return 100;
          }
          // Balanced organic progressive ticks to let the user read all 4 gorgeous quotes comfortably!
          const step = prev < 75 
            ? (Math.random() * 0.2 + 0.28) // Slower pacing to let users read first 3 quotes (about 4.5s each)
            : (Math.random() * 1.5 + 2.0); // Wrapping up quickly for the final block
          return Math.min(prev + step, 100);
        });
      }, 70);
    }
    return () => clearInterval(interval);
  }, [isBooting]);

  const [onboarded, setOnboarded] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedTryOnColors, setSelectedTryOnColors] = useState<Record<string, string>>({
    lips: "#FF4A8D",
    eyes: "#673AB7",
    face: "#FFD600",
  });

  const isCameraNeeded = ['tryon', 'live'].includes(activeTab);
  
  // Set initial onboarded state based on existing facial metrics
  useEffect(() => {
    if (profile?.facialMetrics && profile.facialMetrics.faceShape && profile.facialMetrics.faceShape !== "Pending") {
      setOnboarded(true);
    } else {
      setOnboarded(false);
    }
  }, [profile]);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "initial",
      role: "assistant",
      content: "Hey Girl! What are we getting ready for today? ✨",
      timestamp: Date.now(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [ringLightOn, setRingLightOn] = useState(false);
  const [isImmersiveMode, setIsImmersiveMode] = useState(false);
  const cameraRef = useRef<CameraMirrorHandle>(null);

  const handleSendMessage = async (text: string, uploadedImage?: string) => {
    const usageStatus = getChatUsageStatus(profile, !user);
    if (usageStatus.limitReached) {
      setUpgradeModalReason("chat-limit");
      return;
    }

    // Capture visual context if camera is active, otherwise use uploaded image
    const image = uploadedImage || (isCameraNeeded ? cameraRef.current?.captureFrame() : null);

    const userMessage: Message = {
      id: Math.random().toString(36).substring(7),
      role: 'user',
      content: text,
      image: image || undefined,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          image,
          profile: profile ? {
            displayName: profile.displayName,
            pronouns: profile.pronouns,
            bio: profile.bio,
            goals: profile.beautyGoal || profile.goals,
            facialMetrics: profile.facialMetrics,
            galleryCount: profile.gallery ? profile.gallery.length : 0
          } : undefined
        }),
      });
      
      const data = await response.json();

      if (data.reply) {
        setMessages(prev => [...prev, {
          id: Math.random().toString(36).substring(7),
          role: 'assistant',
          content: data.reply,
          timestamp: Date.now(),
        }]);
        recordChatUsage(profile, !user, updateProfile);
      }
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Persistent memory: once enough raw messages pile up, distill them into
  // one compact long-term summary (via /api/consolidate-memory) instead of
  // keeping the full transcript forever. Runs for guests too - updateProfile
  // already handles both the Firestore and localStorage paths.
  const lastConsolidatedIndexRef = useRef(0);
  useEffect(() => {
    if (isLoading) return;
    const unconsolidated = messages.length - lastConsolidatedIndexRef.current;
    if (unconsolidated < MEMORY_CONSOLIDATION_CHUNK_SIZE) return;

    const chunk = messages.slice(lastConsolidatedIndexRef.current);
    const startIndex = lastConsolidatedIndexRef.current;
    lastConsolidatedIndexRef.current = messages.length;

    (async () => {
      try {
        const response = await fetch("/api/consolidate-memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: buildTranscript(chunk) }),
        });
        if (!response.ok) throw new Error(`Consolidation failed: ${response.status}`);
        const { summary, importance } = await response.json();
        if (summary) {
          await updateProfile({ longTermMemories: addMemory(profile?.longTermMemories, { summary, importance }) });
        }
      } catch (err) {
        console.error("Memory consolidation failed, will retry with the next chunk:", err);
        lastConsolidatedIndexRef.current = startIndex;
      }
    })();
  }, [messages, isLoading]);

  if (authLoading || isBooting) {
    const activeQuoteIndex = Math.min(Math.floor(bootProgress / 25), LOADING_QUOTES.length - 1);
    const activeQuote = LOADING_QUOTES[activeQuoteIndex];

    return (
      <div className="fixed inset-0 bg-[#0a0a0c] flex flex-col items-center justify-center gap-10 z-[999] px-6 text-center select-none overflow-hidden">
        {/* Soft Ambient Radiance Glares */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full bg-empowerment-pink/5 blur-[90px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[250px] h-[250px] rounded-full bg-[#E1FF00]/3 blur-[90px] pointer-events-none" />

        {/* Space Emblem Spinner */}
        <div className="relative flex items-center justify-center">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-28 h-28 rounded-full border border-white/5 border-t-[3px] border-t-empowerment-pink shadow-[0_0_35px_rgba(255,92,162,0.35)]"
          />
          {/* Inner Mirror Loader */}
          <motion.div 
            animate={{ rotate: -360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="absolute w-20 h-20 rounded-full border border-white/5 border-b-[2px] border-b-cyber-lime/70"
          />
          <div className="absolute flex flex-col items-center justify-center">
            <Sparkles size={28} className="text-cyber-lime animate-pulse duration-1000 drop-shadow-[0_0_8px_rgba(209,250,0,0.8)]" />
            <span className="font-mono text-[9px] text-white/50 tracking-widest mt-1 font-bold">
              {Math.round(bootProgress)}%
            </span>
          </div>
        </div>

        {/* Title and Quotes Section */}
        <div className="space-y-6 w-full max-w-md relative z-10">
          <div className="space-y-1">
            <motion.h1 
              initial={{ letterSpacing: "0.2em", opacity: 0 }}
              animate={{ letterSpacing: "0.05em", opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="text-white font-display font-black text-3xl tracking-wide uppercase bg-gradient-to-r from-white via-white to-empowerment-pink bg-clip-text text-transparent drop-shadow-sm"
            >
              YOU GLOW GIRL!
            </motion.h1>
            <p className="text-cyber-lime/80 text-[10px] font-mono font-bold tracking-[0.25em] uppercase animate-pulse">
              Ada • AI Beauty Architect & Tech Pioneer
            </p>
          </div>

          {/* Premium Progress Bar (0% to 100%) */}
          <div className="w-full h-[6px] bg-white/5 rounded-full overflow-hidden border border-white/5 p-[1px] shadow-inner">
            <motion.div 
              className="h-full bg-gradient-to-r from-empowerment-pink to-cyber-lime rounded-full"
              style={{ width: `${bootProgress}%` }}
              layoutId="boot-progress"
            />
          </div>

          {/* Dynamic Changing Quotes Block */}
          <div className="h-24 flex items-center justify-center px-4">
            <AnimatePresence mode="wait">
              <motion.p
                key={activeQuoteIndex}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.45, ease: "easeInOut" }}
                className="text-white/80 text-sm font-medium leading-relaxed font-display"
              >
                {activeQuote}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        {/* Dynamic Telemetry Status */}
        <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-6 text-[9px] font-mono text-white/20 tracking-wider">
          <span className="flex items-center gap-1.5 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-cyber-lime animate-ping" />
            LIVE BOOT_MATRIX
          </span>
          <span>•</span>
          <span className="font-bold">SECURE PIPELINE LINKED</span>
          <span>•</span>
          <span className="font-bold">PORT 3000 READY</span>
        </div>
      </div>
    );
  }

  if (!onboarded) {
    return (
      <Onboarding 
        onComplete={(typedGoal) => {
          setOnboarded(true);
          if (typedGoal && typedGoal.trim()) {
            handleSendMessage(typedGoal.trim());
          }
        }} 
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden flex flex-col">
      {/* Background Mirror */}
      {isCameraNeeded && (
        <div className="absolute inset-0 z-0">
          <CameraMirror 
            ref={cameraRef} 
            ringLightOn={ringLightOn} 
            selectedColors={selectedTryOnColors} 
            collapsed={activeTab === 'live'}
            onboarded={onboarded}
          />
        </div>
      )}

      {/* Header Overlay */}
      <header className="relative z-20 p-6 flex justify-between items-center bg-gradient-to-b from-black/40 to-transparent">
        <div className="flex items-center gap-2.5">
          <motion.div 
            animate={{ 
              boxShadow: [
                "0 0 0px rgba(209,250,0,0)", 
                "0 0 20px rgba(209,250,0,0.6)", 
                "0 0 0px rgba(209,250,0,0)"
              ],
              borderColor: [
                "rgba(255,255,255,0.2)",
                "rgba(209,250,0,0.5)",
                "rgba(255,255,255,0.2)"
              ]
            }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            className="w-10 h-10 bg-gradient-to-tr from-empowerment-pink to-cyber-lime rounded-xl flex items-center justify-center shadow-lg border"
          >
            <Sparkles size={20} className="text-black animate-pulse" />
          </motion.div>
           <div className="flex flex-col">
             <span className="font-display font-black text-empowerment-pink tracking-tight text-lg leading-none">YOU GLOW GIRL!</span>
             <div className="flex items-center gap-1.5 mt-0.5">
               <span className="text-[8px] text-white/80 uppercase tracking-[0.2em] font-extrabold font-mono">with Ada • AI Beauty Architect & Tech Pioneer</span>
               <span className="relative flex h-1.5 w-1.5">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyber-lime opacity-80" />
                 <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyber-lime" />
               </span>
             </div>
           </div>
        </div>

        <motion.button
          id="install-app"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="p-3 bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md rounded-2xl text-white transition-all shadow-xl"
        >
          <Download size={18} />
        </motion.button>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex flex-col justify-end">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard-view"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="absolute inset-0 z-30 bg-black/40 backdrop-blur-3xl overflow-hidden"
            >
              <DashboardView />
            </motion.div>
          )}

          {activeTab === 'chat' && (
            <motion.div 
              key="chat-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20, transition: { duration: 0.1 } }}
              className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center"
            >
               <ChatOverlay 
                messages={messages} 
                onSendMessage={handleSendMessage} 
                isLoading={isLoading} 
                onApplyPalette={(palette) => {
                  setSelectedTryOnColors({
                    lips: palette.lips,
                    eyes: palette.eyes,
                    face: palette.face
                  });
                }}
              />
            </motion.div>
          )}

          {activeTab === 'feed' && (
            <motion.div 
              key="feed-view"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="absolute inset-0 z-30 bg-black/40 backdrop-blur-3xl overflow-hidden"
            >
              <FeedView />
            </motion.div>
          )}

          {activeTab === 'tryon' && (
            <motion.div 
              key="tryon-view"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className="absolute inset-0 z-30 bg-transparent overflow-hidden"
            >
              <TryOnView 
                selectedColors={selectedTryOnColors} 
                onColorSelect={(catId, color) => setSelectedTryOnColors(prev => ({ ...prev, [catId]: color }))} 
              />
            </motion.div>
          )}

          {activeTab === 'live' && (
            <motion.div 
              key="live-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 bg-transparent overflow-hidden"
            >
              <AdaLiveView 
                captureFrame={() => cameraRef.current?.captureFrame() || null} 
                isImmersiveMode={isImmersiveMode}
                setIsImmersiveMode={setIsImmersiveMode}
              />
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div 
              key="profile-view"
              initial={{ opacity: 0, y: -100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="absolute inset-0 z-30 bg-black/40 backdrop-blur-3xl overflow-hidden"
            >
              <ProfileView />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Controls Area */}
      <AnimatePresence>
        {!(activeTab === 'live' && isImmersiveMode) && (
          <motion.section 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.25 }}
            className="relative z-20 px-6 pb-24 pt-4 flex justify-between items-end"
          >
            {/* Active Stats */}
            <div className="space-y-3">
              <div className="flex -space-x-2">
                {profile?.photoURL ? (
                  <div className="w-9 h-9 rounded-full border-2 border-cyber-lime bg-zinc-950 overflow-hidden flex items-center justify-center shadow-lg relative">
                    <img src={profile.photoURL} alt={profile.displayName || "My Avatar"} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-full border-2 border-white/40 bg-white/10 backdrop-blur-md flex items-center justify-center">
                    <span className="text-[10px] text-white/40">👤</span>
                  </div>
                )}
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-9 h-9 rounded-full border-2 border-white/40 bg-white/10 backdrop-blur-md flex items-center justify-center">
                    <span className="text-[10px] text-white/40">👤</span>
                  </div>
                ))}
              </div>
              <div className="text-white text-[9px] font-bold uppercase tracking-[0.2em] flex items-center bg-black/30 backdrop-blur-xl px-4 py-2 rounded-full border border-white/10 shadow-2xl">
                <span className="w-1.5 h-1.5 bg-pink-400 rounded-full mr-2 animate-pulse" />
                12.4k online
              </div>
              {!user && (
                <button
                  onClick={() => setActiveTab('profile')}
                  className="text-cyber-lime text-[9px] font-bold uppercase tracking-[0.2em] flex items-center bg-black/30 backdrop-blur-xl px-4 py-2 rounded-full border border-cyber-lime/30 shadow-2xl"
                >
                  ☁️ Save your glow
                </button>
              )}
            </div>

            {/* Ring Light */}
            <RingLight isOn={ringLightOn} onToggle={() => setRingLightOn(!ringLightOn)} />
          </motion.section>
        )}
      </AnimatePresence>

      {/* DASHBOARD NAVIGATION */}
      <AnimatePresence>
        {!(activeTab === 'live' && isImmersiveMode) && (
          <motion.nav 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-6 left-6 right-6 z-30 h-16 bg-white/90 backdrop-blur-2xl rounded-[32px] border border-white/50 shadow-[0_20px_50px_rgba(0,0,0,0.2)] flex items-center justify-around px-4"
          >
            {[
              { id: 'dashboard', icon: Home, label: 'Home' },
              { id: 'tryon', icon: Palette, label: 'Try-on' },
              { id: 'live', icon: Camera, label: 'Ada Live', activeColor: 'bg-cyber-lime' },
              { id: 'chat', icon: MessageCircle, label: 'Chat' },
              { id: 'profile', icon: User, label: 'Profile' },
            ].map((item) => (
              <motion.button
                key={item.id}
                id={`nav-${item.id}`}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  if (item.id === 'live' && !isElite(profile)) {
                    setUpgradeModalReason("live-locked");
                    return;
                  }
                  setActiveTab(item.id);
                }}
                className="flex flex-col items-center gap-1 group relative"
              >
                <div className={`p-2 rounded-2xl transition-all duration-300 ${
                  activeTab === item.id 
                    ? (item.activeColor || 'bg-empowerment-pink text-white shadow-lg') 
                    : 'text-onyx/40 group-hover:text-onyx/60'
                }`}>
                  <item.icon size={20} />
                </div>
                <span className={`text-[8px] font-bold uppercase tracking-widest transition-all ${
                  activeTab === item.id ? 'opacity-100' : 'opacity-0'
                }`}>
                  {item.label}
                </span>
              </motion.button>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>

      {upgradeModalReason && (
        <UpgradeModal reason={upgradeModalReason} onClose={() => setUpgradeModalReason(null)} />
      )}
    </div>
  );
}

