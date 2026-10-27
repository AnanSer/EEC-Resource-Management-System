const fs = require('fs');

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log('Created:', path);
}

const baseDir = 'C:/Users/user/Desktop/React projects/EEC-Resource-Management-System/frontend/src';

// 1. AuthContext.tsx
write(${baseDir}/context/AuthContext.tsx, import React, { createContext, useContext, useState } from 'react';
import { UserRole, Employee } from '../types';
import { MOCK_EMPLOYEES } from '../mock/employees.mock';

export interface RoleMeta {
  role: UserRole;
  label: string;
  description: string;
  badgeColor: string;
}

export const AUTH_ROLES: RoleMeta[] = [
  { role: 'ADMIN', label: 'System Administrator', description: 'Full system control, audits, user and resource management', badgeColor: 'bg-purple-100 text-purple-800 border-purple-200' },
  { role: 'STORE_KEEPER', label: 'Chief Store Keeper', description: 'Central warehouse inventory, custody assignment, returns, inspections', badgeColor: 'bg-amber-100 text-amber-800 border-amber-200' },
  { role: 'IT_TECHNICIAN', label: 'IT Support & Technician', description: 'IT hardware diagnostics, maintenance tickets, and calibration', badgeColor: 'bg-blue-100 text-blue-800 border-blue-200' },
  { role: 'DEPARTMENT_MANAGER', label: 'Department Manager', description: 'Department approvals, custody tracking, and budget allocation', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { role: 'EMPLOYEE', label: 'Engineer / Field Officer', description: 'View assigned items, request new resources, and report issues', badgeColor: 'bg-slate-100 text-slate-800 border-slate-200' },
];

interface AuthContextType {
  currentUser: Employee;
  currentRole: UserRole;
  switchRole: (role: UserRole) => void;
  allRoles: RoleMeta[];
}

const AuthContext = createContext<AuthContextType>({
  currentUser: MOCK_EMPLOYEES[0],
  currentRole: 'ADMIN',
  switchRole: () => {},
  allRoles: AUTH_ROLES,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentRole, setCurrentRole] = useState<UserRole>('ADMIN');

  // Match corresponding mock employee for the selected role
  const currentUser = MOCK_EMPLOYEES.find(e => e.role === currentRole) || MOCK_EMPLOYEES[0];

  const switchRole = (role: UserRole) => {
    setCurrentRole(role);
  };

  return (
    <AuthContext.Provider value={{ currentUser, currentRole, switchRole, allRoles: AUTH_ROLES }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
);

// 2. StatusBadge.tsx
write(${baseDir}/components/ui/StatusBadge.tsx, import React from 'react';
import { ResourceStatus, ResourceCondition } from '../../types';

interface StatusBadgeProps {
  status?: ResourceStatus;
  condition?: ResourceCondition;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, condition, className = '' }) => {
  if (status) {
    const config: Record<ResourceStatus, { label: string; bg: string; text: string; dot: string }> = {
      AVAILABLE: { label: 'Available in Store', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
      ASSIGNED: { label: 'Assigned / In Use', bg: 'bg-sky-50 border-sky-200', text: 'text-sky-700', dot: 'bg-sky-500' },
      MAINTENANCE: { label: 'Under Maintenance', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
      TESTING: { label: 'Inspection / Testing', bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700', dot: 'bg-purple-500' },
      RETIRED: { label: 'Retired', bg: 'bg-slate-100 border-slate-200', text: 'text-slate-600', dot: 'bg-slate-400' },
      DISPOSED: { label: 'Disposed', bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', dot: 'bg-rose-500' },
    };

    const c = config[status] || config.AVAILABLE;

    return (
      <span className={\inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border \ \ \\}>
        <span className={\w-1.5 h-1.5 rounded-full \\} />
        {c.label}
      </span>
    );
  }

  if (condition) {
    const condConfig: Record<ResourceCondition, { label: string; color: string }> = {
      EXCELLENT: { label: 'Excellent', color: 'bg-teal-50 text-teal-700 border-teal-200' },
      GOOD: { label: 'Good', color: 'bg-blue-50 text-blue-700 border-blue-200' },
      FAIR: { label: 'Fair Condition', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
      NEEDS_REPAIR: { label: 'Needs Repair', color: 'bg-orange-50 text-orange-700 border-orange-200' },
      DAMAGED: { label: 'Damaged', color: 'bg-red-50 text-red-700 border-red-200' },
      RETIRED: { label: 'Retired', color: 'bg-slate-100 text-slate-600 border-slate-200' },
    };

    const c = condConfig[condition] || condConfig.GOOD;

    return (
      <span className={\inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border \ \\}>
        {c.label}
      </span>
    );
  }

  return null;
};
);

// 3. CategoryBadge.tsx
write(${baseDir}/components/ui/CategoryBadge.tsx, import React from 'react';
import { ResourceCategory } from '../../types';
import { Laptop, Truck, Compass, HardHat, Armchair } from 'lucide-react';

interface CategoryBadgeProps {
  category: ResourceCategory;
  showIcon?: boolean;
}

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({ category, showIcon = true }) => {
  const meta: Record<ResourceCategory, { label: string; icon: React.FC<{ className?: string }>; bg: string; text: string }> = {
    IT_EQUIPMENT: { label: 'IT Equipment', icon: Laptop, bg: 'bg-blue-50 text-blue-700 border-blue-100', text: 'text-blue-700' },
    VEHICLES: { label: 'Vehicles & Transport', icon: Truck, bg: 'bg-emerald-50 text-emerald-700 border-emerald-100', text: 'text-emerald-700' },
    HEAVY_MACHINERY: { label: 'Heavy Machinery', icon: HardHat, bg: 'bg-amber-50 text-amber-700 border-amber-100', text: 'text-amber-700' },
    SURVEYING_GEOTECHNICAL: { label: 'Surveying & Geotechnical', icon: Compass, bg: 'bg-cyan-50 text-cyan-700 border-cyan-100', text: 'text-cyan-700' },
    CAMP_FACILITY_FURNITURE: { label: 'Furniture & Facilities', icon: Armchair, bg: 'bg-slate-50 text-slate-700 border-slate-200', text: 'text-slate-700' },
  };

  const item = meta[category] || meta.IT_EQUIPMENT;
  const Icon = item.icon;

  return (
    <span className={\inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border \\}>
      {showIcon && <Icon className= w-3.5 h-3.5 />}
      {item.label}
    </span>
  );
};
);

// 4. EECLogo.tsx
write(${baseDir}/components/brand/EECLogo.tsx, import React from 'react';

interface EECLogoProps {
  collapsed?: boolean;
  className?: string;
}

export const EECLogo: React.FC<EECLogoProps> = ({ collapsed = false, className = '' }) => {
  return (
    <div className={\lex items-center gap-3 \\}>
      {/* Brand Hexagon Shield Icon */}
      <div className=relative flex items-center justify-center w-10 h-10 rounded-xl bg-eec-primary shadow-md border border-cyan-500/20 flex-shrink-0>
        <span className=font-extrabold text-white text-lg tracking-wider font-mono>EEC</span>
        <div className=absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-eec-accent rounded-full border-2 border-white flex items-center justify-center>
          <div className=w-1.5 h-1.5 bg-white rounded-full></div>
        </div>
      </div>

      {!collapsed && (
        <div className=flex flex-col overflow-hidden>
          <div className=flex items-center gap-1.5>
            <span className=font-bold text-slate-900 text-sm tracking-tight leading-none>
              EEC RMS
            </span>
            <span className=text-[10px] bg-eec-primary/10 text-eec-primary px-1.5 py-0.5 rounded font-semibold leading-none>
              2026
            </span>
          </div>
          <span className=text-[10px] font-medium text-slate-600 truncate mt-0.5 leading-tight>
            Ethiopian Engineering Corp.
          </span>
          <span className=text-[9px] text-slate-400 font-sans truncate leading-none>
            የኢትዮጵያ ምህንድስና ኮርፖሬሽን
          </span>
        </div>
      )}
    </div>
  );
};
);

console.log('Generated base branding, UI components, and context');