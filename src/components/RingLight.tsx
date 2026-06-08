import { motion } from "motion/react";
import { Sun } from "lucide-react";

interface RingLightProps {
  isOn: boolean;
  onToggle: () => void;
}

export function RingLight({ isOn, onToggle }: RingLightProps) {
  return (
    <motion.button
      id="ring-light-toggle"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onToggle}
      className={`relative p-4 rounded-full transition-colors duration-500 shadow-xl ${
        isOn ? 'bg-cyber-lime text-onyx shadow-cyber-lime/50' : 'bg-onyx/20 text-white backdrop-blur-md'
      }`}
    >
      <Sun size={24} className={isOn ? 'animate-pulse' : ''} />
      {isOn && (
        <motion.div
           layoutId="ring-glow"
           className="absolute -inset-2 border-2 border-cyber-lime rounded-full"
           animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
           transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </motion.button>
  );
}
