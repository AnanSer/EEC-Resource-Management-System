import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.FC<{ className?: string }>;
  colorClass?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  colorClass = 'bg-eec-primary/10 text-eec-primary',
  trend,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-card p-5 hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {title}
          </p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1 leading-tight">
            {value}
          </h3>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-1">
              {subtitle}
            </p>
          )}
        </div>

        <div className={`p-3 rounded-xl ${colorClass} flex-shrink-0`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>

      {trend && (
        <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-slate-100 text-xs">
          <span className={`font-semibold ${trend.isPositive ? 'text-emerald-600' : 'text-amber-600'}`}>
            {trend.value}
          </span>
          <span className="text-slate-400">vs last quarter</span>
        </div>
      )}
    </div>
  );
};
