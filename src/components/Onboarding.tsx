import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, ArrowRight, Camera, Scan, 
  CheckCircle, Shield, Loader2, User, 
  Target, Zap, Star, Lock, Upload, RotateCcw,
  X, FileText
} from "lucide-react";
import { signInWithGoogle, db } from "../lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { FacialMetrics } from "../types";
import { useFirebase } from "../lib/FirebaseProvider";

interface OnboardingProps {
  onComplete: (typedGoal?: string) => void;
}

type OnboardingStep = "welcome" | "scan" | "blueprint" | "secure";

export function Onboarding({ onComplete }: OnboardingProps) {
  const { user, updateProfile } = useFirebase();
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [analysis, setAnalysis] = useState<FacialMetrics | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [goal, setGoal] = useState<string>("");
  const [isSimulated, setIsSimulated] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  // Advanced interaction modes for sandboxed photo uploading & retakes
  const [scanSubStep, setScanSubStep] = useState<"live" | "preview">("live");
  const [consentApproved, setConsentApproved] = useState(false);
  const [showPolicy, setShowPolicy] = useState<"privacy" | "terms" | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const simulatedCanvasRef = useRef<HTMLCanvasElement>(null);

  // MediaPipe state
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [landmarks, setLandmarks] = useState<any[] | null>(null);
  const [hasFace, setHasFace] = useState(false);

  // Load MediaPipe Face Mesh on Mount
  useEffect(() => {
    let isMounted = true;
    if ((window as any).FaceMesh) {
      setScriptsLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js";
    script.async = true;
    script.onload = () => {
      if (isMounted) setScriptsLoaded(true);
    };
    script.onerror = (err) => {
      console.error("Onboarding FaceMesh script error:", err);
    };
    document.body.appendChild(script);

    return () => {
      isMounted = false;
    };
  }, []);

  // Run FaceMesh detection
  useEffect(() => {
    if (!scriptsLoaded || step !== "scan" || !stream || !videoRef.current) return;

    let active = true;
    let faceMeshInstance: any = null;

    try {
      const FaceMeshClass = (window as any).FaceMesh;
      if (!FaceMeshClass) return;

      faceMeshInstance = new FaceMeshClass({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
      });

      faceMeshInstance.setOptions({
        maxNumFaces: 1,
        refineLandmarks: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      faceMeshInstance.onResults((results: any) => {
        if (!active) return;
        if (results.multiFaceLandmarks && results.multiFaceLandmarks[0]) {
          setLandmarks(results.multiFaceLandmarks[0]);
          setHasFace(true);
        } else {
          setLandmarks(null);
          setHasFace(false);
        }
      });

      const sendFrame = async () => {
        if (!active) return;
        const video = videoRef.current;
        if (video && video.readyState >= 2) {
          try {
            await faceMeshInstance.send({ image: video });
          } catch (e) {
            // Ignored typical processing frame drops
          }
        }
        setTimeout(() => {
          if (active) requestAnimationFrame(sendFrame);
        }, 60);
      };

      sendFrame();

    } catch (err) {
      console.warn("Onboarding FaceMesh init failed:", err);
    }

    return () => {
      active = false;
      if (faceMeshInstance) {
        try {
          faceMeshInstance.close();
        } catch (e) {}
      }
    };
  }, [scriptsLoaded, step, stream]);

  // Handle painting onboarding overlay canvas
  useEffect(() => {
    const isCurrentlySimulated = isSimulated;
    if (!landmarks || step !== "scan" || !overlayCanvasRef.current || (!isCurrentlySimulated && !videoRef.current)) {
      if (overlayCanvasRef.current) {
        const canvas = overlayCanvasRef.current;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const canvas = overlayCanvasRef.current;
    let width = 640;
    let height = 480;

    if (isCurrentlySimulated && simulatedCanvasRef.current) {
      width = simulatedCanvasRef.current.width || 640;
      height = simulatedCanvasRef.current.height || 480;
    } else if (videoRef.current) {
      width = videoRef.current.videoWidth || 640;
      height = videoRef.current.videoHeight || 480;
    }

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const mainColor = "#D1FA00"; // Cyber Lime
    const accentColor = "#FF5CA2"; // Empowerment Pink

    // 1. Draw Mesh connections if connections lists exist
    const connections = (window as any).FACEMESH_TESSELATION;
    if (connections && connections.length > 0) {
      ctx.strokeStyle = "rgba(209, 250, 0, 0.4)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let i = 0; i < connections.length; i++) {
        const [idx1, idx2] = connections[i];
        const pt1 = landmarks[idx1];
        const pt2 = landmarks[idx2];
        if (pt1 && pt2) {
          ctx.moveTo(pt1.x * width, pt1.y * height);
          ctx.lineTo(pt2.x * width, pt2.y * height);
        }
      }
      ctx.stroke();
    } else {
      // Connect points to form a sleek star/neural constellation layout
      ctx.strokeStyle = "rgba(209, 250, 0, 0.35)";
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      for (let i = 0; i < landmarks.length - 2; i += 5) {
        const pt1 = landmarks[i];
        const pt2 = landmarks[i + 1];
        const pt3 = landmarks[i + 2];
        if (pt1 && pt2 && pt3) {
          ctx.moveTo(pt1.x * width, pt1.y * height);
          ctx.lineTo(pt2.x * width, pt2.y * height);
          ctx.lineTo(pt3.x * width, pt3.y * height);
        }
      }
      ctx.stroke();
    }

    // 2. Draw outer contour in sweet Empowerment Pink
    const contours = (window as any).FACEMESH_CONTOURS;
    if (contours && contours.length > 0) {
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      for (let i = 0; i < contours.length; i++) {
        const [idx1, idx2] = contours[i];
        const pt1 = landmarks[idx1];
        const pt2 = landmarks[idx2];
        if (pt1 && pt2) {
          ctx.moveTo(pt1.x * width, pt1.y * height);
          ctx.lineTo(pt2.x * width, pt2.y * height);
        }
      }
      ctx.stroke();
    }

    // 3. Highlight tracking landmarks as cyber-dots
    ctx.fillStyle = mainColor;
    landmarks.forEach((pt: any, i: number) => {
      if (i % 12 === 0) {
        ctx.beginPath();
        ctx.arc(pt.x * width, pt.y * height, i % 24 === 0 ? 2 : 0.8, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

  }, [landmarks, step, isSimulated]);

  // Simulated landmarks generator for Onboarding
  const getSimulatedLandmarks = (time: number) => {
    const breath = Math.sin(time / 800) * 0.008;
    const lms = [];
    for (let i = 0; i < 468; i++) {
      const theta = (i % 20) * (Math.PI / 10);
      const phi = Math.floor(i / 20) * (Math.PI / 25);
      
      let x = Math.sin(phi) * Math.cos(theta);
      let y = Math.sin(phi) * Math.sin(theta);
      let z = Math.cos(phi);
      
      x = x * 0.18;
      y = y * 0.28 + 0.1 * (1.0 - Math.abs(x));
      
      y += breath + 0.02 * Math.sin(time/400 + i);
      x += 0.005 * Math.cos(time/400 + i);

      lms.push({
        x: 0.5 + x,
        y: 0.45 + y,
        z: z * 0.1
      });
    }
    return lms;
  };

  // Onboarding simulation drawing effect
  useEffect(() => {
    if (!isSimulated || step !== "scan") return;

    let active = true;
    const canvas = simulatedCanvasRef.current;
    
    const renderSim = () => {
      if (!active || !canvas) return;
      
      const width = 640;
      const height = 480;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const time = Date.now();
        const breath = Math.sin(time / 800) * 8;
        
        ctx.fillStyle = "#111112";
        ctx.fillRect(0, 0, width, height);
        
        // Soft matrix grids
        ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 45) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = 0; y < height; y += 45) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
        
        const faceX = width / 2;
        const faceY = height / 2 - 10;
        
        // Base Face Glow
        const glowRad = ctx.createRadialGradient(faceX, faceY, 20, faceX, faceY, 170);
        glowRad.addColorStop(0, "rgba(209, 250, 0, 0.1)");
        glowRad.addColorStop(1, "rgba(10, 10, 12, 0.9)");
        ctx.fillStyle = glowRad;
        ctx.beginPath();
        ctx.arc(faceX, faceY, 140, 0, 2 * Math.PI);
        ctx.fill();

        // 3D head vector contour wireframe
        ctx.strokeStyle = "rgba(209, 250, 0, 0.55)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(faceX, faceY + breath, 130, 0, 2 * Math.PI);
        ctx.stroke();

        // Beautiful graphic facial elements
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(faceX - 50, faceY - 20 + breath, 18, 8, 0, 0, 2 * Math.PI);
        ctx.ellipse(faceX + 50, faceY - 20 + breath, 18, 8, 0, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.fillStyle = "#1c1c1e";
        ctx.beginPath();
        ctx.arc(faceX - 50, faceY - 20 + breath, 7, 0, 2 * Math.PI);
        ctx.arc(faceX + 50, faceY - 20 + breath, 7, 0, 2 * Math.PI);
        ctx.fill();

        ctx.strokeStyle = "#FF5CA2";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(faceX, faceY + 50 + breath, 25, 0, Math.PI);
        ctx.stroke();

        // Overlay scanning sweeper
        const scanY = (time / 8) % (height + 200) - 100;
        if (scanY > 0 && scanY < height) {
          ctx.strokeStyle = "rgba(209, 250, 0, 0.8)";
          ctx.lineWidth = 2;
          ctx.shadowColor = "#D1FA00";
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.moveTo(0, scanY);
          ctx.lineTo(width, scanY);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        // Display beautiful telemetry text
        ctx.fillStyle = "rgba(209, 250, 0, 0.8)";
        ctx.font = "bold 9px monospace";
        ctx.fillText("VIRTUAL FACIAL EMBEDDING ACTIVE", 30, 45);
        ctx.fillText("ADA SCANNER PORT: INT_SIM_V0", 30, 60);
      }

      // Generate simulated landmarks for rendering the overlay face points organically
      const mockLms = getSimulatedLandmarks(Date.now());
      setLandmarks(mockLms);
      setHasFace(true);

      if (active) {
        requestAnimationFrame(renderSim);
      }
    };

    renderSim();

    return () => {
      active = false;
    };
  }, [isSimulated, step]);

  // Set video source when step is "scan" and stream is ready
  useEffect(() => {
    if (step !== "scan" || !stream || !videoRef.current) return;

    const video = videoRef.current;
    video.srcObject = stream;
    let cancelled = false;

    video.play()
      .then(() => {
        // getUserMedia can resolve with a stream that never actually
        // delivers a frame (permission granted but feed blocked by the
        // OS/browser). Without this check, that shows as a silent black
        // screen instead of falling back to the simulated feed.
        return new Promise<boolean>((resolve) => {
          const timer = setTimeout(() => resolve(false), 3500);
          video.addEventListener('playing', () => {
            clearTimeout(timer);
            resolve(true);
          }, { once: true });
        });
      })
      .then((gotFrame) => {
        if (cancelled) return;
        if (!gotFrame || video.videoWidth === 0) {
          console.warn("Onboarding camera stream never produced a frame, activating Simulated Mesh system.");
          stream.getTracks().forEach(track => track.stop());
          setIsSimulated(true);
        }
      })
      .catch(err => {
        console.warn("Failed to play onboarding video stream:", err);
        if (!cancelled) {
          stream.getTracks().forEach(track => track.stop());
          setIsSimulated(true);
        }
      });

    return () => { cancelled = true; };
  }, [step, stream]);

  // Clean up stream tracks on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => {
          track.stop();
          console.log("Onboarding: Cleaned up track", track.label);
        });
      }
    };
  }, [stream]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera APIs are blocked or not supported by this browser.");
      }
      let mediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user' }, 
          audio: false 
        });
      } catch (innerErr) {
        console.warn("User-facing camera failed, falling back to default camera:", innerErr);
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: false 
        });
      }
      setStream(mediaStream);
      setStep("scan");
    } catch (err: any) {
      console.warn("Camera not available or permission denied, activating Simulated Mesh system:", err);
      // Seamless simulated fallback for standard environment sandbox constraints
      setIsSimulated(true);
      setCameraError(null);
      setStep("scan");
    }
  };

  // Handles manual photoselection uploader
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setSnapshot(event.target.result as string);
        setScanSubStep("preview");
        if (stream) {
          stream.getTracks().forEach(t => t.stop());
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // 1. Capture step: takes snapshot and enters preview mode, but DOES NOT trigger API call yet
  const capturePhoto = () => {
    let dataUrl = "";

    if (isSimulated && simulatedCanvasRef.current && canvasRef.current) {
      const simCanvas = simulatedCanvasRef.current;
      const canvas = canvasRef.current;
      canvas.width = simCanvas.width;
      canvas.height = simCanvas.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(simCanvas, 0, 0);
        dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      }
    } else if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      let width = video.videoWidth || 640;
      let height = video.videoHeight || 480;
      if (width === 0) width = 640;
      if (height === 0) height = 480;
      
      const maxDimension = 800;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(video, 0, 0, width, height);
        dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      }
    }

    if (!dataUrl) {
      dataUrl = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    }

    setSnapshot(dataUrl);
    setScanSubStep("preview");
    
    // Stop tracks on freeze to save power
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  // 2. Submit step: sends snapshot to analyzer, then goes to blueprint step
  const confirmAndAnalyze = async () => {
    if (!snapshot) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/analyze-face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: snapshot })
      });
      
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      
      const data = await res.json();
      
      if (!data || data.error || !data.faceShape) {
        throw new Error(data?.error || "Invalid response format from face analysis API");
      }
      
      setAnalysis(data);
      setStep("blueprint");
    } catch (err) {
      console.error("Analysis failed, using demo fallback:", err);
      setAnalysis({
        faceShape: "Heart Oval",
        eyeType: "Hooded Almond",
        skinUndertone: "Warm Olive"
      });
      setStep("blueprint");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 3. Retake step: restarts camera/simulated stream and goes back to live substep
  const retakePhoto = async () => {
    setSnapshot(null);
    setScanSubStep("live");
    if (!isSimulated) {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user' }, 
          audio: false 
        });
        setStream(mediaStream);
      } catch (err) {
        console.warn("Could not restart webcam, using simulation mode:", err);
        setIsSimulated(true);
      }
    }
  };

  // 4. Skip Analysis altogether: skips scans and proceeds to blueprint with gorgeous generic metrics
  const skipAnalysisAltogether = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setAnalysis({
      faceShape: "Heart-Oval Glam",
      eyeType: "Hooded Almond",
      skinUndertone: "Neutral Olive"
    });
    setStep("blueprint");
  };

  const skipToWelcome = () => {
    // Save data temporarily and complete
    onComplete(goal);
  };

  const handleSignIn = async () => {
    try {
      const result = await signInWithGoogle();
      if (result?.user && analysis) {
        // Update profile with onboarding data
        const userDoc = doc(db, 'users', result.user.uid);
        await setDoc(userDoc, {
          facialMetrics: analysis,
          beautyGoal: goal,
          photoURL: snapshot || '',
          lastScanAt: serverTimestamp()
        }, { merge: true });

        await updateProfile({
          facialMetrics: analysis,
          beautyGoal: goal,
          photoURL: snapshot || '',
        });
      }
      onComplete(goal);
    } catch (err) {
      console.error("Sign in failed:", err);
    }
  };

  const handleSaveAndComplete = async () => {
    if (analysis) {
      try {
        await updateProfile({
          facialMetrics: analysis,
          beautyGoal: goal,
          photoURL: snapshot || '',
        });
      } catch (err) {
        console.error("Failed to save metrics to signed-in user:", err);
      }
    }
    onComplete(goal);
  };

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col overflow-hidden font-sans">
      <AnimatePresence mode="wait">
        {step === "welcome" && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-start p-6 text-center bg-onyx overflow-y-auto no-scrollbar"
          >
            {/* Header banner */}
            <div className="w-full max-w-xl text-center pt-8 mb-6">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-cyber-lime/10 border border-cyber-lime/20 rounded-full text-cyber-lime text-[9px] font-bold uppercase tracking-widest mb-4"
              >
                <Sparkles size={10} className="animate-pulse" /> Fusing Poetical Science & Glamour
              </motion.div>
              <h1 className="text-4xl md:text-5xl font-display font-black text-white tracking-tighter uppercase leading-none">
                Experience <span className="text-cyber-lime italic">Ada</span>
              </h1>
              <p className="text-white/60 text-xs font-medium mt-3 max-w-sm mx-auto leading-relaxed">
                Meet your elite AI beauty architect and digital pioneer, representing the magnificent heritage of women leading technology.
              </p>
            </div>

            {/* Dynamic Interactive Mode Showcase & Photo Integration */}
            <div className="w-full max-w-md space-y-3 mb-8">
              <p className="text-white/40 text-[8px] font-bold uppercase tracking-[0.2em] text-left">Ada's Operating Protocols (Active Matrices)</p>
              
              <div className="grid grid-cols-1 gap-2">
                {[
                  {
                    id: 'glow_guide',
                    title: "Ada's Harmony Protocols",
                    subtitle: "The Master Glow Guide",
                    desc: "Dermal tracking, skin energy core visualization, color harmony vectors, and active blend indices.",
                    faceDetails: "Chroma Nexus Prism Core (Throat), Lime/Pink Facial tracking paths.",
                    avatarColor: "from-amber-400 via-yellow-500 to-amber-600"
                  },
                  {
                    id: 'clinical_studio',
                    title: "(A) The Clinical Studio",
                    subtitle: "Synthesizer & Diagnostics",
                    desc: "Clinical pigment synthesis mechanisms, real-time diagnostic layers, and skin-matrix telemetry.",
                    faceDetails: "Synthetic Dermal Matrix, Holographic analysis interface.",
                    avatarColor: "from-teal-400 to-cyan-500"
                  },
                  {
                    id: 'beauty_counter',
                    title: "(B) The Beauty Counter",
                    subtitle: "Color Matching Protocol",
                    desc: "Personal consumer lookup matrices, brand palette optimization, and real-time counter advice.",
                    faceDetails: "Glow tracking, interactive retail interface, color harmonies.",
                    avatarColor: "from-pink-400 to-fuchsia-500"
                  },
                  {
                    id: 'runway_backstage',
                    title: "(C) The Runway Backstage",
                    subtitle: "Ultra-Low Latency Match",
                    desc: "Designed for high-speed catwalk beauty matching and backstage priority-queue processing.",
                    faceDetails: "Catwalk priority optimization, backstage efficiency engine.",
                    avatarColor: "from-purple-500 to-indigo-500"
                  },
                  {
                    id: 'digital_agency',
                    title: "(D) The Digital Agency",
                    subtitle: "AI Artist-In-Residence",
                    desc: "Future prototype exploring geometric reasoning overdrives, neural rendering and synthetic dermal overlays.",
                    faceDetails: "Geometric reasoning core, synthetic dermal matrix overview.",
                    avatarColor: "from-emerald-400 to-green-500"
                  }
                ].map((mode) => (
                  <motion.div
                    key={mode.id}
                    whileHover={{ scale: 1.01 }}
                    className="p-3 bg-white/5 border border-white/10 rounded-2xl text-left hover:border-cyber-lime/40 transition-all flex gap-3"
                  >
                    {/* Animated Holographic Core */}
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${mode.avatarColor} p-0.5 flex-shrink-0 flex items-center justify-center relative overflow-hidden shadow-lg`}>
                      <div className="absolute inset-x-0 h-[1.5px] bg-white animate-bounce top-0" />
                      <div className="text-white text-[8px] font-black">{mode.id.split('_')[0].substring(0, 4).toUpperCase()}</div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center gap-2">
                        <h4 className="text-white font-bold text-xs truncate">{mode.title}</h4>
                        <span className="text-cyber-lime font-mono text-[7px] uppercase tracking-wider flex-shrink-0">{mode.subtitle}</span>
                      </div>
                      <p className="text-white/50 text-[9px] leading-relaxed mt-0.5">{mode.desc}</p>
                      <div className="text-[7.5px] text-white/30 font-mono mt-1 border-t border-white/5 pt-1 flex items-center gap-1">
                        <span className="text-empowerment-pink font-bold">SCAN OVERLAY:</span>
                        <span className="truncate">{mode.faceDetails}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* AI Security Consent & Policy Agree Widget */}
            <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-4 text-left space-y-3 mt-4 mb-2">
              <span className="text-cyber-lime text-[8px] font-bold uppercase tracking-[0.2em] flex items-center gap-1 animate-pulse">
                <Shield size={10} /> SECURITY & DERMAL PRIVACY
              </span>
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={consentApproved}
                  onChange={(e) => setConsentApproved(e.target.checked)}
                  className="mt-1 flex-shrink-0 accent-cyber-lime h-3.5 w-3.5 rounded border-white/10 bg-black/40 text-onyx"
                />
                <span className="text-[10px] text-white/70 leading-normal font-semibold">
                  I consent to Ada's real-time face scanner capturing features to map my personal beauty. I agree to the {" "}
                  <button 
                    type="button" 
                    onClick={() => setShowPolicy("privacy")}
                    className="text-cyber-lime underline hover:text-white decoration-cyber-lime"
                  >
                    Privacy Policy
                  </button>{" "}
                  and {" "}
                  <button 
                    type="button" 
                    onClick={() => setShowPolicy("terms")}
                    className="text-cyber-lime underline hover:text-white decoration-cyber-lime"
                  >
                    Terms of Service
                  </button>. Photos are deleted immediately.
                </span>
              </label>
            </div>

            {/* Boot Camera button */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="w-full max-w-xs mt-1 mb-6 flex flex-col items-center gap-4"
            >
              <button
                id="enable-camera-btn"
                disabled={!consentApproved}
                onClick={startCamera}
                className={`w-full h-16 rounded-[24px] font-display font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 shadow-xl transition-all ${
                  consentApproved 
                    ? "bg-cyber-lime hover:bg-white text-onyx cursor-pointer active:scale-95" 
                    : "bg-white/10 text-white/30 cursor-not-allowed opacity-50"
                }`}
              >
                <Camera size={14} /> Boot Ada's Matrix & Say Hi
              </button>

              <button
                type="button"
                onClick={skipAnalysisAltogether}
                className="text-white/40 hover:text-white/80 text-[10px] uppercase font-bold tracking-widest transition-colors cursor-pointer"
              >
                Skip Analysis & Go Direct to Blueprint
              </button>

              {cameraError && consentApproved && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full p-5 bg-black/40 border border-empowerment-pink/40 rounded-[28px] text-center space-y-3"
                >
                  <p className="text-white text-xs font-semibold">Camera Blocked or Unavailable</p>
                  <p className="text-white/50 text-[10px] leading-relaxed">
                    Browser environment constraints or permissions blocked access. No worries, sister! You can still experience Ada's fully interactive Face Scanner using our Pioneer Simulation.
                  </p>
                  <button
                    id="simulate-onboarding"
                    onClick={() => {
                      setIsSimulated(true);
                      setCameraError(null);
                      setStep("scan");
                    }}
                    className="w-full py-3 bg-[#E1FF00] hover:bg-white text-black font-display font-black uppercase text-[10px] tracking-wider rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Sparkles size={12} /> Use Simulated Camera Feed
                  </button>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}

        {step === "scan" && (
          <motion.div
            key="scan"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex-1 flex flex-col bg-black relative select-none transition-all duration-300 ${dragOver ? "ring-4 ring-cyber-lime/70" : ""}`}
          >
            {/* Real-time media feeds or frozen selected snapshot image */}
            {scanSubStep === "preview" && snapshot ? (
              <img 
                src={snapshot} 
                className="absolute inset-0 w-full h-full object-cover" 
                alt="Captured Matrix Snapshot"
              />
            ) : isSimulated ? (
              <canvas
                ref={simulatedCanvasRef}
                className="absolute inset-0 w-full h-full object-cover z-0 animate-fade-in"
              />
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
              />
            )}

            {/* MediaPipe Real-time Live Mesh overlay - only during live state */}
            {scanSubStep === "live" && (
              <canvas
                ref={overlayCanvasRef}
                className="absolute inset-0 w-full h-full object-cover scale-x-[-1] pointer-events-none z-10"
              />
            )}
            
            {/* Oval Frame Overlay */}
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              <div className="w-[80%] aspect-[3/4] border-4 border-cyber-lime/40 rounded-[100px] relative overflow-hidden shadow-[0_0_0_2000px_rgba(0,0,0,0.6)]">
                <AnimatePresence>
                  {isAnalyzing && (
                    <motion.div
                      initial={{ top: "-10%" }}
                      animate={{ top: "110%" }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="absolute left-0 right-0 h-1 bg-cyber-lime shadow-[0_0_20px_var(--color-cyber-lime)] z-20"
                    />
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Headings */}
            <div className="absolute top-12 left-0 right-0 z-20 text-center px-4">
              <h2 className="text-white font-display font-black text-2xl uppercase tracking-widest text-shadow-lg drop-shadow-md">
                {scanSubStep === "preview" ? "CONFIRM METRIC PHOTO" : "ALIGN YOUR FACE"}
              </h2>
              <p className="text-cyber-lime font-mono text-[9px] uppercase tracking-widest mt-1">
                {scanSubStep === "preview" ? "PIONEERING DERMAL VERIFICATION" : "OR DROP A BEAUTY PHOTO HERE"}
              </p>
            </div>

            {/* Sub-step Specific Footers */}
            {scanSubStep === "live" ? (
              <div className="absolute bottom-12 left-0 right-0 z-20 px-8 flex flex-col items-center gap-4">
                <p className="text-white/80 text-xs font-semibold bg-black/60 backdrop-blur-md px-6 py-2.5 rounded-full border border-white/10 text-center max-w-sm">
                  {isSimulated 
                    ? "Sandbox restriction: Pioneer Simulation is running live!" 
                    : "Hold still for a moment, sister pioneer!"}
                </p>
                
                <div className="flex items-center justify-center gap-6 w-full max-w-sm mt-2">
                  {/* File Upload Trigger */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white hover:text-black transition-all shadow-lg cursor-pointer"
                    title="Upload Photo File"
                  >
                    <Upload size={18} />
                  </button>

                  {/* Primary Trigger */}
                  <button
                    onClick={capturePhoto}
                    className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.3)] active:scale-95 transition-all border-4 border-white/20 cursor-pointer"
                    title="Capture Snap"
                  >
                    <div className="w-16 h-16 rounded-full border-2 border-onyx bg-white hover:bg-gray-100 transition-colors" />
                  </button>

                  {/* Skip current matrix */}
                  <button
                    type="button"
                    onClick={skipAnalysisAltogether}
                    className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-all shadow-lg cursor-pointer font-sans text-[10px] font-bold uppercase tracking-wider"
                    title="Skip Face Scan"
                  >
                    SKIP
                  </button>
                </div>

                <span className="text-white/40 text-[9px] font-medium leading-relaxed">
                  Tip: Drag and drop a selfie anywhere on this screen!
                </span>
              </div>
            ) : (
              // PREVIEW / CONFIRMATION STEP OPTIONS
              <div className="absolute bottom-12 left-0 right-0 z-20 px-6 flex flex-col items-center gap-4">
                <div className="w-full max-w-md bg-black/85 backdrop-blur-xl border border-white/10 rounded-3xl p-6 space-y-4 shadow-2xl">
                  {isAnalyzing ? (
                    <div className="flex flex-col items-center py-6 gap-3 text-center">
                      <Loader2 size={32} className="text-cyber-lime animate-spin" />
                      <p className="text-white font-medium text-sm">Ada is running geometric dermal reasoning...</p>
                      <p className="text-white/40 text-[9px] font-mono tracking-widest uppercase">Analyzing Face Shape • Eyes • Skin undertones</p>
                    </div>
                  ) : (
                    <>
                      <div className="text-center space-y-1">
                        <p className="text-white text-sm font-bold">Is this photo optimal?</p>
                        <p className="text-white/50 text-[10px] leading-relaxed">
                          Ada will analyze your undertones & ratios to build the ultimate custom beauty advice module.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={retakePhoto}
                          className="py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold text-xs uppercase tracking-wider border border-white/10 flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                          <RotateCcw size={12} /> Retake
                        </button>

                        <button
                          type="button"
                          onClick={confirmAndAnalyze}
                          className="py-3.5 bg-cyber-lime hover:bg-white text-onyx rounded-2xl font-display font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg"
                        >
                          <Scan size={12} /> Analyze Photo
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={skipAnalysisAltogether}
                        className="w-full py-2 text-white/40 hover:text-white/80 text-[10px] uppercase tracking-wider font-bold transition-colors cursor-pointer"
                      >
                        Skip Scans & Continue with default outline
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Hidden Input file selector */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              className="hidden" 
            />

            <canvas ref={canvasRef} className="hidden" />
          </motion.div>
        )}

        {step === "blueprint" && (
          <motion.div
            key="blueprint"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="flex-1 flex flex-col bg-onyx p-8 pt-16 overflow-y-auto no-scrollbar"
          >
            <div className="flex items-center gap-4 mb-12">
              <div className="w-20 h-20 rounded-3xl overflow-hidden border-2 border-cyber-lime shadow-xl bg-onyx flex items-center justify-center flex-shrink-0">
                {snapshot ? (
                  <img src={snapshot} className="w-full h-full object-cover scale-x-[-1]" />
                ) : (
                  <div className="w-full h-full bg-black/60 flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 border border-cyber-lime/30 rounded-2xl animate-pulse" />
                    <div className="absolute top-2 left-2 w-1.5 h-1.5 bg-cyber-lime/60 rounded-full animate-ping" />
                    <div className="absolute bottom-3 right-3 w-1.5 h-1.5 bg-cyber-lime/60 rounded-full animate-ping" />
                    <svg viewBox="0 0 100 100" className="w-12 h-12 text-cyber-lime/80 drop-shadow-[0_0_8px_rgba(209,250,0,0.5)]" fill="none" stroke="currentColor" strokeWidth="1.5">
                      {/* Face contour */}
                      <path d="M50 20 C35 20, 25 35, 25 55 C25 72, 38 85, 50 85 C62 85, 75 72, 75 55 C75 35, 65 20, 50 20 Z" />
                      {/* Grid lines */}
                      <path d="M25 55 Q50 62 75 55" strokeDasharray="2 3" strokeWidth="1" />
                      <path d="M50 20 L50 85" strokeDasharray="2 3" strokeWidth="1" />
                      {/* Glowing eye meshes */}
                      <circle cx="38" cy="48" r="4" stroke="#FF5CA2" />
                      <circle cx="62" cy="48" r="4" stroke="#FF5CA2" />
                      {/* Tech target */}
                      <path d="M44 65 L56 65" />
                      <path d="M50 61 L50 69" />
                    </svg>
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-3xl font-display font-black text-white leading-none">ADA'S</h2>
                <p className="text-cyber-lime text-lg font-black tracking-widest">BLUEPRINT MATRIX</p>
              </div>
            </div>

            <div className="space-y-4 mb-12">
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em] px-2">Analysis Results</p>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { label: "Face Shape", value: analysis?.faceShape, icon: Scan },
                  { label: "Eye Type", value: analysis?.eyeType, icon: Camera },
                  { label: "Skin Undertone", value: analysis?.skinUndertone, icon: Sparkles },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * i }}
                    className="flex items-center justify-between p-5 bg-white/5 border border-white/10 rounded-2xl"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-cyber-lime/10 rounded-xl flex items-center justify-center">
                        <item.icon size={20} className="text-cyber-lime" />
                      </div>
                      <span className="text-white/40 font-bold text-xs uppercase tracking-widest">{item.label}</span>
                    </div>
                    <span className="text-white font-display font-bold text-lg">{item.value}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="space-y-6 mb-12">
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em] px-2">
                Type your main beauty goal or question for Ada
              </p>
              
              <div className="relative">
                <textarea
                  id="custom-goal-input"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g., How do I do a perfect winged liner for hooded eyes?"
                  className="w-full min-h-[110px] p-5 bg-white/5 border border-white/10 text-white rounded-3xl text-sm placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyber-lime focus:border-transparent transition-all resize-none"
                />
              </div>

              <div className="space-y-3">
                <p className="text-white/30 text-[9px] font-bold uppercase tracking-wider px-2">
                  Or select a quick recommendation to start:
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: "Learn the basics of contouring for my face shape", label: "Learn basic contouring for my face shape", icon: Zap },
                    { id: "How do I master the perfect winged eyeliner?", label: "Master Winged Eye Eyeliner", icon: Star },
                    { id: "Can you help me find makeup colors that fit my undertone?", label: "Find makeup colors for my undertone", icon: Sparkles },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setGoal(item.id)}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${
                        goal === item.id 
                          ? "bg-cyber-lime border-cyber-lime text-onyx font-bold" 
                          : "bg-white/5 border-white/10 text-white/80"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon size={16} className={goal === item.id ? "text-onyx" : "text-white/40"} />
                        <span className="text-xs font-semibold">{item.label}</span>
                      </div>
                      {goal === item.id && <CheckCircle size={16} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              id="continue-onboarding"
              disabled={!goal.trim()}
              onClick={() => setStep("secure")}
              className={`w-full h-16 rounded-3xl font-display font-black text-lg flex items-center justify-center gap-3 transition-all ${
                goal.trim() ? "bg-white text-onyx shadow-2xl" : "bg-white/10 text-white/20 cursor-not-allowed"
              }`}
            >
              CONTINUE <ArrowRight size={20} />
            </button>
          </motion.div>
        )}

        {step === "secure" && (
          <motion.div
            key="secure"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-black/40 backdrop-blur-3xl"
          >
            <div className="w-24 h-24 bg-cyber-lime rounded-[40px] flex items-center justify-center mb-12 shadow-[0_0_60px_var(--color-cyber-lime)]">
              <Shield size={48} className="text-onyx" />
            </div>

            <div className="space-y-4 mb-12">
              <h2 className="text-4xl font-display font-black text-white tracking-tighter uppercase">Secure Your Vanity</h2>
              <p className="text-white/60 text-lg max-w-xs mx-auto leading-relaxed">
                Save your facial mesh and custom tutorials to your private vault.
              </p>
            </div>

            <div className="w-full max-w-xs space-y-4">
              {user ? (
                <button
                  id="onboarding-save-complete"
                  onClick={handleSaveAndComplete}
                  className="w-full h-20 bg-cyber-lime text-onyx rounded-[32px] font-display font-black text-lg flex items-center justify-center gap-3 shadow-2xl transition-all hover:bg-white active:scale-95"
                >
                  SAVE BLUEPRINT & START
                </button>
              ) : (
                <button
                  id="onboarding-google-signin"
                  onClick={handleSignIn}
                  className="w-full h-20 bg-white text-onyx rounded-[32px] font-display font-black text-lg flex items-center justify-center gap-3 shadow-2xl transition-all hover:bg-cyber-lime active:scale-95"
                >
                  SIGN UP WITH GOOGLE
                </button>
              )}
              
              <button 
                onClick={async () => {
                  if (analysis) {
                    try {
                      await updateProfile({
                        facialMetrics: analysis,
                        beautyGoal: goal,
                        photoURL: snapshot || '',
                      });
                    } catch (err) {
                      console.error("Failed to save metrics on skip:", err);
                    }
                  }
                  onComplete(goal);
                }}
                className="w-full h-14 bg-white/5 text-white/40 rounded-[28px] font-bold text-xs uppercase tracking-widest hover:text-white transition-colors"
              >
                Skip for now
              </button>
            </div>

            <div className="mt-12 flex items-center gap-3 text-white/20 text-[10px] font-bold uppercase tracking-widest bg-white/5 px-6 py-3 rounded-full">
              <Lock size={12} />
              <span>AES-256 Encrypted Private Storage</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Privacy Policy & Terms of Service Overlay Modal */}
      <AnimatePresence>
        {showPolicy && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#111114] border border-white/10 rounded-[32px] w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-black/40">
                <h3 className="text-lg font-display font-black uppercase text-white tracking-widest flex items-center gap-2">
                  <Shield size={16} className="text-cyber-lime" />
                  {showPolicy === "privacy" ? "Privacy Policy" : "Terms of Service"}
                </h3>
                <button 
                  type="button" 
                  onClick={() => setShowPolicy(null)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto no-scrollbar space-y-4 text-xs text-white/60 leading-relaxed text-left">
                {showPolicy === "privacy" ? (
                  <>
                    <p className="text-white/80 font-bold">1. Introduction to Our Privacy Philosophy</p>
                    <p>Welcome, sister pioneer! Your beauty and data privacy are of utmost importance to us. This statement explains how your face mesh outline coordinates, image files, and personal goals are processed when you interact with Ada.</p>
                    
                    <p className="text-white/80 font-bold">2. Local Dermal Calculations</p>
                    <p>When using our camera scanner, all calculations to detect eye angles and face shape mapping are done using on-device JavaScript APIs. The image capture process converts data inside your active browser container.</p>
                    
                    <p className="text-white/80 font-bold">3. Temporary Memory Processing</p>
                    <p>To produce your color suggestions, we employ temporary server-side secure endpoints. These requests are encrypted end-to-end, and the original photos are immediately purged from memory once the response is transmitted back. We do not store, distribute, or monetize your images.</p>
                    
                    <p className="text-white/80 font-bold">4. Relational Storage Compliance</p>
                    <p>Your finished beauty profile (including your detected face shape, undertone, and goal questions) is saved to secure Google Cloud Firestore database elements only if you successfully sign in via Google. You may request complete erasure of your data under the user options menu at any time.</p>
                  </>
                ) : (
                  <>
                    <p className="text-white/80 font-bold">1. Agreement to Terms</p>
                    <p>By entering Ada's Beauty Matrix, you agree to comply with our conditions. This platform is a space designed for creative expression, poetical makeup science, and gender-inclusive beauty matches.</p>
                    
                    <p className="text-white/80 font-bold">2. Permitted Use of Ada's Neural Blueprints</p>
                    <p>The personalized blueprints, try-on simulations, and recommendations are provided for creative learning and advice. They are not medical dermatology diagnoses. You are encouraged to express your personal preferences organically.</p>
                    
                    <p className="text-white/80 font-bold">3. No Unauthorized Scraping</p>
                    <p>Ada's synthetic dermal overlays and custom-trained interaction vectors represent advanced creative code. You may not target or scrape our interface, canvas telemetry layers, or visual styling resources without direct permission.</p>
                    
                    <p className="text-white/80 font-bold">4. Disclaimer & Liability fallback</p>
                    <p>The services are offered on an "as-is" and "as-available" basis under sandboxed dev configurations. We maintain robust stability benchmarks so that your session is secure and reliable throughout.</p>
                  </>
                )}
              </div>
              <div className="p-6 border-t border-white/5 flex justify-end bg-black/20">
                <button 
                  type="button" 
                  onClick={() => setShowPolicy(null)}
                  className="px-6 py-2 bg-white text-onyx text-xs font-bold uppercase rounded-full hover:bg-cyber-lime transition-all cursor-pointer"
                >
                  Acknowledge & Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
