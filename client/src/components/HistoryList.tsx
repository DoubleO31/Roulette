import { type Spin } from "@shared/schema";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface HistoryListProps {
  spins: Spin[];
}

export function HistoryList({ spins }: HistoryListProps) {
  const getSpinColor = (result: string) => {
    if (["0", "00"].includes(result)) return "green";
    
    const num = parseInt(result, 10);
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    return redNumbers.includes(num) ? "red" : "black";
  };

  const colorStyles = {
    green: "bg-green-600 border-green-700 text-white",
    red: "bg-red-600 border-red-700 text-white",
    black: "bg-slate-800 border-slate-900 text-white",
  };

  // Show most recent first
  const reversedSpins = [...spins].sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());

  if (spins.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center border-2 border-dashed border-border/50 rounded-xl">
        <p className="text-sm font-medium">No spins yet</p>
        <p className="text-xs opacity-50 mt-1">History will appear here</p>
      </div>
    );
  }

  return (
    <div className="bg-secondary/30 rounded-xl border border-border/50 overflow-hidden h-full flex flex-col">
      <div className="p-4 border-b border-border/50 bg-secondary/50">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground font-display">
          Spin History
        </h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin">
        <AnimatePresence initial={false}>
          {reversedSpins.map((spin, index) => {
            const color = getSpinColor(spin.result);
            return (
              <motion.div
                key={spin.id}
                initial={{ opacity: 0, x: -20, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-3 p-2 rounded-lg bg-background/40 hover:bg-background/60 transition-colors border border-transparent hover:border-border/50 group"
              >
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center font-mono font-bold text-sm shadow-sm border-2",
                  colorStyles[color]
                )}>
                  {spin.result}
                </div>
                <div className="flex-1">
                  <span className="text-xs text-muted-foreground font-mono">
                    #{spins.length - index}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                  {new Date(spin.createdAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
