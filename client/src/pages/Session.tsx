import { useEffect, useRef } from "react";
import { useParams, Link } from "wouter";
import { useSession, useAddSpin } from "@/hooks/use-game";
import { Keypad } from "@/components/Keypad";
import { StatCard } from "@/components/StatCard";
import { BetCard } from "@/components/BetCard";
import { HistoryList } from "@/components/HistoryList";
import { Loader2, AlertCircle, DollarSign, LayoutGrid, Layers, Home } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

export default function Session() {
  const { id } = useParams<{ id: string }>();
  const sessionId = parseInt(id || "", 10);
  const { data: gameState, isLoading, error } = useSession(sessionId);
  const { mutate: addSpin, isPending: isSpinning } = useAddSpin();
  const { toast } = useToast();
  
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to input when needed
  useEffect(() => {
    if (!isSpinning && gameState) {
       // Optional: auto-scroll logic
    }
  }, [isSpinning, gameState]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-primary">
        <Loader2 className="w-12 h-12 animate-spin mb-4 opacity-80" />
        <h2 className="text-xl font-display font-bold tracking-widest animate-pulse">LOADING SESSION...</h2>
      </div>
    );
  }

  if (error || !gameState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
        <div className="bg-destructive/10 p-6 rounded-2xl border border-destructive/20 max-w-md w-full">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-destructive mb-2">Error Loading Session</h2>
          <p className="text-muted-foreground mb-6">{(error as Error)?.message || "Session not found"}</p>
          <Link href="/" className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-secondary text-secondary-foreground font-medium hover:bg-secondary/80 transition-colors">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  const handleSpinInput = (result: string) => {
    addSpin(
      { sessionId, result },
      {
        onSuccess: (newData) => {
          toast({
            title: `Result: ${result}`,
            description: "Balance updated successfully.",
            variant: "default",
          });
        },
        onError: (err) => {
          toast({
            title: "Error",
            description: err.message,
            variant: "destructive",
          });
        }
      }
    );
  };

  const nextBets = gameState.nextBets || [];
  const anchorBets = nextBets.filter(b => b.type === "anchor");
  const mixBets = nextBets.filter(b => b.type === "mix");
  const partyBets = nextBets.filter(b => b.type === "party");

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Bar */}
      <header className="bg-secondary/50 backdrop-blur-md border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground">
              <Home className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-display font-bold text-primary tracking-tight hidden sm:block">
              {gameState.sessionName || "ROULETTE PLAN"}
            </h1>
          </div>
          
          <div className="flex items-center gap-6">
             <div className="text-right hidden sm:block">
               <span className="text-[10px] uppercase text-muted-foreground block font-bold tracking-widest">Session ID</span>
               <span className="font-mono text-sm text-foreground">#{sessionId}</span>
             </div>
             <div className="text-right hidden sm:block">
               <span className="text-[10px] uppercase text-muted-foreground block font-bold tracking-widest">Unit</span>
               <span className="font-mono text-sm text-foreground">${Number(gameState.unitValue ?? 5).toFixed(2)} / U</span>
             </div>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full p-4 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard 
              label="Balance ($)" 
              value={`$${Number(gameState.currentBalance).toFixed(2)}`} 
              icon={<DollarSign className="w-6 h-6" />}
              variant={gameState.currentBalance >= 0 ? "success" : "danger"}
            />
            <StatCard 
              label="Balance (Units)" 
              value={gameState.currentBalanceUnits} 
              icon={<Layers className="w-6 h-6" />}
              variant={gameState.currentBalanceUnits >= 0 ? "primary" : "default"}
            />
            <StatCard 
              label="Unit ($/U)" 
              value={gameState.unitValue} 
            />
            <StatCard 
              label="Block" 
              value={gameState.currentBlock} 
              icon={<LayoutGrid className="w-6 h-6" />}
            />
            <StatCard 
              label="Total Spins" 
              value={gameState.totalSpins} 
            />
          </div>

          {/* Next Bets Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
                <span className="w-2 h-8 bg-primary rounded-sm inline-block"></span>
                NEXT BETS
              </h2>
              {gameState.isPartyMode && (
                <span className="px-3 py-1 bg-amber-500/20 text-amber-500 border border-amber-500/50 rounded-full text-xs font-bold uppercase animate-pulse">
                  Party Mode Active
                </span>
              )}
            </div>

            {nextBets.length === 0 ? (
              <div className="p-12 rounded-2xl border-2 border-dashed border-border/50 bg-secondary/10 text-center flex flex-col items-center justify-center">
                <p className="text-lg font-medium text-muted-foreground mb-1">No active bets</p>
                <p className="text-sm text-muted-foreground/60">Waiting for next spin result to calculate strategy.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Render Anchors First */}
                {anchorBets.map((bet, i) => (
                   <BetCard key={`anchor-${i}`} bet={bet} />
                ))}
                {/* Then Mix */}
                {mixBets.map((bet, i) => (
                   <BetCard key={`mix-${i}`} bet={bet} />
                ))}
                {/* Then Party */}
                {partyBets.map((bet, i) => (
                   <BetCard key={`party-${i}`} bet={bet} />
                ))}
              </div>
            )}
          </section>

          {/* Input Area */}
          <section className="pt-4" ref={bottomRef}>
            <div className="bg-gradient-to-br from-secondary/80 to-secondary/40 p-6 rounded-2xl border border-border shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
              
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-lg font-bold text-foreground font-display">ENTER SPIN RESULT</h3>
                {isSpinning && (
                  <span className="text-xs text-primary animate-pulse font-mono">PROCESSING...</span>
                )}
              </div>
              
              <Keypad onInput={handleSpinInput} disabled={isSpinning} />
            </div>
          </section>
        </div>

        {/* Sidebar History */}
        <aside className="lg:col-span-1 h-[600px] lg:h-auto lg:sticky lg:top-24">
          <HistoryList spins={gameState.history} />
        </aside>
      </div>
    </div>
  );
}
