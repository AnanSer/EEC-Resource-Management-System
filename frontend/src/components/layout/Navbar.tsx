import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { 
  Bell, 
  Search, 
  ChevronDown, 
  Check, 
  Menu,
  ShieldAlert
} from 'lucide-react';

interface NavbarProps {
  onToggleMobileSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleMobileSidebar }) => {
  const { currentUser, currentRole, switchRole, allRoles } = useAuth();
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-4 md:px-6 flex items-center justify-between sticky top-0 z-20 shadow-sm">
      {/* Left: Mobile hamburger & search */}
      <div className="flex items-center gap-3 flex-1 max-w-lg">
        <button
          onClick={onToggleMobileSidebar}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg md:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative w-full max-w-sm hidden sm:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search items, plate numbers, item codes..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-accent/30 focus:border-eec-accent transition-all text-slate-800 placeholder-slate-400"
          />
        </div>
      </div>

      {/* Right: Demo Role Switcher, Notifications, Profile */}
      <div className="flex items-center gap-3">
        {/* Interactive Demo Role Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-all shadow-sm"
          >
            <span className="w-2 h-2 rounded-full bg-eec-terracotta animate-pulse" />
            <span className="hidden sm:inline text-slate-500">Demo Role:</span>
            <span className="font-bold text-slate-900">{currentRole}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {roleDropdownOpen && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setRoleDropdownOpen(false)} 
              />
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-dropdown border border-slate-200/90 py-2 z-50">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-900">Switch Prototype Persona</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Test navigation and views as any original role</p>
                </div>

                <div className="p-1 space-y-1">
                  {allRoles.map((r) => (
                    <button
                      key={r.role}
                      onClick={() => {
                        switchRole(r.role as UserRole);
                        setRoleDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                        currentRole === r.role
                          ? 'bg-eec-primary/10 text-eec-primary font-semibold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span>{r.label}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${r.badgeColor}`}>
                            {r.role}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-normal leading-tight">{r.description}</p>
                      </div>
                      {currentRole === r.role && <Check className="w-4 h-4 text-eec-primary ml-2 flex-shrink-0" />}
                    </button>
                  ))}
                </div>

                <div className="px-3 pt-2 pb-1 border-t border-slate-100 mt-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-600">
                    <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Frontend simulation mode only.</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Notifications Icon */}
        <button className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full"></span>
        </button>

        {/* User Card */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-eec-primary text-white flex items-center justify-center font-bold text-xs shadow-sm">
            {currentUser.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div className="hidden lg:block text-left">
            <p className="text-xs font-bold text-slate-900 leading-none">{currentUser.name}</p>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-none">{currentUser.designation}</p>
          </div>
        </div>
      </div>
    </header>
  );
};
