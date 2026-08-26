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

  // Automatic natural periodic blinking
  useEffect(() => {
    if (isPasswordFocused && !isPeeking) return;

    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 180);
    }, 3200 + Math.random() * 2500);

    return () => clearInterval(blinkInterval);
  }, [isPasswordFocused, isPeeking]);

  // Calculate eye tracking based on email input length
  const calculateTracking = () => {
    if (!isEmailFocused) return { pupilX: 0, pupilY: 0, headTilt: 0 };
    
    const normalizedLength = Math.min(Math.max(emailLength, 0), 28);
    const progress = normalizedLength / 28; // 0 to 1
    
    // Pupil tracks horizontally (-8px left to +8px right) and down towards input
    const pupilX = (progress - 0.5) * 16;
    const pupilY = 4;
    const headTilt = (progress - 0.5) * 4; // -2deg to +2deg
    
    return { pupilX, pupilY, headTilt };
  };

  const { pupilX, pupilY, headTilt } = calculateTracking();

  return (
    <div className="relative w-44 h-44 sm:w-48 sm:h-48 mx-auto flex items-center justify-center select-none pointer-events-none">
      {/* Ambient Status Glow Aura (100% transparent background maintained) */}
      <div 
        className={cn(
          "absolute inset-2 rounded-full blur-3xl transition-all duration-500 opacity-40",
          hasError ? "bg-rose-500/80 scale-110" :
          isSuccess ? "bg-emerald-500/80 scale-125" :
          isSubmitting ? "bg-cyan-500/70 animate-pulse" :
          isPasswordFocused ? "bg-indigo-500/50 scale-95" :
          "bg-sky-500/30"
        )} 
      />

      {/* Main Container with 3D Head Tilt & Bounce */}
      <div 
        className="relative w-full h-full flex items-center justify-center transition-transform duration-200 ease-out"
        style={{
          transform: `rotate(${isEmailFocused ? headTilt : 0}deg) scale(${isSuccess ? 1.05 : 1})`
        }}
      >
        {/* Layer 1: Authentic CCTV Robot Body (Clean Transparent PNG from Reference Artwork) */}
        <img 
          src="/cctv_robot_lens_empty.png" 
          alt="CCTV Robot Mascot" 
          className="w-full h-full object-contain drop-shadow-2xl"
        />

        {/* Layer 2: Dynamic Interactive Eye Lens (Positioned exactly over the Camera Lens Socket) */}
        <div 
          className="absolute"
          style={{
            top: '25.5%',
            left: '61.5%',
            width: '14.5%',
            height: '15.0%',
          }}
        >
          <svg viewBox="0 0 70 70" className="w-full h-full overflow-visible">
            <defs>
              <radialGradient id="irisBlueGrad" cx="38%" cy="32%" r="65%">
                <stop offset="0%" stopColor="#38f8ff" />
                <stop offset="40%" stopColor="#0ea5e9" />
                <stop offset="85%" stopColor="#0369a1" />
                <stop offset="100%" stopColor="#082f49" />
              </radialGradient>

              <filter id="laserBeamGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Lens Base Socket */}
            <circle cx="35" cy="35" r="33" fill="#0c1726" />

            {/* Dynamic Pupil + Iris with Cursor Tracking */}
            <g 
              style={{ 
                transform: `translate(${pupilX}px, ${pupilY}px)`,
                transition: 'transform 0.12s ease-out'
              }}
            >
              {/* Outer Iris */}
              <circle cx="35" cy="35" r="28" fill="url(#irisBlueGrad)" stroke="#0369a1" strokeWidth="2" />
              
              {/* Deep Pupil */}
              <circle cx="35" cy="35" r="16" fill="#07111e" />
              
              {/* Expressive Upper Arch Cut */}
              <path d="M 10 24 Q 35 14 60 26 Q 35 20 10 24 Z" fill="#07111e" />

              {/* Bold White Anime Catchlight Reflection */}
              <ellipse cx="28" cy="27" rx="7.5" ry="6.5" fill="#ffffff" />
              <circle cx="42" cy="41" r="3" fill="#ffffff" opacity="0.85" />
            </g>

            {/* Natural Eyelid Blink */}
            {isBlinking && !isPasswordFocused && (
              <g className="animate-in fade-in duration-75">
                <circle cx="35" cy="35" r="33" fill="#152233" />
                <path d="M 6 35 Q 35 48 64 35" stroke="#38bdf8" strokeWidth="4.5" strokeLinecap="round" fill="none" />
              </g>
            )}

            {/* Password Closed Eye (Shutter Shut / Tutup Mata) */}
            {isPasswordFocused && !isPeeking && (
              <g className="transition-all duration-200">
                <circle cx="35" cy="35" r="33" fill="#152233" />
                <path d="M 8 36 Q 35 52 62 36" stroke="#38bdf8" strokeWidth="5" strokeLinecap="round" fill="none" />
                {/* Mechanical shutter lines */}
                <path d="M 20 22 L 50 22" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
              </g>
            )}

            {/* Success State: Joyful Smile Eye ^_^ */}
            {isSuccess && (
              <g>
                <circle cx="35" cy="35" r="33" fill="#064e3b" opacity="0.4" />
                <path d="M 10 40 Q 35 16 60 40" stroke="#10b981" strokeWidth="5.5" strokeLinecap="round" fill="none" />
              </g>
            )}

            {/* Error State: Worried Alert Eye */}
            {hasError && (
              <g>
                <circle cx="35" cy="35" r="33" fill="#4c0519" opacity="0.5" />
                <path d="M 14 24 L 32 46 L 14 46" stroke="#f43f5e" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M 56 24 L 38 46 L 56 46" stroke="#f43f5e" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </g>
            )}

            {/* Submitting: Laser Scanner Beam Pulse */}
            {isSubmitting && (
              <line 
                x1="4" 
                y1="35" 
                x2="66" 
                y2="35" 
                stroke="#22d3ee" 
                strokeWidth="4" 
                strokeLinecap="round" 
                filter="url(#laserBeamGlow)" 
                className="animate-pulse"
              />
            )}
          </svg>
        </div>

        {/* Layer 3: Animated Robot Arms Covering Eye (Password Privacy Animation) */}
        <div 
          className={cn(
            "absolute inset-0 pointer-events-none transition-all duration-300 ease-out",
            isPasswordFocused && !isPeeking 
              ? "opacity-100 scale-100 translate-y-0" 
              : isPasswordFocused && isPeeking 
              ? "opacity-85 translate-x-3 translate-y-1 scale-95" /* Slightly slides aside when peeking */
              : "opacity-0 translate-y-6 scale-90"
          )}
        >
          <svg viewBox="0 0 476 459" className="w-full h-full overflow-visible drop-shadow-xl">
            <defs>
              <linearGradient id="robotArmLight" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="50%" stopColor="#cde0f7" />
                <stop offset="100%" stopColor="#7a9ec7" />
              </linearGradient>
              <linearGradient id="robotArmDark" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#5d81a8" />
                <stop offset="100%" stopColor="#1e2f47" />
              </linearGradient>
            </defs>

            {/* Left Robotic Hand Covering Left Side of Lens */}
            <g className="transition-transform duration-300 origin-[180px_260px]">
              {/* Forearm segment */}
              <path d="M 210 240 L 285 175 L 305 195 L 230 260 Z" fill="url(#robotArmLight)" stroke="#152233" strokeWidth="6" strokeLinejoin="round" />
              {/* Wrist Joint */}
              <circle cx="295" cy="185" r="14" fill="url(#robotArmDark)" stroke="#152233" strokeWidth="5" />
              {/* Left Robotic Clenched Hand */}
              <ellipse cx="310" cy="170" rx="22" ry="18" fill="url(#robotArmLight)" stroke="#152233" strokeWidth="6" />
              {/* Metallic Fingers */}
              <path d="M 298 160 Q 312 176 326 160" stroke="#152233" strokeWidth="4" fill="none" />
              <path d="M 302 172 Q 314 184 326 172" stroke="#152233" strokeWidth="4" fill="none" />
            </g>

            {/* Right Robotic Hand Covering Center & Right Side of Lens */}
            <g className="transition-transform duration-300 origin-[340px_240px]">
              {/* Forearm segment */}
              <path d="M 390 220 L 345 155 L 365 138 L 410 200 Z" fill="url(#robotArmLight)" stroke="#152233" strokeWidth="6" strokeLinejoin="round" />
              {/* Wrist Joint */}
              <circle cx="355" cy="148" r="15" fill="url(#robotArmDark)" stroke="#152233" strokeWidth="5" />
              {/* Right Hand Shield Palm covering lens */}
              <ellipse cx="340" cy="142" rx="24" ry="20" fill="url(#robotArmLight)" stroke="#152233" strokeWidth="6" />
              {/* Metallic Finger Plates */}
              <path d="M 326 134 Q 340 150 354 134" stroke="#152233" strokeWidth="4" fill="none" />
              <path d="M 328 146 Q 342 160 356 146" stroke="#152233" strokeWidth="4" fill="none" />
            </g>
          </svg>
        </div>

        {/* Layer 4: Alert Beacon Flash on Visor during Error */}
        {hasError && (
          <div className="absolute top-[8%] left-[46%] -translate-x-1/2">
            <div className="w-4 h-4 rounded-full bg-rose-500 animate-ping" />
            <div className="w-3 h-3 rounded-full bg-rose-600 border border-white absolute top-0.5 left-0.5" />
          </div>
        )}
      </div>
    </div>
  );
};


