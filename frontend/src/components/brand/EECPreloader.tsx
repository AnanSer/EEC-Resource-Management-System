import React from 'react';
import { EECLogo } from './EECLogo';

export interface EECPreloaderProps {
  message?: string;
  submessage?: string;
  fullScreen?: boolean;
  className?: string;
}

export const EECPreloader: React.FC<EECPreloaderProps> = ({
  message = 'Resource Management System',
  submessage = 'Ethiopian Engineering Corporation',
  fullScreen = true,
  className = '',
}) => {
  const containerClasses = fullScreen
    ? 'fixed inset-0 z-50 min-h-screen bg-[#F4F8FA] flex flex-col items-center justify-center p-6'
    : 'w-full py-16 flex flex-col items-center justify-center p-6 bg-[#F4F8FA] rounded-2xl';

  return (
    <div className={`${containerClasses} select-none ${className}`} role="status" aria-live="polite">
      {/* Ambient background glow aura */}
      <div className="relative flex flex-col items-center max-w-sm w-full">
        <div 
          className="absolute -inset-10 bg-gradient-to-r from-[#00A7D6]/15 via-[#083D4A]/10 to-[#00A7D6]/15 rounded-full blur-3xl animate-eec-glow pointer-events-none" 
          aria-hidden="true" 
        />

        {/* Central Logo */}
        <div className="relative mb-6 transform transition-transform">
          <EECLogo size="lg" alt="Ethiopian Engineering Corporation" />
        </div>

        {/* Sleek Gradient Shimmer Progress Indicator */}
        <div 
          className="w-48 sm:w-56 h-1 bg-slate-200/90 rounded-full overflow-hidden relative mb-4 shadow-inner"
          aria-hidden="true"
        >
          <div className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-[#00A7D6] to-[#083D4A] rounded-full animate-eec-shimmer" />
        </div>

        {/* Minimal Subtext */}
        {message && (
          <p className="text-xs font-semibold text-slate-700 tracking-wide uppercase text-center">
            {message}
          </p>
        )}
        {submessage && (
          <p className="text-[10px] text-slate-400 font-medium tracking-wider text-center mt-1">
            {submessage}
          </p>
        )}
      </div>
    </div>
  );
};

export default EECPreloader;

