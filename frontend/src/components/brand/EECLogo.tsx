import React, { useState } from 'react';
import eecLogoSrc from '../../assets/eec-logo.png';

export type EECLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'auto';

export interface EECLogoProps {
  size?: EECLogoSize;
  collapsed?: boolean;
  showSubtext?: boolean;
  subtextClassName?: string;
  className?: string;
  imgClassName?: string;
  alt?: string;
}

const SIZE_MAP: Record<EECLogoSize, string> = {
  xs: 'h-6',
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-14',
  xl: 'h-20',
  auto: '',
};

export const EECLogo: React.FC<EECLogoProps> = ({
  size = 'md',
  collapsed = false,
  showSubtext = false,
  subtextClassName = '',
  className = '',
  imgClassName = '',
  alt = 'Ethiopian Engineering Corporation (EEC) Logo',
}) => {
  const [hasError, setHasError] = useState(false);

  // When collapsed in sidebar, constrain to fit within 48px width without distortion
  const heightClass = collapsed ? 'h-5 max-w-[48px]' : SIZE_MAP[size] || 'h-10';

  if (hasError) {
    // Accessible text-based fallback if image fails to load
    return (
      <div className={`flex items-center gap-2 font-bold text-slate-800 ${className}`} aria-label={alt}>
        <span className="text-[#00A7D6] font-black text-lg tracking-wider">EEC</span>
        {!collapsed && (
          <span className="text-xs text-slate-500 font-semibold tracking-tight">RMS</span>
        )}
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      <img
        src={eecLogoSrc}
        alt={alt}
        onError={() => setHasError(true)}
        className={`${heightClass} w-auto object-contain transition-all duration-200 ${imgClassName}`}
        loading="eager"
      />

      {showSubtext && !collapsed && (
        <div className={`flex flex-col border-l border-slate-200 pl-3 leading-tight ${subtextClassName}`}>
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-slate-900 text-xs tracking-tight">
              RMS
            </span>
            <span className="text-[9px] bg-[#00A7D6]/10 text-[#00A7D6] font-bold px-1.5 py-0.2 rounded">
              2026
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-medium truncate">
            Resource Management
          </span>
        </div>
      )}
    </div>
  );
};

export default EECLogo;
