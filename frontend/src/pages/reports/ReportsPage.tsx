import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { useAuth } from '../../context/AuthContext';
import { reportService, triggerFileDownload } from '../../services/reportService';
import { departmentService } from '../../services/departmentService';
import { 
  ReportOverviewData, 
  Department, 
  RecentActivityItem,
  AuditTrailResponse,
  ResourceLifecycleResponse
} from '../../types';
import { 
  Layers, 
  Wrench, 
  Building2,
  Filter,
  RefreshCw,
  AlertCircle,
  Clock,
  ArrowLeftRight,
  ShieldCheck,
  Tag,
  Truck,
  Compass,
  Laptop,
  Search,
  Download,
  FileSpreadsheet,
  FileText,
  History,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCheck,
  PlusCircle,
  Archive,
  UserCheck,
  Eye
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

const ACTION_TYPE_OPTIONS = [
  { value: 'ALL', label: 'All Action Types' },
  { value: 'RESOURCE_REGISTERED', label: 'Resource Registered' },
  { value: 'RESOURCE_ASSIGNED', label: 'Resource Assigned' },
  { value: 'CUSTODY_TRANSFERRED', label: 'Custody Transferred' },
  { value: 'RESOURCE_RETURNED', label: 'Resource Returned' },
  { value: 'MAINTENANCE_SUBMITTED', label: 'Fault Reported' },
  { value: 'MAINTENANCE_APPROVED', label: 'Maintenance Approved' },
  { value: 'MAINTENANCE_STARTED', label: 'Repair Started' },
  { value: 'MAINTENANCE_PROGRESS', label: 'Progress Updated' },
  { value: 'MAINTENANCE_ON_HOLD', label: 'Repair On Hold' },
  { value: 'MAINTENANCE_RESUMED', label: 'Repair Resumed' },
  { value: 'MAINTENANCE_COMPLETED', label: 'Repair Completed' },
  { value: 'MAINTENANCE_REJECTED', label: 'Maintenance Rejected' },
  { value: 'INSPECTION_RECORDED', label: 'QA Inspection Recorded' },
  { value: 'RESOURCE_UPDATED', label: 'Resource Updated' },
  { value: 'RESOURCE_STATUS_CHANGED', label: 'Status Changed' },
  { value: 'CONDITION_CHANGED', label: 'Condition Changed' },
  { value: 'RESOURCE_RETIRED', label: 'Asset Retired' },
  { value: 'RESOURCE_DISPOSED', label: 'Asset Disposed' },
  { value: 'RESOURCE_DELETED', label: 'Registry Record Deleted' },
];

export const ReportsPage: React.FC = () => {
  const { currentRole } = useAuth();

  // Tab State: 'overview' | 'audit'
  const [activeTab, setActiveTab] = useState<'overview' | 'audit'>('overview');

  // Overview Data State
  const [overviewData, setOverviewData] = useState<ReportOverviewData | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  // Overview Filters State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedMaintStatus, setSelectedMaintStatus] = useState('ALL');

  // Audit Trail State
  const [auditData, setAuditData] = useState<AuditTrailResponse | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditStartDate, setAuditStartDate] = useState('');
  const [auditEndDate, setAuditEndDate] = useState('');
  const [auditDept, setAuditDept] = useState('ALL');
  const [auditActionType, setAuditActionType] = useState('ALL');
  const [auditCategory, setAuditCategory] = useState('ALL');
  const [auditUser, setAuditUser] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const auditLimit = 15;

  // Export Loading States
  const [exportingXLSX, setExportingXLSX] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingLifecyclePDF, setExportingLifecyclePDF] = useState(false);

  // Resource Lifecycle Modal State
  const [lifecycleModalOpen, setLifecycleModalOpen] = useState(false);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);
  const [lifecycleData, setLifecycleData] = useState<ResourceLifecycleResponse | null>(null);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);

  // Load departments choices for filtering
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

  // Fetch Overview Data
  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const res = await reportService.getOverview({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        departmentId: selectedDept !== 'ALL' ? selectedDept : undefined,
        category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        maintenanceStatus: selectedMaintStatus !== 'ALL' ? selectedMaintStatus : undefined,
      });
      setOverviewData(res);
    } catch (err: any) {
      console.error('Failed to load reports overview', err);
      setOverviewError(err.response?.data?.message || err.message || 'Failed to generate reports overview');
    } finally {
      setOverviewLoading(false);
    }
  }, [startDate, endDate, selectedDept, selectedCategory, selectedStatus, selectedMaintStatus]);

  // Fetch Audit Trail Data
  const fetchAuditTrail = useCallback(async (pageToLoad = auditPage) => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const res = await reportService.getAuditTrail({
        search: auditSearch.trim() || undefined,
        startDate: auditStartDate || undefined,
        endDate: auditEndDate || undefined,
        departmentId: auditDept !== 'ALL' ? auditDept : undefined,
        actionType: auditActionType !== 'ALL' ? auditActionType : undefined,
        category: auditCategory !== 'ALL' ? auditCategory : undefined,
        userId: auditUser.trim() || undefined,
        page: pageToLoad,
        limit: auditLimit,
      });
      setAuditData(res);
      setAuditPage(pageToLoad);
    } catch (err: any) {
      console.error('Failed to load audit trail', err);
      setAuditError(err.response?.data?.message || err.message || 'Failed to load audit trail records');
    } finally {
      setAuditLoading(false);
    }
  }, [auditSearch, auditStartDate, auditEndDate, auditDept, auditActionType, auditCategory, auditUser, auditPage]);

  // Initial loads and tab switches
  useEffect(() => {
    if (activeTab === 'overview') {
      fetchOverview();
    } else {
      fetchAuditTrail(1);
    }
  }, [activeTab]);

  // Auto reload overview when its filters change
  useEffect(() => {
    if (activeTab === 'overview') {
      fetchOverview();
    }
  }, [fetchOverview]);

  // Handle Overview Filter Reset
  const handleResetOverviewFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedDept('ALL');
    setSelectedCategory('ALL');
    setSelectedStatus('ALL');
    setSelectedMaintStatus('ALL');
  };

  // Handle Audit Filter Reset
  const handleResetAuditFilters = () => {
    setAuditSearch('');
    setAuditStartDate('');
    setAuditEndDate('');
    setAuditDept('ALL');
    setAuditActionType('ALL');
    setAuditCategory('ALL');
    setAuditUser('');
    setAuditPage(1);
    // Trigger fetch with cleared values
    reportService.getAuditTrail({ page: 1, limit: auditLimit })
      .then(res => setAuditData(res))
      .catch(err => setAuditError(err.message));
  };

  const handleApplyAuditFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    fetchAuditTrail(1);
  };

  // Excel XLSX Export Action
  const handleExportXLSX = async () => {
    try {
      setExportingXLSX(true);
      const blob = await reportService.exportAuditXLSX({
        search: auditSearch.trim() || undefined,
        startDate: auditStartDate || undefined,
        endDate: auditEndDate || undefined,
        departmentId: auditDept !== 'ALL' ? auditDept : undefined,
        actionType: auditActionType !== 'ALL' ? auditActionType : undefined,
        category: auditCategory !== 'ALL' ? auditCategory : undefined,
        userId: auditUser.trim() || undefined,
      });
      const dateStr = new Date().toISOString().slice(0, 10);
      triggerFileDownload(blob, `EEC_Audit_Trail_${dateStr}.xlsx`);
    } catch (err: any) {
      console.error('Failed to export Excel XLSX', err);
      alert(err.response?.data?.message || 'Failed to export Excel report');
    } finally {
      setExportingXLSX(false);
    }
  };

  // PDF Export Action
  const handleExportPDF = async () => {
    try {
      setExportingPDF(true);
      const blob = await reportService.exportAuditPDF({
        search: auditSearch.trim() || undefined,
        startDate: auditStartDate || undefined,
        endDate: auditEndDate || undefined,
        departmentId: auditDept !== 'ALL' ? auditDept : undefined,
        actionType: auditActionType !== 'ALL' ? auditActionType : undefined,
        category: auditCategory !== 'ALL' ? auditCategory : undefined,
        userId: auditUser.trim() || undefined,
      });
      const dateStr = new Date().toISOString().slice(0, 10);
      triggerFileDownload(blob, `EEC_Audit_Trail_${dateStr}.pdf`);
    } catch (err: any) {
      console.error('Failed to export PDF', err);
      alert(err.response?.data?.message || 'Failed to export PDF report');
    } finally {
      setExportingPDF(false);
    }
  };

  // Open Lifecycle Dossier Modal
  const openLifecycleModal = async (resourceId: string) => {
    setSelectedResourceId(resourceId);
    setLifecycleModalOpen(true);
    setLifecycleLoading(true);
    setLifecycleError(null);
    try {
      const res = await reportService.getResourceLifecycle(resourceId);
      setLifecycleData(res);
    } catch (err: any) {
      console.error('Failed to fetch resource lifecycle history', err);
      setLifecycleError(err.response?.data?.message || err.message || 'Failed to load resource lifecycle history');
    } finally {
      setLifecycleLoading(false);
    }
  };

  // Export Lifecycle Dossier PDF
  const handleExportLifecyclePDF = async () => {
    if (!selectedResourceId || !lifecycleData) return;
    try {
      setExportingLifecyclePDF(true);
      const blob = await reportService.exportLifecyclePDF(selectedResourceId);
      const dateStr = new Date().toISOString().slice(0, 10);
      triggerFileDownload(blob, `EEC_Lifecycle_${lifecycleData.resource.itemCode}_${dateStr}.pdf`);
    } catch (err: any) {
      console.error('Failed to export lifecycle PDF', err);
      alert(err.response?.data?.message || 'Failed to export lifecycle dossier PDF');
    } finally {
      setExportingLifecyclePDF(false);
    }
  };

  const hasActiveOverviewFilters = Boolean(
    startDate ||
    endDate ||
    selectedDept !== 'ALL' ||
    selectedCategory !== 'ALL' ||
    selectedStatus !== 'ALL' ||
    selectedMaintStatus !== 'ALL'
  );

  const hasActiveAuditFilters = Boolean(
    auditSearch ||
    auditStartDate ||
    auditEndDate ||
    auditDept !== 'ALL' ||
    auditActionType !== 'ALL' ||
    auditCategory !== 'ALL' ||
    auditUser
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

  const getAuditActionBadge = (actionType: string) => {
    switch (actionType) {
      case 'RESOURCE_REGISTERED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <PlusCircle className="w-3 h-3" /> Registered
          </span>
        );
      case 'RESOURCE_ASSIGNED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <UserCheck className="w-3 h-3" /> Assigned
          </span>
        );
      case 'CUSTODY_TRANSFERRED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <ArrowLeftRight className="w-3 h-3" /> Transferred
          </span>
        );
      case 'RESOURCE_RETURNED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
            <CheckCircle2 className="w-3 h-3" /> Returned
          </span>
        );
      case 'MAINTENANCE_SUBMITTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3 h-3" /> Fault Reported
          </span>
        );
      case 'MAINTENANCE_APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <CheckCircle2 className="w-3 h-3" /> Work Approved
          </span>
        );
      case 'MAINTENANCE_STARTED':
      case 'MAINTENANCE_PROGRESS':
      case 'MAINTENANCE_RESUMED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-orange-800 border border-orange-200">
            <Wrench className="w-3 h-3" /> In Repair
          </span>
        );
      case 'MAINTENANCE_ON_HOLD':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-50 text-yellow-800 border border-yellow-200">
            <Clock className="w-3 h-3" /> On Hold
          </span>
        );
      case 'MAINTENANCE_COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Repaired
          </span>
        );
      case 'MAINTENANCE_REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      case 'INSPECTION_RECORDED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
            <FileCheck className="w-3 h-3" /> Inspection QA
          </span>
        );
      case 'RESOURCE_RETIRED':
      case 'RESOURCE_DISPOSED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <Archive className="w-3 h-3" /> {actionType === 'RESOURCE_DISPOSED' ? 'Disposed' : 'Retired'}
          </span>
        );
      case 'RESOURCE_DELETED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
            <XCircle className="w-3 h-3" /> Deleted
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-50 text-slate-700 border border-slate-200">
            <Tag className="w-3 h-3" /> {actionType.replace(/_/g, ' ')}
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">AVAILABLE</span>;
      case 'ASSIGNED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">ASSIGNED</span>;
      case 'MAINTENANCE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">MAINTENANCE</span>;
      case 'RETIRED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-300">RETIRED</span>;
      case 'DISPOSED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">DISPOSED</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Top Header */}
      <PageHeader
        title="Reports & Audits Dashboard"
        subtitle="Live corporate analytics, operational governance, detailed audit trails, and immutable lifecycle history"
      >
        <div className="flex flex-wrap items-center gap-3">
          {activeTab === 'overview' && overviewData?.metadata && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100/90 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold">
              <Building2 className="w-3.5 h-3.5 text-eec-primary" />
              <span>{overviewData.metadata.scopeLabel}</span>
            </div>
          )}
          {activeTab === 'overview' && (
            <button
              onClick={() => fetchOverview()}
              disabled={overviewLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${overviewLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
          {activeTab === 'audit' && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportXLSX}
                disabled={exportingXLSX || auditLoading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-60"
                title="Download filtered audit trail as formatted Microsoft Excel (.xlsx) workbook"
              >
                <FileSpreadsheet className={`w-3.5 h-3.5 text-emerald-600 ${exportingXLSX ? 'animate-spin' : ''}`} />
                {exportingXLSX ? 'Exporting Excel...' : 'Export Excel (.xlsx)'}
              </button>
              <button
                onClick={handleExportPDF}
                disabled={exportingPDF || auditLoading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-eec-primary hover:bg-eec-primary-dark text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-60"
                title="Download filtered audit trail report as PDF"
              >
                <FileText className={`w-3.5 h-3.5 text-white ${exportingPDF ? 'animate-spin' : ''}`} />
                {exportingPDF ? 'Exporting PDF...' : 'Export PDF'}
              </button>
            </div>
          )}
        </div>
      </PageHeader>

      {/* Tab Switcher */}
      <div className="flex items-center border-b border-slate-200 bg-white px-4 rounded-2xl shadow-sm">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 py-3.5 px-5 font-bold text-xs border-b-2 transition-all ${
            activeTab === 'overview'
              ? 'border-eec-primary text-eec-primary'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          Reports Overview (Metrics & Analytics)
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 py-3.5 px-5 font-bold text-xs border-b-2 transition-all ${
            activeTab === 'audit'
              ? 'border-eec-primary text-eec-primary'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          Detailed Audit Trail Explorer (Phase 2)
        </button>
      </div>

      {/* TAB 1: REPORTS OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Dynamic Filters Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                <Filter className="w-4 h-4 text-eec-primary" />
                Report Scope & Multi-Dimensional Filters
              </div>
              {hasActiveOverviewFilters && (
                <button
                  onClick={handleResetOverviewFilters}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 transition-colors"
                >
                  Reset All Filters
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Start Date */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Start Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:bg-white focus:ring-2 focus:ring-eec-primary/20 focus:border-eec-primary transition-all text-slate-700"
                  />
                </div>
              </div>

              {/* End Date */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  End Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:bg-white focus:ring-2 focus:ring-eec-primary/20 focus:border-eec-primary transition-all text-slate-700"
                  />
                </div>
              </div>

              {/* Directorate / Department */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Directorate
                </label>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  disabled={!canFilterDepartments}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:bg-white focus:ring-2 focus:ring-eec-primary/20 focus:border-eec-primary transition-all text-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="ALL">All Directorates</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} - {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Asset Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:bg-white focus:ring-2 focus:ring-eec-primary/20 focus:border-eec-primary transition-all text-slate-700"
                >
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Resource Status */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Resource Status
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:bg-white focus:ring-2 focus:ring-eec-primary/20 focus:border-eec-primary transition-all text-slate-700"
                >
                  {STATUS_OPTIONS.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Maintenance Status */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Maintenance Status
                </label>
                <select
                  value={selectedMaintStatus}
                  onChange={(e) => setSelectedMaintStatus(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:bg-white focus:ring-2 focus:ring-eec-primary/20 focus:border-eec-primary transition-all text-slate-700"
                >
                  {MAINTENANCE_STATUS_OPTIONS.map((mst) => (
                    <option key={mst.value} value={mst.value}>
                      {mst.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Loading and Error States */}
          {overviewLoading && (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-eec-primary animate-spin mx-auto" />
              <p className="text-sm font-semibold text-slate-600">
                Calculating corporate analytics from database records...
              </p>
            </div>
          )}

          {overviewError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-rose-900">Failed to Load Reports</h4>
                <p className="text-xs text-rose-700 mt-1">{overviewError}</p>
                <button
                  onClick={() => fetchOverview()}
                  className="mt-3 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold"
                >
                  Retry Query
                </button>
              </div>
            </div>
          )}

          {/* Overview Dashboard Content */}
          {!overviewLoading && !overviewError && overviewData && (
            <div className="space-y-6">
              {/* Metric Cards Row */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-card">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Total Registered
                  </div>
                  <div className="text-2xl font-black text-slate-800 mt-1">
                    {overviewData.overview.totalResources}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">In Corporate Registry</div>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-card">
                  <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
                    Available
                  </div>
                  <div className="text-2xl font-black text-emerald-700 mt-1">
                    {overviewData.overview.available}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Ready in store / depot</div>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-card">
                  <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                    Assigned
                  </div>
                  <div className="text-2xl font-black text-blue-700 mt-1">
                    {overviewData.overview.assigned}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">In active staff custody</div>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-card">
                  <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
                    Under Repair
                  </div>
                  <div className="text-2xl font-black text-amber-700 mt-1">
                    {overviewData.overview.underMaintenance}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">In workshop / service</div>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-card">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Retired / Scrap
                  </div>
                  <div className="text-2xl font-black text-slate-700 mt-1">
                    {overviewData.overview.retired + overviewData.overview.disposed}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {overviewData.overview.retired} retired, {overviewData.overview.disposed} disposed
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-card">
                  <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
                    Current Book Value
                  </div>
                  <div className="text-lg font-black text-indigo-900 mt-1 truncate">
                    {formatETB(overviewData.overview.totalCurrentValueETB)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 truncate">
                    Acq: {formatETB(overviewData.overview.totalPurchaseCostETB)}
                  </div>
                </div>
              </div>

              {/* Middle Row: Category Distribution & Directorate Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Category Distribution */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
                  <h3 className="text-sm font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-eec-primary" />
                    Resource Distribution by Asset Category
                  </h3>
                  {overviewData.distribution.byCategory.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400">
                      No category distribution data matches active filters.
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {overviewData.distribution.byCategory.map((cat) => {
                        const pct = overviewData.overview.totalResources > 0
                          ? Math.round((cat.count / overviewData.overview.totalResources) * 100)
                          : 0;
                        return (
                          <div key={cat.category} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2 font-bold text-slate-700">
                                {getCategoryIcon(cat.category)}
                                <span>{cat.category.replace(/_/g, ' ')}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-extrabold text-slate-900 mr-2">{cat.count} units</span>
                                <span className="text-[10px] text-slate-400">({pct}%)</span>
                              </div>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-eec-primary h-2 rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <div className="text-[10px] text-slate-400 text-right">
                              Book value: {formatETB(cat.totalValueETB)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Directorate Distribution */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
                  <h3 className="text-sm font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-eec-primary" />
                    Resource Allocation by Directorate
                  </h3>
                  {overviewData.distribution.byDepartment.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400">
                      No directorate allocation data matches active filters.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-bold uppercase">
                            <th className="py-2">Directorate</th>
                            <th className="py-2 text-center">Total Assets</th>
                            <th className="py-2 text-right">Valuation</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {overviewData.distribution.byDepartment.map((dept) => (
                            <tr key={dept.departmentId} className="hover:bg-slate-50/50">
                              <td className="py-2.5">
                                <div className="font-bold text-slate-800">{dept.departmentName}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{dept.departmentCode}</div>
                              </td>
                              <td className="py-2.5 text-center font-bold text-slate-800">
                                {dept.count}
                              </td>
                              <td className="py-2.5 text-right font-mono font-bold text-slate-700">
                                {formatETB(dept.totalValueETB)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Maintenance Metrics Section */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-amber-600" />
                      Maintenance Service & Repair Cost Metrics
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Actual ETB repair expenditures logged across work orders and inspections
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Estimated Repairs</div>
                      <div className="text-sm font-black text-slate-700">
                        {formatETB(overviewData.maintenance.totalEstimatedCostETB)}
                      </div>
                    </div>
                    <div className="text-right pl-4 border-l border-slate-200">
                      <div className="text-[10px] font-bold text-emerald-600 uppercase">Actual Expenditure</div>
                      <div className="text-base font-black text-emerald-700">
                        {formatETB(overviewData.maintenance.totalActualCostETB)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-3 border-t border-slate-100">
                  <div className="p-3 bg-slate-50 rounded-xl text-center">
                    <div className="text-[10px] font-bold text-slate-500">SUBMITTED</div>
                    <div className="text-lg font-black text-slate-800 mt-1">
                      {overviewData.maintenance.byStatus.SUBMITTED}
                    </div>
                  </div>
                  <div className="p-3 bg-indigo-50 rounded-xl text-center">
                    <div className="text-[10px] font-bold text-indigo-700">APPROVED</div>
                    <div className="text-lg font-black text-indigo-900 mt-1">
                      {overviewData.maintenance.byStatus.APPROVED}
                    </div>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-xl text-center">
                    <div className="text-[10px] font-bold text-amber-800">IN PROGRESS</div>
                    <div className="text-lg font-black text-amber-900 mt-1">
                      {overviewData.maintenance.byStatus.IN_PROGRESS}
                    </div>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-xl text-center">
                    <div className="text-[10px] font-bold text-yellow-800">ON HOLD</div>
                    <div className="text-lg font-black text-yellow-900 mt-1">
                      {overviewData.maintenance.byStatus.ON_HOLD}
                    </div>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-xl text-center">
                    <div className="text-[10px] font-bold text-emerald-700">COMPLETED</div>
                    <div className="text-lg font-black text-emerald-800 mt-1">
                      {overviewData.maintenance.byStatus.COMPLETED}
                    </div>
                  </div>
                  <div className="p-3 bg-rose-50 rounded-xl text-center">
                    <div className="text-[10px] font-bold text-rose-700">REJECTED</div>
                    <div className="text-lg font-black text-rose-800 mt-1">
                      {overviewData.maintenance.byStatus.REJECTED}
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Operational Activities Feed */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-eec-primary" />
                      Recent Operational Activity Feed
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Click any equipment name to inspect its complete immutable lifecycle dossier
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">
                    Showing {overviewData.recentActivities.length} recent events
                  </span>
                </div>

                {overviewData.recentActivities.length === 0 ? (
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
                          <th className="py-2.5 px-3 text-center">Lifecycle</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {overviewData.recentActivities.map((act) => (
                          <tr key={`${act.type}-${act.id}`} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3 px-3">
                              {getActivityBadge(act.type)}
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-slate-700">
                              {act.referenceCode}
                            </td>
                            <td className="py-3 px-3">
                              <button
                                onClick={() => openLifecycleModal(act.resourceId)}
                                className="text-left group"
                              >
                                <div className="font-bold text-slate-800 group-hover:text-eec-primary transition-colors flex items-center gap-1">
                                  {act.resourceName}
                                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <div className="font-mono text-[10px] text-slate-400">{act.resourceCode}</div>
                              </button>
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
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() => openLifecycleModal(act.resourceId)}
                                className="p-1 text-slate-400 hover:text-eec-primary hover:bg-slate-100 rounded-lg transition-colors"
                                title="View Resource Lifecycle Dossier"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DETAILED AUDIT TRAIL EXPLORER (PHASE 2) */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          {/* Audit Search and Filters Panel */}
          <form onSubmit={handleApplyAuditFilters} className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                <Search className="w-4 h-4 text-eec-primary" />
                Audit Trail Search & Operational Filters
              </div>
              <div className="flex items-center gap-3">
                {hasActiveAuditFilters && (
                  <button
                    type="button"
                    onClick={handleResetAuditFilters}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-700 transition-colors"
                  >
                    Reset Filters
                  </button>
                )}
                <button
                  type="submit"
                  disabled={auditLoading}
                  className="px-4 py-1.5 bg-eec-primary hover:bg-eec-primary-dark text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-60"
                >
                  Apply Filters
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by equipment name, item code, reference ID (ASG/TRF/MR), or actor name..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-eec-primary/20 focus:border-eec-primary transition-all text-slate-700 placeholder:text-slate-400"
              />
            </div>

            {/* Filter Dropdowns Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Start Date */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={auditStartDate}
                  onChange={(e) => setAuditStartDate(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:bg-white focus:ring-2 focus:ring-eec-primary/20 focus:border-eec-primary transition-all text-slate-700"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={auditEndDate}
                  onChange={(e) => setAuditEndDate(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:bg-white focus:ring-2 focus:ring-eec-primary/20 focus:border-eec-primary transition-all text-slate-700"
                />
              </div>

              {/* Action Type */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Action Type
                </label>
                <select
                  value={auditActionType}
                  onChange={(e) => setAuditActionType(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:bg-white focus:ring-2 focus:ring-eec-primary/20 focus:border-eec-primary transition-all text-slate-700"
                >
                  {ACTION_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Directorate */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Directorate
                </label>
                <select
                  value={auditDept}
                  onChange={(e) => setAuditDept(e.target.value)}
                  disabled={!canFilterDepartments}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:bg-white focus:ring-2 focus:ring-eec-primary/20 focus:border-eec-primary transition-all text-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="ALL">All Directorates</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} - {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Asset Category
                </label>
                <select
                  value={auditCategory}
                  onChange={(e) => setAuditCategory(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:bg-white focus:ring-2 focus:ring-eec-primary/20 focus:border-eec-primary transition-all text-slate-700"
                >
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* User / Actor */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Actor / User
                </label>
                <input
                  type="text"
                  placeholder="Filter by officer name..."
                  value={auditUser}
                  onChange={(e) => setAuditUser(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:bg-white focus:ring-2 focus:ring-eec-primary/20 focus:border-eec-primary transition-all text-slate-700"
                />
              </div>
            </div>
          </form>

          {/* Audit Loading & Error */}
          {auditLoading && (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-eec-primary animate-spin mx-auto" />
              <p className="text-sm font-semibold text-slate-600">
                Fetching audited operational events from database...
              </p>
            </div>
          )}

          {auditError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-rose-900">Failed to Load Audit Trail</h4>
                <p className="text-xs text-rose-700 mt-1">{auditError}</p>
                <button
                  onClick={() => fetchAuditTrail(1)}
                  className="mt-3 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold"
                >
                  Retry Search
                </button>
              </div>
            </div>
          )}

          {/* Audit Table */}
          {!auditLoading && !auditError && auditData && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="text-xs text-slate-600 font-bold">
                  Showing {auditData.events.length} of {auditData.pagination.total} audit records
                </div>
                <div className="text-xs text-slate-400 font-medium">
                  Page {auditData.pagination.page} of {Math.max(1, auditData.pagination.totalPages)}
                </div>
              </div>

              {auditData.events.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-sm font-bold text-slate-700">No audit events match your search criteria</p>
                  <p className="text-xs text-slate-400">
                    Try adjusting the search query, action type, or date range filters.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                        <th className="py-2.5 px-3">Timestamp</th>
                        <th className="py-2.5 px-3">Actor / Role</th>
                        <th className="py-2.5 px-3">Action</th>
                        <th className="py-2.5 px-3">Affected Equipment</th>
                        <th className="py-2.5 px-3">Reference ID</th>
                        <th className="py-2.5 px-3">Details / Narrative</th>
                        <th className="py-2.5 px-3 text-center">Lifecycle</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditData.events.map((ev) => (
                        <tr key={ev.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                            {new Date(ev.timestamp).toLocaleString()}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="font-bold text-slate-800">{ev.actorName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{ev.actorRole}</div>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            {getAuditActionBadge(ev.actionType)}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            {ev.resourceId ? (
                              <button
                                onClick={() => openLifecycleModal(ev.resourceId!)}
                                className="text-left group"
                              >
                                <div className="font-bold text-slate-800 group-hover:text-eec-primary transition-colors flex items-center gap-1">
                                  {ev.resourceName || 'Unnamed Asset'}
                                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <div className="font-mono text-[10px] text-slate-400">
                                  {ev.resourceCode || '—'} {ev.resourceCategory ? `• ${ev.resourceCategory}` : ''}
                                </div>
                              </button>
                            ) : (
                              <span className="text-slate-400 font-mono">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-700 whitespace-nowrap">
                            {ev.referenceId || '—'}
                          </td>
                          <td className="py-3 px-3 text-slate-600 max-w-md">
                            <p className="line-clamp-2">{ev.details || '—'}</p>
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            {ev.resourceId ? (
                              <button
                                onClick={() => openLifecycleModal(ev.resourceId!)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-colors"
                                title="Inspect Complete Lifecycle History"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Dossier
                              </button>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Controls */}
              {auditData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                  <div className="text-xs text-slate-500 font-medium">
                    Showing {((auditData.pagination.page - 1) * auditLimit) + 1} to{' '}
                    {Math.min(auditData.pagination.page * auditLimit, auditData.pagination.total)} of{' '}
                    {auditData.pagination.total} records
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fetchAuditTrail(auditData.pagination.page - 1)}
                      disabled={auditData.pagination.page <= 1 || auditLoading}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" /> Previous
                    </button>
                    <span className="text-xs font-bold text-slate-700 px-2">
                      {auditData.pagination.page} / {auditData.pagination.totalPages}
                    </span>
                    <button
                      onClick={() => fetchAuditTrail(auditData.pagination.page + 1)}
                      disabled={auditData.pagination.page >= auditData.pagination.totalPages || auditLoading}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* RESOURCE LIFECYCLE DOSSIER MODAL */}
      {lifecycleModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-100">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <History className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-extrabold tracking-wide uppercase">
                    Resource Lifecycle Dossier
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Complete immutable chronological audit history
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {lifecycleData && (
                  <button
                    onClick={handleExportLifecyclePDF}
                    disabled={exportingLifecyclePDF}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-60"
                    title="Export complete dossier to PDF"
                  >
                    <Download className={`w-3.5 h-3.5 ${exportingLifecyclePDF ? 'animate-spin' : ''}`} />
                    {exportingLifecyclePDF ? 'Exporting PDF...' : 'Export Dossier (PDF)'}
                  </button>
                )}
                <button
                  onClick={() => setLifecycleModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
              {lifecycleLoading && (
                <div className="py-20 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-eec-primary animate-spin mx-auto" />
                  <p className="text-sm font-semibold text-slate-600">
                    Assembling chronological lifecycle audit timeline...
                  </p>
                </div>
              )}

              {lifecycleError && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-rose-900">Access Restricted / Error</h4>
                    <p className="text-xs text-rose-700 mt-1">{lifecycleError}</p>
                  </div>
                </div>
              )}

              {!lifecycleLoading && !lifecycleError && lifecycleData && (
                <div className="space-y-6">
                  {/* Asset Summary Card */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-black text-slate-900">
                            {lifecycleData.resource.name}
                          </h4>
                          {getStatusBadge(lifecycleData.resource.status)}
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {lifecycleData.resource.condition} CONDITION
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-mono mt-1">
                          <span>Item Code: <strong className="text-slate-800">{lifecycleData.resource.itemCode}</strong></span>
                          <span>•</span>
                          <span>Category: <strong className="text-slate-800">{lifecycleData.resource.category}</strong></span>
                          <span>•</span>
                          <span>Directorate: <strong className="text-slate-800">{lifecycleData.resource.departmentName || '—'}</strong></span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Current Custodian</div>
                        <div className="text-xs font-bold text-slate-800">
                          {lifecycleData.resource.currentAssigneeName || 'Central Store (Unassigned)'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Book: {formatETB(lifecycleData.resource.currentValueETB)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Chronological Timeline */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="text-xs font-extrabold uppercase text-slate-800 tracking-wider flex items-center gap-2">
                        <History className="w-4 h-4 text-eec-primary" />
                        Chronological Event Log ({lifecycleData.events.length} Historical Events)
                      </h4>
                      <span className="text-[11px] text-slate-400">
                        Earliest Registration → Current State
                      </span>
                    </div>

                    {lifecycleData.events.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400">
                        No historical audit records found for this asset.
                      </div>
                    ) : (
                      <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                        {lifecycleData.events.map((event) => (
                          <div key={event.id} className="relative group">
                            {/* Bullet icon */}
                            <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-white border-2 border-eec-primary group-hover:scale-125 transition-transform" />

                            <div className="bg-slate-50/70 hover:bg-slate-100/70 border border-slate-200/70 rounded-xl p-3.5 transition-all space-y-1.5">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  {getAuditActionBadge(event.actionType)}
                                  {event.referenceId && (
                                    <span className="font-mono text-[11px] font-bold text-slate-700">
                                      #{event.referenceId}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] font-mono text-slate-400">
                                  {new Date(event.timestamp).toLocaleString()}
                                </span>
                              </div>

                              <p className="text-xs text-slate-700 font-medium">
                                {event.details || 'Lifecycle event recorded'}
                              </p>

                              <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-1 border-t border-slate-200/40">
                                <span>Recorded by: <strong className="text-slate-600">{event.actorName}</strong> ({event.actorRole})</span>
                                {event.departmentName && (
                                  <>
                                    <span>•</span>
                                    <span>Directorate: <strong className="text-slate-600">{event.departmentName}</strong></span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-white border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Ethiopian Electric Construction Corporation • Asset Governance
              </span>
              <button
                onClick={() => setLifecycleModalOpen(false)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
