import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { maintenanceService, MaintenanceMetrics } from '../../services/maintenanceService';
import { resourceService } from '../../services/resourceService';
import { MaintenanceTicket, Resource, MaintenanceStatus } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { CategoryBadge } from '../../components/ui/CategoryBadge';
import { Modal } from '../../components/ui/Modal';
import { 
  Wrench, 
  AlertCircle, 
  Check, 
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Search,
  CheckCircle,
  XCircle,
  PlayCircle,
  PauseCircle,
  Activity,
  Layers,
  Building2,
  Eye,
  User,
  Calendar,
  History,
  Tag
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export const MaintenancePage: React.FC = () => {
  const location = useLocation();
  const { currentRole, currentUser } = useAuth();
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [metrics, setMetrics] = useState<MaintenanceMetrics | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Create Ticket Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedResourceId, setSelectedResourceId] = useState('');
  const [ticketTitle, setTicketTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [technician, setTechnician] = useState('');
  const [estimatedCost, setEstimatedCost] = useState<number>(10000);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Details Modal
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDetailTicket, setSelectedDetailTicket] = useState<MaintenanceTicket | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Review Modal (Approve / Reject)
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [reviewComments, setReviewComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [reviewing, setReviewing] = useState(false);

  // Status & Progress Update Modal
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [activeTicket, setActiveTicket] = useState<MaintenanceTicket | null>(null);
  const [targetStatus, setTargetStatus] = useState<MaintenanceStatus>('IN_PROGRESS');
  const [diagnosis, setDiagnosis] = useState('');
  const [repairActions, setRepairActions] = useState('');
  const [partsReplaced, setPartsReplaced] = useState('');
  const [actualCost, setActualCost] = useState<number>(0);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [progressNotes, setProgressNotes] = useState('');
  const [holdReason, setHoldReason] = useState('');
  const [outcome, setOutcome] = useState<'REPAIRED_FIT_FOR_USE' | 'REQUIRES_FURTHER_REPAIR' | 'BEYOND_ECONOMIC_REPAIR' | 'DISPOSED'>('REPAIRED_FIT_FOR_USE');
  const [conditionOnCompletion, setConditionOnCompletion] = useState('GOOD');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Optional QA during completion
  const [includeQA, setIncludeQA] = useState(false);
  const [compQAPassed, setCompQAPassed] = useState(true);
  const [compQAFindings, setCompQAFindings] = useState('');
  const [compQACertNumber, setCompQACertNumber] = useState('');
  const [compQAType, setCompQAType] = useState<'CALIBRATION' | 'ROADWORTHINESS_BOLO' | 'HYDRAULIC' | 'SAFETY_AUDIT' | 'MAINTENANCE_QA'>('MAINTENANCE_QA');

  // Inline QA Inspection Modal
  const [isQAModalOpen, setIsQAModalOpen] = useState(false);
  const [qaPassed, setQaPassed] = useState(true);
  const [qaFindings, setQaFindings] = useState('');
  const [qaRemarks, setQaRemarks] = useState('');
  const [certNumber, setCertNumber] = useState('');
  const [recordingQA, setRecordingQA] = useState(false);

  // Role permissions
  const isTechnician = currentRole === 'IT_TECHNICIAN';
  const isAdmin = currentRole === 'ADMIN';
  const isManager = currentRole === 'DEPARTMENT_MANAGER';
  const canPerformTechnicalRepairs = isTechnician || isAdmin;
  const canReview = isAdmin || isManager;

  const loadData = async () => {
    setLoading(true);
    setActionError(null);
    try {
      const [tList, mMetrics] = await Promise.all([
        maintenanceService.getTickets({
          status: statusFilter,
          priority: priorityFilter,
          search: searchQuery,
        }),
        maintenanceService.getMetrics(),
      ]);
      setTickets(tList);
      setMetrics(mMetrics);

      // Load resources for equipment selector strictly per role boundaries
      let authorizedResources: Resource[] = [];
      if (currentRole === 'EMPLOYEE') {
        // Exclusively active assigned assets in employee's custody (excluding any already under MAINTENANCE)
        const myAssets = await resourceService.getMyAssets().catch(() => []);
        authorizedResources = myAssets.filter((r) => r.status !== 'MAINTENANCE');
      } else if (currentRole === 'DEPARTMENT_MANAGER') {
        // Scoped to own department resources only
        const deptResources = await resourceService.getAll().catch(() => []);
        authorizedResources = deptResources.filter(
          (r) =>
            ((r.departmentId || r.currentDepartmentId) === currentUser?.departmentId) &&
            r.status !== 'MAINTENANCE'
        );
      } else if (currentRole === 'STORE_KEEPER') {
        // Inventory-related visibility: unassigned resources or store department assets
        const allResources = await resourceService.getAll({ limit: 100 }).catch(() => []);
        authorizedResources = allResources.filter(
          (r) =>
            (!r.currentAssigneeId || (r.departmentId || r.currentDepartmentId) === currentUser?.departmentId) &&
            r.status !== 'MAINTENANCE'
        );
      } else {
        // IT_TECHNICIAN and ADMIN: enterprise-wide equipment selection
        const allResources = await resourceService.getAll({ limit: 100 }).catch(() => []);
        authorizedResources = allResources.filter((r) => r.status !== 'MAINTENANCE');
      }

      setResources(authorizedResources);

      // Pre-select resource if navigated from Resource Detail "Report Fault" action
      if (location.state?.openReportModal && location.state?.resourceId) {
        setSelectedResourceId(location.state.resourceId);
        setIsCreateModalOpen(true);
      } else if (authorizedResources.length > 0) {
        if (!selectedResourceId || !authorizedResources.some((r) => r.id === selectedResourceId)) {
          setSelectedResourceId(authorizedResources[0].id);
        }
      } else {
        setSelectedResourceId('');
      }
    } catch (err: any) {
      console.error('Failed to load maintenance data', err);
      setActionError(err.response?.data?.message || err.message || 'Failed to load maintenance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, priorityFilter, searchQuery]);

  const handleOpenDetailModal = async (ticket: MaintenanceTicket) => {
    setSelectedDetailTicket(ticket);
    setIsDetailModalOpen(true);
    setLoadingDetail(true);
    try {
      const full = await maintenanceService.getById(ticket.id);
      if (full) {
        setSelectedDetailTicket(full);
      }
    } catch (err: any) {
      console.error('Failed to load full ticket details:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Helper functions for opening modal with specific action context
  const openStartRepairModal = (ticket: MaintenanceTicket) => {
    setActiveTicket(ticket);
    setTargetStatus('IN_PROGRESS');
    setDiagnosis(ticket.diagnosis || '');
    setRepairActions(ticket.repairActions || '');
    setPartsReplaced(ticket.partsReplaced || '');
    setActualCost(ticket.actualCostETB || ticket.estimatedCostETB || 0);
    setResolutionNotes(ticket.resolutionNotes || '');
    setProgressNotes('');
    setHoldReason('');
    setUpdateError(null);
    setIsUpdateModalOpen(true);
  };

  const openUpdateProgressModal = (ticket: MaintenanceTicket) => {
    setActiveTicket(ticket);
    setTargetStatus('IN_PROGRESS');
    setDiagnosis(ticket.diagnosis || '');
    setRepairActions(ticket.repairActions || '');
    setPartsReplaced(ticket.partsReplaced || '');
    setActualCost(ticket.actualCostETB || ticket.estimatedCostETB || 0);
    setResolutionNotes(ticket.resolutionNotes || '');
    setProgressNotes('');
    setHoldReason('');
    setUpdateError(null);
    setIsUpdateModalOpen(true);
  };

  const openPutOnHoldModal = (ticket: MaintenanceTicket) => {
    setActiveTicket(ticket);
    setTargetStatus('ON_HOLD');
    setDiagnosis(ticket.diagnosis || '');
    setRepairActions(ticket.repairActions || '');
    setPartsReplaced(ticket.partsReplaced || '');
    setActualCost(ticket.actualCostETB || ticket.estimatedCostETB || 0);
    setResolutionNotes(ticket.resolutionNotes || '');
    setProgressNotes('');
    setHoldReason('');
    setUpdateError(null);
    setIsUpdateModalOpen(true);
  };

  const openCompleteRepairModal = (ticket: MaintenanceTicket) => {
    setActiveTicket(ticket);
    setTargetStatus('COMPLETED');
    setDiagnosis(ticket.diagnosis || '');
    setRepairActions(ticket.repairActions || '');
    setPartsReplaced(ticket.partsReplaced || '');
    setActualCost(ticket.actualCostETB || ticket.estimatedCostETB || 0);
    setResolutionNotes(ticket.resolutionNotes || '');
    setProgressNotes('');
    setHoldReason('');
    setOutcome('REPAIRED_FIT_FOR_USE');
    setConditionOnCompletion('GOOD');
    setIncludeQA(false);
    setUpdateError(null);
    setIsUpdateModalOpen(true);
  };

  const openResumeWorkModal = (ticket: MaintenanceTicket) => {
    setActiveTicket(ticket);
    setTargetStatus('IN_PROGRESS');
    setDiagnosis(ticket.diagnosis || '');
    setRepairActions(ticket.repairActions || '');
    setPartsReplaced(ticket.partsReplaced || '');
    setActualCost(ticket.actualCostETB || ticket.estimatedCostETB || 0);
    setResolutionNotes(ticket.resolutionNotes || '');
    setProgressNotes('');
    setHoldReason('');
    setUpdateError(null);
    setIsUpdateModalOpen(true);
  };

  const openQAModal = (ticket: MaintenanceTicket) => {
    setActiveTicket(ticket);
    setQaPassed(true);
    setQaFindings('');
    setQaRemarks('');
    setCertNumber('');
    setIsQAModalOpen(true);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResourceId) {
      if (currentRole === 'EMPLOYEE' && resources.length === 0) {
        setCreateError('You currently have no assigned equipment eligible for maintenance reporting.');
      } else {
        setCreateError('Please select a piece of equipment to report.');
      }
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const created = await maintenanceService.createTicket({
        resourceId: selectedResourceId,
        title: ticketTitle,
        description,
        priority,
        assignedTechnicianName: technician || undefined,
        estimatedCostETB: estimatedCost ? Number(estimatedCost) : undefined,
      });
      setIsCreateModalOpen(false);
      setTicketTitle('');
      setDescription('');
      setEstimatedCost(10000);
      setTechnician('');
      setToastMessage(`Maintenance request ${created.requestNumber || created.id} submitted successfully! Equipment marked under maintenance.`);
      setTimeout(() => setToastMessage(null), 5000);
      await loadData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Ticket creation failed';
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleReviewTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket) return;
    setReviewing(true);
    setActionError(null);
    try {
      await maintenanceService.reviewTicket(activeTicket.id, {
        action: reviewAction,
        comments: reviewComments || undefined,
        rejectionReason: reviewAction === 'REJECT' ? rejectionReason : undefined,
      });
      setIsReviewModalOpen(false);
      setReviewComments('');
      setRejectionReason('');
      setToastMessage(`Maintenance request ${activeTicket.requestNumber} ${reviewAction.toLowerCase()}ed successfully`);
      setTimeout(() => setToastMessage(null), 3500);
      await loadData();
      if (selectedDetailTicket?.id === activeTicket.id) {
        const full = await maintenanceService.getById(activeTicket.id);
        if (full) setSelectedDetailTicket(full);
      }
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || 'Review action failed');
    } finally {
      setReviewing(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket) return;
    if (targetStatus === 'ON_HOLD' && !holdReason.trim()) {
      setUpdateError('A specific reason is mandatory when placing a work order on hold');
      return;
    }
    setUpdating(true);
    setUpdateError(null);
    try {
      const res = await maintenanceService.updateStatus(activeTicket.id, targetStatus, {
        diagnosis: diagnosis || undefined,
        repairActions: repairActions || undefined,
        partsReplaced: partsReplaced || undefined,
        actualCostETB: actualCost ? Number(actualCost) : undefined,
        resolutionNotes: resolutionNotes || undefined,
        outcome: targetStatus === 'COMPLETED' ? outcome : undefined,
        conditionOnCompletion: targetStatus === 'COMPLETED' ? conditionOnCompletion : undefined,
        notes: targetStatus === 'ON_HOLD' ? holdReason : (progressNotes || resolutionNotes || diagnosis || undefined),
      });

      // Post-repair QA inspection
      if (targetStatus === 'COMPLETED' && includeQA) {
        try {
          await maintenanceService.recordInspection({
            ticketId: activeTicket.id,
            resourceId: activeTicket.resourceId,
            inspectionType: compQAType,
            passed: compQAPassed,
            findings: compQAFindings || 'Post-repair verification and QA certification',
            certificationNumber: compQACertNumber || undefined,
            remarks: 'Recorded as part of repair completion workflow',
          });
        } catch (qaErr) {
          console.warn('Inspection recording warning:', qaErr);
        }
      }

      setIsUpdateModalOpen(false);
      setHoldReason('');
      setProgressNotes('');
      setIncludeQA(false);
      const custodyNote = res.custodyAction === 'RETURNED_TO_CUSTODIAN'
        ? ' Asset safely restored to custodian custody.'
        : res.custodyAction === 'RETURNED_TO_AVAILABLE'
        ? ' Asset safely returned to central store.'
        : res.custodyAction === 'REMAINS_IN_MAINTENANCE'
        ? ' Asset remains in maintenance (requires further repair).'
        : '';
      setToastMessage(`Work order ${activeTicket.requestNumber || activeTicket.id} updated to ${targetStatus}.${custodyNote}`);
      setTimeout(() => setToastMessage(null), 5000);
      await loadData();
      if (selectedDetailTicket?.id === activeTicket.id) {
        const full = await maintenanceService.getById(activeTicket.id);
        if (full) setSelectedDetailTicket(full);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Status update failed';
      setUpdateError(msg);
    } finally {
      setUpdating(false);
    }
  };

  const handleRecordQA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket) return;
    setRecordingQA(true);
    setActionError(null);
    try {
      await maintenanceService.recordInspection({
        ticketId: activeTicket.id,
        resourceId: activeTicket.resourceId,
        inspectionType: 'MAINTENANCE_QA',
        passed: qaPassed,
        findings: qaFindings,
        certificationNumber: certNumber || undefined,
        remarks: qaRemarks,
      });
      setIsQAModalOpen(false);
      setToastMessage(`QA Inspection recorded as ${qaPassed ? 'PASSED' : 'FAILED'}`);
      setTimeout(() => setToastMessage(null), 3500);
      await loadData();
      if (selectedDetailTicket?.id === activeTicket.id) {
        const full = await maintenanceService.getById(activeTicket.id);
        if (full) setSelectedDetailTicket(full);
      }
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || 'QA recording failed');
    } finally {
      setRecordingQA(false);
    }
  };

  const formatETB = (val: number) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-slideUp">
          <Check className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Global Error Banner */}
      {actionError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-500 hover:text-rose-700 font-bold">
            Dismiss
          </button>
        </div>
      )}

      <PageHeader
        title="Maintenance & Fleet Diagnostics"
        subtitle="Track equipment defect reports, engineering diagnostics, technician servicing, and safe custody returns"
        breadcrumbs={[
          { label: 'RMS', href: '/dashboard' },
          { label: 'Maintenance' },
        ]}
      >
        <button
          onClick={() => {
            setActionError(null);
            setCreateError(null);
            setIsCreateModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-eec-primary hover:bg-[#0E5161] text-white rounded-xl font-bold text-xs transition-colors shadow-sm"
        >
          <Wrench className="w-4 h-4" />
          Report Fault
        </button>
      </PageHeader>

      {/* Summary Stat Cards */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-card">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Work Orders</span>
              <Layers className="w-4 h-4 text-eec-primary" />
            </div>
            <div className="text-2xl font-black text-slate-900">{metrics.totalRequests}</div>
            <div className="text-[10px] text-slate-400 mt-1">
              {metrics.scope === 'DEPARTMENT' ? 'Directorate-scoped' : 'Corporation-wide'}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-card">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Active Servicing</span>
              <Activity className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black text-blue-600">{metrics.activeWorkOrders}</div>
            <div className="text-[10px] text-slate-400 mt-1">
              {metrics.inProgressCount} in progress, {metrics.onHoldCount} on hold
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-card">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">High / Critical</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-amber-600">{metrics.highOrCriticalCount}</div>
            <div className="text-[10px] text-slate-400 mt-1">High-priority operational defects</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-card">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Completed Repairs</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-emerald-600">{metrics.completedCount}</div>
            <div className="text-[10px] text-slate-400 mt-1">
              Total repair costs: {formatETB(metrics.totalActualCostETB)}
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 w-full md:w-auto flex-1">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search work order #, equipment, title, or technician..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-eec-primary"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap justify-end">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-bold uppercase text-[10px]">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUBMITTED">SUBMITTED</option>
              <option value="APPROVED">APPROVED</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="ON_HOLD">ON_HOLD</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-bold uppercase text-[10px]">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>
        </div>
      </div>

      {/* Maintenance Request Cards List */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80">
          <div className="w-8 h-8 border-3 border-eec-primary/20 border-t-eec-primary rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-medium">Loading maintenance workload...</p>
        </div>
      ) : tickets.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80">
          <Wrench className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700">No Maintenance Records Found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery || statusFilter !== 'ALL' || priorityFilter !== 'ALL'
              ? 'No tickets match the selected filter criteria.'
              : 'No equipment defect reports or maintenance work orders are currently logged.'}
          </p>
          {searchQuery || statusFilter !== 'ALL' || priorityFilter !== 'ALL' ? (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setPriorityFilter('ALL');
              }}
              className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              Reset Filters
            </button>
          ) : (
            <button
              onClick={() => {
                setActionError(null);
                setCreateError(null);
                setIsCreateModalOpen(true);
              }}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-eec-primary hover:bg-[#0E5161] text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
            >
              <Wrench className="w-4 h-4" />
              Report Fault
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map((t) => {
            const latestInspection = t.inspections && t.inspections.length > 0 ? t.inspections[0] : null;
            const canReviewThisTicket =
              canReview &&
              (currentRole === 'ADMIN' || (currentRole === 'DEPARTMENT_MANAGER' && t.departmentId === currentUser?.departmentId));

            return (
              <div
                key={t.id}
                onClick={() => handleOpenDetailModal(t)}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card flex flex-col md:flex-row md:items-start justify-between gap-5 transition-all hover:border-eec-primary/50 hover:shadow-md cursor-pointer"
              >
                <div className="space-y-2.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {t.requestNumber || t.ticketNumber}
                    </span>
                    {t.resourceCategory && <CategoryBadge category={t.resourceCategory} />}
                    
                    {/* Status Badge */}
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      t.status === 'SUBMITTED' || t.status === 'OPEN'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : t.status === 'APPROVED'
                        ? 'bg-sky-50 text-sky-800 border-sky-200'
                        : t.status === 'IN_PROGRESS'
                        ? 'bg-blue-50 text-blue-800 border-blue-200'
                        : t.status === 'ON_HOLD'
                        ? 'bg-orange-50 text-orange-800 border-orange-200'
                        : t.status === 'COMPLETED'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}>
                      {t.status}
                    </span>

                    {/* Priority Badge */}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      t.priority === 'CRITICAL'
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : t.priority === 'HIGH'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {t.priority} PRIORITY
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900 leading-tight">
                      {t.title}
                    </h3>
                    <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 mt-1 leading-relaxed">
                      {t.description}
                    </p>
                  </div>

                  {/* Metadata line */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-0.5">
                    <span>
                      Asset:{' '}
                      <Link 
                        to={`/resources/${t.resourceId}`} 
                        onClick={(e) => e.stopPropagation()} 
                        className="font-bold text-eec-primary hover:underline"
                      >
                        {t.resourceName} ({t.resourceCode})
                      </Link>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      {t.departmentName}
                    </span>
                    <span>•</span>
                    <span>Reported by: <strong className="text-slate-700">{t.reportedByName || t.reportedBy}</strong></span>
                    <span>•</span>
                    <span>Technician: <strong className="text-slate-800">{t.assignedTechnicianName || t.assignedTechnician || 'Unassigned'}</strong></span>
                    <span>•</span>
                    <span>Cost: <strong className="text-slate-800">{t.actualCostETB ? formatETB(t.actualCostETB) : (t.estimatedCostETB ? `Est: ${formatETB(t.estimatedCostETB)}` : 'N/A')}</strong></span>
                  </div>

                  {/* Diagnosis & Resolution summary if available */}
                  {(t.diagnosis || t.repairActions || t.resolutionNotes || t.rejectionReason) && (
                    <div className="p-3 bg-slate-50/80 rounded-xl text-xs space-y-1 border border-slate-200/70">
                      {t.diagnosis && (
                        <p><strong className="text-slate-700">Diagnosis:</strong> {t.diagnosis}</p>
                      )}
                      {t.repairActions && (
                        <p><strong className="text-slate-700">Repair Actions:</strong> {t.repairActions}</p>
                      )}
                      {t.partsReplaced && (
                        <p><strong className="text-slate-700">Parts Replaced:</strong> {t.partsReplaced}</p>
                      )}
                      {t.resolutionNotes && (
                        <p><strong className="text-slate-700">Resolution Notes:</strong> {t.resolutionNotes}</p>
                      )}
                      {t.rejectionReason && (
                        <p className="text-rose-700"><strong className="text-rose-800">Rejection Reason:</strong> {t.rejectionReason}</p>
                      )}
                    </div>
                  )}

                  {/* Custody return notice on completion */}
                  {t.status === 'COMPLETED' && t.custodyAction && (
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        {t.custodyAction === 'RETURNED_TO_CUSTODIAN'
                          ? `Repaired and safely returned to active custodian: ${t.custodianNameAtRequest || 'Assigned personnel'}`
                          : t.custodyAction === 'RETURNED_TO_AVAILABLE'
                          ? 'Repaired and safely returned to central store as AVAILABLE'
                          : t.custodyAction === 'REMAINS_IN_MAINTENANCE'
                          ? 'Repair finished with pending issues; asset remains under MAINTENANCE'
                          : 'Equipment decommissioned following maintenance'}
                      </span>
                    </div>
                  )}

                  {/* QA Test Status Tag */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-slate-400" />
                      <span className="font-semibold text-slate-700">QA Inspection: </span>
                      {latestInspection ? (
                        latestInspection.passed ? (
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            PASSED ({latestInspection.inspectionType})
                          </span>
                        ) : (
                          <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            FAILED ({latestInspection.inspectionType})
                          </span>
                        )
                      ) : (
                        <span className="text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Pending QA Verification
                        </span>
                      )}
                    </div>

                    <span className="text-slate-400 text-[11px]">
                      Reported: {t.reportedDate ? new Date(t.reportedDate).toLocaleDateString() : new Date(t.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Action Buttons Column */}
                <div className="flex items-center gap-2 md:flex-col md:items-end justify-end flex-shrink-0">
                  {/* View Details Action */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenDetailModal(t);
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    View Details
                  </button>

                  {/* Management Review (Approve / Reject) for SUBMITTED tickets */}
                  {canReviewThisTicket && (t.status === 'SUBMITTED' || t.status === 'OPEN') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTicket(t);
                        setReviewAction('APPROVE');
                        setReviewComments('');
                        setRejectionReason('');
                        setIsReviewModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-eec-primary hover:bg-[#0E5161] text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Review Request
                    </button>
                  )}

                  {/* Technician / Admin diagnostic and servicing controls */}
                  {canPerformTechnicalRepairs && t.status !== 'COMPLETED' && t.status !== 'REJECTED' && (
                    <>
                      {/* START REPAIR: on APPROVED tickets */}
                      {t.status === 'APPROVED' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openStartRepairModal(t);
                          }}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
                          title="Start technical repair and diagnostic work"
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                          Start Repair
                        </button>
                      )}

                      {/* IN_PROGRESS: Update Progress, Put On Hold, Complete Repair, QA */}
                      {t.status === 'IN_PROGRESS' && (
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openUpdateProgressModal(t);
                            }}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1"
                            title="Update repair diagnosis, actions, parts, and notes"
                          >
                            <Wrench className="w-3.5 h-3.5 text-slate-600" />
                            Update Progress
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openPutOnHoldModal(t);
                            }}
                            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1"
                            title="Place work order on hold with mandatory reason"
                          >
                            <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                            Put On Hold
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openCompleteRepairModal(t);
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1"
                            title="Complete repair and clear equipment"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Complete Repair
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openQAModal(t);
                            }}
                            className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1"
                            title="Record QA inspection test"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                            QA
                          </button>
                        </div>
                      )}

                      {/* ON_HOLD: Resume Work, Complete Repair, QA */}
                      {t.status === 'ON_HOLD' && (
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openResumeWorkModal(t);
                            }}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1"
                            title="Resume repair work from on-hold state"
                          >
                            <PlayCircle className="w-3.5 h-3.5" />
                            Resume Work
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openCompleteRepairModal(t);
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1"
                            title="Complete repair and clear equipment"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Complete Repair
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openQAModal(t);
                            }}
                            className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1"
                            title="Record QA inspection test"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                            QA
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ticket Details Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Maintenance Request ${selectedDetailTicket?.requestNumber || selectedDetailTicket?.id || ''}`}
        subtitle={`Defect and servicing audit history for ${selectedDetailTicket?.resourceName} (${selectedDetailTicket?.resourceCode})`}
      >
        {selectedDetailTicket && (
          <div className="space-y-5 text-xs">
            {/* Status & Priority Ribbon */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-800 text-sm">
                  {selectedDetailTicket.requestNumber || selectedDetailTicket.ticketNumber}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  selectedDetailTicket.status === 'SUBMITTED' || selectedDetailTicket.status === 'OPEN'
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : selectedDetailTicket.status === 'APPROVED'
                    ? 'bg-sky-50 text-sky-800 border-sky-200'
                    : selectedDetailTicket.status === 'IN_PROGRESS'
                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                    : selectedDetailTicket.status === 'ON_HOLD'
                    ? 'bg-orange-50 text-orange-800 border-orange-200'
                    : selectedDetailTicket.status === 'COMPLETED'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  {selectedDetailTicket.status}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  selectedDetailTicket.priority === 'CRITICAL'
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : selectedDetailTicket.priority === 'HIGH'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-slate-200 text-slate-700'
                }`}>
                  {selectedDetailTicket.priority} PRIORITY
                </span>
              </div>
              <div className="text-slate-500 text-[11px] flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Reported: {selectedDetailTicket.reportedDate ? new Date(selectedDetailTicket.reportedDate).toLocaleString() : new Date(selectedDetailTicket.createdAt).toLocaleString()}
              </div>
            </div>

            {/* Equipment & Directorate Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-1.5">
                <div className="flex items-center gap-1.5 text-slate-500 font-bold uppercase text-[10px]">
                  <Tag className="w-3.5 h-3.5 text-eec-primary" />
                  Equipment Information
                </div>
                <div className="font-bold text-slate-900 text-sm">
                  {selectedDetailTicket.resourceName}
                </div>
                <div className="text-slate-600 font-mono text-[11px]">
                  Code: <Link to={`/resources/${selectedDetailTicket.resourceId}`} className="text-eec-primary font-bold hover:underline">{selectedDetailTicket.resourceCode}</Link>
                </div>
                <div className="text-slate-600">
                  Category: {selectedDetailTicket.resourceCategory || 'Engineering Equipment'}
                </div>
                {selectedDetailTicket.custodianNameAtRequest && (
                  <div className="text-slate-700 font-medium">
                    Custodian: <strong>{selectedDetailTicket.custodianNameAtRequest}</strong>
                  </div>
                )}
              </div>

              <div className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-1.5">
                <div className="flex items-center gap-1.5 text-slate-500 font-bold uppercase text-[10px]">
                  <Building2 className="w-3.5 h-3.5 text-eec-primary" />
                  Directorate & Reporter
                </div>
                <div className="font-bold text-slate-900 text-sm">
                  {selectedDetailTicket.departmentName}
                </div>
                <div className="text-slate-600">
                  Directorate Code: <span className="font-semibold">{selectedDetailTicket.departmentCode || selectedDetailTicket.departmentId}</span>
                </div>
                <div className="text-slate-700 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  Reported by: <strong>{selectedDetailTicket.reportedByName || selectedDetailTicket.reportedBy}</strong> ({selectedDetailTicket.reportedByRole || 'STAFF'})
                </div>
              </div>
            </div>

            {/* Defect Description */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <div className="font-bold text-slate-800 text-xs">Defect Description</div>
              <div className="font-semibold text-slate-900">{selectedDetailTicket.title}</div>
              <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{selectedDetailTicket.description}</p>
            </div>

            {/* Review Information */}
            {selectedDetailTicket.reviewedByName && (
              <div className="p-3.5 bg-sky-50/70 border border-sky-200 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sky-900">Administrative Review</span>
                  <span className="text-[11px] text-sky-700">{selectedDetailTicket.reviewedAt ? new Date(selectedDetailTicket.reviewedAt).toLocaleString() : ''}</span>
                </div>
                <div className="text-sky-800">
                  Reviewed by: <strong>{selectedDetailTicket.reviewedByName}</strong>
                </div>
                {selectedDetailTicket.reviewComments && (
                  <div className="text-sky-900 pt-1">
                    <strong>Review Comments:</strong> {selectedDetailTicket.reviewComments}
                  </div>
                )}
                {selectedDetailTicket.rejectionReason && (
                  <div className="text-rose-800 pt-1">
                    <strong>Rejection Reason:</strong> {selectedDetailTicket.rejectionReason}
                  </div>
                )}
              </div>
            )}

            {/* Servicing and Diagnostics Details */}
            {(selectedDetailTicket.assignedTechnicianName || selectedDetailTicket.diagnosis || selectedDetailTicket.repairActions || selectedDetailTicket.actualCostETB) && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="font-bold text-slate-800 flex items-center justify-between">
                  <span>Workshop Servicing & Diagnostics</span>
                  {selectedDetailTicket.completedAt && (
                    <span className="text-[11px] text-emerald-700 font-semibold">
                      Completed: {new Date(selectedDetailTicket.completedAt).toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                  <div>Assigned Technician: <strong>{selectedDetailTicket.assignedTechnicianName || 'Unassigned'}</strong></div>
                  <div>
                    Cost: <strong>{selectedDetailTicket.actualCostETB ? formatETB(selectedDetailTicket.actualCostETB) : (selectedDetailTicket.estimatedCostETB ? `Est: ${formatETB(selectedDetailTicket.estimatedCostETB)}` : 'N/A')}</strong>
                  </div>
                </div>
                {selectedDetailTicket.diagnosis && (
                  <div className="pt-1">
                    <strong className="text-slate-800">Technician Diagnosis:</strong>
                    <p className="text-slate-600 mt-0.5">{selectedDetailTicket.diagnosis}</p>
                  </div>
                )}
                {selectedDetailTicket.repairActions && (
                  <div className="pt-1">
                    <strong className="text-slate-800">Repair Actions:</strong>
                    <p className="text-slate-600 mt-0.5">{selectedDetailTicket.repairActions}</p>
                  </div>
                )}
                {selectedDetailTicket.partsReplaced && (
                  <div className="pt-1">
                    <strong className="text-slate-800">Parts Replaced:</strong>
                    <p className="text-slate-600 mt-0.5">{selectedDetailTicket.partsReplaced}</p>
                  </div>
                )}
                {selectedDetailTicket.resolutionNotes && (
                  <div className="pt-1">
                    <strong className="text-slate-800">Resolution Summary:</strong>
                    <p className="text-slate-600 mt-0.5">{selectedDetailTicket.resolutionNotes}</p>
                  </div>
                )}
                {selectedDetailTicket.custodyAction && (
                  <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 font-semibold flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>
                      {selectedDetailTicket.custodyAction === 'RETURNED_TO_CUSTODIAN'
                        ? `Asset restored to custodian: ${selectedDetailTicket.custodianNameAtRequest || 'Active Personnel'}`
                        : selectedDetailTicket.custodyAction === 'RETURNED_TO_AVAILABLE'
                        ? 'Asset returned to store inventory as AVAILABLE'
                        : selectedDetailTicket.custodyAction === 'REMAINS_IN_MAINTENANCE'
                        ? 'Asset requires further repair; remains in MAINTENANCE'
                        : 'Equipment decommissioned'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* QA Inspections List */}
            {selectedDetailTicket.inspections && selectedDetailTicket.inspections.length > 0 && (
              <div className="p-3.5 bg-purple-50/50 border border-purple-200 rounded-xl space-y-2">
                <div className="font-bold text-purple-950 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-purple-700" />
                  QA Inspections & Functional Certifications
                </div>
                <div className="space-y-2">
                  {selectedDetailTicket.inspections.map((i) => (
                    <div key={i.id} className="p-2.5 bg-white border border-purple-200 rounded-lg text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          i.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {i.passed ? 'PASSED' : 'FAILED'} • {i.inspectionType}
                        </span>
                        <span className="text-slate-400 text-[10px]">
                          {i.inspectedAt ? new Date(i.inspectedAt).toLocaleDateString() : (i.date || '')}
                        </span>
                      </div>
                      <div className="text-slate-700"><strong>Findings:</strong> {i.findings}</div>
                      {i.certificationNumber && (
                        <div className="text-slate-600 font-mono text-[11px]">Cert #: {i.certificationNumber}</div>
                      )}
                      {i.remarks && <div className="text-slate-500 italic">Remarks: {i.remarks}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Maintenance History Audit Logs Timeline */}
            <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2.5">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <History className="w-4 h-4 text-slate-500" />
                Maintenance Audit Trail & Lifecycle History
              </div>
              {loadingDetail ? (
                <div className="py-4 text-center text-slate-400 text-xs">Loading audit trail...</div>
              ) : selectedDetailTicket.logs && selectedDetailTicket.logs.length > 0 ? (
                <div className="relative pl-6 space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {selectedDetailTicket.logs.map((log) => (
                    <div key={log.id} className="relative text-xs">
                      <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-eec-primary ring-4 ring-white" />
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-bold text-slate-700">
                          {log.action} {log.fromStatus ? `(${log.fromStatus} → ${log.toStatus})` : `(${log.toStatus})`}
                        </span>
                        <span>{log.createdAt ? new Date(log.createdAt).toLocaleString() : ''}</span>
                      </div>
                      <div className="text-slate-600 mt-0.5">
                        By: <strong>{log.actorName}</strong> <span className="text-[10px] text-slate-400">({log.actorRole})</span>
                      </div>
                      {log.notes && (
                        <div className="text-slate-500 italic text-[11px] mt-0.5">
                          "{log.notes}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-slate-400 text-xs py-1">No detailed audit history recorded for this ticket.</div>
              )}
            </div>

            {/* Modal Bottom Actions with Technician Servicing Controls */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Management Review inside Details Modal */}
                {canReview && (currentRole === 'ADMIN' || (currentRole === 'DEPARTMENT_MANAGER' && selectedDetailTicket.departmentId === currentUser?.departmentId)) && 
                  (selectedDetailTicket.status === 'SUBMITTED' || selectedDetailTicket.status === 'OPEN') && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTicket(selectedDetailTicket);
                      setReviewAction('APPROVE');
                      setReviewComments('');
                      setRejectionReason('');
                      setIsReviewModalOpen(true);
                    }}
                    className="px-3.5 py-2 bg-eec-primary hover:bg-[#0E5161] text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Review Request
                  </button>
                )}

                {/* Technician Repair Actions in Details Modal */}
                {canPerformTechnicalRepairs && selectedDetailTicket.status !== 'COMPLETED' && selectedDetailTicket.status !== 'REJECTED' && (
                  <>
                    {/* START REPAIR: on APPROVED tickets */}
                    {selectedDetailTicket.status === 'APPROVED' && (
                      <button
                        type="button"
                        onClick={() => openStartRepairModal(selectedDetailTicket)}
                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
                      >
                        <PlayCircle className="w-3.5 h-3.5" />
                        Start Repair / Start Work
                      </button>
                    )}

                    {/* IN_PROGRESS: Update Progress, Put On Hold, Complete Repair, QA */}
                    {selectedDetailTicket.status === 'IN_PROGRESS' && (
                      <>
                        <button
                          type="button"
                          onClick={() => openUpdateProgressModal(selectedDetailTicket)}
                          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
                        >
                          <Wrench className="w-3.5 h-3.5 text-slate-600" />
                          Update Repair Progress
                        </button>
                        <button
                          type="button"
                          onClick={() => openPutOnHoldModal(selectedDetailTicket)}
                          className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
                        >
                          <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                          Put On Hold
                        </button>
                        <button
                          type="button"
                          onClick={() => openCompleteRepairModal(selectedDetailTicket)}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Complete Repair
                        </button>
                        <button
                          type="button"
                          onClick={() => openQAModal(selectedDetailTicket)}
                          className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                          QA Test
                        </button>
                      </>
                    )}

                    {/* ON_HOLD: Resume Work, Complete Repair, QA */}
                    {selectedDetailTicket.status === 'ON_HOLD' && (
                      <>
                        <button
                          type="button"
                          onClick={() => openResumeWorkModal(selectedDetailTicket)}
                          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                          Resume Work
                        </button>
                        <button
                          type="button"
                          onClick={() => openCompleteRepairModal(selectedDetailTicket)}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Complete Repair
                        </button>
                        <button
                          type="button"
                          onClick={() => openQAModal(selectedDetailTicket)}
                          className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                          QA Test
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Ticket Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setCreateError(null);
        }}
        title="Report Faulty Equipment"
        subtitle="Submit maintenance or repair request for EEC engineering assets"
      >
        <form onSubmit={handleCreateTicket} className="space-y-4">
          {createError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{createError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Select Equipment *</label>
            <select
              value={selectedResourceId}
              onChange={(e) => setSelectedResourceId(e.target.value)}
              required
              disabled={creating || resources.length === 0}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none disabled:opacity-60"
            >
              {resources.length === 0 ? (
                <option value="" disabled>
                  {currentRole === 'EMPLOYEE'
                    ? 'You currently have no assigned equipment eligible for maintenance reporting.'
                    : 'No eligible equipment available to report'}
                </option>
              ) : (
                resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.itemCode} • {r.name} ({r.category}) {r.currentAssigneeName ? `[Custodian: ${r.currentAssigneeName}]` : '[Store / Unassigned]'}
                  </option>
                ))
              )}
            </select>
            {currentRole === 'EMPLOYEE' && resources.length === 0 && (
              <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>You currently have no assigned equipment eligible for maintenance reporting.</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Issue Summary *</label>
            <input
              type="text"
              required
              disabled={creating}
              value={ticketTitle}
              onChange={(e) => setTicketTitle(e.target.value)}
              placeholder="e.g. Total Station EDM angular error or Hydraulic pressure drop"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Detailed Defect Description *</label>
            <textarea
              required
              rows={3}
              disabled={creating}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe symptoms, operational conditions, and fault codes"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none disabled:opacity-60"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Priority</label>
              <select
                value={priority}
                disabled={creating}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none disabled:opacity-60"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical (Operations Blocked)</option>
              </select>
            </div>

            {canPerformTechnicalRepairs && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Assigned Technician</label>
                <input
                  type="text"
                  disabled={creating}
                  value={technician}
                  onChange={(e) => setTechnician(e.target.value)}
                  placeholder="e.g. Kenenisa Bekele"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none disabled:opacity-60"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Estimated Cost (ETB)</label>
              <input
                type="number"
                disabled={creating}
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-mono disabled:opacity-60"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={creating}
              onClick={() => {
                setIsCreateModalOpen(false);
                setCreateError(null);
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || resources.length === 0 || !selectedResourceId}
              className="px-5 py-2 text-xs font-bold text-white bg-eec-primary hover:bg-[#0E5161] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-sm flex items-center gap-2"
            >
              {creating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Submit Maintenance Request</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Review Modal (Approve / Reject) */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        title="Review Maintenance Request"
        subtitle={`Administrative evaluation for ${activeTicket?.requestNumber}`}
      >
        <form onSubmit={handleReviewTicket} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Decision *</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setReviewAction('APPROVE')}
                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 ${
                  reviewAction === 'APPROVE'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-400/20'
                    : 'bg-slate-50 text-slate-600'
                }`}
              >
                <Check className="w-4 h-4 text-emerald-600" />
                Approve Servicing
              </button>
              <button
                type="button"
                onClick={() => setReviewAction('REJECT')}
                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 ${
                  reviewAction === 'REJECT'
                    ? 'bg-rose-50 text-rose-800 border-rose-300 ring-2 ring-rose-400/20'
                    : 'bg-slate-50 text-slate-600'
                }`}
              >
                <XCircle className="w-4 h-4 text-rose-600" />
                Reject Request
              </button>
            </div>
          </div>

          {reviewAction === 'REJECT' ? (
            <div>
              <label className="block text-xs font-bold text-rose-700 uppercase mb-1">Rejection Reason *</label>
              <textarea
                required
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Specify administrative justification for rejection"
                className="w-full px-3 py-2 text-xs bg-rose-50/50 border border-rose-200 rounded-xl focus:outline-none text-rose-900"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Approval Comments</label>
              <textarea
                rows={2}
                value={reviewComments}
                onChange={(e) => setReviewComments(e.target.value)}
                placeholder="Optional notes or instructions for technician dispatch"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsReviewModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={reviewing}
              className={`px-5 py-2 text-xs font-bold text-white rounded-xl transition-all shadow-sm ${
                reviewAction === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {reviewing ? 'Processing...' : `Confirm ${reviewAction}`}
            </button>
          </div>
        </form>
      </Modal>

      {/* Update Work Order Progress Modal */}
      <Modal
        isOpen={isUpdateModalOpen}
        onClose={() => {
          setIsUpdateModalOpen(false);
          setUpdateError(null);
        }}
        title={
          activeTicket?.status === 'APPROVED'
            ? 'Start Repair Work'
            : targetStatus === 'ON_HOLD'
            ? 'Put Work Order On Hold'
            : targetStatus === 'COMPLETED'
            ? 'Complete Repair & Clear Asset'
            : activeTicket?.status === 'ON_HOLD' && targetStatus === 'IN_PROGRESS'
            ? 'Resume Repair Work'
            : 'Update Repair Progress'
        }
        subtitle={`Work Order ${activeTicket?.requestNumber || activeTicket?.id} for ${activeTicket?.resourceName}`}
      >
        <form onSubmit={handleUpdateStatus} className="space-y-4">
          {updateError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{updateError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Workflow Target Status *</label>
            <select
              value={targetStatus}
              onChange={(e) => setTargetStatus(e.target.value as any)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none"
            >
              {activeTicket?.status === 'APPROVED' && (
                <option value="IN_PROGRESS">IN_PROGRESS (Start Repair Work)</option>
              )}
              {activeTicket?.status === 'IN_PROGRESS' && (
                <>
                  <option value="IN_PROGRESS">IN_PROGRESS (Update Work Details)</option>
                  <option value="ON_HOLD">ON_HOLD (Awaiting Parts / External Service)</option>
                  <option value="COMPLETED">COMPLETED (Finish Repair & Clear Asset)</option>
                </>
              )}
              {activeTicket?.status === 'ON_HOLD' && (
                <>
                  <option value="IN_PROGRESS">IN_PROGRESS (Resume Work)</option>
                  <option value="COMPLETED">COMPLETED (Finish Repair & Clear Asset)</option>
                </>
              )}
            </select>
          </div>

          {targetStatus === 'ON_HOLD' && (
            <div>
              <label className="block text-xs font-bold text-amber-800 uppercase mb-1">Reason for Placing on Hold *</label>
              <textarea
                required
                rows={2}
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
                placeholder="Specify mandatory reason (e.g. Awaiting specialized optical sensor part #OPT-77 from central supplier)"
                className="w-full px-3 py-2 text-xs bg-amber-50/70 border border-amber-200 rounded-xl focus:outline-none text-amber-900"
              />
            </div>
          )}

          {targetStatus === 'IN_PROGRESS' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                {activeTicket?.status === 'APPROVED'
                  ? 'Initial Work Notes'
                  : activeTicket?.status === 'ON_HOLD'
                  ? 'Work Resumption Notes'
                  : 'Progress Notes / Servicing Notes'}
              </label>
              <textarea
                rows={2}
                value={progressNotes}
                onChange={(e) => setProgressNotes(e.target.value)}
                placeholder="Enter technician servicing notes, findings, or daily progress updates"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Technician Diagnosis</label>
            <textarea
              rows={2}
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="e.g. Optical collimation misalignment identified"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Repair Actions Performed</label>
            <textarea
              rows={2}
              value={repairActions}
              onChange={(e) => setRepairActions(e.target.value)}
              placeholder="e.g. Realigned optical prisms, cleaned laser emitter lenses"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Parts Replaced</label>
              <input
                type="text"
                value={partsReplaced}
                onChange={(e) => setPartsReplaced(e.target.value)}
                placeholder="e.g. Prism seal gasket, optical filter"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Actual Incurred Cost (ETB)</label>
              <input
                type="number"
                value={actualCost}
                onChange={(e) => setActualCost(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-mono"
              />
            </div>
          </div>

          {targetStatus === 'COMPLETED' && (
            <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-emerald-900 uppercase mb-1">Repair Outcome *</label>
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-white border border-emerald-300 rounded-xl font-bold text-emerald-900 focus:outline-none"
                >
                  <option value="REPAIRED_FIT_FOR_USE">REPAIRED_FIT_FOR_USE (Clears Asset for Service)</option>
                  <option value="REQUIRES_FURTHER_REPAIR">REQUIRES_FURTHER_REPAIR (Damaged, Remains in Maintenance)</option>
                  <option value="BEYOND_ECONOMIC_REPAIR">BEYOND_ECONOMIC_REPAIR (Decommission Asset)</option>
                  <option value="DISPOSED">DISPOSED (Permanent Disposal)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-emerald-900 uppercase mb-1">Equipment Condition on Completion</label>
                <select
                  value={conditionOnCompletion}
                  onChange={(e) => setConditionOnCompletion(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-emerald-300 rounded-xl font-bold text-emerald-900 focus:outline-none"
                >
                  <option value="EXCELLENT">EXCELLENT (Like New / Calibrated)</option>
                  <option value="GOOD">GOOD (Fully Operational)</option>
                  <option value="FAIR">FAIR (Functional with Minor Wear)</option>
                  <option value="POOR">POOR (Marginal Performance)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-emerald-900 uppercase mb-1">Resolution Summary *</label>
                <textarea
                  required
                  rows={2}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Summary of repair completion, calibration confirmation, and operational safety clearance"
                  className="w-full px-3 py-2 text-xs bg-white border border-emerald-300 rounded-xl focus:outline-none"
                />
              </div>

              {/* Optional Inline QA Inspection */}
              <div className="pt-2 border-t border-emerald-200">
                <label className="flex items-center gap-2 cursor-pointer text-emerald-950 font-bold">
                  <input
                    type="checkbox"
                    checked={includeQA}
                    onChange={(e) => setIncludeQA(e.target.checked)}
                    className="rounded text-eec-primary focus:ring-eec-primary"
                  />
                  <span>Attach Post-Repair QA Inspection Certification</span>
                </label>

                {includeQA && (
                  <div className="mt-2.5 p-2.5 bg-white border border-emerald-200 rounded-lg space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">QA Type</label>
                        <select
                          value={compQAType}
                          onChange={(e) => setCompQAType(e.target.value as any)}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg"
                        >
                          <option value="MAINTENANCE_QA">MAINTENANCE_QA</option>
                          <option value="CALIBRATION">CALIBRATION</option>
                          <option value="SAFETY_AUDIT">SAFETY_AUDIT</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">QA Result</label>
                        <select
                          value={compQAPassed ? 'PASSED' : 'FAILED'}
                          onChange={(e) => setCompQAPassed(e.target.value === 'PASSED')}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg"
                        >
                          <option value="PASSED">PASSED</option>
                          <option value="FAILED">FAILED</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Cert / QA #</label>
                        <input
                          type="text"
                          value={compQACertNumber}
                          onChange={(e) => setCompQACertNumber(e.target.value)}
                          placeholder="QA-CAL-2026-X"
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">Findings / Tolerance</label>
                      <input
                        type="text"
                        value={compQAFindings}
                        onChange={(e) => setCompQAFindings(e.target.value)}
                        placeholder="e.g. Deviation < 0.2mm across 50m bench; passed calibration"
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-emerald-800 leading-relaxed pt-1">
                <strong>Custody Restoration Invariant: </strong>
                {outcome === 'REQUIRES_FURTHER_REPAIR' ? (
                  <span>
                    Asset condition updated, but asset remains in <strong>MAINTENANCE</strong> until cleared.
                  </span>
                ) : activeTicket?.currentAssigneeName ? (
                  <span>
                    This equipment is currently assigned to <strong>{activeTicket.currentAssigneeName}</strong>. On completion, it will automatically return to <strong>ASSIGNED</strong> status without interrupting their custody.
                  </span>
                ) : (
                  <span>
                    This equipment has no current custodian. On completion, it will automatically return to <strong>AVAILABLE</strong> in central store.
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setIsUpdateModalOpen(false);
                setUpdateError(null);
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updating}
              className="px-5 py-2 text-xs font-bold text-white bg-eec-primary hover:bg-[#0E5161] rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-60"
            >
              {updating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>
                  {activeTicket?.status === 'APPROVED'
                    ? 'Confirm & Start Work'
                    : targetStatus === 'ON_HOLD'
                    ? 'Confirm & Put On Hold'
                    : targetStatus === 'COMPLETED'
                    ? 'Complete Repair'
                    : activeTicket?.status === 'ON_HOLD' && targetStatus === 'IN_PROGRESS'
                    ? 'Confirm & Resume Work'
                    : 'Save Progress'}
                </span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Record QA Inspection Modal */}
      <Modal
        isOpen={isQAModalOpen}
        onClose={() => setIsQAModalOpen(false)}
        title="Record Workshop QA Inspection Test"
        subtitle={`Pre-requisite for completing ${activeTicket?.requestNumber}`}
      >
        <form onSubmit={handleRecordQA} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Test Result *</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setQaPassed(true)}
                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 ${
                  qaPassed ? 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-2 ring-emerald-400/20' : 'bg-slate-50 text-slate-600'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                PASSED QA
              </button>
              <button
                type="button"
                onClick={() => setQaPassed(false)}
                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 ${
                  !qaPassed ? 'bg-rose-50 text-rose-700 border-rose-300 ring-2 ring-rose-400/20' : 'bg-slate-50 text-slate-600'
                }`}
              >
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                FAILED QA
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Technical Findings *</label>
            <textarea
              required
              rows={3}
              value={qaFindings}
              onChange={(e) => setQaFindings(e.target.value)}
              placeholder="e.g. Laser EDM tested on calibration bench: 0.2 arc-sec accuracy confirmed"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">QA / Certificate Number</label>
            <input
              type="text"
              value={certNumber}
              onChange={(e) => setCertNumber(e.target.value)}
              placeholder="e.g. QA-PASS-2026-081"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Remarks</label>
            <input
              type="text"
              value={qaRemarks}
              onChange={(e) => setQaRemarks(e.target.value)}
              placeholder="e.g. Ready for field redeployment"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsQAModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={recordingQA || !qaFindings.trim()}
              className="px-5 py-2 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-xl transition-all shadow-sm disabled:opacity-50"
            >
              {recordingQA ? 'Recording...' : 'Save QA Inspection Test'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
