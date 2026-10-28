import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Bell, 
  Search, 
  ChevronDown, 
  Menu,
  LogOut,
  User,
  ShieldCheck,
  Building2
} from 'lucide-react';

interface NavbarProps {
  onToggleMobileSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleMobileSidebar }) => {
  const { currentUser, currentRole, logout } = useAuth();
  const navigate = useNavigate();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const roleBadgeColors: Record<string, string> = {
    ADMIN: 'bg-purple-100 text-purple-800 border-purple-200',
    STORE_KEEPER: 'bg-amber-100 text-amber-800 border-amber-200',
    IT_TECHNICIAN: 'bg-blue-100 text-blue-800 border-blue-200',
    DEPARTMENT_MANAGER: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    EMPLOYEE: 'bg-slate-100 text-slate-800 border-slate-200',
  };

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
            placeholder="Search resources, serial numbers, plate numbers..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-accent/30 focus:border-eec-accent transition-all text-slate-800 placeholder-slate-400"
          />
        </div>
      </div>

      {/* Right: Real Authenticated Session Badge, Notifications, User Menu */}
      <div className="flex items-center gap-3">
        {/* Active Role Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-xl border bg-slate-50 text-xs font-semibold text-slate-700">
          <ShieldCheck className="w-3.5 h-3.5 text-eec-primary" />
          <span className="text-slate-400 font-normal">Role:</span>
          <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${roleBadgeColors[currentRole] || 'bg-slate-100 text-slate-700'}`}>
            {currentRole}
          </span>
        </div>

        {/* Notifications Link */}
        <Link 
          to="/notifications" 
          className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full"></span>
        </Link>

        {/* Authenticated User Menu Dropdown */}
        {currentUser && (
          <div className="relative">
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2 pl-2 border-l border-slate-200 hover:opacity-90 transition-opacity focus:outline-none"
            >
              <div className="w-8 h-8 rounded-full bg-eec-primary text-white flex items-center justify-center font-bold text-xs shadow-sm">
                {currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-xs font-bold text-slate-900 leading-none">{currentUser.name}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-none">{currentUser.designation}</p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {profileDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setProfileDropdownOpen(false)} 
                />
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-dropdown border border-slate-200/90 py-2 z-50 animate-fadeIn">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900">{currentUser.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{currentUser.email}</p>
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500">
                      <Building2 className="w-3 h-3 text-slate-400" />
                      <span>{currentUser.departmentName || 'Engineering Directorate'}</span>
                    </div>
                  </div>

                  <div className="p-1 space-y-0.5">
                    <Link
                      to="/profile"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors font-medium"
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      <span>Personnel Profile & Custody</span>
                    </Link>

                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        handleLogout();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors font-semibold"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      <span>Sign Out (End Session)</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
