import { motion, AnimatePresence } from "motion/react";
import { Sparkles, X } from "lucide-react";
import { STRIPE_PREMIUM_PAYMENT_LINK } from "../lib/config";

interface UpgradeModalProps {
  reason: "chat-limit" | "live-locked";
  onClose: () => void;
}

const COPY: Record<UpgradeModalProps["reason"], { title: string; body: string }> = {
  "chat-limit": {
    title: "You've used today's free chats with Ada",
    body: "Come back tomorrow for more, or go Elite for unlimited chats with Ada every day."
  },
  "live-locked": {
    title: "Ada Live is an Elite feature",
    body: "Real-time camera coaching with Ada's voice is part of Ada Elite. Unlock it to go live."
  }
};

export function UpgradeModal({ reason, onClose }: UpgradeModalProps) {
  const copy = COPY[reason];
  const hasPaymentLink = STRIPE_PREMIUM_PAYMENT_LINK.length > 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-md flex items-center justify-center px-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm bg-onyx border border-white/10 rounded-[32px] p-8 text-center space-y-6 shadow-2xl relative"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/40 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>

          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-empowerment-pink to-cyber-lime flex items-center justify-center shadow-lg">
            <Sparkles size={28} className="text-black" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-display font-black text-white">{copy.title}</h2>
            <p className="text-white/50 text-sm leading-relaxed">{copy.body}</p>
          </div>

          {hasPaymentLink ? (
            <a
              href={STRIPE_PREMIUM_PAYMENT_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full h-14 bg-cyber-lime text-onyx rounded-2xl font-display font-black text-sm flex items-center justify-center shadow-[0_10px_30px_rgba(180,255,0,0.3)]"
            >
              UPGRADE TO ADA ELITE
            </a>
          ) : (
            <div className="w-full h-14 bg-white/5 text-white/30 rounded-2xl font-display font-black text-sm flex items-center justify-center border border-white/10">
              ELITE COMING SOON
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
