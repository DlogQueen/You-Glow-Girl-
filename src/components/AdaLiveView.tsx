import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, Mic, VolumeX, AlertCircle, RefreshCw, AudioLines, 
  Info, Shield, Layers, Eye, EyeOff, Cpu, ChevronRight, ChevronLeft, 
  Play, ArrowLeft, Check, Loader2, Award, ChevronUp, ChevronDown, Minimize2
} from "lucide-react";
import { triggerHaptic } from "../lib/haptics";
import { useSpeech } from "../hooks/useSpeech";
import { useFirebase } from "../lib/FirebaseProvider";

interface AdaLiveViewProps {
  captureFrame: () => string | null;
  isImmersiveMode: boolean;
  setIsImmersiveMode: (val: boolean) => void;
}

const TUTORIALS = [
  {
    id: "ada_glow",
    title: "Ada's Golden Pioneer Glow",
    description: "Luminous gold highlights paired with deep dewy base hydration.",
    steps: [
      {
        title: "Dermal Prep & Base",
        description: "Apply a dewy, hydrating base primer over your cheekbones and forehead. Ensure smooth hydration coverage.",
        focalArea: "face",
        suggestionRule: "Say aloud: 'Ada, does my base dewy primer prep look balanced?'",
        targetPoints: "SYS.PREP.COORDS.08",
        colorSwatch: "#FFD600",
        adaFeedback: "Analyzing your reflection via my facial matrix... Beautiful, sister! Your skin moisture index has increased by 45%! The light deflection factor is absolutely prime. We are ready to proceed with sculpting gold accents!"
      },
      {
        title: "The Lovelace Highlight",
        description: "Sweep a champagne gold or gold pigment along the bridge of your nose and outer cheekbones.",
        focalArea: "eyes",
        suggestionRule: "Say aloud: 'Ada, check my high orbital bone gold reflection.'",
        targetPoints: "ORBITAL_BONE.COORDS.14",
        colorSwatch: "#FFC400",
        adaFeedback: "Outstanding glow placement! I have calculated the specular highlights near your orbital bones (indices 133 and 362). The reflection is exactly at a 42-degree angle, maximizing retro-reflective glow. Absolute genius!"
      },
      {
        title: "Nourished Lip Stain",
        description: "Blend a lightweight rosewood or hydration balm at the center of your lips, feathering outwards.",
        focalArea: "lips",
        suggestionRule: "Say aloud: 'Ada, does this lip color coordinate well?'",
        targetPoints: "LIP_OUTER_BOUND.02",
        colorSwatch: "#FF4A8D",
        adaFeedback: "Mouth mapping calibrated! Your lip contrast has optimized. The soft diffusion mimics a poetical velvet algorithm, and matches the natural pink aesthetic beautifully. Master look achieved, you are fully optimized!"
      }
    ]
  },
  {
    id: "hopper_wings",
    title: "Grace Hopper Velvet Wings",
    description: "Sharp outer-edge wing shadows with deep mathematical eye contouring.",
    steps: [
      {
        title: "Crease Shadow Prep",
        description: "Apply a soft matte purple or charcoal shadow evenly across the mobile eyelid crease.",
        focalArea: "eyes",
        suggestionRule: "Say aloud: 'Ada, is my eye lid shadow base even?'",
        targetPoints: "EYE_LID_CREASE.09",
        colorSwatch: "#673AB7",
        adaFeedback: "Calculating eyelid base... Excellent symmetry! The shadow intensity matches perfectly between left and right orbitals (98.4% balance score). Ready for the wings!"
      },
      {
        title: "Winged Outer Liner",
        description: "Starting from the outer eye corner, draw a clean 45-degree winged line rising up toward the temple.",
        focalArea: "eyes",
        suggestionRule: "Say aloud: 'Ada, evaluate my wing eyeliner angle!'",
        targetPoints: "WING_EYE_ANGLE",
        colorSwatch: "#1C1C1E",
        adaFeedback: "Wow, look at that symmetry! Your wing rises at exactly a 45.2-degree angle relative to index 263. Grace Hopper would be proud of this flawless code execution. You look sharp and commanding!"
      },
      {
        title: "Balancing Lip Gloss",
        description: "Saturate lips in a subtle glossy glaze to neutralize. Keeps attention focused on the matte winged eyes.",
        focalArea: "lips",
        suggestionRule: "Say aloud: 'Ada, is this nude balancing lip shade okay?'",
        targetPoints: "LIP_CENTER_GLOSS",
        colorSwatch: "#FFAB00",
        adaFeedback: "Perfect balancing act, sister pioneer! The lighter tone contrasts your bold gaze, providing a highly professional and balanced digital presence. Magnificent!"
      }
    ]
  },
  {
    id: "runway_sculpt",
    title: "Backstage Runway Contouring",
    description: "Chroma-rich cheek hollow sculpting combined with retro-classic defined lip lines.",
    steps: [
      {
        title: "Cheek Shading Contour",
        description: "Apply a cool shadow hollow beneath the cheekbone structure. Fade and blend upwards.",
        focalArea: "face",
        suggestionRule: "Say aloud: 'Ada, is my high cheekbone shade blended?'",
        targetPoints: "CHEEK_HOLLOW_VAL",
        colorSwatch: "#FF6D00",
        adaFeedback: "Scanning bone geometry... Beautiful! You successfully placed the shadow exactly 3.4mm below the main cheekbone node. The depth looks exquisite under studio lighting!"
      },
      {
        title: "Crimson Lip Sculpting",
        description: "Trace your lipstick right on the cupid's bow peak. Fill completely with rich crimson fuchsia.",
        focalArea: "lips",
        suggestionRule: "Say aloud: 'Ada, check my velvet lip contour.'",
        targetPoints: "CUPID_BOW_PEAK",
        colorSwatch: "#C2185B",
        adaFeedback: "Fabulous! Lips are mapped at 100% saturation. The fuchsia tone looks rich, and is perfectly symmetric across your outer oral border points. Your facial profile is ready for the runway!"
      }
    ]
  }
];

type OperatingMode = "glow_guide" | "clinical_studio" | "beauty_counter" | "runway_backstage" | "digital_agency";

export function AdaLiveView({ captureFrame, isImmersiveMode, setIsImmersiveMode }: AdaLiveViewProps) {
  const { profile } = useFirebase();
  const [error, setError] = useState<string | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(true);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [agreeMistakes, setAgreeMistakes] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [activeMode, setActiveMode] = useState<OperatingMode>("glow_guide");
  
  // Tutorial specific states
  const [glassTab, setGlassTab] = useState<"face" | "tutorials">("face");
  const [activeTutorialId, setActiveTutorialId] = useState<string | null>(null);
  const [activeStepIdx, setActiveStepIdx] = useState<number>(0);
  const [isScanningActive, setIsScanningActive] = useState<boolean>(false);
  const [scanningProgress, setScanningProgress] = useState<number>(0);
  const [mockAdaFdbk, setMockAdaFdbk] = useState<string>("");
  const [isFeedbackLoading, setIsFeedbackLoading] = useState<boolean>(false);
  const [realtimeFeedback, setRealtimeFeedback] = useState<string | null>(null);

  // Individual collapse state for each overlay panel, independent of the
  // global immersive-mode toggle - each floating card can be shrunk on its
  // own without hiding everything else.
  const [isProtocolPanelCollapsed, setIsProtocolPanelCollapsed] = useState(false);
  const [isMatrixCardCollapsed, setIsMatrixCardCollapsed] = useState(false);

  const startScanningAnalysis = () => {
    setIsScanningActive(true);
    setScanningProgress(0);
    setIsFeedbackLoading(true);
    setMockAdaFdbk("");
    
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 5;
      setScanningProgress(currentProgress);
      if (currentProgress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setIsScanningActive(false);
          setIsFeedbackLoading(false);
          const currentTuto = TUTORIALS.find(t => t.id === activeTutorialId);
          const currentStep = currentTuto?.steps[activeStepIdx];
          if (currentStep) {
            setMockAdaFdbk(currentStep.adaFeedback);
          }
        }, 600);
      }
    }, 80);
  };

  const { 
    isListening, 
    isSpeaking, 
    startListening, 
    stopListening, 
    speak, 
    cancelSpeech 
  } = useSpeech({
    onResult: async (text) => {
      if (isAudioMuted) return;
      
      try {
        const frame = captureFrame();
        const base64Data = frame ? frame : null;
        
        setIsFeedbackLoading(true);
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            image: base64Data,
            profile: profile ? {
              displayName: profile.displayName,
              pronouns: profile.pronouns,
              bio: profile.bio,
              goals: profile.beautyGoal || profile.goals,
              facialMetrics: profile.facialMetrics,
            } : undefined
          }),
        });
        
        const data = await response.json();
        if (data.reply) {
          setRealtimeFeedback(data.reply);
          if (!isAudioMuted) {
            speak(data.reply);
          }
        }
      } catch (err) {
        console.error("Live API Error:", err);
      } finally {
        setIsFeedbackLoading(false);
      }
    },
    onError: () => {
      if (isLiveActive && !isAudioMuted) {
         // Auto-resume listening on error/timeout
         setTimeout(startListening, 500);
      }
    }
  });

  const activateLive = () => {
    setAgreeMistakes(true);
    setShowDisclaimer(false);
    setIsLiveActive(true);
    setIsAudioMuted(false);
    setIsConnected(true);
    startListening();
  };

  useEffect(() => {
    if (isLiveActive && !isAudioMuted && !isSpeaking && !isListening && !isFeedbackLoading) {
      const timer = setTimeout(() => {
        startListening();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLiveActive, isAudioMuted, isSpeaking, isListening, isFeedbackLoading, startListening]);

  useEffect(() => {
    if (isAudioMuted) {
      stopListening();
      cancelSpeech();
    } else if (isLiveActive && !isSpeaking) {
      startListening();
    }
  }, [isAudioMuted, isLiveActive]);

  useEffect(() => {
    return () => {
      stopListening();
      cancelSpeech();
    };
  }, []);

  // Mode configurations reflecting your exact images!
  const modesData = {
    glow_guide: {
      title: "Ada's Harmony Protocols",
      status: "MEET YOUR GLOW GUIDE",
      color: "border-amber-400 bg-amber-400/10",
      accent: "#D1FA00",
      description: "Direct tracking matrix calibrated. Features include Skin Energy Core Visualization, personal harmonizer mapping, and blend indicator monitoring."
    },
    clinical_studio: {
      title: "(A) The Clinical Studio",
      status: "Dermal Diagnostics Mode Active",
      color: "border-teal-400 bg-teal-400/10",
      accent: "#2DD4BF",
      description: "Synthesizing clinical pigments and reading the real-time dermal diagnostic layer. Live cell structure telemetry ongoing."
    },
    beauty_counter: {
      title: "(B) The Beauty Counter",
      status: "Consumer Color Theorist Active",
      color: "border-pink-500 bg-pink-500/10",
      accent: "#EC4899",
      description: "Matching consumer color theory protocols. Optimizing custom lip, eye and cheek pigments against the ambient lighting matrix."
    },
    runway_backstage: {
      title: "(C) The Runway Backstage",
      status: "Catwalk Priority Queue Active",
      color: "border-purple-500 bg-purple-500/10",
      accent: "#A855F7",
      description: "Running ultra-low latency blending calculations for backstage and high-speed live runway styling commands."
    },
    digital_agency: {
      title: "(D) The Digital Agency",
      status: "AI Artist-In-Residence Active",
      color: "border-emerald-500 bg-emerald-500/10",
      accent: "#10B981",
      description: "Harnessing geometric reasoning cores, synthetic dermal matrices, and advanced chroma analysis to project future trends."
    }
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-between pointer-events-none p-6 pb-28">
      
      {/* 1. TOP STATUS PANEL */}
      <AnimatePresence>
        {!isImmersiveMode && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full bg-black/60 border border-white/10 rounded-2xl p-3.5 backdrop-blur-xl pointer-events-auto flex justify-between items-center z-40 mt-14"
          >
            <div>
              <span className="text-[8px] font-mono font-bold uppercase tracking-widest text-cyber-lime block">SYS PROTOCOL MANAGER</span>
              <span className="text-white text-xs font-bold font-display uppercase tracking-wider">{modesData[activeMode].title}</span>
            </div>
            <div className="flex items-center gap-2">
              <AnimatePresence>
                {!isProtocolPanelCollapsed && (
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: "auto", opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="flex gap-1.5 overflow-x-auto max-w-[200px] no-scrollbar"
                  >
                    {(["glow_guide", "clinical_studio", "beauty_counter", "runway_backstage", "digital_agency"] as OperatingMode[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setActiveMode(m)}
                        className={`p-1.5 rounded-lg border text-[8px] font-bold uppercase tracking-wider transition-all truncate max-w-[70px] ${
                          activeMode === m
                            ? "bg-cyber-lime border-cyber-lime text-onyx shadow-[0_0_10px_var(--color-cyber-lime)]"
                            : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
                        }`}
                      >
                        {m.split('_')[0]}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
              <button
                onClick={() => setIsProtocolPanelCollapsed(!isProtocolPanelCollapsed)}
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
                title={isProtocolPanelCollapsed ? "Expand protocol selector" : "Collapse protocol selector"}
              >
                {isProtocolPanelCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. DYNAMIC ADA HUMAN FACE SIMULATION REPRESENTATION */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden pb-12">
        <div className="relative w-full max-w-sm h-[400px] flex items-center justify-center">
          
          {/* Pulsing Radial Background Glow */}
          <motion.div
            animate={
              isSpeaking
                ? { 
                    scale: [1, 1.2, 1],
                    background: `radial-gradient(circle, ${modesData[activeMode].accent}33 0%, rgba(0,0,0,0) 70%)`
                  }
                : { 
                    scale: [1, 1.05, 1],
                    background: `radial-gradient(circle, ${modesData[activeMode].accent}15 0%, rgba(0,0,0,0) 70%)`
                  }
            }
            transition={{ duration: isSpeaking ? 0.3 : 3, repeat: Infinity, ease: "easeInOut" }}
            className="absolute w-80 h-80 blur-3xl pointer-events-none"
          />

          {/* 2.1 LIVE DISCLAIMER POPUP WINDOW OVERLAY */}
          <AnimatePresence>
            {showDisclaimer && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, y: 12 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="absolute z-50 w-72 h-[340px] rounded-[48px] bg-black/95 border-2 border-cyber-lime/40 overflow-hidden backdrop-blur-2xl flex flex-col justify-between p-6 pointer-events-auto shadow-[0_0_40px_rgba(209,250,0,0.25)]"
              >
                {/* Header */}
                <div className="space-y-1 font-mono">
                  <div className="flex items-center gap-1.5 text-cyber-lime">
                    <Shield size={12} className="animate-pulse" />
                    <span className="text-[8px] font-black tracking-widest uppercase">LIVE VOICE & VISION</span>
                  </div>
                  <h3 className="text-white text-sm font-display font-black tracking-tight uppercase">
                    Live Mirror Terms
                  </h3>
                </div>

                {/* Body Content */}
                <div className="flex-1 my-3 flex flex-col justify-center space-y-3 font-mono">
                  {/* Custom Disclaimer quote requested by user */}
                  <div className="p-3 bg-cyber-lime/5 border-l-2 border-cyber-lime rounded-r-xl space-y-1">
                    <span className="text-cyber-lime text-[6px] font-bold uppercase tracking-widest block">ADA WARNING</span>
                    <p className="text-[10px] text-white leading-relaxed font-bold tracking-tight">
                      "don't expect this to help make perfect makeup. we are all learning as we go. including ADA."
                    </p>
                  </div>

                  <p className="text-[8px] text-white/50 leading-relaxed font-semibold">
                    Agree to start high-fidelity computer vision alignment and real-time voice synthesis loops securely over port 3000.
                  </p>

                  <label className="flex items-start gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={agreeMistakes}
                      onChange={(e) => setAgreeMistakes(e.target.checked)}
                      className="mt-0.5 flex-shrink-0 accent-cyber-lime h-3.5 w-3.5 bg-black/40 border-white/20 text-onyx rounded cursor-pointer"
                    />
                    <span className="text-[8.5px] text-white/80 leading-normal font-medium">
                      Agree AI can make mistakes & allow stream
                    </span>
                  </label>
                </div>

                {/* Footer and Microphone activator */}
                <div className="pt-2 border-t border-white/5">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { triggerHaptic(); activateLive(); }}
                    disabled={!agreeMistakes}
                    className={`w-full py-2.5 rounded-2xl flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${
                      agreeMistakes 
                        ? "bg-cyber-lime text-onyx shadow-[0_0_15px_rgba(209,250,0,0.5)] cursor-pointer" 
                        : "bg-white/5 text-white/30 border border-white/10 cursor-not-allowed"
                    }`}
                  >
                    <Mic size={11} className={agreeMistakes ? "animate-bounce" : ""} />
                    HIT THE MICROPHONE
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Golden/Beige Beautiful Beauty Clinic Glass Frame (Ada's Face Container) */}
          <AnimatePresence>
            {!isImmersiveMode && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ 
                  opacity: 1, 
                  scale: 1,
                  borderColor: isSpeaking ? modesData[activeMode].accent : "rgba(255, 255, 255, 0.15)",
                  boxShadow: isSpeaking 
                    ? `0 0 20px ${modesData[activeMode].accent}33`
                    : "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
                }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className={`relative w-72 rounded-[48px] bg-black/40 border overflow-hidden backdrop-blur-md flex flex-col justify-between p-5 pointer-events-auto transition-[height] duration-300 ${
                  isMatrixCardCollapsed ? "h-20" : "h-[340px]"
                }`}
              >

                {/* Holographic grid lines backplane */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

                {/* Top Header Section */}
                <div className="relative z-20 space-y-2">
                  {/* Top: Logo and Active indicator */}
                  <div className="flex justify-between items-start font-mono">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1">
                        <Sparkles size={10} className="text-cyber-lime animate-pulse" />
                        <span className="text-[7.5px] font-black tracking-widest text-[#D1FA00]">ADA'S MATRIX v4.0</span>
                      </div>
                      <div className="text-white/60 text-[6.5px] font-bold uppercase">{modesData[activeMode].status}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-white/30 text-[7px]">CHROMA LABS: OK</span>
                      <button
                        onClick={() => setIsMatrixCardCollapsed(!isMatrixCardCollapsed)}
                        className="p-1 rounded-md bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all"
                        title={isMatrixCardCollapsed ? "Expand" : "Minimize"}
                      >
                        <Minimize2 size={8} />
                      </button>
                    </div>
                  </div>

                  {/* Sleek Sub-Tab selection */}
                  {!isMatrixCardCollapsed && (
                  <div className="flex gap-1.5 justify-center p-0.5 rounded-full bg-white/5 border border-white/10 font-mono">
                    <button 
                      onClick={() => setGlassTab("face")} 
                      className={`flex-1 py-1 text-[7.5px] font-black uppercase tracking-wider rounded-full transition-all ${
                        glassTab === "face" 
                          ? "bg-white text-onyx shadow-md" 
                          : "text-white/50 hover:text-white/80"
                      }`}
                    >
                      Soul Monitor
                    </button>
                    <button 
                      onClick={() => setGlassTab("tutorials")} 
                      className={`flex-1 py-1 text-[7.5px] font-black uppercase tracking-wider rounded-full transition-all ${
                        glassTab === "tutorials" 
                          ? "bg-cyber-lime text-onyx shadow-md" 
                          : "text-white/50 hover:text-white/80"
                      }`}
                    >
                      💄 Guides
                    </button>
                  </div>
                  )}
                </div>

                {/* MAIN CONTENT AREA */}
                {!isMatrixCardCollapsed && (glassTab === "face" ? (
                  <>
                    {/* ADA AVATAR REPRESENTATION */}
                    <div className="flex-1 relative flex items-center justify-center my-2 z-10 overflow-hidden">
                       <img 
                          src="/ada_avatar.png" 
                          alt="Ada, your AI Beauty Architect" 
                          className="w-48 h-48 object-cover rounded-full border-2 border-cyber-lime/50 shadow-[0_0_20px_rgba(209,250,0,0.3)]"
                       />
                       
                       {/* Floating Ada Response Toast for Emotion/Makeup Encouragement */}
                       <AnimatePresence>
                         {(realtimeFeedback) && (
                           <motion.div 
                             initial={{ opacity: 0, y: 20, scale: 0.9 }}
                             animate={{ opacity: 1, y: 0, scale: 1 }}
                             exit={{ opacity: 0, y: 10, scale: 0.95 }}
                             className="absolute -bottom-16 left-0 right-0 z-50 p-3 bg-black/80 backdrop-blur-xl border border-cyber-lime rounded-2xl text-center shadow-[0_0_20px_rgba(209,250,0,0.3)]"
                           >
                             <p className="text-white text-[9px] font-bold tracking-wide italic px-2">"{realtimeFeedback}"</p>
                           </motion.div>
                         )}
                       </AnimatePresence>
                    </div>

                    {/* Card Footer: Detail description and operating metrics */}
                    <div className="relative font-mono text-[7px] text-white/40 border-t border-white/5 pt-1.5 z-10 flex flex-col gap-1">
                      <p className="line-clamp-2 leading-tight text-[7.5px] text-white/80">{modesData[activeMode].description}</p>
                      
                      <div className="flex justify-between items-center text-[6px] mt-0.5 text-white/30">
                        <div className="flex items-center gap-1">
                          <div className={`w-1 h-1 rounded-full ${isConnected ? 'bg-cyber-lime animate-pulse' : 'bg-white/10'}`} />
                          <span>MATRIX SCAN: OK</span>
                        </div>
                        <span>EMPOWERMENT LEVEL: 100%</span>
                      </div>
                    </div>
                  </>
                ) : (
                  /* EXQUISITE INTERACTIVE TUTORIAL / MAKEUP GUIDING HUB */
                  <div className="flex-1 my-2 flex flex-col justify-between overflow-y-auto max-h-[220px] pr-1 scrollbar-thin scrollbar-thumb-white/10 z-10 pointer-events-auto">
                    {activeTutorialId === null ? (
                      /* LISTING ALL ACCREDITED TUTORIALS */
                      <div className="space-y-2 mt-1">
                        <header className="space-y-0.5 border-b border-white/5 pb-1 flex justify-between items-center font-mono">
                          <span className="text-[7.5px] font-black text-cyber-lime uppercase tracking-wider">Acredited Guides</span>
                          <span className="text-[6.5px] text-white/40 uppercase font-bold">Qty: {TUTORIALS.length} Selected</span>
                        </header>
                        
                        <div className="space-y-1.5 max-h-[175px] overflow-y-auto">
                          {TUTORIALS.map((t) => (
                            <motion.div 
                              key={t.id}
                              whileHover={{ scale: 1.01 }}
                              className="p-2.5 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between gap-1.5"
                            >
                              <div>
                                <h4 className="text-white text-[8px] font-black font-mono leading-tight tracking-wide">{t.title}</h4>
                                <p className="text-white/45 text-[7px] leading-relaxed mt-0.5">{t.description}</p>
                              </div>
                              <div className="flex justify-between items-center mt-1">
                                <span className="text-[6px] text-cyber-lime font-mono uppercase bg-cyber-lime/10 px-1.5 py-0.5 rounded-md border border-cyber-lime/15">{t.steps.length} matrix steps</span>
                                <button 
                                  onClick={() => {
                                    setActiveTutorialId(t.id);
                                    setActiveStepIdx(0);
                                    setMockAdaFdbk("");
                                  }}
                                  className="px-2.5 py-1 rounded-xl bg-cyber-lime text-onyx text-[7px] font-black uppercase tracking-widest flex items-center gap-1 shadow-[0_2px_8px_rgba(209,250,0,0.3)] hover:bg-white transition-all cursor-pointer"
                                >
                                  <Play size={6} fill="currentColor" /> Start
                                </button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      /* ACTIVE STEP GUIDANCE SYSTEM WITH ADA VISION */
                      (() => {
                        const currentTuto = TUTORIALS.find(t => t.id === activeTutorialId);
                        const step = currentTuto?.steps[activeStepIdx];
                        if (!currentTuto || !step) return null;

                        return (
                          <div className="flex flex-col h-full justify-between gap-2">
                            {/* Header details with Exit Back option */}
                            <div className="flex justify-between items-center border-b border-white/5 pb-1 font-mono">
                              <button 
                                onClick={() => setActiveTutorialId(null)}
                                className="text-white/40 hover:text-white flex items-center gap-1 text-[7px] uppercase font-bold scale-[0.95] origin-left"
                              >
                                <ArrowLeft size={8} /> Guides
                              </button>
                              <span className="text-[7.5px] text-cyber-lime uppercase tracking-widest font-black">
                                STEP {activeStepIdx + 1} OF {currentTuto.steps.length}
                              </span>
                            </div>

                            {/* Active Step Content */}
                            <div className="space-y-1.5 flex-1 pr-1.5">
                              {/* Title and Spot Swatch */}
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="text-white text-[9.5px] font-black leading-tight">{step.title}</h4>
                                
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {/* Swatch color bubble */}
                                  <div 
                                    className="w-3_5 h-3_5 rounded-full border border-white/30 shadow-[0_0_8px_var(--swatch)] animate-pulse"
                                    style={{ 
                                      backgroundColor: step.colorSwatch,
                                      width: "12px",
                                      height: "12px",
                                      "--swatch": step.colorSwatch 
                                    } as any}
                                  />
                                  <span className="font-mono text-[5.5px] text-white/55 font-bold uppercase tracking-wide">{step.focalArea} Target</span>
                                </div>
                              </div>

                              <p className="text-white/70 text-[7.5px] leading-tight pb-1 border-b border-white/5">{step.description}</p>
                              
                              {/* Speech suggestion helper to talk with live agent API */}
                              <div className="p-1 px-2.5 rounded-xl bg-empowerment-pink/5 border border-empowerment-pink/15 flex flex-col gap-0.5">
                                <span className="font-mono text-[5.5px] text-empowerment-pink font-bold uppercase tracking-widest">Interactive Speech Prompt</span>
                                <p className="text-white text-[7px] italic leading-tight">"{step.suggestionRule}"</p>
                              </div>

                              {/* Ada Vision Real-time calibration scan engine */}
                              <div className="space-y-1 mt-1">
                                {isScanningActive ? (
                                  /* Live Scan Sweep Wave Indicator */
                                  <div className="p-2 rounded-xl bg-[#00ffff]/5 border border-[#00ffff]/20 space-y-1 flex flex-col justify-center">
                                    <div className="flex justify-between items-center text-[5.5px] font-mono text-[#00ffff]">
                                      <span className="font-black tracking-widest animate-pulse">[SCANNING RETINAL COORDS]</span>
                                      <span>{scanningProgress}%</span>
                                    </div>
                                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden relative">
                                      <motion.div 
                                        className="h-full bg-[#00ffff] shadow-[0_0_8px_rgba(0,255,255,0.8)]"
                                        style={{ width: `${scanningProgress}%` }}
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  /* Scanning request activator button */
                                  <button 
                            onClick={() => { triggerHaptic(); startScanningAnalysis(); }}
                                    disabled={isFeedbackLoading}
                                    className="w-full py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 flex items-center justify-center gap-1.5 text-white font-mono text-[7px] uppercase font-black tracking-widest transition-all cursor-pointer"
                                  >
                                    <Sparkles size={8} className="text-cyber-lime animate-spin" />
                                    [Trigger Ada's Vision Blend Scan]
                                  </button>
                                )}

                                {/* Floating quote response block representing Ada's smart guidance feedback */}
                                <AnimatePresence>
                                  {(mockAdaFdbk && !isScanningActive || realtimeFeedback) && (
                                    <motion.div 
                                      initial={{ opacity: 0, y: 3 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      className="p-2 rounded-2xl bg-cyan-400/5 border border-cyan-400/15 flex gap-1.5 items-start mt-1.5"
                                    >
                                      <Cpu size={10} className="text-cyan-400 flex-shrink-0 mt-0.5" />
                                      <div className="space-y-0.5 flex-1">
                                        <span className="font-mono text-[5.5px] text-cyan-400 font-bold uppercase tracking-widest">{realtimeFeedback ? "Real-time Ada Guidance" : "Ada's Vision Diagnosis"}</span>
                                        <p className="text-white/90 text-[7px] leading-tight italic">"{realtimeFeedback || mockAdaFdbk}"</p>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>

                            {/* Active Steps Slider Navigation controls */}
                            <div className="flex justify-between gap-1 mt-1 border-t border-white/5 pt-1.5">
                              <button 
                                disabled={activeStepIdx === 0}
                                onClick={() => {
                                  setActiveStepIdx(prev => prev - 1);
                                  setMockAdaFdbk("");
                                }}
                                className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white disabled:opacity-30 disabled:pointer-events-none flex items-center gap-0.5 text-[6.5px] font-mono uppercase"
                              >
                                <ChevronLeft size={8} /> Prev
                              </button>

                              {activeStepIdx < currentTuto.steps.length - 1 ? (
                                <button 
                                  onClick={() => {
                                    setActiveStepIdx(prev => prev + 1);
                                    setMockAdaFdbk("");
                                  }}
                                  className="px-2.5 py-1 rounded-xl bg-cyber-lime text-onyx text-[7px] font-black uppercase tracking-wider flex items-center gap-0.5 shadow-[0_2px_8px_rgba(209,250,0,0.25)] hover:bg-white cursor-pointer"
                                >
                                  Next <ChevronRight size={8} />
                                </button>
                              ) : (
                                  /* Last Step Achieved: Complete Look celebration card */
                                  <button 
                                    onClick={() => {
                                      setActiveTutorialId(null);
                                      setGlassTab("face");
                                      setMockAdaFdbk("");
                                    }}
                                    className="px-2.5 py-1 rounded-xl bg-pink-500 text-white border border-pink-400 text-[6.5px] font-black uppercase tracking-wider flex items-center gap-1 shadow-[0_2px_8px_rgba(244,63,94,0.3)] hover:bg-pink-400 cursor-pointer"
                                  >
                                    <Award size={8} /> [Complete Look]
                                  </button>
                                )}
                              </div>
                          </div>
                        );
                      })()
                    )}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex-1" />

      {/* Minimalism Audio Wave Visualizer */}
      <div className="absolute bottom-36 left-0 right-0 flex justify-center items-center gap-1.5 h-6 z-40 pointer-events-none">
        <AnimatePresence>
          {isSpeaking && (
              <motion.div className="flex gap-1 items-center" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 4 }}
                    animate={{ height: [4, 16 + Math.random() * 12, 4] }}
                    transition={{ duration: 0.4, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }}
                    className="w-1 rounded-full bg-cyber-lime shadow-[0_0_8px_rgba(209,250,0,0.5)]"
                  />
                ))}
              </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. CONTROL PANEL & AUDIO FEEDBACK */}
      <motion.div 
        animate={{
          borderColor: isSpeaking ? modesData[activeMode].accent : "rgba(255, 255, 255, 0.15)",
          boxShadow: isSpeaking 
            ? `0 0 20px ${modesData[activeMode].accent}33`
            : "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)"
        }}
        className={`w-full bg-black/65 border p-5 rounded-[32px] backdrop-blur-xl transition-all duration-300 pointer-events-auto shadow-2xl relative z-40 ${isImmersiveMode ? "mt-auto max-w-sm mx-auto p-4 rounded-full border-white/5 bg-black/50" : ""}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isConnected ? 'bg-cyber-lime' : 'bg-onyx'}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${isConnected ? 'bg-cyber-lime' : 'bg-onyx'}`}></span>
            </span>
            <span className="text-white text-[10px] font-bold uppercase tracking-widest truncate max-w-[150px] sm:max-w-none">
              {isImmersiveMode ? "Immersive Camera Feed" : isConnected ? "Ada Live Connection Active" : showDisclaimer ? "Live Connection Pending Agreement..." : "Initializing Ada's Brain..."}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Immersive Screen HUD Toggle */}
            {!showDisclaimer && (
              <button
                onClick={() => { triggerHaptic(); setIsImmersiveMode(!isImmersiveMode); }}
                className={`p-3 rounded-full border transition-all pointer-events-auto cursor-pointer ${
                  isImmersiveMode
                    ? "bg-cyber-lime border-cyber-lime text-onyx shadow-[0_0_15px_rgba(209,250,0,0.5)]"
                    : "bg-white/10 border-white/15 text-white hover:bg-white/20"
                }`}
                title={isImmersiveMode ? "Enable Dashboard Info overlays" : "Hide overlays and enter Immersive Full Screen"}
              >
                {isImmersiveMode ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            )}

            <button 
              onClick={() => { triggerHaptic(); showDisclaimer ? activateLive() : setIsAudioMuted(!isAudioMuted); }}
              className={`p-3 rounded-full border transition-all pointer-events-auto cursor-pointer ${
                showDisclaimer
                  ? "bg-cyber-lime border-cyber-lime text-onyx animate-pulse shadow-[0_0_15px_rgba(209,250,0,0.5)]"
                  : isAudioMuted 
                    ? "bg-empowerment-pink/20 border-empowerment-pink text-empowerment-pink"
                    : "bg-cyber-lime/20 border-cyber-lime text-cyber-lime"
              }`}
              title={showDisclaimer ? "Activate Live and Accept Terms" : isAudioMuted ? "Unmute Mic" : "Mute Mic"}
            >
              {showDisclaimer ? <Mic size={16} /> : isAudioMuted ? <VolumeX size={16} /> : <Mic size={16} />}
            </button>
          </div>
        </div>

        {/* Info panel explaining her training on female pioneers */}
        <AnimatePresence>
          {!isImmersiveMode && (
            <motion.div 
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: "auto", opacity: 1, marginTop: 12 }}
              exit={{ height: 0, opacity: 0, marginTop: 0 }}
              className="p-3.5 bg-white/5 border border-white/5 rounded-2xl flex items-start gap-2.5 overflow-hidden"
            >
              <Cpu size={14} className="text-cyber-lime mt-0.5 flex-shrink-0" />
              <div className="space-y-0.5 pointer-events-auto">
                <p className="text-[10px] font-bold text-white uppercase tracking-wider">Trained on Tech Pioneering Heritage</p>
                <p className="text-[8.5px] text-white/50 leading-relaxed">
                  Ada Lovelace, Grace Hopper, Margaret Hamilton & Hedy Lamarr's pioneer legacies are loaded. Ask Ada about computer geometry or history anytime!
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Notification */}
        {error && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-black/40 border border-empowerment-pink/50 rounded-2xl p-4 flex items-start gap-2.5 text-xs text-empowerment-pink"
            >
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <p className="font-semibold">{error}</p>
            </motion.div>
        )}
      </motion.div>
    </div>
  );
}
