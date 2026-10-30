import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { useAuth } from '../../context/AuthContext';
import { reportService } from '../../services/reportService';
import { departmentService } from '../../services/departmentService';
import { 
  ReportOverviewData, 
  Department, 
  RecentActivityItem 
} from '../../types';
import { 
  Layers, 
  Wrench, 
  Building2,
  DollarSign,
  Calendar,
  Filter,
  RefreshCw,
  AlertCircle,
  Clock,
  ArrowLeftRight,
  ShieldCheck,
  Tag,
  Truck,
  Compass,
  Laptop
} from 'lucide-react';

const CATEGORY_OPTIONS = [
  { value: 'ALL', label: 'All Categories' },
  { value: 'VEHICLES', label: 'Vehicles & Fleet' },
  { value: 'HEAVY_MACHINERY', label: 'Heavy Machinery & Earthmoving' },
  { value: 'SURVEYING_GEOTECHNICAL', label: 'Surveying & Geotechnical' },
  { value: 'IT_EQUIPMENT', label: 'IT Hardware & Telecom' },
  { value: 'CAMP_FACILITY_FURNITURE', label: 'Camp & Facility Assets' },
];

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Resource Statuses' },
  { value: 'AVAILABLE', label: 'Available (In Store)' },
  { value: 'ASSIGNED', label: 'Assigned (In Custody)' },
  { value: 'MAINTENANCE', label: 'Under Maintenance' },
  { value: 'RETIRED', label: 'Retired' },
  { value: 'DISPOSED', label: 'Disposed' },
];

const MAINTENANCE_STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Maintenance Statuses' },
  { value: 'SUBMITTED', label: 'Submitted (Pending Review)' },
  { value: 'APPROVED', label: 'Approved (Pending Servicing)' },
  { value: 'IN_PROGRESS', label: 'In Progress (Active Work)' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'REJECTED', label: 'Rejected' },
];

export const ReportsPage: React.FC = () => {
  const { currentRole } = useAuth();

  // State
  const [data, setData] = useState<ReportOverviewData | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedMaintStatus, setSelectedMaintStatus] = useState('ALL');

  // Load department choices for filtering
  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const depts = await departmentService.getAll();
        setDepartments(depts);
      } catch (err) {
        console.error('Failed to load departments for report filter', err);
      }
    };
    loadDepartments();
  }, []);

  // Fetch reports data
  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await reportService.getOverview({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        departmentId: selectedDept !== 'ALL' ? selectedDept : undefined,
        category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        maintenanceStatus: selectedMaintStatus !== 'ALL' ? selectedMaintStatus : undefined,
      });
      setData(res);
    } catch (err: any) {
      console.error('Failed to load reports', err);
      setError(err.response?.data?.message || err.message || 'Failed to generate reports overview');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedDept, selectedCategory, selectedStatus, selectedMaintStatus]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedDept('ALL');
    setSelectedCategory('ALL');
    setSelectedStatus('ALL');
    setSelectedMaintStatus('ALL');
  };

  const hasActiveFilters = Boolean(
    startDate ||
    endDate ||
    selectedDept !== 'ALL' ||
    selectedCategory !== 'ALL' ||
    selectedStatus !== 'ALL' ||
    selectedMaintStatus !== 'ALL'
  );

  const canFilterDepartments = currentRole === 'ADMIN' || currentRole === 'STORE_KEEPER' || currentRole === 'IT_TECHNICIAN';

  // Currency helper
  const formatETB = (amount: number) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'decimal',
      maximumFractionDigits: 0,
    }).format(amount) + ' ETB';
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'VEHICLES': return <Truck className="w-4 h-4 text-sky-600" />;
      case 'HEAVY_MACHINERY': return <Truck className="w-4 h-4 text-amber-600" />;
      case 'SURVEYING_GEOTECHNICAL': return <Compass className="w-4 h-4 text-emerald-600" />;
      case 'IT_EQUIPMENT': return <Laptop className="w-4 h-4 text-indigo-600" />;
      default: return <Tag className="w-4 h-4 text-slate-500" />;
    }
  };

  const getActivityBadge = (type: RecentActivityItem['type']) => {
    switch (type) {
      case 'ASSIGNMENT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <ArrowLeftRight className="w-3 h-3" /> Assignment
          </span>
        );
      case 'TRANSFER':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <ArrowLeftRight className="w-3 h-3" /> Custody Transfer
          </span>
        );
      case 'MAINTENANCE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Wrench className="w-3 h-3" /> Maintenance
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Top Header */}
      <PageHeader
        title="Corporate Reports & Operational Intelligence"
        subtitle="Live auditable reporting across EEC physical resources, custody assignments, and maintenance logs"
      >
        <div className="flex flex-wrap items-center gap-3">
          {data?.metadata && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100/90 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold">
              <Building2 className="w-3.5 h-3.5 text-eec-primary" />
              <span>{data.metadata.scopeLabel}</span>
            </div>
          )}
          <button
            onClick={() => fetchReports()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </div>
      </PageHeader>

      {/* Dynamic Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
            <Filter className="w-4 h-4 text-eec-primary" />
            <span>Audit & Analytical Filters</span>
          </div>
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="text-xs font-semibold text-eec-terracotta hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Start Date */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> From Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-medium"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> To Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-medium"
            />
          </div>

          {/* Directorate (if authorized) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
              <Building2 className="w-3 h-3" /> Directorate
            </label>
            <select
              value={selectedDept}
              disabled={!canFilterDepartments}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="ALL">All Directorates</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
              <Tag className="w-3 h-3" /> Asset Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-medium"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Resource Status */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
              <Layers className="w-3 h-3" /> Resource Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-medium"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Maintenance Status */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
              <Wrench className="w-3 h-3" /> Maintenance
            </label>
            <select
              value={selectedMaintStatus}
              onChange={(e) => setSelectedMaintStatus(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-medium"
            >
              {MAINTENANCE_STATUS_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold">Failed to load reports overview</h4>
            <p className="text-xs text-rose-700 mt-0.5">{error}</p>
          </div>
          <button
            onClick={() => fetchReports()}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <div className="w-10 h-10 bg-slate-100 rounded-xl" />
              <div className="w-24 h-4 bg-slate-100 rounded" />
              <div className="w-32 h-6 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Main Reports Data Presentation */}
      {data && (
        <>
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Registered Resources & Valuation */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Registered Assets</span>
                <div className="w-8 h-8 rounded-xl bg-eec-primary/10 text-eec-primary flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {data.overview.totalResources}
              </div>
              <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
                <span>Book Value:</span>
                <span className="font-bold text-slate-800 font-mono">
                  {formatETB(data.overview.totalCurrentValueETB || data.overview.totalPurchaseCostETB)}
                </span>
              </div>
            </div>

            {/* Card 2: Status Breakdown */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Operational Status</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-600">
                  {data.overview.available}
                </span>
                <span className="text-xs font-semibold text-slate-500">Available</span>
                <span className="text-slate-300">•</span>
                <span className="text-xl font-bold text-blue-600">
                  {data.overview.assigned}
                </span>
                <span className="text-xs font-semibold text-slate-500">Assigned</span>
              </div>
              <div className="mt-2 text-xs text-amber-700 flex items-center gap-1 font-medium">
                <Wrench className="w-3.5 h-3.5 text-amber-600" />
                <span>{data.overview.underMaintenance} currently in maintenance</span>
              </div>
            </div>

            {/* Card 3: Custody & Deployments */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Custody</span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <ArrowLeftRight className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {data.custody.totalActiveAssignments}
              </div>
              <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
                <span>Unassigned in Store:</span>
                <span className="font-bold text-slate-800 font-mono">
                  {data.custody.totalUnassigned} units
                </span>
              </div>
            </div>

            {/* Card 4: Maintenance Expenditure */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Maintenance Cost</span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 tracking-tight font-mono text-eec-primary">
                {formatETB(data.maintenance.totalActualCostETB)}
              </div>
              <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
                <span>Work Orders:</span>
                <span className="font-bold text-slate-800">
                  {data.maintenance.byStatus.total} total ({data.maintenance.byStatus.COMPLETED} completed)
                </span>
              </div>
            </div>
          </div>

          {/* Section: Resource Distributions (Category & Directorate) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Breakdown Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-eec-primary" />
                    Resource Distribution by Category
                  </h3>
                  <span className="text-xs text-slate-500 font-medium">
                    {data.distribution.byCategory.length} categories active
                  </span>
                </div>

                <div className="space-y-4">
                  {data.distribution.byCategory.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500">
                      No resources found matching filter criteria
                    </div>
                  ) : (
                    data.distribution.byCategory.map((cat) => {
                      const share = data.overview.totalResources > 0 
                        ? Math.round((cat.count / data.overview.totalResources) * 100) 
                        : 0;
                      return (
                        <div key={cat.category} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              {getCategoryIcon(cat.category)}
                              {cat.category.replace(/_/g, ' ')}
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="text-slate-500 font-mono">{cat.count} units ({share}%)</span>
                              <span className="font-bold text-slate-900 font-mono">{formatETB(cat.totalValueETB)}</span>
                            </div>
                          </div>
                          {/* Segmented bar */}
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                            <div
                              style={{ width: `${share}%` }}
                              className="bg-eec-primary h-full transition-all"
                              title={`${cat.count} total`}
                            />
                          </div>
                          <div className="flex items-center gap-4 text-[10px] text-slate-500 pt-0.5">
                            <span className="text-emerald-700">Available: {cat.available}</span>
                            <span className="text-blue-700">Assigned: {cat.assigned}</span>
                            <span className="text-amber-700">Maintenance: {cat.maintenance}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Directorate Distribution Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-eec-primary" />
                    Resource Allocation by Directorate
                  </h3>
                  <span className="text-xs text-slate-500 font-medium">
                    {data.distribution.byDepartment.length} directorates listed
                  </span>
                </div>

                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {data.distribution.byDepartment.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500">
                      No departmental allocations found
                    </div>
                  ) : (
                    data.distribution.byDepartment.map((d) => {
                      const share = data.overview.totalResources > 0
                        ? Math.round((d.count / data.overview.totalResources) * 100)
                        : 0;
                      return (
                        <div key={d.departmentId} className="p-3 bg-slate-50/70 border border-slate-100 rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <div className="font-bold text-slate-800">
                              <span>{d.departmentName}</span>
                              <span className="ml-1.5 text-[10px] text-slate-500 font-mono">({d.departmentCode})</span>
                            </div>
                            <span className="font-bold text-slate-900 font-mono">{formatETB(d.totalValueETB)}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>{d.count} total resources</span>
                            <span className="font-mono">{share}% corporate volume</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-200/60 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${share}%` }}
                              className="bg-eec-terracotta h-full transition-all"
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section: Custody & Maintenance Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Custody Distribution */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4 text-eec-primary" />
                  Custody & Personnel Deployment
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  {data.custody.totalActiveAssignments} assigned in field
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Top Active Custodians
                  </h4>
                  {data.custody.byEmployee.length === 0 ? (
                    <p className="text-xs text-slate-400 py-2">No active employee assignments found.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {data.custody.byEmployee.slice(0, 6).map((emp, i) => (
                        <div key={emp.employeeId || i} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs">
                          <div className="truncate mr-2">
                            <div className="font-bold text-slate-800 truncate">{emp.employeeName}</div>
                            <div className="text-[10px] text-slate-500 truncate">{emp.departmentName}</div>
                          </div>
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[11px] font-black rounded-lg shrink-0">
                            {emp.count} {emp.count === 1 ? 'unit' : 'units'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Active Deployments by Directorate
                  </h4>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {data.custody.byDepartment.map((cd) => (
                      <div key={cd.departmentId} className="flex items-center justify-between text-xs py-1 border-b border-slate-50">
                        <span className="text-slate-700 font-medium">{cd.departmentName}</span>
                        <span className="font-bold text-slate-900 font-mono">{cd.count} assigned</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Maintenance Work Orders & Expenditure */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-eec-primary" />
                  Maintenance Work Orders & Real Costs
                </h3>
                <span className="text-xs font-bold text-slate-900 font-mono">
                  {formatETB(data.maintenance.totalActualCostETB)}
                </span>
              </div>

              {/* Status badges row */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-200/60 text-center">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Submitted</div>
                  <div className="text-sm font-black text-slate-700">{data.maintenance.byStatus.SUBMITTED}</div>
                </div>
                <div className="p-2 bg-blue-50 rounded-xl border border-blue-200/60 text-center">
                  <div className="text-[10px] text-blue-700 font-bold uppercase">Approved</div>
                  <div className="text-sm font-black text-blue-800">{data.maintenance.byStatus.APPROVED}</div>
                </div>
                <div className="p-2 bg-amber-50 rounded-xl border border-amber-200/60 text-center">
                  <div className="text-[10px] text-amber-700 font-bold uppercase">Active</div>
                  <div className="text-sm font-black text-amber-800">{data.maintenance.byStatus.IN_PROGRESS}</div>
                </div>
                <div className="p-2 bg-orange-50 rounded-xl border border-orange-200/60 text-center">
                  <div className="text-[10px] text-orange-700 font-bold uppercase">On Hold</div>
                  <div className="text-sm font-black text-orange-800">{data.maintenance.byStatus.ON_HOLD}</div>
                </div>
                <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200/60 text-center">
                  <div className="text-[10px] text-emerald-700 font-bold uppercase">Complete</div>
                  <div className="text-sm font-black text-emerald-800">{data.maintenance.byStatus.COMPLETED}</div>
                </div>
                <div className="p-2 bg-rose-50 rounded-xl border border-rose-200/60 text-center">
                  <div className="text-[10px] text-rose-700 font-bold uppercase">Rejected</div>
                  <div className="text-sm font-black text-rose-800">{data.maintenance.byStatus.REJECTED}</div>
                </div>
              </div>

              {/* Maintenance cost by category table */}
              <div>
                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Actual Repair Costs by Category
                </h4>
                {data.maintenance.byCategory.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">No recorded repair expenditures.</p>
                ) : (
                  <div className="space-y-2">
                    {data.maintenance.byCategory.map((mc) => (
                      <div key={mc.category} className="p-2.5 bg-slate-50/70 border border-slate-100 rounded-xl flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                          {getCategoryIcon(mc.category)}
                          {mc.category.replace(/_/g, ' ')}
                          <span className="text-[10px] text-slate-400 font-normal">({mc.count} tickets)</span>
                        </span>
                        <span className="font-bold text-slate-900 font-mono">
                          {formatETB(mc.actualCostETB)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section: Unified Recent Activities Timeline */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-eec-primary" />
                  Recent Operational Audit Trail
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Latest resource assignments, custody transfers, and maintenance servicing activities
                </p>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                Showing {data.recentActivities.length} recent events
              </span>
            </div>

            {data.recentActivities.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                No recent activity records match the selected parameters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-500 text-[11px] font-bold uppercase">
                      <th className="py-2.5 px-3">Event Type</th>
                      <th className="py-2.5 px-3">Reference #</th>
                      <th className="py-2.5 px-3">Equipment / Resource</th>
                      <th className="py-2.5 px-3">Action Details</th>
                      <th className="py-2.5 px-3">Officer / Actor</th>
                      <th className="py-2.5 px-3">Directorate</th>
                      <th className="py-2.5 px-3 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.recentActivities.map((act) => (
                      <tr key={`${act.type}-${act.id}`} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-3">
                          {getActivityBadge(act.type)}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-700">
                          {act.referenceCode}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-800">{act.resourceName}</div>
                          <div className="font-mono text-[10px] text-slate-400">{act.resourceCode}</div>
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-medium">
                          {act.title}
                        </td>
                        <td className="py-3 px-3 text-slate-700 font-medium">
                          {act.actorName}
                        </td>
                        <td className="py-3 px-3 text-slate-500">
                          {act.departmentName || '—'}
                        </td>
                        <td className="py-3 px-3 text-right text-[11px] text-slate-500 font-mono">
                          {new Date(act.timestamp).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ReportsPage;
