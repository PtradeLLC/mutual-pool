import React from 'react';
import logoImg from '../assets/images/mutual_pool_logo_1785098560966.jpg';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Logo: React.FC<LogoProps> = ({ 
  className = '', 
  size = 'md' 
}) => {
  const sizeClasses = {
    sm: 'h-8 sm:h-9',
    md: 'h-10 sm:h-12',
    lg: 'h-14 sm:h-16',
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img 
        src={logoImg} 
        alt="MutualPool Logo - We Pool. We Grow. We Deliver." 
        referrerPolicy="no-referrer"
        className={`${sizeClasses[size]} w-auto object-contain rounded-lg shadow-xs hover:scale-102 transition-transform bg-white p-0.5 border border-[#E2E8F0]`}
      />
    </div>
  );
};
