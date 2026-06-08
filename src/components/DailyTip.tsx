import { useState, useEffect } from "react";
import { Sparkles, Heart, RefreshCw, Check, ArrowRight, Eye, Palette } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useFirebase } from "../lib/FirebaseProvider";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

interface DailyTipProps {
  onApplyPalette?: (palette: { lips: string; eyes: string; face: string }) => void;
}

export interface TipType {
  tipTitle: string;
  tipContent: string;
  category: "Skincare" | "Eyes" | "Lips" | "Pigment Theory" | string;
  palette: {
    lips: string;
    eyes: string;
    face: string;
    paletteName: string;
  };
}

// Fallback curated daily tips based on the day of the week so there is always a dynamic rotating tip!
const STATIC_DAILY_TIPS: TipType[] = [
  {
    tipTitle: "The Hydration Foundation Matrix",
    tipContent: "Darling, before applying any high-pigment contour or concealer, mist your face with a rosewater primer. Proper canvas hydration prevents pigment fracturing under digital lens magnification.",
    category: "Skincare",
    palette: {
      lips: "#E05A47",
      eyes: "#B58F55",
      face: "#F0CFAE",
      paletteName: "Classic Dewy Sienna"
    }
  },
  {
    tipTitle: "Feline Wing & Mathematical Lines",
    tipContent: "For a striking feline lift, align the wing brush with the outermost point of your eyebrow. Let mathematicians like Ada guide your sweep: a 45-degree angle acts as a natural structural contour elevator.",
    category: "Eyes",
    palette: {
      lips: "#FF1493",
      eyes: "#0E1111",
      face: "#FFFDD0",
      paletteName: "Empowerment Sharp Ink"
    }
  },
  {
    tipTitle: "Complementary Pigment Theory",
    tipContent: "If your calibrated undertone is Cool, try applying warm peach shadows to neutralise digital shadow fatigue. Color theory is the ultimate beauty hack—it creates dimensional pop with zero weight.",
    category: "Pigment Theory",
    palette: {
      lips: "#FFA07A",
      eyes: "#7B68EE",
      face: "#FFE4B5",
      paletteName: "Cyber Peach Lavender"
    }
  },
  {
    tipTitle: "Dynamic Ombre Lip Plump",
    tipContent: "Create depth by outlining with a deep mahogany, and blending inwards to a vibrant roseate shade. This mimics natural focal lighting gradients, giving off major elite pioneer vibes.",
    category: "Lips",
    palette: {
      lips: "#8B0000",
      eyes: "#DAA520",
      face: "#FFF5EE",
      paletteName: "Mahogany Sunrise"
    }
  },
  {
    tipTitle: "Micro-Dermal Dew Polish",
    tipContent: "To achieve the ultimate glass skin finish, apply liquid highlighter strictly to the orbital bone. Keep the forehead and nose bridge semi-matte to satisfy both high-definition cameras and soft room light settings.",
    category: "Skincare",
    palette: {
      lips: "#FF69B4",
      eyes: "#B0E0E6",
      face: "#FFE4E1",
      paletteName: "Frosty Dermal Glare"
    }
  },
  {
    tipTitle: "P pioneer Crimson Classic",
    tipContent: "Inspired by mid-century mathematical algorithms: pairing a classic bold crimson lip with bare, highlighted eyes creates an instant, high-contrast focus pull that projects supreme authority.",
    category: "Lips",
    palette: {
      lips: "#DC143C",
      eyes: "#F5F5DC",
      face: "#FFF8DC",
      paletteName: "Algorithm Crimson"
    }
  },
  {
    tipTitle: "Celestial Shimmer & Soft Focus",
    tipContent: "Apply high-intensity metallic champagnes directly on the center of your lid. It creates a focal spot that mirrors ring light flashes, keeping your gaze intensely bright and captivating.",
    category: "Eyes",
    palette: {
      lips: "#FF7F50",
      eyes: "#FFD700",
      face: "#FAF0E6",
      paletteName: "Cosmic Sunset Flare"
    }
  }
];

export function DailyTip({ onApplyPalette }: DailyTipProps) {
  const { user, profile, updateProfile } = useFirebase();
  const [activeTip, setActiveTip] = useState<TipType>(STATIC_DAILY_TIPS[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [applied, setApplied] = useState(false);
  const [liked, setLiked] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Automatically select the tip of the day based on the calendar date (day of week: 0 to 6)
  useEffect(() => {
    // If user's profile has a custom pushed tip, use that!
    if (profile?.pushedTip) {
      setActiveTip(profile.pushedTip);
    } else {
      const today = new Date().getDay();
      setActiveTip(STATIC_DAILY_TIPS[today % STATIC_DAILY_TIPS.length]);
    }
  }, [profile?.pushedTip]);

  // Sync like status
  useEffect(() => {
    if (profile?.likedTips) {
      setLiked(profile.likedTips.includes(activeTip.tipTitle));
    } else {
      setLiked(false);
    }
    setApplied(false);
  }, [activeTip, profile?.likedTips]);

  const handleApplyPalette = () => {
    if (onApplyPalette) {
      onApplyPalette(activeTip.palette);
      setApplied(true);
      setTimeout(() => setApplied(false), 2500);
    }
  };

  const handleLikeTip = async () => {
    if (!user) {
      alert("Conect your Google Passport to save this gorgeous tip, babe!");
      return;
    }
    const currentLikes = profile?.likedTips || [];
    let updatedLikes;
    if (liked) {
      updatedLikes = currentLikes.filter((t: string) => t !== activeTip.tipTitle);
    } else {
      updatedLikes = [...currentLikes, activeTip.tipTitle];
    }
    setLiked(!liked);
    await updateProfile({ likedTips: updatedLikes });
  };

  const handleAIMagic = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate-tip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });

      if (response.ok) {
        const data = await response.json();
        // Save generate tip in Firebase Profile as "pushedTip" so Ada can push to the home screen persistently!
        if (user) {
          await updateProfile({ pushedTip: data });
        } else {
          setActiveTip(data);
        }
      } else {
        throw new Error("Failed to generate AI tip");
      }
    } catch (err) {
      console.error("AI Daily Tip generation error:", err);
      // Pick a random alternative tip if failed
      const randIdx = Math.floor(Math.random() * STATIC_DAILY_TIPS.length);
      setActiveTip(STATIC_DAILY_TIPS[randIdx]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleResetToStandard = async () => {
    if (user && profile?.pushedTip) {
      await updateProfile({ pushedTip: null });
      const today = new Date().getDay();
      setActiveTip(STATIC_DAILY_TIPS[today % STATIC_DAILY_TIPS.length]);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -15 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full bg-gradient-to-br from-[#121217] via-[#0f0f13] to-[#0a0a0c] border border-white/10 rounded-[28px] overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.6)] select-none relative group/tip"
    >
      {/* Ambient background glows */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyber-lime/5 rounded-full blur-[30px] pointer-events-none group-hover/tip:bg-cyber-lime/10 transition-all duration-500" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-empowerment-pink/5 rounded-full blur-[30px] pointer-events-none group-hover/tip:bg-empowerment-pink/10 transition-all duration-500" />

      {/* Tiny top header indicator bar */}
      <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between bg-black/40">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyber-lime opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyber-lime"></span>
          </span>
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-white/50 font-mono">
            {profile?.pushedTip ? "✨ Ada's Custom Push" : "✨ Curated Daily Tip"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[8px] px-2 py-0.5 rounded-full font-mono font-bold bg-white/5 text-white/40 border border-white/5 uppercase">
            {activeTip.category}
          </span>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-white/30 hover:text-white text-[10px] font-bold font-mono uppercase tracking-wider transition-colors px-1 cursor-pointer"
          >
            {isCollapsed ? "Expand" : "Hide"}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-5 space-y-4">
              {/* Tip Text Area */}
              <div className="space-y-1.5">
                <h4 className="text-sm font-display font-black text-white group-hover/tip:text-cyber-lime transition-colors duration-300">
                  {activeTip.tipTitle}
                </h4>
                <p className="text-[11.5px] text-white/75 leading-relaxed font-medium">
                  {activeTip.tipContent}
                </p>
              </div>

              {/* Recommended Color Palette Preview Bar */}
              <div className="bg-black/30 border border-white/5 rounded-2xl p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Palette size={14} className="text-white/30" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[7.5px] text-white/30 uppercase tracking-widest font-bold font-mono">Simulated Palette</span>
                    <span className="text-[10px] text-white/80 font-bold truncate">{activeTip.palette.paletteName || "Matching Tone"}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Color dots preview */}
                  <div className="flex items-center -space-x-1.5">
                    {[
                      { col: activeTip.palette.lips, label: "Lips" },
                      { col: activeTip.palette.eyes, label: "Eyes" },
                      { col: activeTip.palette.face, label: "Face" }
                    ].map((c, idx) => (
                      <div
                        key={idx}
                        className="w-5 h-5 rounded-full border border-black shadow-md relative group/dot cursor-crosshair"
                        style={{ backgroundColor: c.col }}
                        title={`${c.label}: ${c.col}`}
                      />
                    ))}
                  </div>

                  {/* Apply Recommendation Trigger */}
                  <button
                    onClick={handleApplyPalette}
                    className={`h-8 px-3 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                      applied
                        ? "bg-cyber-lime text-onyx font-bold scale-[0.98]"
                        : "bg-white text-onyx hover:bg-zinc-200"
                    }`}
                  >
                    {applied ? (
                      <>
                        <Check size={10} strokeWidth={3} /> Applied!
                      </>
                    ) : (
                      <>
                        Apply Look <ArrowRight size={10} />
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Bottom Interactive Dashboard */}
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <div className="flex items-center gap-1.5">
                  {/* Like Button */}
                  <button
                    onClick={handleLikeTip}
                    className={`p-2.5 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
                      liked
                        ? "bg-empowerment-pink/15 border-empowerment-pink/30 text-empowerment-pink"
                        : "bg-white/5 border-white/5 text-white/40 hover:text-white"
                    }`}
                    title="Like Tip"
                  >
                    <Heart size={13} className={liked ? "fill-empowerment-pink text-empowerment-pink" : ""} />
                  </button>

                  {/* Clear Custom / Reset Button */}
                  {profile?.pushedTip && (
                    <button
                      onClick={handleResetToStandard}
                      className="px-2.5 py-2 hover:bg-white/5 rounded-xl text-[8.5px] font-bold text-white/30 hover:text-white/60 transition-colors cursor-pointer uppercase font-mono border border-dashed border-white/5"
                    >
                      Reset Daily
                    </button>
                  )}
                </div>

                {/* AI Regenerate Trigger */}
                <button
                  onClick={handleAIMagic}
                  disabled={isGenerating}
                  className="h-9 px-3 bg-gradient-to-r from-cyber-lime to-[#cbf500] text-onyx rounded-xl font-bold text-[9px] uppercase tracking-widest flex items-center gap-1.5 shadow-[0_4px_12px_rgba(209,250,0,0.2)] disabled:opacity-40 select-none cursor-pointer"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw size={11} className="animate-spin" /> Synthesizing...
                    </>
                  ) : (
                    <>
                      <Sparkles size={11} /> Refresh with AI
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
