import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedLoginMascotProps {
  isEmailFocused: boolean;
  isPasswordFocused: boolean;
  isPeeking: boolean;
  emailLength: number;
  isSubmitting?: boolean;
  isSuccess?: boolean;
  hasError?: boolean;
}

export const AnimatedLoginMascot: React.FC<AnimatedLoginMascotProps> = ({
  isEmailFocused,
  isPasswordFocused,
  isPeeking,
  emailLength,
  isSubmitting = false,
  isSuccess = false,
  hasError = false,
}) => {
  const [isBlinking, setIsBlinking] = useState(false);

  // Automatic natural blinking effect
  useEffect(() => {
    if (isPasswordFocused && !isPeeking) return;

    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 160);
    }, 3500 + Math.random() * 2000);

    return () => clearInterval(blinkInterval);
  }, [isPasswordFocused, isPeeking]);

  // Calculate eye pupil tracking based on email input length
  const calculateEyeOffset = () => {
    if (!isEmailFocused) return { x: 0, y: 0 };
    // Track from -7px (left) to +7px (right)
    const normalizedLength = Math.min(Math.max(emailLength, 0), 30);
    const x = ((normalizedLength / 30) - 0.5) * 14;
    const y = 3; // Look slightly downwards towards input
    return { x, y };
  };

  const { x: pupilX, y: pupilY } = calculateEyeOffset();

  return (
    <div className="relative w-36 h-32 mx-auto flex items-center justify-center select-none pointer-events-none">
      {/* Ambient Head Glow */}
      <div 
        className={cn(
          "absolute inset-0 rounded-full blur-xl transition-all duration-500 opacity-40",
          hasError ? "bg-rose-500/50 scale-110" :
          isSuccess ? "bg-emerald-500/60 scale-125" :
          isSubmitting ? "bg-sky-500/50 animate-pulse" :
          isPasswordFocused ? "bg-indigo-500/40" :
          "bg-teal-500/30"
        )} 
      />

      <svg
        viewBox="0 0 160 140"
        className="w-full h-full drop-shadow-xl overflow-visible transition-transform duration-300"
      >
        <defs>
          <linearGradient id="headGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          <linearGradient id="earGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0d9488" />
            <stop offset="100%" stopColor="#0f766e" />
          </linearGradient>
          <linearGradient id="pawGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* --- EARS --- */}
        {/* Left Ear */}
        <g className="transition-transform duration-300 origin-[35px_35px]">
          <circle cx="35" cy="35" r="22" fill="url(#headGrad)" stroke="#334155" strokeWidth="2" />
          <circle cx="35" cy="35" r="13" fill="url(#earGrad)" opacity="0.8" />
        </g>

        {/* Right Ear */}
        <g className="transition-transform duration-300 origin-[125px_35px]">
          <circle cx="125" cy="35" r="22" fill="url(#headGrad)" stroke="#334155" strokeWidth="2" />
          <circle cx="125" cy="35" r="13" fill="url(#earGrad)" opacity="0.8" />
        </g>

        {/* --- HEAD --- */}
        <circle 
          cx="80" 
          cy="75" 
          r="54" 
          fill="url(#headGrad)" 
          stroke={hasError ? "#f43f5e" : isSuccess ? "#10b981" : isPasswordFocused ? "#6366f1" : "#14b8a6"} 
          strokeWidth="2.5"
          className="transition-colors duration-300"
        />

        {/* Cyber Forehead Accent */}
        <path
          d="M 68 32 Q 80 28 92 32"
          stroke="#14b8a6"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.9"
        />

        {/* --- EYES & EYELIDS CONTAINER --- */}
        <g className="transition-all duration-300">
          {/* Left Eye Sclera (White) */}
          <ellipse cx="56" cy="68" rx="14" ry="16" fill="#f8fafc" />
          {/* Right Eye Sclera (White) */}
          <ellipse cx="104" cy="68" rx="14" ry="16" fill="#f8fafc" />

          {/* Left Pupil with tracking */}
          <g style={{ transform: `translate(${pupilX}px, ${pupilY}px)` }} className="transition-transform duration-100 ease-out">
            <circle cx="56" cy="68" r="8.5" fill="#0f172a" />
            <circle cx="56" cy="68" r="4.5" fill="#0d9488" />
            {/* Catchlight reflection */}
            <circle cx="53" cy="65" r="2.5" fill="#ffffff" />
            <circle cx="58" cy="71" r="1.2" fill="#ffffff" opacity="0.7" />
          </g>

          {/* Right Pupil with tracking */}
          <g style={{ transform: `translate(${pupilX}px, ${pupilY}px)` }} className="transition-transform duration-100 ease-out">
            <circle cx="104" cy="68" r="8.5" fill="#0f172a" />
            <circle cx="104" cy="68" r="4.5" fill="#0d9488" />
            {/* Catchlight reflection */}
            <circle cx="101" cy="65" r="2.5" fill="#ffffff" />
            <circle cx="106" cy="71" r="1.2" fill="#ffffff" opacity="0.7" />
          </g>

          {/* Natural Blink Eyelids */}
          {isBlinking && !isPasswordFocused && (
            <>
              <ellipse cx="56" cy="68" rx="15" ry="17" fill="#1e293b" />
              <path d="M 43 68 Q 56 73 69 68" stroke="#14b8a6" strokeWidth="2" fill="none" />
              <ellipse cx="104" cy="68" rx="15" ry="17" fill="#1e293b" />
              <path d="M 91 68 Q 104 73 117 68" stroke="#14b8a6" strokeWidth="2" fill="none" />
            </>
          )}

          {/* Glasses / Visor Frame (Futuristic Touch) */}
          <path
            d="M 40 68 C 40 52, 72 52, 72 68 C 72 84, 40 84, 40 68 Z M 72 68 L 88 68 M 88 68 C 88 52, 120 52, 120 68 C 120 84, 88 84, 88 68 Z"
            stroke="#14b8a6"
            strokeWidth="1.5"
            strokeOpacity="0.4"
            fill="none"
          />
        </g>

        {/* --- MUZZLE & NOSE & MOUTH --- */}
        <ellipse cx="80" cy="92" rx="20" ry="14" fill="#334155" opacity="0.9" />
        
        {/* Cute Cyber Nose */}
        <polygon points="75,86 85,86 80,93" fill="#14b8a6" />

        {/* Mouth */}
        {hasError ? (
          /* Oops / Wavy Mouth */
          <path d="M 72 100 Q 76 96 80 100 Q 84 104 88 100" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" fill="none" />
        ) : isSuccess ? (
          /* Big Happy Smile */
          <path d="M 70 97 Q 80 108 90 97" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        ) : isSubmitting ? (
          /* O-shape mouth (focus) */
          <circle cx="80" cy="99" r="3" fill="#38bdf8" />
        ) : (
          /* Gentle smile */
          <path d="M 73 97 Q 80 103 87 97" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" fill="none" />
        )}

        {/* Cheeks Glow when typing email or success */}
        {(isEmailFocused || isSuccess) && (
          <>
            <circle cx="44" cy="85" r="7" fill="#14b8a6" opacity="0.3" filter="url(#glow)" />
            <circle cx="116" cy="85" r="7" fill="#14b8a6" opacity="0.3" filter="url(#glow)" />
          </>
        )}

        {/* --- ANIMATED HANDS / PAWS (COVERING EYES ON PASSWORD) --- */}
        {/* Left Paw */}
        <g 
          className={cn(
            "transition-all duration-300 ease-out origin-[45px_130px]",
            isPasswordFocused && !isPeeking 
              ? "translate-y-0 opacity-100 rotate-[12deg]" 
              : isPasswordFocused && isPeeking 
              ? "translate-y-6 opacity-80 rotate-[35deg]" /* Lowers left hand for peek */
              : "translate-y-16 opacity-0 rotate-0"
          )}
        >
          <ellipse cx="54" cy="74" rx="17" ry="21" fill="url(#pawGrad)" stroke="#475569" strokeWidth="2" />
          {/* Paw pads */}
          <ellipse cx="54" cy="74" rx="7" ry="9" fill="#14b8a6" opacity="0.7" />
          <circle cx="45" cy="62" r="3" fill="#14b8a6" opacity="0.7" />
          <circle cx="53" cy="58" r="3.2" fill="#14b8a6" opacity="0.7" />
          <circle cx="62" cy="62" r="3" fill="#14b8a6" opacity="0.7" />
        </g>

        {/* Right Paw */}
        <g 
          className={cn(
            "transition-all duration-300 ease-out origin-[115px_130px]",
            isPasswordFocused 
              ? "translate-y-0 opacity-100 rotate-[-12deg]" 
              : "translate-y-16 opacity-0 rotate-0"
          )}
        >
          <ellipse cx="106" cy="74" rx="17" ry="21" fill="url(#pawGrad)" stroke="#475569" strokeWidth="2" />
          {/* Paw pads */}
          <ellipse cx="106" cy="74" rx="7" ry="9" fill="#14b8a6" opacity="0.7" />
          <circle cx="98" cy="62" r="3" fill="#14b8a6" opacity="0.7" />
          <circle cx="107" cy="58" r="3.2" fill="#14b8a6" opacity="0.7" />
          <circle cx="115" cy="62" r="3" fill="#14b8a6" opacity="0.7" />
        </g>
      </svg>
    </div>
  );
};
