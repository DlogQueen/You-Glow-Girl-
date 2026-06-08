import { useState, useRef, useEffect, type FormEvent, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, Sparkles, Mic, Volume2, VolumeX, MicOff, Minimize2, Maximize2, Palette, Droplet, GripHorizontal, ImageIcon, X } from "lucide-react";
import { Message } from "../types";
import { useSpeech } from "../hooks/useSpeech";
import { useFirebase } from "../lib/FirebaseProvider";
import { DailyTip } from "./DailyTip";

interface ChatOverlayProps {
  messages: Message[];
  onSendMessage: (text: string, image?: string) => void;
  isLoading: boolean;
  onApplyPalette?: (palette: { lips: string; eyes: string; face: string }) => void;
}

const THEMES = [
  { id: 'dark', bg: 'bg-zinc-900', text: 'text-white', border: 'border-white/10', userBg: 'bg-empowerment-pink text-white', botBg: 'bg-white/10' },
  { id: 'pink', bg: 'bg-empowerment-pink', text: 'text-white', border: 'border-white/30', userBg: 'bg-black/30', botBg: 'bg-white/20' },
  { id: 'lime', bg: 'bg-cyber-lime', text: 'text-onyx', border: 'border-onyx/20', userBg: 'bg-black/10', botBg: 'bg-white/60' },
];

const OPACITIES = [
  { id: 'solid', val: 'backdrop-blur-3xl bg-opacity-95', name: 'Solid' },
  { id: 'glass', val: 'backdrop-blur-md bg-opacity-60', name: 'Glass' },
  { id: 'ghost', val: 'backdrop-blur-sm bg-opacity-30 hover:bg-opacity-80 transition-all', name: 'Ghost' },
];

export function ChatOverlay({ messages, onSendMessage, isLoading, onApplyPalette }: ChatOverlayProps) {
  const { profile, updateProfile } = useFirebase();
  const [input, setInput] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastMessageId = useRef<string | null>(null);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hasAutoCollapsed, setHasAutoCollapsed] = useState(false);
  
  const [themeIdx, setThemeIdx] = useState(0);
  const [opacityIdx, setOpacityIdx] = useState(0);

  useEffect(() => {
    if (profile?.themePreferences) {
      setThemeIdx(profile.themePreferences.themeIdx || 0);
      setOpacityIdx(profile.themePreferences.opacityIdx || 0);
    }
  }, [profile]);

  const activeTheme = THEMES[themeIdx];
  const activeOpacity = OPACITIES[opacityIdx];

  const { 
    isListening, 
    isSpeaking, 
    startListening, 
    stopListening, 
    speak, 
    cancelSpeech, 
    hasSupport 
  } = useSpeech({
    onResult: (text) => {
      onSendMessage(text);
    },
    onError: () => {
      setVoiceMode(false);
    }
  });

  // Handle Voice Mode / Auto-Speak
  useEffect(() => {
    if (!voiceMode) {
      cancelSpeech();
      stopListening();
      return;
    }

    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === 'assistant' && lastMsg.id !== lastMessageId.current) {
      lastMessageId.current = lastMsg.id;
      speak(lastMsg.content);
    }
  }, [messages, voiceMode, speak, cancelSpeech, stopListening]);

  // Restart listening after Ada finishes speaking if in voice mode
  useEffect(() => {
    if (voiceMode && !isSpeaking && !isLoading && !isListening) {
      const timer = setTimeout(() => {
        startListening();
      }, 300); // Small grace period
      return () => clearTimeout(timer);
    }
  }, [voiceMode, isSpeaking, isLoading, isListening, startListening]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isCollapsed]);

  // Auto-collapse after first reply
  useEffect(() => {
    if (!hasAutoCollapsed) {
      const assistantMessages = messages.filter(m => m.role === 'assistant');
      if (assistantMessages.length > 1) {
        setIsCollapsed(true);
        setHasAutoCollapsed(true);
      }
    }
  }, [messages, hasAutoCollapsed]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Image must be smaller than 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if ((input.trim() || selectedImage) && !isLoading) {
      onSendMessage(input.trim() || "Analyze this image.", selectedImage || undefined);
      setInput("");
      setSelectedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (isListening) stopListening();
    }
  };

  const toggleVoiceMode = () => {
    if (voiceMode) {
      setVoiceMode(false);
      cancelSpeech();
      stopListening();
    } else {
      setVoiceMode(true);
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.role === 'assistant') {
        speak(lastMsg.content);
      }
    }
  };

  const cycleTheme = () => {
    const nextThemeIdx = (themeIdx + 1) % THEMES.length;
    setThemeIdx(nextThemeIdx);
    updateProfile({
      themePreferences: {
        ...profile?.themePreferences,
        themeIdx: nextThemeIdx
      }
    });
  };

  const cycleOpacity = () => {
    const nextOpacityIdx = (opacityIdx + 1) % OPACITIES.length;
    setOpacityIdx(nextOpacityIdx);
    updateProfile({
      themePreferences: {
        ...profile?.themePreferences,
        opacityIdx: nextOpacityIdx
      }
    });
  };

  return (
    <motion.div 
      drag={isCollapsed}
      dragConstraints={{ left: -500, right: 500, top: -500, bottom: 500 }}
      layout
      data-collapsed={isCollapsed}
      className={`pointer-events-auto flex flex-col shadow-2xl overflow-hidden ${activeTheme.bg} ${activeTheme.text} ${activeTheme.border} ${activeOpacity.val} border ${
        isCollapsed 
          ? 'w-80 h-96 rounded-3xl absolute bottom-24 right-4 z-[100]' 
          : 'w-full max-w-2xl h-[70vh] rounded-[40px] relative z-[60]'
      }`}
    >
      {/* Header / Draggable Area */}
      <div className={`p-3 border-b ${activeTheme.border} flex items-center justify-between cursor-move handle ${isCollapsed ? 'bg-black/10' : ''}`}>
        <div className="flex items-center gap-2">
          {isCollapsed && <GripHorizontal size={16} className="opacity-50" />}
          <div className="flex items-center gap-1.5 px-2 py-1 bg-black/20 rounded-full animate-pulse border border-cyber-lime/30 shadow-[0_0_15px_var(--color-cyber-lime)]">
            <Sparkles size={12} className={themeIdx === 2 ? 'text-onyx' : 'text-cyber-lime'} />
            <span className="text-[10px] uppercase font-bold tracking-widest text-cyber-lime">Ada Chat</span>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button onClick={cycleOpacity} className="p-1.5 hover:bg-black/10 rounded-full transition-colors" title="Change Transparency">
            <Droplet size={14} />
          </button>
          <button onClick={cycleTheme} className="p-1.5 hover:bg-black/10 rounded-full transition-colors" title="Change Color">
            <Palette size={14} />
          </button>
          <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-1.5 hover:bg-black/10 rounded-full transition-colors">
            {isCollapsed ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide"
      >
        <div className="mb-2">
          <DailyTip onApplyPalette={onApplyPalette} />
        </div>
        <AnimatePresence mode="popLayout">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-4 py-3 rounded-[20px] text-sm leading-relaxed backdrop-blur-md ${
                  msg.role === 'user'
                    ? `${activeTheme.userBg} rounded-br-none`
                    : `${activeTheme.botBg} rounded-bl-none border ${activeTheme.border}`
                }`}
              >
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-1.5 mb-1 text-[10px] font-display font-bold uppercase tracking-wider opacity-60">
                    <Sparkles size={10} /> Ada
                  </div>
                )}
                {msg.image && (
                  <div className="mb-2 rounded-lg overflow-hidden border border-white/20">
                    <img src={msg.image} alt="User Upload" className="max-w-full h-auto object-cover max-h-48" />
                  </div>
                )}
                {msg.content}
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className={`${activeTheme.botBg} px-4 py-2 rounded-full text-xs font-medium backdrop-blur-md italic flex items-center gap-2 border border-cyber-lime/20 shadow-[0_0_10px_rgba(209,250,0,0.15)] text-cyber-lime animate-pulse`}>
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-cyber-lime rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-empowerment-pink rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-cyber-lime rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
                <span>Ada is thinking...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input Form */}
      <form 
        onSubmit={handleSubmit}
        className={`p-3 border-t ${activeTheme.border} bg-black/10 relative flex flex-col gap-2`}
      >
        {selectedImage && (
          <div className="relative w-16 h-16 rounded-md overflow-hidden border border-white/20 ml-2">
            <img src={selectedImage} alt="Selected" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => { setSelectedImage(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
              className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5"
            >
              <X size={12} />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          {/* File Upload Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-3 bg-black/20 hover:bg-black/30 rounded-full transition-all text-white/70 hover:text-white"
            title="Upload Photo"
          >
            <ImageIcon size={18} />
          </button>
          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
          />

          <div className="relative flex-1">
          <input
            id="chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? "Listening..." : "Ask Ada anything..."}
            className={`w-full bg-black/20 focus:bg-black/30 placeholder-current/50 border border-transparent rounded-full px-5 py-3 text-sm focus:outline-none focus:border-current/30 pr-12 transition-all ${
              isListening ? 'ring-2 ring-cyber-lime' : ''
            }`}
          />
          <button
            id="send-button"
            type="submit"
            disabled={(!input.trim() && !selectedImage) || isLoading}
            className={`absolute right-1 top-1/2 -translate-y-1/2 p-2.5 rounded-full disabled:opacity-30 disabled:cursor-not-allowed transition-all ${themeIdx === 2 ? 'bg-onyx text-cyber-lime' : 'bg-white text-onyx'}`}
          >
            <Send size={14} />
          </button>
        </div>

        {hasSupport && (
          <motion.button
            id="voice-toggle"
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleVoiceMode}
            className={`p-3 rounded-full flex items-center justify-center transition-all ${
              voiceMode 
                ? 'bg-cyber-lime text-onyx' 
                : 'bg-black/20 hover:bg-black/40'
            }`}
          >
            <AnimatePresence mode="wait">
              {isSpeaking ? (
                <motion.div key="speaking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Volume2 size={18} className="animate-pulse" />
                </motion.div>
              ) : voiceMode ? (
                <motion.div key="listening" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative">
                  <Mic size={18} />
                  {isListening && <motion.div layoutId="mic-glow" className="absolute inset-0 bg-onyx/10 rounded-full animate-ping" />}
                </motion.div>
              ) : (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <MicOff size={18} className="opacity-60" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        )}
        </div>
      </form>
    </motion.div>
  );
}
