import { useCreateSession, useDeleteSession, useSessions } from "@/hooks/use-game";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { PlayCircle, ShieldCheck, Trash2, ArrowUpRight } from "lucide-react";
import { useState } from "react";

export default function Home() {
  const [, setLocation] = useLocation();
  const { mutate: createSession, isPending } = useCreateSession();
  const { data: sessions, isLoading: isLoadingSessions } = useSessions();
  const { mutate: deleteSession, isPending: isDeleting } = useDeleteSession();

  const [name, setName] = useState("");
  const [initialBalance, setInitialBalance] = useState(100);
  const [unitValue, setUnitValue] = useState(5);

  const handleStart = () => {
    const trimmedName = name.trim();
    createSession({ name: trimmedName || undefined, initialBalance, unitValue }, {
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
          <div className="w-full sm:w-auto grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="text-left">
              <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Session name</label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Lucky Run"
                maxLength={60}
                className="h-12"
              />
            </div>
            <div className="text-left">
              <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Initial balance ($)</label>
              <Input
                type="number"
                min={0}
                value={initialBalance}
                onChange={(e) => setInitialBalance(Math.max(0, Number(e.target.value || 0)))}
                className="h-12"
              />
            </div>
            <div className="text-left">
              <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Unit size ($ / U)</label>
              <Input
                type="number"
                min={1}
                value={unitValue}
                onChange={(e) => setUnitValue(Math.max(1, Number(e.target.value || 1)))}
                className="h-12"
              />
            </div>
          </div>

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
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="text-left"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-bold text-white">Active Sessions</h2>
            {sessions && sessions.length > 0 && (
              <span className="text-xs text-muted-foreground font-mono">{sessions.length} total</span>
            )}
          </div>

          {isLoadingSessions ? (
            <div className="p-6 rounded-2xl border border-border/50 bg-secondary/20 text-muted-foreground text-sm">
              Loading sessions...
            </div>
          ) : (sessions && sessions.length > 0) ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="p-4 rounded-2xl border border-border/50 bg-secondary/30 hover:bg-secondary/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-lg font-display font-bold text-foreground">
                        {session.name || `Session #${session.id}`}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono mt-1">
                        #{session.id} • ${Number(session.unitValue ?? 5).toFixed(2)} / U
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (isDeleting) return;
                        const ok = window.confirm(`Delete ${session.name || `Session #${session.id}`}?`);
                        if (ok) deleteSession(session.id);
                      }}
                      className="p-2 rounded-lg border border-border/50 text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors"
                      aria-label={`Delete session ${session.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      Balance ${Number(session.initialBalance ?? 0).toFixed(2)}
                    </div>
                    <button
                      type="button"
                      onClick={() => setLocation(`/session/${session.id}`)}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80"
                    >
                      Resume
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 rounded-2xl border border-dashed border-border/50 bg-secondary/10 text-muted-foreground text-sm">
              No sessions yet. Create one to get started.
            </div>
          )}
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
