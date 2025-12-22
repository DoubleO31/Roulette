import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string | number;
  icon?: React.ReactNode;
  variant?: "default" | "primary" | "danger" | "success";
  className?: string;
}

export function StatCard({ label, value, subValue, icon, variant = "default", className }: StatCardProps) {
  const variants = {
    default: "bg-secondary border-border text-foreground",
    primary: "bg-primary/10 border-primary/20 text-primary",
    danger: "bg-destructive/10 border-destructive/20 text-destructive",
    success: "bg-green-500/10 border-green-500/20 text-green-400",
  };

  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl p-4 border shadow-sm transition-all hover:shadow-md",
      variants[variant],
      className
    )}>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider opacity-70 font-display">
            {label}
          </p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-bold tracking-tight font-mono">
              {value}
            </h3>
            {subValue && (
              <span className="text-sm opacity-60 font-mono">
                {subValue}
              </span>
            )}
          </div>
        </div>
        {icon && (
          <div className="opacity-20 transform scale-150">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
