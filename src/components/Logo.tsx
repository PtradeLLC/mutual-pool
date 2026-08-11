import React, { useState } from 'react';
import logoImg from '../assets/images/logo.png';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ 
  className = '', 
  size = 'md',
  showTagline = true
}) => {
  const [errorCount, setErrorCount] = useState(0);

  const imgSizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10 sm:h-11 sm:w-11',
    lg: 'h-14 w-14',
    xl: 'h-20 w-20',
  };

  const textSizeClasses = {
    sm: 'text-base',
    md: 'text-lg sm:text-xl',
    lg: 'text-2xl sm:text-3xl',
    xl: 'text-3xl sm:text-4xl',
  };

  const taglineSizeClasses = {
    sm: 'text-[7px]',
    md: 'text-[8px] sm:text-[9px]',
    lg: 'text-[11px]',
    xl: 'text-[13px]',
  };

  const sources = [
    logoImg,
    '/logo.png',
    '/logo.jpg',
  ].filter(Boolean);

  const currentSrc = sources[errorCount] || '/logo.png';

  const handleImageError = () => {
    if (errorCount < sources.length - 1) {
      setErrorCount(prev => prev + 1);
    }
  };

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <img 
        src={currentSrc} 
        alt="MutualPool Logo Icon" 
        referrerPolicy="no-referrer"
        onError={handleImageError}
        className={`${imgSizeClasses[size]} object-contain rounded-xl shadow-xs border border-slate-200/80 hover:scale-102 transition-transform shrink-0`}
      />
      <div className="flex flex-col justify-center">
        <span className={`font-black tracking-tight leading-none text-[#1B2838] ${textSizeClasses[size]}`}>
          Mutual<span className="text-[#4D6E58]">Pool</span>
        </span>
        {showTagline && (
          <span className={`font-extrabold text-[#475569] tracking-wider uppercase mt-1 leading-none ${taglineSizeClasses[size]}`}>
            WE POOL. WE GROW. WE DELIVER.
          </span>
        )}
      </div>
    </div>
  );
};





