import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { resourceService } from '../../services/resourceService';
import { Resource, DashboardMetrics } from '../../types';
import { StatCard } from '../../components/ui/StatCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { CategoryBadge } from '../../components/ui/CategoryBadge';
import { 
  Layers, 
  CheckCircle2, 
  ArrowLeftRight, 
  Wrench, 
  AlertTriangle,
  Coins,
  ArrowRight,
  ShieldAlert,
  Building,
  PlusCircle,
  Truck,
  Compass,
  Laptop
} from 'lucide-react';
import { Link } from 'react-router-dom';

const CATEGORY_CONFIG: Record<
  string,
  { label: string; icon: React.FC<{ className?: string }>; colorClass: string }
> = {
  VEHICLES: { label: 'Vehicles', icon: Truck, colorClass: 'text-emerald-600' },
  HEAVY_MACHINERY: { label: 'Heavy Machinery & Plant', icon: Wrench, colorClass: 'text-amber-600' },
  SURVEYING_GEOTECHNICAL: { label: 'Surveying & Geotechnical', icon: Compass, colorClass: 'text-cyan-600' },
  IT_EQUIPMENT: { label: 'IT & Engineering Tech', icon: Laptop, colorClass: 'text-blue-600' },
  CAMP_FACILITY_FURNITURE: { label: 'Camp & Facility Furniture', icon: Building, colorClass: 'text-purple-600' },
  OTHER: { label: 'Other Equipment', icon: Layers, colorClass: 'text-slate-600' },
};

export const DashboardPage: React.FC = () => {
  const { currentUser, currentRole } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentResources, setRecentResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, res] = await Promise.all([
        resourceService.getMetrics(),
        resourceService.getAll()
      ]);
      setMetrics(m);
      setRecentResources(res.slice(0, 5));
    } catch (err: any) {
      console.error('Failed to load dashboard metrics', err);
      setError(err.response?.data?.message || err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentRole]);

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-eec-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-rose-800 text-xs">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  const isDepartmentScoped = metrics.scope === 'DEPARTMENT' || currentRole === 'DEPARTMENT_MANAGER' || currentRole === 'EMPLOYEE';
  const departmentName = metrics.departmentName || currentUser.departmentName || 'Directorate';
  const utilizationPercent = metrics.totalAssets > 0
    ? Math.round((metrics.assignedAssets / metrics.totalAssets) * 100)
    : 0;

  const formatETB = (val: number) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      maximumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-eec-primary to-[#0E5161] text-white rounded-2xl p-6 md:p-8 shadow-card relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10 translate-x-10 translate-y-10">
          <Building className="w-72 h-72 text-white" />
        </div>
        
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold text-cyan-200 mb-3 border border-white/10">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            {isDepartmentScoped
              ? `Scope: Department-Level (${departmentName})`
              : 'Scope: Corporation-Wide (Enterprise Master View)'}
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Welcome back, {currentUser.name}
          </h1>
          <p className="text-sm md:text-base text-cyan-100/90 mt-2 font-normal leading-relaxed">
            {currentUser.designation} • {departmentName}
          </p>
          <p className="text-xs text-cyan-200/70 mt-1">
            Active Persona: <strong className="text-white">{currentRole}</strong> ({isDepartmentScoped ? 'Department-scoped inventory views' : 'Full corporation visibility'})
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-5">
            <Link
              to="/resources"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-eec-primary font-bold text-xs rounded-xl hover:bg-cyan-50 transition-colors shadow-sm"
            >
              <Layers className="w-4 h-4" />
              Open Resource Registry
            </Link>
            <Link
              to="/resources?action=new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/20 text-white border border-white/20 font-bold text-xs rounded-xl hover:bg-cyan-500/30 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Register New Resource
            </Link>
          </div>
        </div>
      </div>

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={isDepartmentScoped ? 'Department Registered Assets' : 'Total Registered Assets (Enterprise)'}
          value={metrics.totalAssets}
          subtitle={isDepartmentScoped ? `Assigned to ${departmentName}` : 'All corporate directorates'}
          icon={Layers}
          colorClass="bg-blue-50 text-blue-700"
          trend={{
            value: 'N/A',
            label: 'QoQ trend unavailable (insufficient history)'
          }}
        />
        <StatCard
          title={isDepartmentScoped ? 'Available in Directorate' : 'Available in Store'}
          value={metrics.availableAssets}
          subtitle={isDepartmentScoped ? 'Ready for project allocation' : 'Corporate store & directorate ready'}
          icon={CheckCircle2}
          colorClass="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          title="Field & Site Custody"
          value={metrics.assignedAssets}
          subtitle={isDepartmentScoped ? 'Deployed to department projects' : 'Deployed across corporation teams'}
          icon={ArrowLeftRight}
          colorClass="bg-cyan-50 text-cyan-700"
          trend={{
            value: `${utilizationPercent}%`,
            isPositive: utilizationPercent > 0,
            label: 'custody utilization rate'
          }}
        />
        <StatCard
          title="Under Maintenance / Tests"
          value={metrics.maintenanceAssets + metrics.testingAssets}
          subtitle="Workshops, Bolo, or Calibrations"
          icon={Wrench}
          colorClass="bg-amber-50 text-amber-700"
        />
      </div>

      {/* Asset Valuation & Urgent Alerts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Total Book Value Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {isDepartmentScoped ? 'Department Capital Valuation' : 'Total Capital Valuation (Enterprise)'}
              </span>
              <div className="p-2 bg-teal-50 text-teal-700 rounded-lg">
                <Coins className="w-5 h-5" />
              </div>
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 mt-3 font-mono">
              {formatETB(metrics.totalValueETB)}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {isDepartmentScoped
                ? `Active inventory value assigned to ${departmentName}.`
                : 'Estimated active inventory value across all corporation directorates.'}
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 space-y-3">
            {Object.keys(metrics.categoryPercentages || {}).length > 0 ? (
              Object.entries(metrics.categoryPercentages || {}).map(([catKey, pct]) => {
                const config = CATEGORY_CONFIG[catKey] || {
                  label: catKey.replace(/_/g, ' '),
                  icon: Layers,
                  colorClass: 'text-slate-600',
                };
                const Icon = config.icon;
                const catVal = metrics.categoryValues?.[catKey] || 0;
                const catCount = metrics.categoryCounts?.[catKey] || 0;
                return (
                  <div key={catKey} className="flex justify-between items-center text-xs text-slate-600">
                    <span className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${config.colorClass}`} />
                      <span>{config.label}</span>
                      <span className="text-[11px] text-slate-400 font-mono">({catCount})</span>
                    </span>
                    <div className="text-right">
                      <span className="font-bold text-slate-900 font-mono">{pct.toFixed(1)}%</span>
                      <span className="text-[10px] text-slate-400 block font-mono">{formatETB(catVal)}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-xs text-slate-400 italic py-2">
                No active inventory recorded in this scope.
              </div>
            )}
          </div>
        </div>

        {/* Operational Roadblocks & Critical Compliance Alerts */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-50 text-amber-700 rounded-lg">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">Compliance & Maintenance Alerts</h2>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              {metrics.recentAlerts.length} active {metrics.recentAlerts.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          <div className="space-y-3">
            {metrics.recentAlerts.length > 0 ? (
              metrics.recentAlerts.map((alert) => (
                <div 
                  key={alert.id}
                  className="p-3.5 rounded-xl border border-slate-200/70 bg-slate-50/70 hover:bg-slate-50 transition-colors flex items-start gap-3.5"
                >
                  <div className="mt-0.5">
                    {alert.type === 'WARNING' && <ShieldAlert className="w-4 h-4 text-amber-600" />}
                    {alert.type === 'ALERT' && <AlertTriangle className="w-4 h-4 text-rose-600" />}
                    {alert.type === 'SUCCESS' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 truncate">{alert.title}</h4>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">
                        {new Date(alert.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{alert.message}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                No active compliance or maintenance alerts for this scope.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Resources Registry Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Equipment & Assets</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isDepartmentScoped
                ? `Latest additions and status changes in ${departmentName} custody`
                : 'Latest additions and status changes in corporate custody'}
            </p>
          </div>
          <Link
            to="/resources"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-eec-primary hover:text-eec-accent transition-colors"
          >
            View Full Registry
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
              <tr>
                <th className="px-6 py-3.5">Asset Code / Name</th>
                <th className="px-6 py-3.5">Category</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Condition</th>
                <th className="px-6 py-3.5">Current Location / Assignee</th>
                <th className="px-6 py-3.5 text-right">Value (ETB)</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {recentResources.length > 0 ? (
                recentResources.map((res) => (
                  <tr key={res.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{res.name}</div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">{res.itemCode}</div>
                    </td>
                    <td className="px-6 py-4">
                      <CategoryBadge category={res.category} />
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={res.status} />
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge condition={res.condition} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-800">{res.location}</div>
                      {res.currentAssigneeName && (
                        <div className="text-[11px] text-eec-primary font-medium mt-0.5">
                          Custody: {res.currentAssigneeName}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                      {formatETB(res.currentValueETB)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/resources/${res.id}`}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-eec-primary hover:text-white rounded-lg font-bold text-[11px] transition-colors inline-block"
                      >
                        Details
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-xs text-slate-400 italic">
                    No resources recorded in this scope yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
