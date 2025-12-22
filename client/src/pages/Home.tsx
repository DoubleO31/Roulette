import { useCreateSession } from "@/hooks/use-game";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { PlayCircle, ShieldCheck, TrendingUp } from "lucide-react";

export default function Home() {
  const [, setLocation] = useLocation();
  const { mutate: createSession, isPending } = useCreateSession();

  const handleStart = () => {
    createSession(undefined, {
      onSuccess: (session) => {
        setLocation(`/session/${session.id}`);
      },
    });
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-4">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-2xl w-full relative z-10 text-center space-y-12">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-4"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-amber-600 shadow-lg shadow-primary/20 mb-6">
             <ShieldCheck className="w-10 h-10 text-primary-foreground" />
          </div>
          
          <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight text-white mb-4">
            ROULETTE <span className="text-primary text-shadow-glow">PLAN</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Professional session management and strategy tracking. 
            Visualize your anchor bets, mix plays, and party modes in real-time.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <button
            onClick={handleStart}
            disabled={isPending}
            className="group relative px-8 py-5 rounded-xl bg-gradient-to-r from-primary to-amber-500 text-primary-foreground font-bold text-lg shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-1 transition-all duration-300 disabled:opacity-70 disabled:hover:translate-y-0 disabled:cursor-not-allowed w-full sm:w-auto overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 rounded-xl" />
            <div className="relative flex items-center justify-center gap-3">
              {isPending ? (
                <>Creating Session...</>
              ) : (
                <>
                  <PlayCircle className="w-6 h-6" />
                  START NEW SESSION
                </>
              )}
            </div>
          </button>
        </motion.div>

        <motion.div 
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           transition={{ delay: 0.5, duration: 1 }}
           className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12 border-t border-white/5"
        >
           <div className="space-y-2">
              <h3 className="text-white font-bold font-display">Unit Tracking</h3>
              <p className="text-sm text-muted-foreground">Real-time P/L calculation in both currency and units.</p>
           </div>
           <div className="space-y-2">
              <h3 className="text-white font-bold font-display">Strategy Engine</h3>
              <p className="text-sm text-muted-foreground">Automated detection of Anchor, Mix, and Party bet opportunities.</p>
           </div>
           <div className="space-y-2">
              <h3 className="text-white font-bold font-display">History Analysis</h3>
              <p className="text-sm text-muted-foreground">Visual history log with color-coded results.</p>
           </div>
        </motion.div>
      </div>
    </div>
  );
}
