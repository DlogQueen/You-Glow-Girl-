import { motion } from "motion/react";
import { useFirebase } from "../lib/FirebaseProvider";
import { Sparkles, Sun, Droplets, Calendar, Star, ArrowRight, Activity, Flame } from "lucide-react";
import { useState, useEffect } from "react";

export function DashboardView() {
  const { profile } = useFirebase();
  const [greeting, setGreeting] = useState("Hello");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 17) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  const name = profile?.displayName?.split(" ")[0] || "Gorgeous";

  const savedLooks = [
    { id: 1, title: "Summer Glow", img: "https://images.unsplash.com/photo-1596704017254-9b121068fb31?w=300&q=80", tag: "Skincare" },
    { id: 2, title: "Night Out", img: "https://images.unsplash.com/photo-1512496015851-a1c814125827?w=300&q=80", tag: "Makeup" },
    { id: 3, title: "Clean Girl", img: "https://images.unsplash.com/photo-1522337660859-02fbefca4702?w=300&q=80", tag: "Everyday" },
  ];

  return (
    <div className="w-full h-full overflow-y-auto scrollbar-hide text-white pt-10 pb-32 px-6">
      
      {/* Greet Section */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <h1 className="font-display font-light text-4xl text-white/90">
          {greeting}, <br />
          <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-empowerment-pink to-cyber-lime">
            {name}
          </span>
        </h1>
        <p className="font-mono text-xs text-white/50 mt-2 uppercase tracking-widest">
          Your digital vanity is ready
        </p>
      </motion.div>

      {/* Stats/Vitals Row */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid grid-cols-2 gap-4 mb-8"
      >
        <div className="bg-white/5 border border-white/10 rounded-3xl p-5 backdrop-blur-xl relative overflow-hidden group hover:border-cyber-lime/50 transition-colors">
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-cyber-lime/10 rounded-full blur-xl group-hover:bg-cyber-lime/20 transition-colors" />
          <div className="flex items-center gap-3 mb-3">
            <Flame size={18} className="text-empowerment-pink" />
            <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-white/60">Glow Streak</span>
          </div>
          <div className="text-3xl font-display font-black tracking-tighter">14 <span className="text-base text-white/40 font-medium tracking-normal">days</span></div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-5 backdrop-blur-xl relative overflow-hidden group hover:border-[#60A5FA]/50 transition-colors">
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-[#60A5FA]/10 rounded-full blur-xl group-hover:bg-[#60A5FA]/20 transition-colors" />
          <div className="flex items-center gap-3 mb-3">
            <Droplets size={18} className="text-[#60A5FA]" />
            <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-white/60">Hydration</span>
          </div>
          <div className="text-3xl font-display font-black tracking-tighter">92<span className="text-base text-white/40 font-medium tracking-normal">%</span></div>
        </div>
      </motion.div>

      {/* UV & Environment Card */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="w-full bg-gradient-to-r from-white/10 to-white/5 border border-white/10 rounded-[2rem] p-6 backdrop-blur-2xl mb-8 flex items-center justify-between"
      >
        <div>
          <div className="flex items-center gap-2 text-white/60 text-[10px] uppercase font-bold tracking-widest font-mono mb-2">
            <Sun size={14} className="text-amber-400" /> Environment
          </div>
          <div className="font-display text-xl font-medium">UV Index: <span className="font-bold text-amber-400">Moderate (4)</span></div>
          <div className="text-xs text-white/50 mt-1">Don't forget your SPF 50+ sunscreen today!</div>
        </div>
      </motion.div>

      {/* Today's Routine */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-xl tracking-tight">Today's Routine</h2>
          <button className="text-[10px] font-mono font-bold uppercase tracking-widest text-cyber-lime flex items-center gap-1">
            View All <ArrowRight size={12} />
          </button>
        </div>
        
        <div className="space-y-3">
          {[
            { id: '1', title: 'Morning Cleanse', subtitle: 'Cetaphil Gentle Cleanser', done: true },
            { id: '2', title: 'Vitamin C Serum', subtitle: 'Glow Recipe', done: true },
            { id: '3', title: 'Moisturizer + SPF', subtitle: 'Supergoop! Unseen', done: false },
          ].map((step, idx) => (
            <div key={step.id} className="flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl">
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${step.done ? 'bg-cyber-lime border-cyber-lime text-black' : 'border-white/20'}`}>
                {step.done && <Sparkles size={12} />}
              </div>
              <div>
                <div className={`font-medium ${step.done ? 'text-white/60 line-through' : 'text-white'}`}>{step.title}</div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider">{step.subtitle}</div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Saved Looks Gallery */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-xl tracking-tight">Saved Vanity</h2>
          <button className="text-[10px] font-mono font-bold uppercase tracking-widest text-empowerment-pink flex items-center gap-1">
            Gallery <ArrowRight size={12} />
          </button>
        </div>
        
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
          {savedLooks.map((look) => (
            <div key={look.id} className="min-w-[140px] snap-start relative rounded-3xl overflow-hidden group">
              <div className="aspect-[4/5]">
                <img src={look.img} alt={look.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              </div>
              <div className="absolute bottom-4 left-4 right-4">
                <div className="text-[9px] font-bold tracking-widest uppercase text-empowerment-pink mb-1">{look.tag}</div>
                <div className="font-medium text-sm text-white/90 leading-tight">{look.title}</div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

    </div>
  );
}
