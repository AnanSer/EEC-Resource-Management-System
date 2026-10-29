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
  Plus, 
  AlertCircle, 
  Check, 
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Search,
  CheckCircle,
  XCircle,
  PlayCircle,
  Activity,
  Layers,
  Building2
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const MaintenancePage: React.FC = () => {
  const { currentRole } = useAuth();
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
  const [outcome, setOutcome] = useState<'REPAIRED_FIT_FOR_USE' | 'BEYOND_ECONOMIC_REPAIR' | 'DISPOSED'>('REPAIRED_FIT_FOR_USE');
  const [conditionOnCompletion, setConditionOnCompletion] = useState('GOOD');
  const [updating, setUpdating] = useState(false);

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
      const [tList, rList, mMetrics] = await Promise.all([
        maintenanceService.getTickets({
          status: statusFilter,
          priority: priorityFilter,
          search: searchQuery,
        }),
        resourceService.getAll(),
        maintenanceService.getMetrics(),
      ]);
      setTickets(tList);
      setResources(rList);
      setMetrics(mMetrics);
      if (rList.length > 0 && !selectedResourceId) {
        setSelectedResourceId(rList[0].id);
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

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setActionError(null);
    try {
      await maintenanceService.createTicket({
        resourceId: selectedResourceId,
        title: ticketTitle,
        description,
        priority,
        assignedTechnicianName: technician || undefined,
        estimatedCostETB: Number(estimatedCost),
      });
      setIsCreateModalOpen(false);
      setTicketTitle('');
      setDescription('');
      setToastMessage('Maintenance request submitted successfully! Equipment marked under maintenance.');
      setTimeout(() => setToastMessage(null), 3500);
      loadData();
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || 'Ticket creation failed');
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
      loadData();
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || 'Review action failed');
    } finally {
      setReviewing(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket) return;
    setUpdating(true);
    setActionError(null);
    try {
      const res = await maintenanceService.updateStatus(activeTicket.id, targetStatus, {
        diagnosis,
        repairActions,
        partsReplaced,
        actualCostETB: actualCost ? Number(actualCost) : undefined,
        resolutionNotes,
        outcome,
        conditionOnCompletion,
      });
      setIsUpdateModalOpen(false);
      const custodyNote = res.custodyAction === 'RETURNED_TO_CUSTODIAN'
        ? ' Asset safely restored to custodian custody.'
        : res.custodyAction === 'RETURNED_TO_AVAILABLE'
        ? ' Asset safely returned to available store.'
        : '';
      setToastMessage(`Work order updated to ${targetStatus}.${custodyNote}`);
      setTimeout(() => setToastMessage(null), 4000);
      loadData();
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || 'Status update failed');
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
      loadData();
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
            setIsCreateModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-eec-primary hover:bg-[#0E5161] text-white rounded-xl font-bold text-xs transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Report Faulty Equipment
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
              <option value="SUBMITTED">SUBMITTED (Pending Review)</option>
              <option value="APPROVED">APPROVED (Ready for Tech)</option>
              <option value="IN_PROGRESS">IN_PROGRESS (Under Repair)</option>
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
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tickets List */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 border-4 border-eec-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : tickets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Maintenance Records Found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery || statusFilter !== 'ALL' || priorityFilter !== 'ALL'
              ? 'No tickets match the selected filter criteria.'
              : 'No equipment defect reports or maintenance work orders are currently logged.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map((t) => {
            const latestInspection = t.inspections && t.inspections.length > 0 ? t.inspections[0] : null;

            return (
              <div
                key={t.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card flex flex-col md:flex-row md:items-start justify-between gap-5 transition-all hover:border-slate-300"
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
                      Asset: <Link to={`/resources/${t.resourceId}`} className="font-bold text-eec-primary hover:underline">{t.resourceName} ({t.resourceCode})</Link>
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

                  {/* Diagnosis & Resolution block if available */}
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

                {/* Role-Appropriate Actions */}
                <div className="flex items-center gap-2 md:flex-col md:items-end justify-end flex-shrink-0">
                  {/* Management Review (Approve / Reject) for SUBMITTED tickets */}
                  {canReview && (t.status === 'SUBMITTED' || t.status === 'OPEN') && (
                    <button
                      onClick={() => {
                        setActiveTicket(t);
                        setReviewAction('APPROVE');
                        setReviewComments('');
                        setRejectionReason('');
                        setIsReviewModalOpen(true);
                      }}
                      className="px-3.5 py-1.5 bg-eec-primary hover:bg-[#0E5161] text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Review Request
                    </button>
                  )}

                  {/* Technician / Admin diagnostic and servicing controls */}
                  {canPerformTechnicalRepairs && t.status !== 'COMPLETED' && t.status !== 'REJECTED' && (
                    <>
                      {t.status === 'APPROVED' && (
                        <button
                          onClick={() => {
                            setActiveTicket(t);
                            setTargetStatus('IN_PROGRESS');
                            setDiagnosis(t.diagnosis || '');
                            setRepairActions(t.repairActions || '');
                            setActualCost(t.actualCostETB || t.estimatedCostETB || 0);
                            setIsUpdateModalOpen(true);
                          }}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                          Start Repair
                        </button>
                      )}

                      {(t.status === 'IN_PROGRESS' || t.status === 'ON_HOLD') && (
                        <>
                          <button
                            onClick={() => {
                              setActiveTicket(t);
                              setIsQAModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Record QA Test
                          </button>

                          <button
                            onClick={() => {
                              setActiveTicket(t);
                              setTargetStatus(t.status === 'ON_HOLD' ? 'IN_PROGRESS' : 'COMPLETED');
                              setDiagnosis(t.diagnosis || '');
                              setRepairActions(t.repairActions || '');
                              setPartsReplaced(t.partsReplaced || '');
                              setActualCost(t.actualCostETB || t.estimatedCostETB || 0);
                              setResolutionNotes(t.resolutionNotes || '');
                              setIsUpdateModalOpen(true);
                            }}
                            className="px-3.5 py-1.5 bg-eec-primary hover:bg-[#0E5161] text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                            Update Progress
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Ticket Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Report Faulty Equipment"
        subtitle="Submit maintenance or repair request for EEC engineering assets"
      >
        <form onSubmit={handleCreateTicket} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Select Equipment *</label>
            <select
              value={selectedResourceId}
              onChange={(e) => setSelectedResourceId(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none"
            >
              {resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.itemCode} • {r.name} ({r.category}) {r.currentAssigneeName ? `[Custodian: ${r.currentAssigneeName}]` : '[Store]'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Issue Summary *</label>
            <input
              type="text"
              required
              value={ticketTitle}
              onChange={(e) => setTicketTitle(e.target.value)}
              placeholder="e.g. Total Station EDM angular error or Hydraulic pressure drop"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Detailed Defect Description *</label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe symptoms, operational conditions, and fault codes"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none"
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
                  value={technician}
                  onChange={(e) => setTechnician(e.target.value)}
                  placeholder="e.g. Tigist Asfiwa"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Estimated Cost (ETB)</label>
              <input
                type="number"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-5 py-2 text-xs font-bold text-white bg-eec-primary hover:bg-[#0E5161] rounded-xl transition-all shadow-sm"
            >
              {creating ? 'Submitting...' : 'Submit Maintenance Request'}
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
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                APPROVE REQUEST
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
                REJECT REQUEST
              </button>
            </div>
          </div>

          {reviewAction === 'REJECT' ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Rejection Reason *</label>
              <textarea
                required
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Provide clear justification for rejecting the repair request"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
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
        onClose={() => setIsUpdateModalOpen(false)}
        title="Update Work Order Progress"
        subtitle={`Work Order ${activeTicket?.requestNumber} for ${activeTicket?.resourceName}`}
      >
        <form onSubmit={handleUpdateStatus} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Workflow Status *</label>
            <select
              value={targetStatus}
              onChange={(e) => setTargetStatus(e.target.value as any)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none"
            >
              {activeTicket?.status === 'APPROVED' && (
                <option value="IN_PROGRESS">IN_PROGRESS (Start Diagnostics & Repair)</option>
              )}
              {activeTicket?.status === 'IN_PROGRESS' && (
                <>
                  <option value="IN_PROGRESS">IN_PROGRESS (Update Work Details)</option>
                  <option value="ON_HOLD">ON_HOLD (Awaiting Parts/External Service)</option>
                  <option value="COMPLETED">COMPLETED (Repair Finished)</option>
                </>
              )}
              {activeTicket?.status === 'ON_HOLD' && (
                <>
                  <option value="IN_PROGRESS">IN_PROGRESS (Resume Work)</option>
                  <option value="COMPLETED">COMPLETED (Repair Finished)</option>
                </>
              )}
            </select>
          </div>

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

              <div className="text-[11px] text-emerald-800 leading-relaxed pt-1">
                <strong>Custody Restoration Invariant: </strong>
                {activeTicket?.currentAssigneeName ? (
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
              onClick={() => setIsUpdateModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updating}
              className="px-5 py-2 text-xs font-bold text-white bg-eec-primary hover:bg-[#0E5161] rounded-xl transition-all shadow-sm"
            >
              {updating ? 'Saving...' : 'Save Work Order Progress'}
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
