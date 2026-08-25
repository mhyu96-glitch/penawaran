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
      setTimeout(() => setIsBlinking(false), 180);
    }, 3200 + Math.random() * 2000);

    return () => clearInterval(blinkInterval);
  }, [isPasswordFocused, isPeeking]);

  // Calculate eye pupil tracking based on email input length
  const calculateTracking = () => {
    if (!isEmailFocused) return { pupilX: 0, pupilY: 0, headTilt: 0 };
    // Track from -8px (left) to +8px (right)
    const normalizedLength = Math.min(Math.max(emailLength, 0), 28);
    const pupilX = ((normalizedLength / 28) - 0.5) * 12;
    const pupilY = 3.5; // Look downwards towards input
    const headTilt = ((normalizedLength / 28) - 0.5) * 6; // Subtle 3D head tilt
    return { pupilX, pupilY, headTilt };
  };

  const { pupilX, pupilY, headTilt } = calculateTracking();

  return (
    <div className="relative w-36 h-32 mx-auto flex items-center justify-center select-none pointer-events-none">
      {/* Ambient Glow Aura */}
      <div 
        className={cn(
          "absolute inset-0 rounded-full blur-2xl transition-all duration-500 opacity-50",
          hasError ? "bg-rose-500/60 scale-110" :
          isSuccess ? "bg-emerald-500/70 scale-125" :
          isSubmitting ? "bg-teal-500/60 animate-pulse" :
          isPasswordFocused ? "bg-indigo-500/50" :
          "bg-teal-500/40"
        )} 
      />

      <svg
        viewBox="0 0 160 140"
        style={{ transform: `rotate(${isEmailFocused ? headTilt : 0}deg)` }}
        className="w-full h-full drop-shadow-2xl overflow-visible transition-transform duration-200 ease-out"
      >
        <defs>
          {/* Gradients */}
          <linearGradient id="pandaFaceGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>

          <linearGradient id="pandaDarkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>

          <linearGradient id="irisGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0d9488" />
            <stop offset="100%" stopColor="#042f2e" />
          </linearGradient>

          <linearGradient id="blushGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#fb7185" />
          </linearGradient>

          <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* --- EARS --- */}
        {/* Left Ear */}
        <g className="transition-transform duration-300 origin-[34px_34px]">
          <circle cx="34" cy="34" r="21" fill="url(#pandaDarkGrad)" stroke="#334155" strokeWidth="2" />
          <circle cx="34" cy="34" r="12" fill="#0d9488" opacity="0.35" />
          <circle cx="34" cy="34" r="7" fill="#14b8a6" opacity="0.2" />
        </g>

        {/* Right Ear */}
        <g className="transition-transform duration-300 origin-[126px_34px]">
          <circle cx="126" cy="34" r="21" fill="url(#pandaDarkGrad)" stroke="#334155" strokeWidth="2" />
          <circle cx="126" cy="34" r="12" fill="#0d9488" opacity="0.35" />
          <circle cx="126" cy="34" r="7" fill="#14b8a6" opacity="0.2" />
        </g>

        {/* --- MAIN HEAD / FACE (Cute Rounded Fluffy Panda) --- */}
        <circle 
          cx="80" 
          cy="74" 
          r="53" 
          fill="url(#pandaFaceGrad)" 
          stroke={hasError ? "#f43f5e" : isSuccess ? "#10b981" : isPasswordFocused ? "#6366f1" : "#14b8a6"} 
          strokeWidth="3"
          className="transition-colors duration-300"
        />

        {/* --- PANDA EYE PATCHES (Black curved patches around eyes) --- */}
        {/* Left Eye Patch */}
        <ellipse 
          cx="54" 
          cy="68" 
          rx="18" 
          ry="22" 
          fill="url(#pandaDarkGrad)" 
          transform="rotate(-14 54 68)"
        />
        {/* Right Eye Patch */}
        <ellipse 
          cx="106" 
          cy="68" 
          rx="18" 
          ry="22" 
          fill="url(#pandaDarkGrad)" 
          transform="rotate(14 106 68)"
        />

        {/* --- EYEBROWS (Expressive) --- */}
        {hasError ? (
          /* Worried Eyebrows */
          <>
            <path d="M 44 48 Q 54 53 64 51" stroke="#475569" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M 96 51 Q 106 53 116 48" stroke="#475569" strokeWidth="3" strokeLinecap="round" fill="none" />
          </>
        ) : isSuccess ? (
          /* Cheerful Raised Eyebrows */
          <>
            <path d="M 44 45 Q 54 41 64 45" stroke="#10b981" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M 96 45 Q 106 41 116 45" stroke="#10b981" strokeWidth="3" strokeLinecap="round" fill="none" />
          </>
        ) : (
          /* Normal Cute Eyebrows */
          <>
            <path d="M 45 47 Q 54 44 63 47" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M 97 47 Q 106 44 115 47" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </>
        )}

        {/* --- EYES & PUPILS --- */}
        {/* Left Eye White */}
        <ellipse cx="55" cy="69" rx="12" ry="14" fill="#ffffff" />
        {/* Right Eye White */}
        <ellipse cx="105" cy="69" rx="12" ry="14" fill="#ffffff" />

        {/* Left Pupil + Iris with dynamic tracking */}
        <g style={{ transform: `translate(${pupilX}px, ${pupilY}px)` }} className="transition-transform duration-100 ease-out">
          {/* Iris */}
          <ellipse cx="55" cy="69" rx="8" ry="10" fill="url(#irisGrad)" />
          {/* Deep Pupil */}
          <circle cx="55" cy="69" r="5.5" fill="#0f172a" />
          {/* Anime Sparkle Catchlights */}
          <circle cx="52.5" cy="65.5" r="3" fill="#ffffff" />
          <circle cx="57" cy="72" r="1.5" fill="#ffffff" opacity="0.8" />
        </g>

        {/* Right Pupil + Iris with dynamic tracking */}
        <g style={{ transform: `translate(${pupilX}px, ${pupilY}px)` }} className="transition-transform duration-100 ease-out">
          {/* Iris */}
          <ellipse cx="105" cy="69" rx="8" ry="10" fill="url(#irisGrad)" />
          {/* Deep Pupil */}
          <circle cx="105" cy="69" r="5.5" fill="#0f172a" />
          {/* Anime Sparkle Catchlights */}
          <circle cx="102.5" cy="65.5" r="3" fill="#ffffff" />
          <circle cx="107" cy="72" r="1.5" fill="#ffffff" opacity="0.8" />
        </g>

        {/* Natural Eyelid Blink */}
        {isBlinking && !isPasswordFocused && (
          <>
            <ellipse cx="55" cy="69" rx="13" ry="15" fill="#1e293b" />
            <path d="M 43 69 Q 55 75 67 69" stroke="#14b8a6" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <ellipse cx="105" cy="69" rx="13" ry="15" fill="#1e293b" />
            <path d="M 93 69 Q 105 75 117 69" stroke="#14b8a6" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </>
        )}

        {/* --- CUTE NOSE & MUZZLE --- */}
        <ellipse cx="80" cy="91" rx="15" ry="10" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
        
        {/* Shiny Black Heart/Triangle Nose */}
        <path d="M 74 86 Q 80 84 86 86 Q 83 93 80 94 Q 77 93 74 86 Z" fill="#0f172a" />
        <ellipse cx="78" cy="87" rx="1.5" ry="0.8" fill="#ffffff" opacity="0.6" />

        {/* Mouth */}
        {hasError ? (
          /* Oops / Wavy Cute Mouth */
          <path d="M 73 100 Q 77 96 80 100 Q 83 104 87 100" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        ) : isSuccess ? (
          /* Joyful Open Mouth */
          <g>
            <path d="M 72 98 Q 80 110 88 98 Z" fill="#f43f5e" />
            <path d="M 72 98 Q 80 110 88 98" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </g>
        ) : isSubmitting ? (
          /* Concentrated 'o' Mouth */
          <circle cx="80" cy="100" r="3.5" fill="#0d9488" stroke="#0f172a" strokeWidth="2" />
        ) : (
          /* Classic Kawaii 'w' Smile */
          <path d="M 73 97 Q 77 102 80 98 Q 83 102 87 97" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        )}

        {/* --- BLUSHING CHEEKS --- */}
        <ellipse cx="40" cy="86" rx="9" ry="5.5" fill="url(#blushGrad)" opacity={isEmailFocused || isSuccess ? "0.6" : "0.35"} />
        <ellipse cx="120" cy="86" rx="9" ry="5.5" fill="url(#blushGrad)" opacity={isEmailFocused || isSuccess ? "0.6" : "0.35"} />

        {/* --- ANIMATED HANDS / PAWS (COVERING EYES ON PASSWORD) --- */}
        {/* Left Paw */}
        <g 
          className={cn(
            "transition-all duration-300 ease-out origin-[45px_135px]",
            isPasswordFocused && !isPeeking 
              ? "translate-y-0 opacity-100 rotate-[12deg]" 
              : isPasswordFocused && isPeeking 
              ? "translate-y-9 opacity-85 rotate-[40deg]" /* Lowers left hand for peek */
              : "translate-y-16 opacity-0 rotate-0"
          )}
        >
          <ellipse cx="54" cy="74" rx="18" ry="22" fill="url(#pandaDarkGrad)" stroke="#334155" strokeWidth="2.5" />
          {/* Soft Pink Paw Pads */}
          <ellipse cx="54" cy="76" rx="8" ry="10" fill="#14b8a6" opacity="0.8" />
          <circle cx="44" cy="62" r="3.5" fill="#14b8a6" opacity="0.8" />
          <circle cx="53" cy="57" r="3.8" fill="#14b8a6" opacity="0.8" />
          <circle cx="63" cy="62" r="3.5" fill="#14b8a6" opacity="0.8" />
        </g>

        {/* Right Paw */}
        <g 
          className={cn(
            "transition-all duration-300 ease-out origin-[115px_135px]",
            isPasswordFocused 
              ? "translate-y-0 opacity-100 rotate-[-12deg]" 
              : "translate-y-16 opacity-0 rotate-0"
          )}
        >
          <ellipse cx="106" cy="74" rx="18" ry="22" fill="url(#pandaDarkGrad)" stroke="#334155" strokeWidth="2.5" />
          {/* Soft Pink Paw Pads */}
          <ellipse cx="106" cy="76" rx="8" ry="10" fill="#14b8a6" opacity="0.8" />
          <circle cx="97" cy="62" r="3.5" fill="#14b8a6" opacity="0.8" />
          <circle cx="107" cy="57" r="3.8" fill="#14b8a6" opacity="0.8" />
          <circle cx="116" cy="62" r="3.5" fill="#14b8a6" opacity="0.8" />
        </g>
      </svg>
    </div>
  );
};
