import React, { useState } from 'react';
import logoImg from '../assets/images/logo.png';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Logo: React.FC<LogoProps> = ({ 
  className = '', 
  size = 'md' 
}) => {
  const [errorCount, setErrorCount] = useState(0);

  const sizeClasses = {
    sm: 'h-8 sm:h-9',
    md: 'h-10 sm:h-12',
    lg: 'h-14 sm:h-16',
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

  // If all image attempts fail, render clean off-white vector logo matching the user's authentic white badge aesthetic
  if (errorCount >= sources.length || !currentSrc) {
    return (
      <div className={`flex items-center gap-2 ${sizeClasses[size]} ${className}`}>
        <div className="h-full aspect-square bg-[#F8F6F0] rounded-xl flex items-center justify-center p-1 shadow-xs border border-[#E2E8F0]">
          <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Sage Green Leaves */}
            <path d="M50 32C45 18 35 13 32 8C42 10 48 20 50 32Z" fill="#52796F" />
            <path d="M50 32C55 18 65 13 68 8C58 10 52 20 50 32Z" fill="#52796F" />
            {/* Navy Infinity Loop with speech bubble tails */}
            <path d="M30 62C18 62 12 50 22 38C32 26 45 38 50 46C55 38 68 26 78 38C88 50 82 62 70 62C58 62 52 50 50 46C48 50 42 62 30 62Z" 
                  stroke="#1E293B" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            {/* Handshake in center bottom */}
            <circle cx="50" cy="56" r="3.5" fill="#52796F" />
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="font-extrabold tracking-tight leading-none text-[#1E293B] text-lg">
            Mutual<span className="text-[#52796F]">Pool</span>
          </span>
          <span className="text-[7.5px] font-bold text-[#64748B] tracking-widest uppercase mt-0.5">
            We Pool. We Grow. We Deliver.
          </span>
        </div>
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
        className={`${sizeClasses[size]} w-auto object-contain rounded-xl shadow-xs hover:scale-102 transition-transform bg-[#F8F6F0] p-0.5 border border-[#E2E8F0]`}
      />
    </div>
  );
};



