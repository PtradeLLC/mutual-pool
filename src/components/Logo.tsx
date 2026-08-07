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

  // If all image attempts fail, render elegant vector SVG logo fallback
  if (errorCount >= sources.length || !currentSrc) {
    return (
      <div className={`flex items-center gap-2.5 ${sizeClasses[size]} ${className}`}>
        <div className="h-full aspect-square bg-[#0F172A] rounded-xl flex items-center justify-center p-1.5 shadow-xs border border-[#E2E8F0]">
          <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Sage Green Leaves at Top */}
            <path d="M50 35C45 20 35 15 32 10C42 12 48 22 50 35Z" fill="#3B7A57" />
            <path d="M50 35C55 20 65 15 68 10C58 12 52 22 50 35Z" fill="#52796F" />
            {/* Infinity Loop */}
            <path d="M30 65C18 65 12 52 22 40C32 28 45 40 50 48C55 40 68 28 78 40C88 52 82 65 70 65C58 65 52 52 50 48C48 52 42 65 30 65Z" 
                  stroke="#1E293B" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
            {/* Handshake in center bottom */}
            <circle cx="50" cy="58" r="4" fill="#3B7A57" />
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="font-extrabold tracking-tight leading-none text-[#0F172A] text-lg">
            Mutual<span className="text-[#3B7A57]">Pool</span>
          </span>
          <span className="text-[8px] font-bold text-[#64748B] tracking-widest uppercase mt-0.5">
            We Pool. We Grow.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img 
        src={currentSrc} 
        alt="MutualPool Logo" 
        referrerPolicy="no-referrer"
        onError={handleImageError}
        className={`${sizeClasses[size]} w-auto object-contain rounded-lg shadow-xs hover:scale-102 transition-transform bg-white p-0.5 border border-[#E2E8F0]`}
      />
    </div>
  );
};


