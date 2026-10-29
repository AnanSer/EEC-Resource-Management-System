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
        requisitionService.getAll(),
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
          {requisitions.length} Total Requests
        </div>
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
      ) : (
        <div className="space-y-4">
          {requisitions.map((req) => (
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
