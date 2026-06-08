import { useEffect, useState } from "react";
import { LayoutGrid, Loader2, Heart } from "lucide-react";
import { motion } from "motion/react";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, increment } from "firebase/firestore";
import { db } from "../lib/firebase";

export function FeedView() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "feed"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPosts(postsData);
      setLoading(false);
    }, (error) => {
      console.error("Feed error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLike = async (postId: string) => {
    try {
      const postRef = doc(db, "feed", postId);
      await updateDoc(postRef, {
        likes: increment(1)
      });
    } catch (err) {
      console.error("Like error:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="text-cyber-lime animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="p-6 pt-12 space-y-6 overflow-y-auto max-h-screen pb-32">
      <header>
        <h2 className="text-3xl font-display font-bold text-white mb-2">Social Feed</h2>
        <p className="text-empowerment-pink text-xs uppercase tracking-widest font-black">Trending in YOU GLOW GIRL! ✨</p>
      </header>

      <div className="grid grid-cols-1 gap-6">
        {posts.length === 0 ? (
          <div className="text-center py-20 text-white/40">
            <LayoutGrid className="mx-auto mb-4 opacity-20" size={48} />
            <p className="font-display font-bold">No posts yet, babe!</p>
          </div>
        ) : (
          posts.map((post, i) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="group relative h-72 rounded-3xl overflow-hidden border border-white/10 shadow-2xl"
            >
              <img src={post.imageUrl} alt={post.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
              
              <div className="absolute bottom-5 left-5 right-5">
                <span className="text-[10px] font-bold text-cyber-lime uppercase tracking-widest mb-1 block">#{post.type}</span>
                <h3 className="text-white font-display font-bold text-xl leading-tight">{post.title}</h3>
                <div className="flex justify-between items-center mt-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center text-[10px]">👤</div>
                    <span className="text-white/80 text-xs font-medium">{post.authorName}</span>
                  </div>
                  <motion.button 
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleLike(post.id)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/10 hover:bg-white/20 transition-colors"
                  >
                    <Heart size={14} className={post.likes > 0 ? "fill-empowerment-pink text-empowerment-pink" : "text-white/60"} />
                    <span className="text-white text-[11px] font-bold">{post.likes}</span>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
