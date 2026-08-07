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
  const [imgSrc, setImgSrc] = useState<string>(logoImg || '/logo.png');
  const [hasError, setHasError] = useState(false);

  const sizeClasses = {
    sm: 'h-8 sm:h-9',
    md: 'h-10 sm:h-12',
    lg: 'h-14 sm:h-16',
  };

  const handleImageError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc('/logo.png');
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img 
        src={imgSrc} 
        alt="MutualPool Logo" 
        referrerPolicy="no-referrer"
        onError={handleImageError}
        className={`${sizeClasses[size]} w-auto object-contain rounded-lg shadow-xs hover:scale-102 transition-transform bg-white p-0.5 border border-[#E2E8F0]`}
      />
    </div>
  );
};

