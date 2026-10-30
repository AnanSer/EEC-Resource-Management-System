import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { EECLogo } from '../brand/EECLogo';
import { 
  LayoutDashboard, 
  Layers, 
  ArrowLeftRight, 
  ClipboardList, 
  RotateCcw, 
  Wrench, 
  ShieldCheck, 
  Building2, 
  Users, 
  CheckSquare, 
  FileBarChart, 
  Bell, 
  Settings,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Shield
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  name: string;
  path: string;
  icon: React.FC<{ className?: string }>;
  badge?: string;
  allowedRoles: ('ADMIN' | 'STORE_KEEPER' | 'IT_TECHNICIAN' | 'DEPARTMENT_MANAGER' | 'EMPLOYEE')[];
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, allowedRoles: ['ADMIN', 'STORE_KEEPER', 'IT_TECHNICIAN', 'DEPARTMENT_MANAGER', 'EMPLOYEE'] },
  { name: 'Resource Registry', path: '/resources', icon: Layers, allowedRoles: ['ADMIN', 'STORE_KEEPER', 'IT_TECHNICIAN', 'DEPARTMENT_MANAGER', 'EMPLOYEE'] },
  { name: 'Assignments', path: '/assignments', icon: ArrowLeftRight, allowedRoles: ['ADMIN', 'STORE_KEEPER', 'DEPARTMENT_MANAGER'] },
  { name: 'Requisitions', path: '/requisitions', icon: ClipboardList, allowedRoles: ['ADMIN', 'STORE_KEEPER', 'DEPARTMENT_MANAGER', 'EMPLOYEE'] },
  { name: 'Returns & Custody', path: '/returns', icon: RotateCcw, allowedRoles: ['ADMIN', 'STORE_KEEPER', 'DEPARTMENT_MANAGER'] },
  { name: 'Maintenance', path: '/maintenance', icon: Wrench, allowedRoles: ['ADMIN', 'STORE_KEEPER', 'IT_TECHNICIAN', 'DEPARTMENT_MANAGER', 'EMPLOYEE'] },
  { name: 'Inspections & Tests', path: '/inspections', icon: ShieldCheck, allowedRoles: ['ADMIN', 'IT_TECHNICIAN', 'STORE_KEEPER'] },
  { name: 'Departments', path: '/departments', icon: Building2, allowedRoles: ['ADMIN', 'DEPARTMENT_MANAGER'] },
  { name: 'Employees', path: '/employees', icon: Users, allowedRoles: ['ADMIN', 'DEPARTMENT_MANAGER'] },
  { name: 'User Approvals', path: '/approvals', icon: CheckSquare, allowedRoles: ['ADMIN'] },
  { name: 'Reports & Audits', path: '/reports', icon: FileBarChart, allowedRoles: ['ADMIN', 'STORE_KEEPER', 'IT_TECHNICIAN', 'DEPARTMENT_MANAGER', 'EMPLOYEE'] },
  { name: 'Notifications', path: '/notifications', icon: Bell, allowedRoles: ['ADMIN', 'STORE_KEEPER', 'IT_TECHNICIAN', 'DEPARTMENT_MANAGER', 'EMPLOYEE'] },
  { name: 'Settings', path: '/settings', icon: Settings, allowedRoles: ['ADMIN'] },
  { name: 'My Profile', path: '/profile', icon: UserCheck, allowedRoles: ['ADMIN', 'STORE_KEEPER', 'IT_TECHNICIAN', 'DEPARTMENT_MANAGER', 'EMPLOYEE'] },
];

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const { currentRole } = useAuth();
  const { unreadCount } = useNotifications();

  const filteredItems = NAV_ITEMS
    .filter(item => item.allowedRoles.includes(currentRole))
    .map(item => {
      if (item.path === '/notifications') {
        return {
          ...item,
          badge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : undefined,
        };
      }
      return item;
    });

  return (
    <aside
      className={`fixed top-0 left-0 bottom-0 z-30 bg-white border-r border-slate-200/80 shadow-sidebar flex flex-col transition-all duration-300 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100 flex-shrink-0">
        <EECLogo collapsed={collapsed} />
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors hidden md:block"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-eec-primary/10 text-eec-primary font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {/* Left Active Pill Indicator */}
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-1.5 bg-eec-terracotta rounded-r-full" />
                  )}
                  <Icon className={`w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-105 ${isActive ? 'text-eec-primary' : 'text-slate-400 group-hover:text-slate-600'}`} />
                  
                  {!collapsed && (
                    <span className="truncate flex-1">{item.name}</span>
                  )}

                  {!collapsed && item.badge && (
                    <span className="px-2 py-0.5 text-[11px] font-bold bg-amber-100 text-amber-800 rounded-full leading-none">
                      {item.badge}
                    </span>
                  )}

                  {/* Tooltip for collapsed state */}
                  {collapsed && (
                    <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs rounded-md shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                      {item.name}
                    </div>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* Bottom Role Notice */}
      {!collapsed && (
        <div className="p-3 m-3 bg-slate-50 border border-slate-200/60 rounded-xl flex items-center gap-2.5">
          <Shield className="w-4 h-4 text-eec-primary flex-shrink-0" />
          <div className="overflow-hidden">
            <p className="text-[10px] text-slate-400 font-semibold uppercase leading-none">Access Level</p>
            <p className="text-xs font-bold text-slate-800 truncate mt-0.5">{currentRole}</p>
          </div>
        </div>
      )}
    </aside>
  );
};
