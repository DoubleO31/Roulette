import { type Bet } from "@shared/schema";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface BetCardProps {
  bet: Bet;
}

export function BetCard({ bet }: BetCardProps) {
  const typeColors = {
    anchor: "border-l-blue-500 bg-blue-500/5",
    mix: "border-l-purple-500 bg-purple-500/5",
    party: "border-l-amber-500 bg-amber-500/5",
  };

  const badgeColors = {
    anchor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    mix: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    party: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "relative group p-5 rounded-xl border border-border/50 bg-secondary/30 backdrop-blur-sm shadow-lg",
        "hover:bg-secondary/50 hover:border-border transition-all duration-300",
        "border-l-4",
        typeColors[bet.type]
      )}
    >
      <div className="flex justify-between items-start mb-3">
        <span className={cn(
          "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border",
          badgeColors[bet.type]
        )}>
          {bet.type}
        </span>
        <div className="text-right">
          <div className="text-2xl font-bold font-mono text-foreground tabular-nums">
            {bet.amountUnits} <span className="text-xs text-muted-foreground font-sans font-normal">UNITS</span>
          </div>
        </div>
      </div>
      
      <h3 className="text-xl font-bold text-foreground mb-1 font-display group-hover:text-primary transition-colors">
        {bet.name}
      </h3>
      
      <p className="text-sm text-muted-foreground leading-relaxed">
        {bet.description}
      </p>
    </motion.div>
  );
}
