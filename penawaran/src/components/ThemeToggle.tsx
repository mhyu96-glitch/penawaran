import React, { useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isPulling, setIsPulling] = useState(false);
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? (resolvedTheme === "dark" || theme === "dark") : true;

  const handleToggle = () => {
    setIsPulling(true);
    
    // Trigger spring pull action
    setTimeout(() => {
      setTheme(isDark ? "light" : "dark");
    }, 150);

    // Reset pulling animation state
    setTimeout(() => {
      setIsPulling(false);
    }, 550);
  };

  if (!mounted) {
    return (
      <div className={cn("h-10 w-10 rounded-2xl bg-muted/30 border border-border/80", className)} />
    );
  }

  return (
    <button
      onClick={handleToggle}
      type="button"
      className={cn(
        "group relative flex h-10 w-10 items-center justify-center rounded-2xl border border-border/80 bg-background/80 hover:bg-muted/60 transition-all duration-200 active:scale-95 shadow-xs select-none cursor-pointer overflow-hidden",
        isDark 
          ? "hover:border-amber-400/40 text-slate-400 hover:text-amber-300" 
          : "hover:border-amber-500/50 bg-amber-500/10 text-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.2)]",
        className
      )}
      title={isDark ? "Tarik lampu untuk Mode Terang" : "Tarik lampu untuk Mode Gelap"}
      aria-label="Tarik sakelar lampu untuk ganti tema"
    >
      {/* Glow Aura in Light Mode */}
      <div 
        className={cn(
          "pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-500",
          !isDark 
            ? "opacity-100 bg-radial from-amber-400/25 via-amber-400/10 to-transparent" 
            : "opacity-0"
        )} 
      />

      {/* Hanging Lamp & Pull Cord Interactive SVG */}
      <div
        className={cn(
          "relative flex items-center justify-center transition-transform duration-300",
          isPulling ? "translate-y-2 scale-95" : "translate-y-0 group-hover:-translate-y-0.5"
        )}
        style={{
          transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)"
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="overflow-visible"
        >
          {/* Top Hanging Wire */}
          <line
            x1="12"
            y1="0"
            x2="12"
            y2={isPulling ? "6" : "4"}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="transition-all duration-200 opacity-60"
          />

          {/* Lamp Socket / Base Cap */}
          <rect
            x="9.5"
            y={isPulling ? "5" : "3.5"}
            width="5"
            height="2.5"
            rx="1"
            fill="currentColor"
            className="transition-all duration-200 opacity-80"
          />

          {/* Light Bulb Glass Body */}
          <path
            d={
              isPulling
                ? "M12 7.5C9.2 7.5 7.5 9.5 7.5 12C7.5 13.8 8.8 15.2 9.5 16.5H14.5C15.2 15.2 16.5 13.8 16.5 12C16.5 9.5 14.8 7.5 12 7.5Z"
                : "M12 6C9.2 6 7.5 8 7.5 10.5C7.5 12.3 8.8 13.7 9.5 15H14.5C15.2 13.7 16.5 12.3 16.5 10.5C16.5 8 14.8 6 12 6Z"
            }
            fill={!isDark ? "#fef08a" : "transparent"}
            stroke={!isDark ? "#d97706" : "currentColor"}
            strokeWidth="1.5"
            strokeLinejoin="round"
            className={cn(
              "transition-all duration-300",
              !isDark
                ? "filter drop-shadow-[0_0_8px_rgba(251,191,36,0.9)] fill-amber-300 stroke-amber-500"
                : "fill-slate-800/40 stroke-slate-400"
            )}
          />

          {/* Internal Filament */}
          {!isDark ? (
            <path
              d={isPulling ? "M10.5 11.5L12 9.5L13.5 11.5" : "M10.5 10L12 8L13.5 10"}
              stroke="#b45309"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-pulse"
            />
          ) : (
            <path
              d={isPulling ? "M10.5 11.5L12 9.5L13.5 11.5" : "M10.5 10L12 8L13.5 10"}
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-40"
            />
          )}

          {/* Pull String Chain with Little Bead at the Right Side */}
          <g className={cn("transition-all duration-200 origin-top", isPulling ? "translate-y-1" : "")}>
            <line
              x1="17.5"
              y1={isPulling ? "11" : "9"}
              x2="17.5"
              y2={isPulling ? "21" : "18"}
              stroke={!isDark ? "#d97706" : "currentColor"}
              strokeWidth="1"
              strokeDasharray="1.5 1.5"
              className="opacity-70"
            />
            {/* Pull Bead Handle */}
            <circle
              cx="17.5"
              cy={isPulling ? "21.5" : "18.5"}
              r={isPulling ? "2" : "1.75"}
              fill={!isDark ? "#f59e0b" : "currentColor"}
              stroke={!isDark ? "#b45309" : "none"}
              strokeWidth="0.5"
              className={cn(
                "transition-all duration-200",
                !isDark ? "drop-shadow-[0_0_4px_rgba(245,158,11,0.8)]" : "opacity-80"
              )}
            />
          </g>

          {/* Radiating Light Sparkles / Rays (Active in Light Mode) */}
          {!isDark && (
            <g className="text-amber-500 animate-in fade-in zoom-in duration-300">
              <line x1="5" y1="10.5" x2="3" y2="10.5" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="19" y1="10.5" x2="21" y2="10.5" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="6.5" y1="5.5" x2="4.5" y2="3.5" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="17.5" y1="5.5" x2="19.5" y2="3.5" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
            </g>
          )}

          {/* Soft Moon Crescent (Subtle in Dark Mode) */}
          {isDark && (
            <path
              d="M12 11.5A2.5 2.5 0 0 0 13.8 9 2.5 2.5 0 1 1 12 11.5Z"
              fill="currentColor"
              className="opacity-30"
            />
          )}
        </svg>
      </div>
    </button>
  );
}

export default ThemeToggle;