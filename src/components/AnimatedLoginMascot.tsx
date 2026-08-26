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
    
    // Pupil tracks horizontally (-7px left to +7px right) and down towards input
    const pupilX = (progress - 0.5) * 14;
    const pupilY = 3.5;
    const headTilt = (progress - 0.5) * 4; // -2deg to +2deg
    
    return { pupilX, pupilY, headTilt };
  };

  const { pupilX, pupilY, headTilt } = calculateTracking();

  return (
    <div className="relative w-40 h-40 sm:w-44 sm:h-44 mx-auto flex items-center justify-center select-none pointer-events-none">
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
          transform: `rotate(${isEmailFocused ? headTilt : isPasswordFocused && !isPeeking ? -2 : 0}deg) scale(${isSuccess ? 1.05 : 1})`
        }}
      >
        {/* Layer 1: Authentic CCTV Robot Body (Clean Transparent Artwork) */}
        <img 
          src="/cctv_robot_lens_empty.png" 
          alt="CCTV Robot Mascot" 
          className="w-full h-full object-contain drop-shadow-2xl"
        />

        {/* Layer 2: Dynamic Interactive Eye Lens & Camera Shutter */}
        <div 
          className="absolute"
          style={{
            top: '25.0%',
            left: '61.3%',
            width: '14.7%',
            height: '15.2%',
          }}
        >
          <svg viewBox="0 0 70 70" className="w-full h-full overflow-visible">
            <defs>
              {/* Iris Gradient */}
              <radialGradient id="cctvIrisGrad" cx="38%" cy="32%" r="65%">
                <stop offset="0%" stopColor="#38f8ff" />
                <stop offset="40%" stopColor="#0ea5e9" />
                <stop offset="85%" stopColor="#0369a1" />
                <stop offset="100%" stopColor="#082f49" />
              </radialGradient>

              {/* Shutter Blade Metallic Gradient */}
              <linearGradient id="shutterBladeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2a3f5f" />
                <stop offset="50%" stopColor="#152438" />
                <stop offset="100%" stopColor="#0a121e" />
              </linearGradient>

              {/* Laser Glow Filter */}
              <filter id="cctvLaserGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Lens Base Socket Rim */}
            <circle cx="35" cy="35" r="33" fill="#091321" />

            {/* --- A. Normal / Email Tracking Eye State --- */}
            {(!isPasswordFocused || isPeeking) && !isBlinking && !hasError && !isSuccess && (
              <g 
                style={{ 
                  transform: `translate(${pupilX}px, ${pupilY}px)`,
                  transition: 'transform 0.12s ease-out'
                }}
              >
                {/* Outer Iris */}
                <circle cx="35" cy="35" r="28" fill="url(#cctvIrisGrad)" stroke="#0369a1" strokeWidth="2" />
                
                {/* Deep Pupil */}
                <circle cx="35" cy="35" r="16" fill="#07111e" />
                
                {/* Determined Upper Eyelid Curve (Matches Original Artwork) */}
                <path d="M 9 23 Q 35 13 61 25 Q 35 19 9 23 Z" fill="#07111e" />

                {/* Bold White Reflection Highlights */}
                <ellipse cx="28" cy="27" rx="7.5" ry="6.5" fill="#ffffff" />
                <circle cx="43" cy="42" r="3" fill="#ffffff" opacity="0.85" />
              </g>
            )}

            {/* --- B. Password Peeking Mode (Slit Shutter with Curious Eye) --- */}
            {isPasswordFocused && isPeeking && (
              <g className="transition-all duration-300">
                {/* Top Shutter Half */}
                <path d="M 2 35 C 2 17, 17 2, 35 2 C 53 2, 68 17, 68 35 L 68 28 L 2 28 Z" fill="url(#shutterBladeGrad)" stroke="#38bdf8" strokeWidth="1" />
                {/* Bottom Shutter Half */}
                <path d="M 2 35 C 2 53, 17 68, 35 68 C 53 68, 68 53, 68 35 L 68 42 L 2 42 Z" fill="url(#shutterBladeGrad)" stroke="#38bdf8" strokeWidth="1" />
                {/* Peeking Eye Slit Sparkle */}
                <ellipse cx="35" cy="35" rx="5" ry="4" fill="#38f8ff" className="animate-ping" opacity="0.75" />
                <circle cx="35" cy="35" r="3.5" fill="#ffffff" />
              </g>
            )}

            {/* --- C. Password Closed Eye / Tutup Mata (Mechanical Shutter Shut) --- */}
            {isPasswordFocused && !isPeeking && (
              <g className="transition-all duration-300">
                {/* Full Shutter Aperture Cover */}
                <circle cx="35" cy="35" r="33" fill="url(#shutterBladeGrad)" stroke="#1e2f47" strokeWidth="2" />
                {/* Shutter Blade Segment Lines */}
                <path d="M 35 2 L 35 68" stroke="#1e2f47" strokeWidth="2" opacity="0.6" />
                <path d="M 2 35 L 68 35" stroke="#1e2f47" strokeWidth="2" opacity="0.6" />
                <circle cx="35" cy="35" r="18" fill="none" stroke="#1e2f47" strokeWidth="2" opacity="0.6" />
                
                {/* Cute Glowing Closed-Eye Smile (◠) */}
                <path 
                  d="M 12 36 Q 35 54 58 36" 
                  stroke="#38bdf8" 
                  strokeWidth="5" 
                  strokeLinecap="round" 
                  fill="none" 
                />
                {/* Cute Privacy Eyelash accents */}
                <path d="M 20 46 L 16 52" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
                <path d="M 35 48 L 35 55" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
                <path d="M 50 46 L 54 52" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
              </g>
            )}

            {/* --- D. Natural Eyelid Blink --- */}
            {isBlinking && !isPasswordFocused && (
              <g className="animate-in fade-in duration-75">
                <circle cx="35" cy="35" r="33" fill="#152438" />
                <path d="M 6 35 Q 35 48 64 35" stroke="#38bdf8" strokeWidth="4.5" strokeLinecap="round" fill="none" />
              </g>
            )}

            {/* --- E. Success State: Joyful Smile Eye ^_^ --- */}
            {isSuccess && (
              <g>
                <circle cx="35" cy="35" r="33" fill="#064e3b" opacity="0.4" />
                <path d="M 10 40 Q 35 16 60 40" stroke="#10b981" strokeWidth="5.5" strokeLinecap="round" fill="none" />
              </g>
            )}

            {/* --- F. Error State: Worried Alert Eye --- */}
            {hasError && (
              <g>
                <circle cx="35" cy="35" r="33" fill="#4c0519" opacity="0.5" />
                <path d="M 14 24 L 32 46 L 14 46" stroke="#f43f5e" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M 56 24 L 38 46 L 56 46" stroke="#f43f5e" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </g>
            )}

            {/* --- G. Submitting: Laser Scanner Beam Pulse --- */}
            {isSubmitting && (
              <line 
                x1="4" 
                y1="35" 
                x2="66" 
                y2="35" 
                stroke="#22d3ee" 
                strokeWidth="4" 
                strokeLinecap="round" 
                filter="url(#cctvLaserGlow)" 
                className="animate-pulse"
              />
            )}
          </svg>
        </div>

        {/* Layer 3: Alert Beacon Flash on Visor during Error */}
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


