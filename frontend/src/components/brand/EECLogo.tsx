import React from 'react';

interface EECLogoProps {
  collapsed?: boolean;
  className?: string;
}

export const EECLogo: React.FC<EECLogoProps> = ({ collapsed = false, className = '' }) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-eec-primary shadow-md border border-cyan-500/20 flex-shrink-0">
        <span className="font-extrabold text-white text-base tracking-wider font-mono">EEC</span>
        <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-eec-accent rounded-full border-2 border-white flex items-center justify-center">
          <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
        </div>
      </div>

      {!collapsed && (
        <div className="flex flex-col overflow-hidden">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-900 text-sm tracking-tight leading-none">
              EEC RMS
            </span>
            <span className="text-[10px] bg-eec-primary/10 text-eec-primary px-1.5 py-0.5 rounded font-semibold leading-none">
              2026
            </span>
          </div>
          <span className="text-[10px] font-medium text-slate-600 truncate mt-0.5 leading-tight">
            Ethiopian Engineering Corp.
          </span>
          <span className="text-[9px] text-slate-400 font-sans truncate leading-none">
            የኢትዮጵያ ምህንድስና ኮርፖሬሽን
          </span>
        </div>
      )}
    </div>
  );
};
