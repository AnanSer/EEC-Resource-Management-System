import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { requisitionService } from '../../services/requisitionService';
import { resourceService } from '../../services/resourceService';
import { departmentService } from '../../services/departmentService';
import { employeeService } from '../../services/employeeService';
import { ResourceRequisition, Resource, ResourceCategory, Department, Employee } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { CategoryBadge } from '../../components/ui/CategoryBadge';
import { Modal } from '../../components/ui/Modal';
import { 
  ClipboardList, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  PackageCheck, 
  AlertCircle, 
  Check, 
  Layers,
  Send,
  Search,
  X,
  RotateCcw,
  Clock,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const RequisitionsPage: React.FC = () => {
  const { currentUser, currentRole } = useAuth();
  const [requisitions, setRequisitions] = useState<ResourceRequisition[]>([]);
  const [availableResources, setAvailableResources] = useState<Resource[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setCategoryFilter('ALL');
    setUrgencyFilter('ALL');
    setDepartmentFilter('ALL');
  };

  const isFiltered = Boolean(
    searchQuery.trim() ||
    statusFilter !== 'ALL' ||
    categoryFilter !== 'ALL' ||
    urgencyFilter !== 'ALL' ||
    departmentFilter !== 'ALL'
  );

  // KPI counts across all scoped requisitions
  const kpis = {
    total: requisitions.length,
    pending: requisitions.filter(r => r.status === 'PENDING').length,
    approved: requisitions.filter(r => r.status === 'APPROVED').length,
    fulfilled: requisitions.filter(r => r.status === 'FULFILLED').length,
    rejected: requisitions.filter(r => r.status === 'REJECTED' || r.status === 'CANCELLED').length,
  };

  // Filtered requisitions list
  const filteredRequisitions = requisitions.filter((req) => {
    if (statusFilter !== 'ALL' && req.status !== statusFilter) return false;
    if (categoryFilter !== 'ALL' && req.category !== categoryFilter) return false;
    if (urgencyFilter !== 'ALL' && req.urgency !== urgencyFilter) return false;
    if (departmentFilter !== 'ALL' && req.departmentId !== departmentFilter) return false;

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    return (
      (req.requisitionNumber && req.requisitionNumber.toLowerCase().includes(q)) ||
      (req.itemDescription && req.itemDescription.toLowerCase().includes(q)) ||
      (req.justification && req.justification.toLowerCase().includes(q)) ||
      (req.requesterName && req.requesterName.toLowerCase().includes(q)) ||
      (req.employeeName && req.employeeName.toLowerCase().includes(q)) ||
      (req.departmentName && req.departmentName.toLowerCase().includes(q)) ||
      (req.fulfilledResourceName && req.fulfilledResourceName.toLowerCase().includes(q)) ||
      (req.fulfilledResourceCode && req.fulfilledResourceCode.toLowerCase().includes(q)) ||
      (req.approvalComments && req.approvalComments.toLowerCase().includes(q)) ||
      (req.rejectionReason && req.rejectionReason.toLowerCase().includes(q)) ||
      (req.handoverNotes && req.handoverNotes.toLowerCase().includes(q))
    );
  });

  // New Requisition Modal
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [category, setCategory] = useState<ResourceCategory>('IT_EQUIPMENT');
  const [itemDescription, setItemDescription] = useState('');
  const [justification, setJustification] = useState('');
  const [urgency, setUrgency] = useState<'ROUTINE' | 'URGENT' | 'EMERGENCY_PROJECT'>('ROUTINE');
  const [requiredDate, setRequiredDate] = useState('2026-11-20');
  const [targetDeptId, setTargetDeptId] = useState('');
  const [targetEmpId, setTargetEmpId] = useState('');
  const [isDirectAllocation, setIsDirectAllocation] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Approve Modal (Admin)
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [approveTargetId, setApproveTargetId] = useState('');
  const [approvalComments, setApprovalComments] = useState('');
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  // Fulfill Modal (Store Keeper)
  const [isFulfillModalOpen, setIsFulfillModalOpen] = useState(false);
  const [activeReq, setActiveReq] = useState<ResourceRequisition | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [fulfillLocation, setFulfillLocation] = useState('');
  const [fulfillError, setFulfillError] = useState<string | null>(null);
  const [fulfilling, setFulfilling] = useState(false);

  // Rejection Modal (Admin)
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionTargetId, setRejectionTargetId] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  const canApprove = currentRole === 'ADMIN';
  const canFulfill = currentRole === 'STORE_KEEPER';

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqs, res, depts, emps] = await Promise.all([
        requisitionService.getAll({ limit: 200 }),
        resourceService.getAll(),
        departmentService.getAll().catch(() => []),
        employeeService.getAll().catch(() => []),
      ]);
      setRequisitions(reqs);
      setAvailableResources(res.filter(r => r.status === 'AVAILABLE'));
      setDepartments(depts);
      setEmployees(emps.filter(e => e.isActive));

      if (depts.length > 0 && !targetDeptId) {
        setTargetDeptId(currentUser.departmentId || depts[0].id);
      }
    } catch (err) {
      console.error('[RequisitionsPage loadData Error]', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentRole, currentUser.departmentId]);

  const handleSubmitRequisition = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      await requisitionService.submit({
        category,
        itemDescription,
        justification,
        urgency,
        requiredDate,
        departmentId: currentRole === 'ADMIN' ? (targetDeptId || currentUser.departmentId) : currentUser.departmentId,
        employeeId: currentRole === 'ADMIN' && targetEmpId ? targetEmpId : undefined,
        isDirectAllocation: currentRole === 'ADMIN' ? isDirectAllocation : false,
      });
      setIsSubmitModalOpen(false);
      setItemDescription('');
      setJustification('');
      setIsDirectAllocation(false);
      setToastMessage(
        isDirectAllocation
          ? 'Corporate allocation initiated and approved. Ready for Store Keeper fulfillment.'
          : 'Requisition submitted for Administrator approval.'
      );
      setTimeout(() => setToastMessage(null), 3500);
      await loadData();
    } catch (err: any) {
      setSubmitError(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    setApproving(true);
    setApproveError(null);
    try {
      await requisitionService.approve(approveTargetId, approvalComments || undefined);
      setIsApproveModalOpen(false);
      setApprovalComments('');
      setToastMessage('Requisition APPROVED. Store Keeper can now fulfill inventory.');
      setTimeout(() => setToastMessage(null), 3500);
      await loadData();
    } catch (err: any) {
      setApproveError(err.message || 'Approval failed');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    setRejecting(true);
    setRejectError(null);
    try {
      await requisitionService.reject(rejectionTargetId, rejectionReason);
      setIsRejectModalOpen(false);
      setRejectionReason('');
      setToastMessage('Requisition marked as REJECTED');
      setTimeout(() => setToastMessage(null), 3500);
      await loadData();
    } catch (err: any) {
      setRejectError(err.message || 'Rejection failed');
    } finally {
      setRejecting(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await requisitionService.cancel(id);
      setToastMessage('Requisition cancelled');
      setTimeout(() => setToastMessage(null), 3500);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Cancel failed');
    }
  };

  const handleFulfill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReq) return;
    setFulfilling(true);
    setFulfillError(null);
    try {
      await requisitionService.fulfill({
        requisitionId: activeReq.id,
        resourceId: selectedAssetId,
        handoverNotes,
        location: fulfillLocation || undefined,
      });
      setIsFulfillModalOpen(false);
      setHandoverNotes('');
      setFulfillLocation('');
      setToastMessage('Resource allocated! Inventory, custody, and employee profile updated.');
      setTimeout(() => setToastMessage(null), 3500);
      await loadData();
    } catch (err: any) {
      setFulfillError(err.message || 'Fulfillment failed');
    } finally {
      setFulfilling(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-slideUp">
          <Check className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      <PageHeader
        title="Resource Requisitions & Store Handover"
        subtitle="Submit equipment requests, manage Admin approval gates, and process Store Keeper fulfillment"
        breadcrumbs={[
          { label: 'RMS', href: '/dashboard' },
          { label: 'Requisitions' }
        ]}
      >
        <div className="flex items-center gap-2">
          {currentRole === 'ADMIN' && (
            <button
              onClick={() => {
                setIsDirectAllocation(true);
                setSubmitError(null);
                setIsSubmitModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs transition-colors"
            >
              <Send className="w-4 h-4 text-eec-primary" />
              Direct Allocation
            </button>
          )}

          <button
            onClick={() => {
              setIsDirectAllocation(false);
              setSubmitError(null);
              setIsSubmitModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-eec-primary hover:bg-[#0E5161] text-white rounded-xl font-bold text-xs transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Requisition Request
          </button>
        </div>
      </PageHeader>

      {/* Role notice banner */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-eec-primary" />
          <span className="font-semibold text-slate-800">
            Active Workflow Privileges for <strong className="text-eec-primary">{currentRole}</strong>:
          </span>
          <span className="text-slate-500">
            {currentRole === 'ADMIN' && 'You can review and Approve or Reject requests, or initiate direct allocations.'}
            {currentRole === 'STORE_KEEPER' && 'You fulfill Approved requisitions by selecting physical hardware from warehouse.'}
            {['EMPLOYEE', 'DEPARTMENT_MANAGER'].includes(currentRole) && 'You can submit new asset requisitions and track their status.'}
          </span>
        </div>
        <div className="text-slate-400 font-mono text-[11px]">
          {isFiltered ? `Showing ${filteredRequisitions.length} of ${requisitions.length}` : `${requisitions.length} Total Requests`}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total */}
        <button
          type="button"
          onClick={() => setStatusFilter('ALL')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/10'
              : 'bg-white text-slate-900 border-slate-200/80 hover:border-slate-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${statusFilter === 'ALL' ? 'text-slate-300' : 'text-slate-500'}`}>
              Total Requests
            </span>
            <Layers className={`w-4 h-4 ${statusFilter === 'ALL' ? 'text-slate-300' : 'text-slate-400'}`} />
          </div>
          <div className="text-2xl font-black">{kpis.total}</div>
          <div className={`text-[10px] mt-1 ${statusFilter === 'ALL' ? 'text-slate-300' : 'text-slate-400'}`}>
            Corporation-wide requisitions
          </div>
        </button>

        {/* Pending */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'PENDING' ? 'ALL' : 'PENDING')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'PENDING'
              ? 'bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-500/20'
              : 'bg-white text-slate-900 border-slate-200/80 hover:border-amber-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${statusFilter === 'PENDING' ? 'text-amber-100' : 'text-amber-700'}`}>
              Pending Review
            </span>
            <Clock className={`w-4 h-4 ${statusFilter === 'PENDING' ? 'text-amber-100' : 'text-amber-500'}`} />
          </div>
          <div className={`text-2xl font-black ${statusFilter === 'PENDING' ? 'text-white' : 'text-amber-600'}`}>{kpis.pending}</div>
          <div className={`text-[10px] mt-1 ${statusFilter === 'PENDING' ? 'text-amber-100' : 'text-slate-400'}`}>
            {currentRole === 'ADMIN' ? 'Awaiting your approval' : 'In review queue'}
          </div>
        </button>

        {/* Approved */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'APPROVED' ? 'ALL' : 'APPROVED')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'APPROVED'
              ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-600/20'
              : 'bg-white text-slate-900 border-slate-200/80 hover:border-emerald-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${statusFilter === 'APPROVED' ? 'text-emerald-100' : 'text-emerald-700'}`}>
              Approved Handover
            </span>
            <CheckCircle2 className={`w-4 h-4 ${statusFilter === 'APPROVED' ? 'text-emerald-100' : 'text-emerald-600'}`} />
          </div>
          <div className={`text-2xl font-black ${statusFilter === 'APPROVED' ? 'text-white' : 'text-emerald-600'}`}>{kpis.approved}</div>
          <div className={`text-[10px] mt-1 ${statusFilter === 'APPROVED' ? 'text-emerald-100' : 'text-slate-400'}`}>
            {currentRole === 'STORE_KEEPER' ? 'Ready for warehouse dispatch' : 'Awaiting physical issue'}
          </div>
        </button>

        {/* Fulfilled */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'FULFILLED' ? 'ALL' : 'FULFILLED')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'FULFILLED'
              ? 'bg-sky-600 text-white border-sky-700 shadow-md ring-2 ring-sky-600/20'
              : 'bg-white text-slate-900 border-slate-200/80 hover:border-sky-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${statusFilter === 'FULFILLED' ? 'text-sky-100' : 'text-sky-700'}`}>
              Fulfilled Assets
            </span>
            <PackageCheck className={`w-4 h-4 ${statusFilter === 'FULFILLED' ? 'text-sky-100' : 'text-sky-600'}`} />
          </div>
          <div className={`text-2xl font-black ${statusFilter === 'FULFILLED' ? 'text-white' : 'text-sky-600'}`}>{kpis.fulfilled}</div>
          <div className={`text-[10px] mt-1 ${statusFilter === 'FULFILLED' ? 'text-sky-100' : 'text-slate-400'}`}>
            Active field deployment
          </div>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3.5">
        {/* Row 1: Search and Quick Status Tabs */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by requisition #, description, justification, requester, employee..."
              className="w-full pl-10 pr-9 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-primary/20 focus:border-eec-primary text-slate-800 placeholder:text-slate-400 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto scrollbar-none">
            {[
              { id: 'ALL', label: 'All', count: kpis.total },
              { id: 'PENDING', label: 'Pending', count: kpis.pending },
              { id: 'APPROVED', label: 'Approved', count: kpis.approved },
              { id: 'FULFILLED', label: 'Fulfilled', count: kpis.fulfilled },
              { id: 'REJECTED', label: 'Rejected', count: kpis.rejected },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-white text-eec-primary shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  statusFilter === tab.id
                    ? 'bg-eec-primary/10 text-eec-primary'
                    : 'bg-slate-200 text-slate-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Secondary Dropdowns and Reset */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Category Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-eec-primary/20"
              >
                <option value="ALL">All Categories</option>
                <option value="IT_EQUIPMENT">IT Equipment</option>
                <option value="VEHICLES">Vehicles & Transport</option>
                <option value="HEAVY_MACHINERY">Heavy Machinery</option>
                <option value="SURVEYING_GEOTECHNICAL">Surveying & Geotechnical</option>
                <option value="CAMP_FACILITY_FURNITURE">Furniture & Facilities</option>
              </select>
            </div>

            {/* Urgency Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Urgency:</span>
              <select
                value={urgencyFilter}
                onChange={(e) => setUrgencyFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-eec-primary/20"
              >
                <option value="ALL">All Urgencies</option>
                <option value="ROUTINE">Routine</option>
                <option value="URGENT">Urgent</option>
                <option value="EMERGENCY_PROJECT">Emergency Project</option>
              </select>
            </div>

            {/* Department Filter (Admin / Store Keeper / All) */}
            {departments.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Directorate:</span>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-eec-primary/20 max-w-[200px] truncate"
                >
                  <option value="ALL">All Directorates</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Reset Filters Button */}
            {isFiltered && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                title="Reset all search and filters"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          {/* Showing Count */}
          <div className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-800">{filteredRequisitions.length}</strong> of {requisitions.length} requisitions
            {isFiltered && <span className="ml-1 text-eec-primary font-bold">(filtered)</span>}
          </div>
        </div>

        {/* Active Filter Chips */}
        {isFiltered && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Active Filters:</span>
            {searchQuery.trim() && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg font-medium">
                Search: "{searchQuery}"
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="hover:text-rose-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {statusFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg font-medium">
                Status: {statusFilter}
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className="hover:text-rose-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {categoryFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg font-medium">
                Category: {categoryFilter.replace(/_/g, ' ')}
                <button
                  type="button"
                  onClick={() => setCategoryFilter('ALL')}
                  className="hover:text-rose-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {urgencyFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-800 border border-purple-200 rounded-lg font-medium">
                Urgency: {urgencyFilter.replace(/_/g, ' ')}
                <button
                  type="button"
                  onClick={() => setUrgencyFilter('ALL')}
                  className="hover:text-rose-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {departmentFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-medium">
                Directorate: {departments.find(d => d.id === departmentFilter)?.name || departmentFilter}
                <button
                  type="button"
                  onClick={() => setDepartmentFilter('ALL')}
                  className="hover:text-rose-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs text-eec-primary hover:underline font-bold ml-1 cursor-pointer"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Requisitions List */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 border-4 border-eec-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : requisitions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Requisitions Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            No equipment requisitions have been recorded yet. Click the button above to request assets for your projects.
          </p>
        </div>
      ) : filteredRequisitions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Matching Requisitions</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            No requisitions match your current search query or active filter settings. Try adjusting your filters or resetting them.
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-slate-500" />
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequisitions.map((req) => (
            <div
              key={req.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                    {req.requisitionNumber}
                  </span>
                  <CategoryBadge category={req.category} />
                  
                  {/* Status Badge */}
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    req.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    req.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                    req.status === 'FULFILLED' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                    req.status === 'CANCELLED' ? 'bg-slate-100 text-slate-500' :
                    'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    {req.status === 'APPROVED' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {req.status === 'PENDING' && <AlertCircle className="w-3.5 h-3.5" />}
                    {req.status === 'FULFILLED' && <PackageCheck className="w-3.5 h-3.5" />}
                    {req.status === 'REJECTED' && <XCircle className="w-3.5 h-3.5" />}
                    {req.status}
                  </span>

                  {req.isDirectAllocation && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                      Direct Allocation
                    </span>
                  )}

                  {req.urgency === 'EMERGENCY_PROJECT' && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500 text-white animate-pulse">
                      EMERGENCY
                    </span>
                  )}
                  {req.urgency === 'URGENT' && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white">
                      URGENT
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900">{req.itemDescription}</h3>
                  <p className="text-xs text-slate-600 mt-0.5">{req.justification}</p>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-1">
                  <span><strong>Requester:</strong> {req.requesterName} ({req.requesterRole})</span>
                  <span><strong>Assignee:</strong> {req.employeeName || req.requesterName}</span>
                  <span><strong>Department:</strong> {req.departmentName}</span>
                  {req.requiredDate && <span><strong>Required Date:</strong> {req.requiredDate}</span>}
                </div>

                {req.approvedBy && (
                  <p className="text-[11px] text-emerald-700 bg-emerald-50/60 p-2 rounded-lg border border-emerald-100">
                    <strong>Approved by:</strong> {req.approvedBy} on {req.approvedAt ? new Date(req.approvedAt).toLocaleDateString() : 'N/A'}
                    {req.approvalComments && ` • Notes: ${req.approvalComments}`}
                  </p>
                )}

                {req.status === 'FULFILLED' && (
                  <div className="p-2.5 bg-sky-50 rounded-xl border border-sky-100 text-xs text-sky-900 flex items-center justify-between">
                    <div>
                      <p className="font-semibold">
                        Fulfilled: {req.fulfilledResourceName || 'Physical Asset'} ({req.fulfilledResourceCode})
                      </p>
                      <p className="text-[11px] text-sky-700 mt-0.5">
                        Dispatched by {req.fulfilledBy} on {req.fulfilledAt ? new Date(req.fulfilledAt).toLocaleDateString() : 'Store Handover'}
                        {req.handoverNotes && ` • ${req.handoverNotes}`}
                      </p>
                    </div>
                    {req.fulfilledResourceId && (
                      <Link
                        to={`/resources/${req.fulfilledResourceId}`}
                        className="text-xs font-bold text-sky-700 hover:text-sky-900 underline"
                      >
                        View Asset
                      </Link>
                    )}
                  </div>
                )}

                {req.status === 'REJECTED' && req.rejectionReason && (
                  <p className="text-xs text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200">
                    <strong>Rejection Reason:</strong> {req.rejectionReason}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 md:flex-col md:items-end justify-end shrink-0">
                {/* Admin Approval Gate */}
                {canApprove && req.status === 'PENDING' && (
                  <>
                    <button
                      onClick={() => {
                        setApproveTargetId(req.id);
                        setApprovalComments('');
                        setApproveError(null);
                        setIsApproveModalOpen(true);
                      }}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approve Request
                    </button>
                    <button
                      onClick={() => {
                        setRejectionTargetId(req.id);
                        setRejectionReason('');
                        setRejectError(null);
                        setIsRejectModalOpen(true);
                      }}
                      className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject
                    </button>
                  </>
                )}

                {/* Store Keeper Fulfillment Gate */}
                {canFulfill && req.status === 'APPROVED' && (
                  <button
                    onClick={() => {
                      setActiveReq(req);
                      const matching = availableResources.filter(r => r.category === req.category);
                      if (matching.length > 0) {
                        setSelectedAssetId(matching[0].id);
                      } else if (availableResources.length > 0) {
                        setSelectedAssetId(availableResources[0].id);
                      }
                      setHandoverNotes('');
                      setFulfillLocation('');
                      setFulfillError(null);
                      setIsFulfillModalOpen(true);
                    }}
                    className="px-4 py-2 bg-eec-primary hover:bg-[#0E5161] text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <PackageCheck className="w-4 h-4" />
                    Handover Equipment
                  </button>
                )}

                {/* Requester cancel option */}
                {req.status === 'PENDING' && (req.requesterId === currentUser.id || currentRole === 'ADMIN') && (
                  <button
                    onClick={() => handleCancel(req.id)}
                    className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    Cancel Request
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Requisition / Direct Allocation Modal */}
      <Modal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        title={isDirectAllocation ? 'Initiate Corporate Asset Allocation' : 'Submit Resource Requisition'}
        subtitle={isDirectAllocation 
          ? 'Admin-initiated allocation without requisition (pre-approved for Store Keeper fulfillment)' 
          : 'Request equipment allocation for corporate engineering projects'}
      >
        <form onSubmit={handleSubmitRequisition} className="space-y-4">
          {submitError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ResourceCategory)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none"
              >
                <option value="IT_EQUIPMENT">IT Equipment</option>
                <option value="VEHICLES">Vehicles & Transport</option>
                <option value="HEAVY_MACHINERY">Heavy Machinery</option>
                <option value="SURVEYING_GEOTECHNICAL">Surveying & Geotechnical</option>
                <option value="CAMP_FACILITY_FURNITURE">Furniture & Facilities</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Urgency Level</label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as any)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none"
              >
                <option value="ROUTINE">Routine Project Requisition</option>
                <option value="URGENT">Urgent Field Requirement</option>
                <option value="EMERGENCY_PROJECT">Emergency Dam / Rail Work</option>
              </select>
            </div>
          </div>

          {currentRole === 'ADMIN' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Target Directorate *</label>
                <select
                  value={targetDeptId}
                  onChange={(e) => {
                    const did = e.target.value;
                    setTargetDeptId(did);
                    const matchingEmps = employees.filter(emp => emp.departmentId === did);
                    if (matchingEmps.length > 0) setTargetEmpId(matchingEmps[0].id);
                  }}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-medium focus:outline-none"
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Assignee Employee</label>
                <select
                  value={targetEmpId}
                  onChange={(e) => setTargetEmpId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-medium focus:outline-none"
                >
                  <option value="">-- First available department staff --</option>
                  {employees
                    .filter(e => !targetDeptId || e.departmentId === targetDeptId)
                    .map(e => (
                      <option key={e.id} value={e.id}>{e.name} ({e.designation})</option>
                    ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Item Specification / Description *
            </label>
            <input
              type="text"
              required
              value={itemDescription}
              onChange={(e) => setItemDescription(e.target.value)}
              placeholder="e.g. Field Laptop with CAD license or 4x4 Station Wagon"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Project Justification / Purpose *
            </label>
            <textarea
              required
              rows={3}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Explain the specific engineering project, timeline, and need"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Required By Date *</label>
            <input
              type="date"
              required
              value={requiredDate}
              onChange={(e) => setRequiredDate(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsSubmitModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold text-white bg-eec-primary hover:bg-[#0E5161] rounded-xl transition-all shadow-sm"
            >
              {submitting ? 'Submitting...' : isDirectAllocation ? 'Initiate Allocation' : 'Submit Requisition'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Admin Approve Modal */}
      <Modal
        isOpen={isApproveModalOpen}
        onClose={() => setIsApproveModalOpen(false)}
        title="Approve Resource Requisition"
        subtitle="Authorize Store Keeper to fulfill physical equipment from warehouse"
      >
        <form onSubmit={handleApprove} className="space-y-4">
          {approveError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{approveError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Approval Remarks / Instructions for Store Keeper (Optional)
            </label>
            <textarea
              rows={3}
              value={approvalComments}
              onChange={(e) => setApprovalComments(e.target.value)}
              placeholder="e.g. Approved under FY2026 Awash project budget. Issue certified field equipment."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsApproveModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={approving}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm"
            >
              {approving ? 'Approving...' : 'Confirm Approval'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Fulfill Modal (Store Keeper) */}
      <Modal
        isOpen={isFulfillModalOpen}
        onClose={() => setIsFulfillModalOpen(false)}
        title="Store Keeper Handover Fulfillment"
        subtitle={`Select physical hardware for ${activeReq?.requisitionNumber} (${activeReq?.category})`}
      >
        <form onSubmit={handleFulfill} className="space-y-4">
          {fulfillError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{fulfillError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Select Available Physical Asset in Warehouse *
            </label>
            {availableResources.length === 0 ? (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                No available assets currently in store. Please register or intake inventory first.
              </div>
            ) : (
              <select
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none"
              >
                {/* First show matching category */}
                <optgroup label={`Matching Category: ${activeReq?.category}`}>
                  {availableResources
                    .filter(r => r.category === activeReq?.category)
                    .map(r => (
                      <option key={r.id} value={r.id}>
                        {r.itemCode} • {r.name} ({r.condition}, {r.location})
                      </option>
                    ))}
                </optgroup>
                {/* Fallback show all other categories */}
                <optgroup label="Other Available Assets">
                  {availableResources
                    .filter(r => r.category !== activeReq?.category)
                    .map(r => (
                      <option key={r.id} value={r.id}>
                        {r.itemCode} • {r.name} ({r.category})
                      </option>
                    ))}
                </optgroup>
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Field Handover Location (Optional)
            </label>
            <input
              type="text"
              value={fulfillLocation}
              onChange={(e) => setFulfillLocation(e.target.value)}
              placeholder="e.g. Modjo Expressway Site Office or Central Store"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Physical Handover Notes & Voucher Details
            </label>
            <textarea
              rows={3}
              value={handoverNotes}
              onChange={(e) => setHandoverNotes(e.target.value)}
              placeholder="e.g. Handed over with power adapter, calibration certificate, and vehicle keys"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsFulfillModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={fulfilling || availableResources.length === 0}
              className="px-5 py-2 text-xs font-bold text-white bg-eec-primary hover:bg-[#0E5161] rounded-xl transition-all shadow-sm disabled:opacity-50"
            >
              {fulfilling ? 'Fulfilling...' : 'Confirm Store Handover'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="Reject Resource Requisition"
        subtitle="Provide mandatory justification for rejecting this request"
      >
        <form onSubmit={handleReject} className="space-y-4">
          {rejectError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{rejectError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Rejection Reason (Required) *
            </label>
            <textarea
              required
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Explain why this requisition is rejected (e.g. Budget ceiling reached, redundant asset in department)"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsRejectModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={rejecting || rejectionReason.trim().length < 3}
              className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-sm disabled:opacity-50"
            >
              {rejecting ? 'Rejecting...' : 'Confirm Rejection'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
