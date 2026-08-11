import React, { useState } from 'react';
import logoImg from '../assets/images/logo.png';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'badge' | 'inline' | 'icon';
}

export const MutualPoolSvgLogo: React.FC<{ size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }> = ({ 
  size = 'md',
  className = '' 
}) => {
  const sizeMap = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
  };

  return (
    <svg 
      viewBox="0 0 400 400" 
      className={`${sizeMap[size]} ${className}`} 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Off-White Squircle Card Background */}
      <rect x="10" y="10" width="380" height="380" rx="72" fill="#FAF9F4" stroke="#E6E4DA" strokeWidth="4" />
      
      {/* Sage Green Sprouting Leaves (Top Center) */}
      <g id="sprouting-leaves">
        {/* Left Leaf Stem & Blade */}
        <path d="M198 165 C185 125 155 85 142 70 C170 80 188 115 198 165 Z" fill="#4D6E58" />
        <path d="M198 165 C178 120 148 95 142 70 C162 90 185 125 198 165 Z" fill="#3D5A47" opacity="0.3" />
        <path d="M198 165 C180 135 155 100 142 70" stroke="#3D5A47" strokeWidth="2.5" strokeLinecap="round" />
        
        {/* Right Leaf Stem & Blade */}
        <path d="M202 165 C215 125 245 85 258 70 C230 80 212 115 202 165 Z" fill="#4D6E58" />
        <path d="M202 165 C222 120 252 95 258 70 C238 90 215 125 202 165 Z" fill="#3D5A47" opacity="0.3" />
        <path d="M202 165 C220 135 245 100 258 70" stroke="#3D5A47" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* Navy Blue Infinity Speech Bubble Loops */}
      <g id="infinity-speech-loops">
        {/* Main Infinity Loop Base */}
        <path 
          d="M 125 210 
             C 70 210, 50 120, 115 120 
             C 160 120, 185 185, 200 205 
             C 215 185, 240 120, 285 120 
             C 350 120, 330 210, 275 210 
             C 230 210, 210 180, 200 165 
             C 190 180, 170 210, 125 210 Z" 
          fill="none" 
          stroke="#1B2838" 
          strokeWidth="22" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />

        {/* Left Speech Bubble Tail */}
        <path d="M 68 220 L 52 248 L 92 232 Z" fill="#1B2838" />

        {/* Right Speech Bubble Tail */}
        <path d="M 332 220 L 348 248 L 308 232 Z" fill="#1B2838" />

        {/* Handshake in Center Bottom */}
        <g id="handshake" transform="translate(180, 208)">
          <path d="M 0 12 C 8 4, 18 4, 24 10 L 28 14 C 32 18, 38 18, 40 12" stroke="#1B2838" strokeWidth="6" strokeLinecap="round" fill="none" />
          <path d="M 8 16 C 14 10, 24 10, 28 16" stroke="#4D6E58" strokeWidth="5" strokeLinecap="round" fill="none" />
          {/* Clasped fingers */}
          <rect x="15" y="12" width="5" height="10" rx="2" fill="#1B2838" />
          <rect x="21" y="14" width="5" height="10" rx="2" fill="#1B2838" />
        </g>
      </g>

      {/* Member Silhouettes Inside Loops */}
      {/* Left Loop Members (3 People) */}
      <g id="left-loop-members" fill="#1B2838">
        {/* Center Leader */}
        <circle cx="120" cy="160" r="10" />
        <path d="M102 188 C102 174, 110 172, 120 172 C130 172, 138 174, 138 188 Z" />
        
        {/* Left Member */}
        <circle cx="96" cy="168" r="7.5" />
        <path d="M83 190 C83 180, 89 178, 96 178 C103 178, 109 180, 109 190 Z" opacity="0.9" />

        {/* Right Member */}
        <circle cx="144" cy="168" r="7.5" />
        <path d="M131 190 C131 180, 137 178, 144 178 C151 178, 157 180, 157 190 Z" opacity="0.9" />
      </g>

      {/* Right Loop Members (3 People) */}
      <g id="right-loop-members" fill="#1B2838">
        {/* Center Leader */}
        <circle cx="280" cy="160" r="10" />
        <path d="M262 188 C262 174, 270 172, 280 172 C290 172, 298 174, 298 188 Z" />

        {/* Left Member */}
        <circle cx="256" cy="168" r="7.5" />
        <path d="M243 190 C243 180, 249 178, 256 178 C263 178, 269 180, 269 190 Z" opacity="0.9" />

        {/* Right Member */}
        <circle cx="304" cy="168" r="7.5" />
        <path d="M291 190 C291 180, 297 178, 304 178 C311 178, 317 180, 317 190 Z" opacity="0.9" />
      </g>

      {/* Typography: MutualPool */}
      <text 
        x="200" 
        y="312" 
        textAnchor="middle" 
        fontFamily="Plus Jakarta Sans, system-ui, -apple-system, sans-serif" 
        fontWeight="800" 
        fontSize="44" 
        letterSpacing="-1.2"
      >
        <tspan fill="#1B2838">Mutual</tspan>
        <tspan fill="#4D6E58">Pool</tspan>
      </text>

      {/* Tagline: WE POOL. WE GROW. WE DELIVER. */}
      <text 
        x="200" 
        y="342" 
        textAnchor="middle" 
        fontFamily="Plus Jakarta Sans, system-ui, -apple-system, sans-serif" 
        fontWeight="700" 
        fontSize="13.5" 
        letterSpacing="3.5" 
        fill="#3D4D5C"
      >
        WE POOL. WE GROW. WE DELIVER.
      </text>
    </svg>
  );
};

export const Logo: React.FC<LogoProps> = ({ 
  className = '', 
  size = 'md',
  variant = 'badge'
}) => {
  const [errorCount, setErrorCount] = useState(0);

  const sizeClasses = {
    sm: 'h-8 sm:h-9',
    md: 'h-10 sm:h-12',
    lg: 'h-14 sm:h-16',
    xl: 'h-20 sm:h-24',
  };

  const sources = [
    logoImg,
    '/logo.png',
    '/logo.jpg',
  ].filter(Boolean);

  const currentSrc = sources[errorCount];

  const handleImageError = () => {
    if (errorCount < sources.length) {
      setErrorCount(prev => prev + 1);
    }
  };

  // If raster image fails or if inline SVG badge is requested
  if (errorCount >= sources.length || !currentSrc) {
    return (
      <div className={`flex items-center gap-2.5 ${sizeClasses[size]} ${className}`}>
        <MutualPoolSvgLogo size={size} />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img 
        src={currentSrc} 
        alt="MutualPool Logo - We Pool. We Grow. We Deliver." 
        referrerPolicy="no-referrer"
        onError={handleImageError}
        className={`${sizeClasses[size]} w-auto object-contain rounded-xl hover:scale-102 transition-transform shadow-xs`}
      />
    </div>
  );
};




