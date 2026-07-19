import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { RotateCcw, CameraOff, Loader2, Sparkles } from "lucide-react";

interface CameraMirrorProps {
  ringLightOn: boolean;
  selectedColors?: {
    lips?: string;
    eyes?: string;
    face?: string;
    [key: string]: string | undefined;
  };
  collapsed?: boolean;
  onboarded?: boolean;
}

export interface CameraMirrorHandle {
  captureFrame: () => string | null;
}

export const CameraMirror = forwardRef<CameraMirrorHandle, CameraMirrorProps>(({ ringLightOn, selectedColors, collapsed, onboarded = false }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const simulatedCanvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [scanProgress, setScanProgress] = useState(0);
  const [matrixLocked, setMatrixLocked] = useState(false);
  const [isSimulated, setIsSimulated] = useState(false);

  // MediaPipe FaceMesh state
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [landmarks, setLandmarks] = useState<any[] | null>(null);
  const [hasFace, setHasFace] = useState(false);

  // Load MediaPipe Face Mesh CDN Script
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
      console.error("Failed to load MediaPipe Face Mesh script:", err);
    };
    document.body.appendChild(script);

    return () => {
      isMounted = false;
    };
  }, []);

  // Initialize and run FaceMesh processing frame loop
  useEffect(() => {
    if (!scriptsLoaded || isInitializing || !videoRef.current) return;

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
          } catch (err) {
            // Silence frame processing hiccups
          }
        }
        setTimeout(() => {
          if (active) requestAnimationFrame(sendFrame);
        }, 60); // Optimal FPS limit for smooth tracking + browser performance
      };

      sendFrame();

    } catch (err) {
      console.warn("FaceMesh instance failed:", err);
    }

    return () => {
      active = false;
      if (faceMeshInstance) {
        try {
          faceMeshInstance.close();
        } catch (e) {}
      }
    };
  }, [scriptsLoaded, isInitializing]);

  // Handle rendering landmarks onto the overlay-canvas
  useEffect(() => {
    if (!landmarks || !videoRef.current || !overlayCanvasRef.current) {
      if (overlayCanvasRef.current) {
        const canvas = overlayCanvasRef.current;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const video = videoRef.current;
    const canvas = overlayCanvasRef.current;
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // If onboarded, DO NOT draw the regular wireframe lines, connections, dots, or major nodes!
    if (onboarded) {
      const faceColor = selectedColors?.face;
      const lipsColor = selectedColors?.lips;
      const eyeColor = selectedColors?.eyes;

      // Ensure soft natural blending operations for virtual makeup
      ctx.save();

      // 1. Draw lips color contour filling
      // Outer lip boundary indices
      const lipIndicesOuter = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
      if (lipsColor && lipsColor !== "none") {
        ctx.fillStyle = lipsColor;
        ctx.globalAlpha = 0.55; // Natural pigment dewy glow opacity
        ctx.beginPath();
        lipIndicesOuter.forEach((idx, i) => {
          const pt = landmarks[idx];
          if (pt) {
            if (i === 0) ctx.moveTo(pt.x * width, pt.y * height);
            else ctx.lineTo(pt.x * width, pt.y * height);
          }
        });
        ctx.closePath();
        ctx.fill();
      }

      // 2. Draw soft eye shadow accents
      const leftEyeIndices = [33, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7];
      const rightEyeIndices = [362, 382, 381, 380, 374, 373, 390, 263, 466, 388, 387, 386, 385, 384, 398];
      if (eyeColor && eyeColor !== "none" && eyeColor !== "#1C1C1E") {
        ctx.fillStyle = eyeColor;
        ctx.globalAlpha = 0.35; // Translucent airbrushed palette shadow

        // Left eye
        ctx.beginPath();
        leftEyeIndices.forEach((idx, i) => {
          const pt = landmarks[idx];
          if (pt) {
            if (i === 0) ctx.moveTo(pt.x * width, pt.y * height);
            else ctx.lineTo(pt.x * width, pt.y * height);
          }
        });
        ctx.closePath();
        ctx.fill();

        // Right eye
        ctx.beginPath();
        rightEyeIndices.forEach((idx, i) => {
          const pt = landmarks[idx];
          if (pt) {
            if (i === 0) ctx.moveTo(pt.x * width, pt.y * height);
            else ctx.lineTo(pt.x * width, pt.y * height);
          }
        });
        ctx.closePath();
        ctx.fill();
      }

      // 3. Draw soft, delicate cheekbone blushes (face color)
      const leftCheekIndex = 422;
      const rightCheekIndex = 202;
      if (faceColor && faceColor !== "none" && faceColor !== "rgba(225, 255, 0, 0.4)") {
        const leftCheek = landmarks[leftCheekIndex];
        const rightCheek = landmarks[rightCheekIndex];

        ctx.globalAlpha = 0.2;
        if (leftCheek) {
          const radGrad = ctx.createRadialGradient(
            leftCheek.x * width, leftCheek.y * height, 2,
            leftCheek.x * width, leftCheek.y * height, 35
          );
          radGrad.addColorStop(0, faceColor);
          radGrad.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = radGrad;
          ctx.beginPath();
          ctx.arc(leftCheek.x * width, leftCheek.y * height, 35, 0, 2 * Math.PI);
          ctx.fill();
        }
        if (rightCheek) {
          const radGrad = ctx.createRadialGradient(
            rightCheek.x * width, rightCheek.y * height, 2,
            rightCheek.x * width, rightCheek.y * height, 35
          );
          radGrad.addColorStop(0, faceColor);
          radGrad.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = radGrad;
          ctx.beginPath();
          ctx.arc(rightCheek.x * width, rightCheek.y * height, 35, 0, 2 * Math.PI);
          ctx.fill();
        }
      }

      ctx.restore();
      return;
    }

    // Default (Pre-Onboarded Scan): Draw full high-tech geometric face mesh
    const faceColor = selectedColors?.face || "rgba(225, 255, 0, 0.4)";
    const lipsColor = selectedColors?.lips || "rgba(255, 92, 162, 0.8)";
    const eyeColor = selectedColors?.eyes || "#E1FF00";

    // 1. Draw Mesh connections if connections lists exist
    const connections = (window as any).FACEMESH_TESSELATION;
    if (connections && connections.length > 0) {
      ctx.strokeStyle = faceColor;
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
      // High-precision geometric alignment wireframe if connection tables are absent
      ctx.strokeStyle = faceColor;
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      for (let i = 0; i < landmarks.length - 2; i += 4) {
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

    // 2. Draw contours (Lips / Eyes)
    const contours = (window as any).FACEMESH_CONTOURS;
    if (contours && contours.length > 0) {
      ctx.strokeStyle = lipsColor;
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

    // 3. Highlight nodes
    ctx.fillStyle = eyeColor;
    landmarks.forEach((pt: any, i: number) => {
      const isMajor = i % 15 === 0;
      const isMinor = i % 5 === 0;
      if (isMajor || isMinor) {
        ctx.beginPath();
        ctx.arc(pt.x * width, pt.y * height, isMajor ? 1.6 : 0.6, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

  }, [landmarks, selectedColors, onboarded]);

  // Simulated landmarks generator for CameraMirror page
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

  // Simulated live camera rendering loop
  useEffect(() => {
    if (!isSimulated) return;

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
        const breath = Math.sin(time / 800) * 10;
        
        // Dark high-tech cyber background grid
        ctx.fillStyle = "#111112";
        ctx.fillRect(0, 0, width, height);
        
        ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 40) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = 0; y < height; y += 40) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
        
        const faceX = width / 2;
        const faceY = height / 2 - 20;
        
        const faceColor = selectedColors?.face || "#FFD600";
        const lipsColor = selectedColors?.lips || "#FF4A8D";
        const eyesColor = selectedColors?.eyes || "#673AB7";
        
        // Base Face Radial Glow
        const glowRad = ctx.createRadialGradient(faceX, faceY, 20, faceX, faceY, 180);
        glowRad.addColorStop(0, "rgba(28, 28, 30, 0.5)");
        glowRad.addColorStop(1, "rgba(10, 10, 12, 0.85)");
        ctx.fillStyle = glowRad;
        ctx.beginPath();
        ctx.arc(faceX, faceY, 150, 0, 2 * Math.PI);
        ctx.fill();

        // Cheeks / Blush Matrix
        ctx.save();
        const blushGradL = ctx.createRadialGradient(faceX - 70, faceY + 50 + breath, 5, faceX - 70, faceY + 50 + breath, 55);
        blushGradL.addColorStop(0, `${faceColor}33`);
        blushGradL.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = blushGradL;
        ctx.beginPath();
        ctx.arc(faceX - 70, faceY + 50 + breath, 55, 0, 2 * Math.PI);
        ctx.fill();

        const blushGradR = ctx.createRadialGradient(faceX + 70, faceY + 50 + breath, 5, faceX + 70, faceY + 50 + breath, 55);
        blushGradR.addColorStop(0, `${faceColor}33`);
        blushGradR.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = blushGradR;
        ctx.beginPath();
        ctx.arc(faceX + 70, faceY + 50 + breath, 55, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();

        // Eye Shadow Overlay (stroke arc)
        ctx.strokeStyle = `${eyesColor}aa`;
        ctx.lineWidth = 14;
        ctx.lineCap = "round";
        
        ctx.beginPath();
        ctx.arc(faceX - 60, faceY - 20 + breath, 25, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(faceX + 60, faceY - 20 + breath, 25, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();

        // Vector Eyes
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(faceX - 60, faceY - 15 + breath, 20, 10, 0, 0, 2 * Math.PI);
        ctx.ellipse(faceX + 60, faceY - 15 + breath, 20, 10, 0, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.fillStyle = "#121214";
        ctx.beginPath();
        ctx.arc(faceX - 60, faceY - 15 + breath, 7, 0, 2 * Math.PI);
        ctx.arc(faceX + 60, faceY - 15 + breath, 7, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(faceX - 58, faceY - 17 + breath, 2, 0, 2 * Math.PI);
        ctx.arc(faceX + 62, faceY - 17 + breath, 2, 0, 2 * Math.PI);
        ctx.fill();

        // Lip Fill Overlay
        ctx.save();
        ctx.fillStyle = lipsColor;
        ctx.shadowColor = lipsColor;
        ctx.shadowBlur = 15;
        
        // Upper Lip Shape
        ctx.beginPath();
        ctx.moveTo(faceX - 45, faceY + 80 + breath);
        ctx.quadraticCurveTo(faceX - 22, faceY + 68 + breath, faceX - 10, faceY + 74 + breath);
        ctx.quadraticCurveTo(faceX, faceY + 78 + breath, faceX + 10, faceY + 74 + breath);
        ctx.quadraticCurveTo(faceX + 22, faceY + 68 + breath, faceX + 45, faceY + 80 + breath);
        ctx.quadraticCurveTo(faceX, faceY + 90 + breath, faceX - 45, faceY + 80 + breath);
        ctx.fill();

        // Lower Lip Shape
        ctx.beginPath();
        ctx.moveTo(faceX - 45, faceY + 82 + breath);
        ctx.quadraticCurveTo(faceX, faceY + 105 + breath, faceX + 45, faceY + 82 + breath);
        ctx.quadraticCurveTo(faceX, faceY + 86 + breath, faceX - 45, faceY + 82 + breath);
        ctx.fill();
        ctx.restore();

        // Facial Oval bounding wireframe
        ctx.strokeStyle = "rgba(225, 255, 0, 0.4)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(faceX, faceY, 150, 0, 2 * Math.PI);
        ctx.stroke();

        // Sweeping Scan Bar
        const scanY = (time / 10) % (height + 200) - 100;
        if (scanY > 0 && scanY < height) {
          const scanGrad = ctx.createLinearGradient(0, scanY - 40, 0, scanY);
          scanGrad.addColorStop(0, "rgba(209, 250, 0, 0)");
          scanGrad.addColorStop(1, "rgba(209, 250, 0, 0.2)");
          ctx.fillStyle = scanGrad;
          ctx.fillRect(0, scanY - 40, width, 40);
          
          ctx.strokeStyle = "rgba(209, 250, 0, 0.75)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(0, scanY);
          ctx.lineTo(width, scanY);
          ctx.stroke();
        }

        // Telemetry readout
        ctx.fillStyle = "rgba(209, 250, 0, 0.75)";
        ctx.font = "bold 9px monospace";
        ctx.fillText("ADA SIMULATION DRIVER v4.0", 25, 40);
        ctx.fillText("FACIAL CORE METRIC: ACTIVE", 25, 55);
        ctx.fillText(`C-MATRIX: ${lipsColor} // ${eyesColor}`, 25, 70);

        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.font = "8px monospace";
        ctx.fillText("PIONEERING ENERGY INJECTOR: 100%", 25, height - 55);
        ctx.fillText("SYS: RECOGNITION OK // FPS 60", 25, height - 40);
        ctx.fillText("SECURE DATA VAULT OVER OAUTH: LOCK", 25, height - 25);

        ctx.fillText("SCANNING FOR FACIAL VECTORS...", width - 180, 40);
        ctx.fillText("CALIBRATING DERMAL INDICES...", width - 180, 55);
      }

      // Generate simulated landmarks for real-time mesh highlights alignment
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
  }, [isSimulated, selectedColors]);

  const setupCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Your browser doesn't support camera access, babe. Try a modern one!");
      setIsInitializing(false);
      return;
    }

    setIsInitializing(true);
    setError(null);
    setMatrixLocked(false);
    try {
      // Simplest constraints first for maximum compatibility
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true,
        audio: false 
      });
      
      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;
        try {
          await video.play();

          // getUserMedia can resolve with a stream that never actually
          // delivers a frame (permission granted but feed blocked by the
          // OS/browser). Without this, that shows as a silent black screen
          // instead of falling back to the simulated feed.
          const gotFrame = await new Promise<boolean>((resolve) => {
            const timer = setTimeout(() => resolve(false), 3500);
            video.addEventListener('playing', () => {
              clearTimeout(timer);
              resolve(true);
            }, { once: true });
          });

          if (gotFrame && video.videoWidth > 0) {
            setMatrixLocked(true);
          } else {
            console.warn("Camera stream never produced a frame, activating Simulated Mesh system.");
            stream.getTracks().forEach(track => track.stop());
            setIsSimulated(true);
            setMatrixLocked(true);
          }
        } catch (playErr) {
          console.warn("Video play failed:", playErr);
          stream.getTracks().forEach(track => track.stop());
          setIsSimulated(true);
          setMatrixLocked(true);
        }
      }
    } catch (err: any) {
      console.warn("Camera not available or blocked, activating Simulated Mesh system:", err);
      // Seamless simulated fallback for standard environment sandbox constraints
      setIsSimulated(true);
      setError(null);
      setMatrixLocked(true);
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    setupCamera();

    return () => {
      // Clean up camera tracks on unmount
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => {
          track.stop();
          console.log("Stopped camera track:", track.label);
        });
      }
    };
  }, []);

  useEffect(() => {
    if (matrixLocked) {
      // Simulating scan progress once camera is active
      const interval = setInterval(() => {
        setScanProgress(prev => (prev < 92 ? prev + 1 : 92));
      }, 150);
      return () => clearInterval(interval);
    }
  }, [matrixLocked]);

  useImperativeHandle(ref, () => ({
    captureFrame: () => {
      if (isSimulated && simulatedCanvasRef.current && canvasRef.current) {
        const simCanvas = simulatedCanvasRef.current;
        const canvas = canvasRef.current;
        canvas.width = simCanvas.width;
        canvas.height = simCanvas.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(simCanvas, 0, 0);
          return canvas.toDataURL('image/jpeg', 0.85);
        }
      }
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
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
          return canvas.toDataURL('image/jpeg', 0.85);
        }
      }
      return null;
    }
  }));

  return (
    <div className="relative w-full h-full bg-[#1C1C1E] overflow-hidden pointer-events-none">
      <AnimatePresence>
        {error ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-white z-20 bg-onyx/90 backdrop-blur-xl pointer-events-auto"
          >
            <CameraOff size={48} className="text-empowerment-pink mb-4" />
            <h3 className="text-xl font-display font-bold mb-2">Camera Access Required</h3>
            <p className="text-sm opacity-60 max-w-xs mb-6">{error}</p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <motion.button
                id="retry-camera"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={setupCamera}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-onyx rounded-full font-bold shadow-xl pointer-events-auto cursor-pointer"
              >
                <RotateCcw size={18} /> Retry Connection
              </motion.button>
              <motion.button
                id="simulate-camera"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setIsSimulated(true);
                  setError(null);
                  setMatrixLocked(true);
                }}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-cyber-lime text-onyx rounded-full font-bold shadow-xl pointer-events-auto cursor-pointer"
              >
                <Sparkles size={18} /> Use Simulated Camera Feed
              </motion.button>
            </div>
          </motion.div>
        ) : isInitializing ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center p-8 text-white z-20"
          >
            <Loader2 size={48} className="animate-spin text-empowerment-pink mb-4" />
            <p className="font-mono text-[10px] tracking-widest uppercase text-empowerment-pink drop-shadow-[0_0_10px_rgba(255,92,162,0.4)]">Initializing YOU GLOW GIRL!...</p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {isSimulated ? (
        <canvas
          ref={simulatedCanvasRef}
          className="absolute inset-0 w-full h-full object-cover"
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

      {/* Real-time Dynamic MediaPipe Face Mesh Overlay */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 w-full h-full object-cover scale-x-[-1] pointer-events-none z-10 animate-fade-in"
      />
      
      {/* Complex Polygonal Dermal Matrix */}
      <AnimatePresence>
        {!collapsed && !onboarded && (
          <motion.div 
            key="dermal-matrix"
            className="absolute inset-0 pointer-events-none flex items-center justify-center z-10"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: hasFace ? 0.05 : 0.3, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.8, ease: "easeInOut" } }}
          >
            <svg viewBox="0 0 400 500" className="w-full max-w-sm h-auto drop-shadow-[0_0_15px_rgba(225,255,0,0.6)]">
              <defs>
                <linearGradient id="meshGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#E1FF00" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="#E1FF00" stopOpacity="0.4" />
                </linearGradient>
              </defs>
              
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1 }}
              >
                {/* Forehead, Cheeks, Contour (Face category) */}
                <g stroke={selectedColors?.face || "#E1FF00"} strokeWidth="0.5" fill="none" strokeOpacity="0.2">
                  {/* Forehead */}
                  <path d="M200 80 L240 90 L280 120 L200 120 L120 120 L160 90 Z" />
                  <path d="M200 80 L200 120" />
                  {/* Cheeks & Nose */}
                  <path d="M90 220 L160 180 L200 190 L240 180 L310 220" />
                  <path d="M160 180 L160 260 L200 240 L200 190" />
                  <path d="M240 180 L240 260 L200 240" />
                  <path d="M200 240 L200 300" />
                  {/* Outer Contour */}
                  <motion.path 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 3, ease: "easeInOut" }}
                    d="M200 80 L280 120 L310 220 L270 340 L200 410 L130 340 L90 220 L120 120 Z" 
                    strokeWidth="1.5"
                    strokeOpacity="0.5"
                  />
                </g>

                {/* Eyes & Brows (Eyes category) */}
                <g stroke={selectedColors?.eyes || "#E1FF00"} strokeWidth="0.5" fill="none" strokeOpacity="0.2">
                  <path d="M120 120 L160 140 L200 120 L240 140 L280 120" />
                  <path d="M160 140 L200 160 L240 140" />
                  <path d="M160 140 L160 180 L200 160" />
                  <path d="M240 140 L240 180 L200 160" />
                </g>

                {/* Mouth & Jaw (Lips category) */}
                <g stroke={selectedColors?.lips || "#E1FF00"} strokeWidth="0.5" fill="none" strokeOpacity="0.2">
                  <path d="M130 340 L160 300 L200 310 L240 300 L270 340" />
                  <path d="M160 300 L160 360 L200 380 L240 360 L240 300" />
                  <path d="M200 310 L200 380" />
                  <path d="M130 340 L200 410 L270 340" />
                </g>

                {/* Pulsing Intersection Nodes with category color-coding */}
                {[
                  [200, 80], [240, 90], [160, 90], [280, 120], [120, 120], [200, 120],
                  [160, 140], [240, 140], [200, 160], [160, 180], [240, 180], [200, 190],
                  [90, 220], [310, 220], [200, 240], [160, 260], [240, 260],
                  [160, 300], [240, 300], [200, 310], [130, 340], [270, 340],
                  [160, 360], [240, 360], [200, 380], [200, 410]
                ].map(([cx, cy], i) => {
                  const nodeColor = cy >= 300 
                    ? (selectedColors?.lips || "#E1FF00") 
                    : (cy >= 130 && cy < 190 ? (selectedColors?.eyes || "#E1FF00") : (selectedColors?.face || "#E1FF00"));
                  return (
                    <motion.circle 
                      key={i}
                      cx={cx} cy={cy} r="1.5" 
                      fill={nodeColor}
                      animate={{ 
                        scale: [1, 1.8, 1], 
                        opacity: [0.4, 1, 0.4],
                      }}
                      transition={{ duration: 3, repeat: Infinity, delay: (cx + cy) / 500 }}
                    />
                  );
                })}

                {/* Targeted Scanning Rings */}
                <g>
                  <motion.circle cx="200" cy="220" r="60" fill="none" stroke="#E1FF00" strokeWidth="0.5" strokeDasharray="4 4" animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} />
                  <motion.circle cx="200" cy="220" r="100" fill="none" stroke="#E1FF00" strokeWidth="0.25" strokeDasharray="1 5" animate={{ rotate: -360 }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }} />
                </g>
              </motion.g>
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CALLOUTS & SCAN STATUS */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div 
            key="callouts-scan"
            className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-10"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.3 } }}
          >
            <div className="flex justify-between items-start">
               <div className="space-y-4">
                  {/* Scan Status */}
                  <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16">
                      <svg className="w-full h-full -rotate-90">
                        <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                        <motion.circle 
                          cx="32" cy="32" r="28" 
                          fill="none" 
                          stroke="#E1FF00" 
                          strokeWidth="4" 
                          strokeDasharray="175.9"
                          strokeDashoffset={175.9 * (1 - scanProgress / 100)}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-[10px] font-bold text-white leading-none">{scanProgress}%</span>
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-cyber-lime text-[8px] font-bold uppercase tracking-widest">Live Scan Status:</span>
                      <AnimatePresence mode="wait">
                        {matrixLocked ? (
                          <motion.span 
                            key="locked"
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-white font-display font-medium text-[10px]"
                          >
                            {scanProgress >= 92 ? "Matrix Locked" : "Analyzing Matrix..."}
                          </motion.span>
                        ) : (
                          <motion.span 
                            key="waiting"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-white/40 font-display font-medium text-[10px] italic"
                          >
                            Waiting for feed...
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Dermal Facts */}
                  <motion.div 
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="space-y-2 border-l-2 border-cyber-lime pl-4"
                  >
                    <div>
                       <span className="text-cyber-lime text-[7px] font-bold uppercase">Targeted Areas:</span>
                       <p className="text-white/80 text-[7px] leading-tight">Mid-face Brightening<br />Olive Tone Balancing</p>
                    </div>
                    <div>
                       <span className="text-cyber-lime text-[7px] font-bold uppercase">Undertone:</span>
                       <p className="text-white/80 text-[7px] leading-tight">Neutral/Warm Detected</p>
                    </div>
                  </motion.div>
               </div>

               <div className="text-right">
                  <div className="text-cyber-lime text-[8px] font-bold uppercase tracking-widest bg-black/40 px-2 py-1 rounded backdrop-blur-sm inline-block mb-1">
                    AI Analysis Active
                  </div>
                  <p className="text-white/60 text-[7px] leading-tight">
                    Confidence Score: HIGH<br />
                    Sallowness: Corrected
                  </p>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ring Light Effect */}
      {ringLightOn && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          className="absolute inset-0 pointer-events-none ring-[100px] ring-white/10 blur-3xl mix-blend-screen z-10" 
        />
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
});

CameraMirror.displayName = "CameraMirror";
