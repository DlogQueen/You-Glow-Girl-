import { Palette, Wand2, Sparkles, Save, Loader2, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { useFirebase } from "../lib/FirebaseProvider";
import { db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

interface TryOnViewProps {
  selectedColors: Record<string, string>;
  onColorSelect: (catId: string, color: string) => void;
}

export function TryOnView({ selectedColors, onColorSelect }: TryOnViewProps) {
  const { user } = useFirebase();
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const categories = [
    { id: "lips", label: "Lips", icon: "💄", colors: ["#FF4A8D", "#E91E63", "#C2185B", "#AD1457", "#880E4F"] },
    { id: "eyes", label: "Eyes", icon: "👁️", colors: ["#673AB7", "#512DA8", "#4527A0", "#311B92", "#1C1C1E"] },
    { id: "face", label: "Face", icon: "✨", colors: ["#FFD600", "#FFC400", "#FFAB00", "#FF9100", "#FF6D00"] },
  ];

  const handleColorSelect = (catId: string, color: string) => {
    onColorSelect(catId, color);
  };

  const handleSaveLook = async () => {
    if (!user || Object.keys(selectedColors).length === 0) return;
    
    setIsSaving(true);
    try {
      await addDoc(collection(db, `users/${user.uid}/looks`), {
        userId: user.uid,
        name: `Nexus Look ${new Date().toLocaleDateString()}`,
        colors: Object.values(selectedColors),
        createdAt: serverTimestamp(),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Save look error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 pt-12 space-y-8 overflow-y-auto max-h-screen pb-32">
      <header className="flex justify-between items-start bg-black/45 backdrop-blur-md border border-white/10 p-5 rounded-[28px] shadow-xl">
        <div>
          <h2 className="text-2xl font-display font-bold text-white mb-1">Virtual Try-on</h2>
          <p className="text-cyber-lime text-[10px] uppercase tracking-widest font-bold">AR Pigment Simulator</p>
        </div>
        
        {user && Object.keys(selectedColors).length > 0 && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleSaveLook}
            disabled={isSaving}
            className={`p-3 rounded-2xl shadow-xl border ${saveSuccess ? 'bg-pink-500 border-pink-400 text-white' : 'bg-white/10 border-white/20 text-white'}`}
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : saveSuccess ? <Check size={18} /> : <Save size={18} />}
          </motion.button>
        )}
      </header>

      <div className="space-y-6">
        {categories.map((cat, i) => (
          <motion.div
            key={cat.id}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.1 }}
            className="space-y-3 bg-black/45 backdrop-blur-md border border-white/10 p-5 rounded-[28px] shadow-xl"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">{cat.icon}</span>
              <h3 className="text-white font-display font-bold text-lg">{cat.label}</h3>
            </div>
            
            <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
              {cat.colors.map((color, idx) => (
                <div key={idx} className="relative flex-shrink-0">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleColorSelect(cat.id, color)}
                    className={`w-12 h-12 rounded-full border-2 shadow-lg ${selectedColors[cat.id] === color ? 'border-cyber-lime scale-110' : 'border-white/20'}`}
                    style={{ backgroundColor: color }}
                  />
                  {selectedColors[cat.id] === color && (
                    <motion.div layoutId={`dot-${cat.id}`} className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-cyber-lime rounded-full" />
                  )}
                </div>
              ))}
              <kbd className="w-12 h-12 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center text-white/40 hover:text-white/60 flex-shrink-0">
                <Palette size={20} />
              </kbd>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full h-16 bg-cyber-lime rounded-3xl flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(225,255,0,0.3)] group"
      >
        <Wand2 size={24} className="text-onyx" />
        <span className="font-display font-bold text-onyx text-lg">Auto-Apply Best Match</span>
        <Sparkles size={20} className="text-onyx animate-pulse" />
      </motion.button>

      {!user && (
        <p className="text-center text-white/30 text-[10px] uppercase tracking-widest font-bold">Sign in to save your custom looks</p>
      )}
    </div>
  );
}
