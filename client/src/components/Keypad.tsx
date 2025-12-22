import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface KeypadProps {
  onInput: (value: string) => void;
  disabled?: boolean;
}

export function Keypad({ onInput, disabled }: KeypadProps) {
  const numbers = [
    { label: "1", color: "red" }, { label: "2", color: "black" }, { label: "3", color: "red" },
    { label: "4", color: "black" }, { label: "5", color: "red" }, { label: "6", color: "black" },
    { label: "7", color: "red" }, { label: "8", color: "black" }, { label: "9", color: "red" },
    { label: "10", color: "black" }, { label: "11", color: "black" }, { label: "12", color: "red" },
    { label: "13", color: "black" }, { label: "14", color: "red" }, { label: "15", color: "black" },
    { label: "16", color: "red" }, { label: "17", color: "black" }, { label: "18", color: "red" },
    { label: "19", color: "red" }, { label: "20", color: "black" }, { label: "21", color: "red" },
    { label: "22", color: "black" }, { label: "23", color: "red" }, { label: "24", color: "black" },
    { label: "25", color: "red" }, { label: "26", color: "black" }, { label: "27", color: "red" },
    { label: "28", color: "black" }, { label: "29", color: "black" }, { label: "30", color: "red" },
    { label: "31", color: "black" }, { label: "32", color: "red" }, { label: "33", color: "black" },
    { label: "34", color: "red" }, { label: "35", color: "black" }, { label: "36", color: "red" },
  ];

  // Helper to get color class
  const getColorClass = (color: string) => {
    if (color === 'red') return "bg-red-600 border-red-700 hover:bg-red-500 text-white";
    if (color === 'black') return "bg-slate-800 border-slate-900 hover:bg-slate-700 text-white";
    return "bg-green-600 border-green-700 hover:bg-green-500 text-white";
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 bg-secondary/50 rounded-2xl border border-border shadow-xl backdrop-blur-sm">
      <div className="flex gap-2 mb-2">
         {/* Zeroes */}
         <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onInput("0")}
          disabled={disabled}
          className={cn(
            "flex-1 h-14 rounded-lg font-mono text-xl font-bold shadow-md border-b-4 transition-all",
            getColorClass("green"),
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          0
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onInput("00")}
          disabled={disabled}
          className={cn(
            "flex-1 h-14 rounded-lg font-mono text-xl font-bold shadow-md border-b-4 transition-all",
            getColorClass("green"),
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          00
        </motion.button>
      </div>
      
      <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-12 gap-2">
        {numbers.map((num) => (
          <motion.button
            key={num.label}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onInput(num.label)}
            disabled={disabled}
            className={cn(
              "h-12 sm:h-14 rounded-lg font-mono text-lg font-bold shadow-md border-b-4 transition-all",
              getColorClass(num.color),
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {num.label}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
