import React from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Clock, ShieldAlert } from 'lucide-react';

export const ReturnsPage: React.FC = () => {
  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Asset Returns & Custody Clearance"
        subtitle="Process return of engineering resources and verify physical condition upon intake"
        breadcrumbs={[
          { label: 'RMS', href: '/dashboard' },
          { label: 'Asset Returns & Custody Clearance' }
        ]}
      />

      <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-card text-center max-w-2xl mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-eec-primary/10 text-eec-primary flex items-center justify-center mx-auto mb-4">
          <Clock className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Asset Returns & Custody Clearance Prototype Module</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
          The foundation, shared shell, and design tokens are in place. The core Resource Registry and Dashboard are ready for initial UX review.
        </p>

        <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200/60 text-left text-xs space-y-2">
          <p className="font-bold text-slate-800 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-eec-primary" />
            Milestone Scope Note
          </p>
          <p className="text-slate-600 leading-relaxed text-[11px]">
            As agreed, the shared application shell, role switcher, executive dashboard, resource registry, and asset detail view are built first for interactive review. This screen will be populated in the next progressive expansion.
          </p>
        </div>
      </div>
    </div>
  );
};
