import React from 'react';
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
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${c.bg} ${c.text} ${className}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
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
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${c.color} ${className}`}>
        {c.label}
      </span>
    );
  }

  return null;
};
