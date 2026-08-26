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
    }, 3200 + Math.random() * 2400);

    return () => clearInterval(blinkInterval);
  }, [isPasswordFocused, isPeeking]);

  // Calculate realistic eye tracking based on email input character length
  const calculateTracking = () => {
    if (!isEmailFocused) return { pupilX: 0, pupilY: 0, headTilt: 0, headPanX: 0, headPanY: 0 };
    
    // Normalize character count (0 to 30)
    const normalizedLength = Math.min(Math.max(emailLength, 0), 30);
    const progress = normalizedLength / 30; // 0 to 1
    
    // Pupil tracks horizontally and glances downward toward input
    const pupilX = (progress - 0.5) * 14; // -7px (left) to +7px (right)
    const pupilY = 4; // looking down at input
    
    // Subtle 3D head pivot
    const headTilt = (progress - 0.5) * 6; // -3deg to +3deg
    const headPanX = (progress - 0.5) * 4;
    const headPanY = 2;
    
    return { pupilX, pupilY, headTilt, headPanX, headPanY };
  };

  const { pupilX, pupilY, headTilt, headPanX, headPanY } = calculateTracking();

  return (
    <div className="relative w-40 h-44 sm:w-44 sm:h-48 mx-auto flex items-center justify-center select-none pointer-events-none">
      {/* Ambient Status Glow Aura (Transparent background maintained) */}
      <div 
        className={cn(
          "absolute inset-3 rounded-full blur-3xl transition-all duration-500 opacity-40",
          hasError ? "bg-rose-500/70 scale-110" :
          isSuccess ? "bg-emerald-500/80 scale-125" :
          isSubmitting ? "bg-cyan-500/70 animate-pulse" :
          isPasswordFocused ? "bg-indigo-500/50 scale-95" :
          "bg-sky-500/30"
        )} 
      />

      <svg
        viewBox="0 0 240 240"
        className="w-full h-full drop-shadow-2xl overflow-visible"
      >
        <defs>
          {/* Metallic Body Gradients */}
          <linearGradient id="cctvVisorTop" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#e2eeff" />
            <stop offset="100%" stopColor="#a3c3e8" />
          </linearGradient>

          <linearGradient id="cctvVisorSide" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#b4d0f0" />
            <stop offset="50%" stopColor="#7a9ec7" />
            <stop offset="100%" stopColor="#456a94" />
          </linearGradient>

          <linearGradient id="cctvBodyLight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#cde0f7" />
            <stop offset="100%" stopColor="#8baecf" />
          </linearGradient>

          <linearGradient id="cctvBodyMid" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#b2cde8" />
            <stop offset="100%" stopColor="#5d81a8" />
          </linearGradient>

          <linearGradient id="cctvBodyDark" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b5478" />
            <stop offset="100%" stopColor="#1e2f47" />
          </linearGradient>

          {/* Camera Lens Eyeball Gradients */}
          <radialGradient id="cctvLensGlassGlow" cx="45%" cy="40%" r="65%">
            <stop offset="0%" stopColor="#e0f9ff" />
            <stop offset="25%" stopColor="#38bdf8" />
            <stop offset="70%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#034b75" />
          </radialGradient>

          <radialGradient id="cctvIrisBlue" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#38f8ff" />
            <stop offset="45%" stopColor="#0ea5e9" />
            <stop offset="85%" stopColor="#0369a1" />
            <stop offset="100%" stopColor="#082f49" />
          </radialGradient>

          {/* Glowing Filters */}
          <filter id="cctvScanBeamGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ========================================================================= */}
        {/* 1. REAR FLEXIBLE ACCORDION CABLE */}
        {/* ========================================================================= */}
        <g className="transition-transform duration-300">
          {/* Cable Outer Shadow/Border */}
          <path 
            d="M 56 100 C 24 112, 22 165, 82 165" 
            stroke="#152233" 
            strokeWidth="16" 
            fill="none" 
            strokeLinecap="round" 
          />
          {/* Cable Metallic Segments */}
          <path 
            d="M 56 100 C 24 112, 22 165, 82 165" 
            stroke="#8baecf" 
            strokeWidth="10" 
            fill="none" 
            strokeLinecap="round" 
            strokeDasharray="4 4" 
          />
          <path 
            d="M 56 100 C 24 112, 22 165, 82 165" 
            stroke="#ffffff" 
            strokeWidth="3" 
            fill="none" 
            strokeLinecap="round" 
            opacity="0.6" 
          />
        </g>

        {/* ========================================================================= */}
        {/* 2. LEGS AND FEET (ROBOT STANDING FIRMLY) */}
        {/* ========================================================================= */}
        {/* --- LEFT LEG (BACK) --- */}
        <g id="cctv-left-leg">
          {/* Thigh */}
          <path d="M 80 162 L 74 192 L 90 192 L 94 162 Z" fill="url(#cctvBodyMid)" stroke="#152233" strokeWidth="3" strokeLinejoin="round" />
          {/* Knee Joint */}
          <ellipse cx="82" cy="192" rx="8.5" ry="4" fill="url(#cctvBodyLight)" stroke="#152233" strokeWidth="3" />
          {/* Shin */}
          <path d="M 74 194 L 72 216 L 88 216 L 88 194 Z" fill="url(#cctvBodyMid)" stroke="#152233" strokeWidth="3" strokeLinejoin="round" />
          {/* Foot / Boot */}
          <path d="M 60 226 C 60 216, 75 214, 88 214 C 96 214, 98 220, 96 226 Z" fill="url(#cctvBodyLight)" stroke="#152233" strokeWidth="3.5" strokeLinejoin="round" />
          {/* Foot Highlight */}
          <ellipse cx="78" cy="217" rx="6" ry="2.5" fill="#ffffff" opacity="0.8" />
        </g>

        {/* --- RIGHT LEG (FRONT) --- */}
        <g id="cctv-right-leg">
          {/* Thigh */}
          <path d="M 112 160 L 115 192 L 133 192 L 126 160 Z" fill="url(#cctvBodyLight)" stroke="#152233" strokeWidth="3" strokeLinejoin="round" />
          {/* Knee Joint */}
          <ellipse cx="124" cy="192" rx="9.5" ry="4.5" fill="url(#cctvBodyMid)" stroke="#152233" strokeWidth="3" />
          {/* Shin */}
          <path d="M 115 194 L 117 216 L 134 216 L 132 194 Z" fill="url(#cctvBodyLight)" stroke="#152233" strokeWidth="3" strokeLinejoin="round" />
          {/* Foot / Boot */}
          <path d="M 106 226 C 106 216, 122 214, 140 214 C 148 214, 151 220, 147 226 Z" fill="url(#cctvBodyLight)" stroke="#152233" strokeWidth="3.5" strokeLinejoin="round" />
          {/* Foot Highlight */}
          <ellipse cx="126" cy="217" rx="7.5" ry="2.8" fill="#ffffff" opacity="0.9" />
        </g>

        {/* ========================================================================= */}
        {/* 3. PELVIS / WAIST SOCKET */}
        {/* ========================================================================= */}
        <g id="cctv-pelvis">
          <ellipse cx="104" cy="160" rx="18" ry="12" fill="url(#cctvBodyMid)" stroke="#152233" strokeWidth="3.5" />
          {/* Waist Cylinder */}
          <path d="M 94 136 L 94 154 C 94 160, 114 160, 114 154 L 114 136 Z" fill="url(#cctvBodyLight)" stroke="#152233" strokeWidth="3.5" strokeLinejoin="round" />
          <ellipse cx="104" cy="136" rx="10.5" ry="5" fill="url(#cctvBodyMid)" stroke="#152233" strokeWidth="3" />
        </g>

        {/* ========================================================================= */}
        {/* 4. NECK SWIVEL MOUNT */}
        {/* ========================================================================= */}
        <g id="cctv-neck">
          {/* Neck Column */}
          <path d="M 98 114 L 98 136 L 110 136 L 110 114 Z" fill="url(#cctvBodyLight)" stroke="#152233" strokeWidth="3" strokeLinejoin="round" />
          <ellipse cx="104" cy="124" rx="8" ry="3.5" fill="url(#cctvBodyMid)" stroke="#152233" strokeWidth="2.5" />
          {/* Neck Top Ball Joint */}
          <circle cx="104" cy="112" r="7" fill="url(#cctvBodyMid)" stroke="#152233" strokeWidth="3" />
        </g>

        {/* ========================================================================= */}
        {/* 5. LEFT ARM (BACK ARM) - ANIMATED */}
        {/* ========================================================================= */}
        <g 
          id="cctv-left-arm"
          className={cn(
            "transition-all duration-300 ease-out origin-[75px_115px]",
            isPasswordFocused && !isPeeking 
              ? "translate-y-[-35px] translate-x-[36px] rotate-[-55deg]" /* Raises left hand to cover left side of lens */
              : isPasswordFocused && isPeeking
              ? "translate-y-[-20px] translate-x-[20px] rotate-[-30deg]"
              : isSuccess
              ? "translate-y-[-10px] rotate-[-15deg]"
              : ""
          )}
        >
          {/* Shoulder Joint */}
          <circle cx="76" cy="122" r="7.5" fill="url(#cctvBodyLight)" stroke="#152233" strokeWidth="3" />
          {/* Upper Arm */}
          <path d="M 72 124 L 52 144 L 62 152 L 80 128 Z" fill="url(#cctvBodyLight)" stroke="#152233" strokeWidth="3" strokeLinejoin="round" />
          {/* Elbow Joint */}
          <circle cx="56" cy="148" r="6" fill="url(#cctvBodyMid)" stroke="#152233" strokeWidth="3" />
          {/* Forearm & Fist */}
          <path d="M 54 150 L 62 168 C 65 174, 76 174, 80 166 L 66 146 Z" fill="url(#cctvBodyLight)" stroke="#152233" strokeWidth="3" strokeLinejoin="round" />
          {/* Mechanical Hand Fist */}
          <ellipse cx="73" cy="168" rx="7.5" ry="6.5" fill="url(#cctvBodyLight)" stroke="#152233" strokeWidth="3" />
          {/* Finger Knuckle Details */}
          <path d="M 68 165 Q 73 172 78 165" stroke="#152233" strokeWidth="2" fill="none" />
        </g>

        {/* ========================================================================= */}
        {/* 6. CAMERA HEAD (FULL 3D HOUSING + INTERACTIVE EYE) */}
        {/* ========================================================================= */}
        <g 
          id="cctv-camera-head"
          style={{ 
            transform: `translate(${headPanX}px, ${headPanY}px) rotate(${headTilt}deg)`,
            transformOrigin: '104px 112px'
          }}
          className="transition-transform duration-200 ease-out"
        >
          {/* --- A. Outer Camera Housing (Visor / Body) --- */}
          {/* Rear Camera Shell Box */}
          <path 
            d="M 52 52 L 126 36 L 120 102 L 46 95 Z" 
            fill="url(#cctvVisorSide)" 
            stroke="#152233" 
            strokeWidth="3.5" 
            strokeLinejoin="round" 
          />
          {/* Top Visor Roof */}
          <path 
            d="M 52 52 L 126 36 L 210 46 L 132 66 Z" 
            fill="url(#cctvVisorTop)" 
            stroke="#152233" 
            strokeWidth="3.5" 
            strokeLinejoin="round" 
          />
          {/* Top Visor Bright Highlight Line */}
          <path 
            d="M 58 52 L 126 38 L 200 48" 
            stroke="#ffffff" 
            strokeWidth="3" 
            strokeLinecap="round" 
            fill="none" 
            opacity="0.8" 
          />

          {/* Camera Side Grooves & Panel Details */}
          <path d="M 56 68 L 100 60" stroke="#152233" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 54 80 L 88 74" stroke="#152233" strokeWidth="2.5" strokeLinecap="round" />

          {/* --- B. Front Camera Aperture Bezel (Recessed Visor Hood) --- */}
          <path 
            d="M 124 38 L 216 48 C 224 50, 226 56, 224 64 L 208 114 C 206 122, 198 124, 190 122 L 102 110 C 94 108, 92 102, 94 94 L 110 46 C 112 40, 118 38, 124 38 Z" 
            fill="url(#cctvVisorSide)" 
            stroke="#152233" 
            strokeWidth="3.5" 
            strokeLinejoin="round" 
          />

          {/* Inner Visor Bevel Rim */}
          <path 
            d="M 130 46 L 208 55 C 214 56, 215 60, 213 66 L 201 106 C 199 112, 193 114, 187 112 L 112 102 C 106 100, 104 96, 106 90 L 118 52 C 120 47, 124 45, 130 46 Z" 
            fill="url(#cctvBodyDark)" 
            stroke="#152233" 
            strokeWidth="3" 
            strokeLinejoin="round" 
          />

          {/* --- C. Inner Lens Face Screen --- */}
          <path 
            d="M 134 50 L 204 58 C 209 59, 210 62, 208 67 L 198 102 C 196 107, 191 109, 186 107 L 118 98 C 113 96, 111 93, 113 88 L 123 55 C 125 51, 129 49, 134 50 Z" 
            fill="#dbe9f9" 
            stroke="#152233" 
            strokeWidth="2.5" 
          />

          {/* --- D. Circular Camera Lens Frame --- */}
          <ellipse 
            cx="160" 
            cy="80" 
            rx="33" 
            ry="31" 
            fill="url(#cctvBodyDark)" 
            stroke="#152233" 
            strokeWidth="3.5" 
          />
          {/* Metallic Inner Bezel */}
          <ellipse 
            cx="160" 
            cy="80" 
            rx="28" 
            ry="26" 
            fill="url(#cctvLensGlassGlow)" 
            stroke="#0284c7" 
            strokeWidth="2" 
          />

          {/* --- E. Eye Pupil & Iris with Interactive Cursor/Typing Tracking --- */}
          <g 
            style={{ 
              transform: `translate(${pupilX}px, ${pupilY}px)`,
              transition: 'transform 0.12s ease-out'
            }}
          >
            {/* Iris */}
            <ellipse 
              cx="160" 
              cy="80" 
              rx="18" 
              ry="17" 
              fill="url(#cctvIrisBlue)" 
              stroke="#0369a1" 
              strokeWidth="1.5" 
            />
            {/* Deep Pupil */}
            <ellipse 
              cx="160" 
              cy="80" 
              rx="11" 
              ry="10.5" 
              fill="#0b1726" 
            />
            {/* High-Gloss Anime Catchlight Reflection (Primary Dot) */}
            <ellipse 
              cx="155" 
              cy="74" 
              rx="5" 
              ry="4" 
              fill="#ffffff" 
            />
            {/* Secondary Accent Reflection Dot */}
            <circle 
              cx="165" 
              cy="84" 
              r="2" 
              fill="#ffffff" 
              opacity="0.85" 
            />
          </g>

          {/* --- F. Expressive Eyelid / Shutter Overlay --- */}
          {/* Default Upper Eyelid Arch (Gives determined / scout gaze from image) */}
          {!isPasswordFocused && !isBlinking && !hasError && !isSuccess && (
            <path 
              d="M 132 72 Q 160 62 188 74 Q 160 66 132 72 Z" 
              fill="#152233" 
            />
          )}

          {/* Submitting: Laser Scanner Beam */}
          {isSubmitting && (
            <line 
              x1="130" 
              y1="80" 
              x2="190" 
              y2="80" 
              stroke="#22d3ee" 
              strokeWidth="3" 
              strokeLinecap="round" 
              filter="url(#cctvScanBeamGlow)" 
              className="animate-pulse"
            />
          )}

          {/* Natural Blink State */}
          {isBlinking && !isPasswordFocused && (
            <g>
              <ellipse cx="160" cy="80" rx="28.5" ry="26.5" fill="#152233" />
              <path d="M 134 80 Q 160 88 186 80" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" fill="none" />
            </g>
          )}

          {/* Password Mode: Shutter / Eye Closed (Tutup Mata) */}
          {isPasswordFocused && !isPeeking && (
            <g className="transition-opacity duration-200">
              {/* Lens Shutter Shut Down */}
              <ellipse cx="160" cy="80" rx="28.5" ry="26.5" fill="#152233" />
              {/* Cute Curved Closed Eye Line */}
              <path 
                d="M 136 80 Q 160 90 184 80" 
                stroke="#38bdf8" 
                strokeWidth="3.5" 
                strokeLinecap="round" 
                fill="none" 
              />
              {/* Mechanical Shutter Lines */}
              <path d="M 148 70 L 172 70" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
            </g>
          )}

          {/* Password Peeking Mode: Curious Gap Gaze */}
          {isPasswordFocused && isPeeking && (
            <ellipse 
              cx="156" 
              cy="76" 
              rx="4" 
              ry="3" 
              fill="#ffffff" 
              className="animate-ping"
            />
          )}

          {/* Success Mode: Cheerful Happy Eye ^_^ */}
          {isSuccess && (
            <g>
              <ellipse cx="160" cy="80" rx="28.5" ry="26.5" fill="#10b981" opacity="0.2" />
              <path 
                d="M 138 84 Q 160 66 182 84" 
                stroke="#10b981" 
                strokeWidth="4" 
                strokeLinecap="round" 
                fill="none" 
              />
            </g>
          )}

          {/* Error Mode: Worried >_< / Red Alert */}
          {hasError && (
            <g>
              <ellipse cx="160" cy="80" rx="28.5" ry="26.5" fill="#f43f5e" opacity="0.25" />
              {/* Flash Red Alert Beacon on Hood */}
              <circle cx="160" cy="32" r="5" fill="#f43f5e" filter="url(#cctvScanBeamGlow)" className="animate-ping" />
              <path d="M 142 72 L 158 88 L 142 88" stroke="#f43f5e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M 178 72 L 162 88 L 178 88" stroke="#f43f5e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </g>
          )}
        </g>

        {/* ========================================================================= */}
        {/* 7. RIGHT ARM (FRONT SCOUT / COVER EYE ARM) - ANIMATED */}
        {/* ========================================================================= */}
        <g 
          id="cctv-right-arm"
          className={cn(
            "transition-all duration-300 ease-out origin-[118px_122px]",
            isPasswordFocused && !isPeeking 
              ? "translate-y-[-42px] translate-x-[22px] rotate-[-25deg]" /* Moves hand directly over center of camera lens */
              : isPasswordFocused && isPeeking
              ? "translate-y-[-24px] translate-x-[48px] rotate-[15deg]" /* Slides hand aside to peek through gap */
              : isSuccess
              ? "translate-y-[-18px] translate-x-[15px] rotate-[10deg]"
              : ""
          )}
        >
          {/* Shoulder Joint */}
          <circle cx="118" cy="122" r="8.5" fill="url(#cctvBodyLight)" stroke="#152233" strokeWidth="3.5" />
          
          {/* Upper Arm Segment */}
          <path d="M 120 120 L 166 90 L 176 100 L 126 130 Z" fill="url(#cctvBodyLight)" stroke="#152233" strokeWidth="3" strokeLinejoin="round" />
          
          {/* Elbow Joint */}
          <circle cx="170" cy="94" r="7" fill="url(#cctvBodyMid)" stroke="#152233" strokeWidth="3" />
          
          {/* Forearm Segment reaching to Visor/Eye */}
          <path d="M 168 92 L 194 72 L 202 82 L 174 100 Z" fill="url(#cctvBodyLight)" stroke="#152233" strokeWidth="3" strokeLinejoin="round" />
          
          {/* Mechanical Wrist & Hand in Visor Scout/Shield Pose */}
          <ellipse cx="196" cy="74" rx="9" ry="7" fill="url(#cctvBodyLight)" stroke="#152233" strokeWidth="3" />
          
          {/* Robotic Fingers in Scout/Salute Curvature */}
          <path d="M 190 70 C 196 64, 206 66, 210 74 C 204 78, 194 78, 190 70 Z" fill="url(#cctvBodyMid)" stroke="#152233" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M 194 71 L 206 73" stroke="#152233" strokeWidth="1.8" />
          <path d="M 194 75 L 204 77" stroke="#152233" strokeWidth="1.8" />
        </g>
      </svg>
    </div>
  );
};

