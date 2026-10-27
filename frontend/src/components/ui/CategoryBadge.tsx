import React from 'react';
import { ResourceCategory } from '../../types';
import { Laptop, Truck, Compass, HardHat, Armchair } from 'lucide-react';

interface CategoryBadgeProps {
  category: ResourceCategory;
  showIcon?: boolean;
}

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({ category, showIcon = true }) => {
  const meta: Record<ResourceCategory, { label: string; icon: React.FC<{ className?: string }>; bg: string }> = {
    IT_EQUIPMENT: { label: 'IT Equipment', icon: Laptop, bg: 'bg-blue-50 text-blue-700 border-blue-100' },
    VEHICLES: { label: 'Vehicles & Transport', icon: Truck, bg: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    HEAVY_MACHINERY: { label: 'Heavy Machinery', icon: HardHat, bg: 'bg-amber-50 text-amber-700 border-amber-100' },
    SURVEYING_GEOTECHNICAL: { label: 'Surveying & Geotechnical', icon: Compass, bg: 'bg-cyan-50 text-cyan-700 border-cyan-100' },
    CAMP_FACILITY_FURNITURE: { label: 'Furniture & Facilities', icon: Armchair, bg: 'bg-slate-50 text-slate-700 border-slate-200' },
  };

  const item = meta[category] || meta.IT_EQUIPMENT;
  const Icon = item.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${item.bg}`}>
      {showIcon && <Icon className="w-3.5 h-3.5" />}
      {item.label}
    </span>
  );
};
