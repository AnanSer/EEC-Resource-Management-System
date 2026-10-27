import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { requisitionService } from '../../services/requisitionService';
import { resourceService } from '../../services/resourceService';
import { ResourceRequisition, Resource, ResourceCategory } from '../../types';
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
  } from 'lucide-react';
import { Link } from 'react-router-dom';

export const RequisitionsPage: React.FC = () => {
  const { currentUser, currentRole } = useAuth();
  const [requisitions, setRequisitions] = useState<ResourceRequisition[]>([]);
  const [availableResources, setAvailableResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Requisition Modal
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [category, setCategory] = useState<ResourceCategory>('IT_EQUIPMENT');
  const [itemDescription, setItemDescription] = useState('');
  const [justification, setJustification] = useState('');
  const [urgency, setUrgency] = useState<'ROUTINE' | 'URGENT' | 'EMERGENCY_PROJECT'>('ROUTINE');
  const [requiredDate, setRequiredDate] = useState('2026-11-20');
  const [submitting, setSubmitting] = useState(false);

  // Fulfill Modal (Store Keeper)
  const [isFulfillModalOpen, setIsFulfillModalOpen] = useState(false);
  const [activeReq, setActiveReq] = useState<ResourceRequisition | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [fulfilling, setFulfilling] = useState(false);

  // Rejection Modal (Admin)
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionTargetId, setRejectionTargetId] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const canApprove = currentRole === 'ADMIN';
  const canFulfill = ['STORE_KEEPER', 'ADMIN'].includes(currentRole);

  const loadData = async () => {
    setLoading(true);
    try {
      const scope = { role: currentRole, departmentId: currentUser.departmentId, userId: currentUser.id, employeeId: currentUser.employeeId };
      const [reqs, res] = await Promise.all([
        requisitionService.getAll(scope),
        resourceService.getAll()
      ]);
      setRequisitions(reqs);
      setAvailableResources(res.filter(r => r.status === 'AVAILABLE'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmitRequisition = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await requisitionService.submit({
        requesterId: currentUser.id,
        requesterName: currentUser.name,
        requesterRole: currentRole,
        departmentId: currentUser.departmentId,
        departmentName: currentUser.departmentName || 'EEC Directorate',
        category,
        itemDescription,
        justification,
        urgency,
        requiredDate
      });
      setIsSubmitModalOpen(false);
      setItemDescription('');
      setJustification('');
      setToastMessage('Requisition submitted for Admin approval');
      setTimeout(() => setToastMessage(null), 3500);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await requisitionService.approve(id, `${currentUser.name} (Admin)`);
      setToastMessage('Requisition APPROVED. Store Keeper can now fulfill inventory.');
      setTimeout(() => setToastMessage(null), 3500);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Approval failed');
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    setRejecting(true);
    try {
      await requisitionService.reject(rejectionTargetId, rejectionReason);
      setIsRejectModalOpen(false);
      setRejectionReason('');
      setToastMessage('Requisition marked as REJECTED');
      setTimeout(() => setToastMessage(null), 3500);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Rejection failed');
    } finally {
      setRejecting(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await requisitionService.cancel(id, currentUser.id);
      setToastMessage('Requisition cancelled by requester');
      setTimeout(() => setToastMessage(null), 3500);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Cancel failed');
    }
  };

  const handleFulfill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReq) return;
    setFulfilling(true);
    try {
      await requisitionService.fulfill({
        requisitionId: activeReq.id,
        resourceId: selectedAssetId,
        storeKeeperName: `${currentUser.name} (${currentRole})`,
        handoverNotes
      });
      setIsFulfillModalOpen(false);
      setHandoverNotes('');
      setToastMessage('Resource handed over! Inventory and custody successfully updated.');
      setTimeout(() => setToastMessage(null), 3500);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Fulfillment failed');
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
        <button
          onClick={() => setIsSubmitModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-eec-primary hover:bg-[#0E5161] text-white rounded-xl font-bold text-xs transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Requisition Request
        </button>
      </PageHeader>

      {/* Role notice banner */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-eec-primary" />
          <span className="font-semibold text-slate-800">
            Active Workflow Privileges for <strong className="text-eec-primary">{currentRole}</strong>:
          </span>
          <span className="text-slate-500">
            {currentRole === 'ADMIN' && 'You can review and Approve or Reject pending requests.'}
            {currentRole === 'STORE_KEEPER' && 'You fulfill Approved requisitions by selecting physical hardware from warehouse.'}
            {['EMPLOYEE', 'DEPARTMENT_MANAGER'].includes(currentRole) && 'You can submit new asset requisitions and track their status.'}
          </span>
        </div>
      </div>

      {/* Requisitions List */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 border-4 border-eec-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : requisitions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Requisitions Found</h3>
        </div>
      ) : (
        <div className="space-y-4">
          {requisitions.map((req) => (
            <div
              key={req.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-5"
            >
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    {req.requisitionNumber}
                  </span>
                  <CategoryBadge category={req.category} />
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    req.status === 'PENDING'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : req.status === 'APPROVED'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : req.status === 'FULFILLED'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {req.status}
                  </span>
                  {req.urgency === 'URGENT' && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded text-[10px] font-bold">
                      URGENT
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-bold text-slate-900 leading-tight">
                  {req.itemDescription}
                </h3>

                <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="font-semibold text-slate-700">Justification: </span>
                  {req.justification}
                </p>

                <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                  <span>Requester: <strong className="text-slate-800">{req.requesterName}</strong></span>
                  <span>•</span>
                  <span>{req.departmentName}</span>
                  <span>•</span>
                  <span>Required by: <strong>{req.requiredDate}</strong></span>
                </div>

                {req.status === 'FULFILLED' && req.fulfilledResourceName && (
                  <div className="mt-2 text-xs text-emerald-800 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200 flex items-center justify-between">
                    <div>
                      <span>Handed Over: </span>
                      <strong>{req.fulfilledResourceName} ({req.fulfilledResourceCode})</strong>
                      <span className="text-[11px] text-emerald-600 block mt-0.5">By {req.fulfilledBy}</span>
                    </div>
                    {req.fulfilledResourceId && (
                      <Link
                        to={`/resources/${req.fulfilledResourceId}`}
                        className="text-xs font-bold underline"
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
              <div className="flex items-center gap-2 md:flex-col md:items-end justify-end flex-shrink-0">
                {/* Admin Approval Gate */}
                {canApprove && req.status === 'PENDING' && (
                  <>
                    <button
                      onClick={() => handleApprove(req.id)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approve Request
                    </button>
                    <button
                      onClick={() => {
                        setRejectionTargetId(req.id);
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
                      if (matching.length > 0) setSelectedAssetId(matching[0].id);
                      setIsFulfillModalOpen(true);
                    }}
                    className="px-4 py-2 bg-eec-primary hover:bg-[#0E5161] text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <PackageCheck className="w-4 h-4" />
                    Handover Equipment
                  </button>
                )}

                {/* Requester cancel option */}
                {req.status === 'PENDING' && req.requesterId === currentUser.id && (
                  <button
                    onClick={() => handleCancel(req.id)}
                    className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    Cancel My Request
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Requisition Modal */}
      <Modal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        title="Submit Resource Requisition"
        subtitle="Request equipment allocation for corporate engineering projects"
      >
        <form onSubmit={handleSubmitRequisition} className="space-y-4">
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
              Project Justification *
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
              {submitting ? 'Submitting...' : 'Submit Requisition'}
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
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Matching Available Assets in Warehouse *
            </label>
            {availableResources.filter(r => r.category === activeReq?.category).length === 0 ? (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                No matching available assets in store for category <strong>{activeReq?.category}</strong>. Please check inventory intake.
              </div>
            ) : (
              <select
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none"
              >
                {availableResources
                  .filter(r => r.category === activeReq?.category)
                  .map(r => (
                    <option key={r.id} value={r.id}>
                      {r.itemCode} • {r.name} ({r.location})
                    </option>
                  ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Physical Handover Notes & Voucher Details
            </label>
            <textarea
              rows={3}
              value={handoverNotes}
              onChange={(e) => setHandoverNotes(e.target.value)}
              placeholder="e.g. Handed over with keys, logbook, and safety kit"
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
              disabled={fulfilling || availableResources.filter(r => r.category === activeReq?.category).length === 0}
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
