import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { returnService } from '../../services/returnService';
import { resourceService } from '../../services/resourceService';
import { AssetReturnRecord, Resource, ResourceCondition } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { 
  RotateCcw, 
   
  Check, 
   
  AlertCircle,
  } from 'lucide-react';
import { Link } from 'react-router-dom';

export const ReturnsPage: React.FC = () => {
  const { currentUser, currentRole } = useAuth();
  const [returns, setReturns] = useState<AssetReturnRecord[]>([]);
  const [assignedResources, setAssignedResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Return Intake Modal (Store Keeper receiving)
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [activeReturn, setActiveReturn] = useState<AssetReturnRecord | null>(null);
  const [conditionOnReturn, setConditionOnReturn] = useState<ResourceCondition>('GOOD');
  const [returnLocation, setReturnLocation] = useState('Central Warehouse - Kersa, Bay 3');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [receiving, setReceiving] = useState(false);

  // Walk-in Return Modal
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [walkInResourceId, setWalkInResourceId] = useState('');
  const [walkInCondition, setWalkInCondition] = useState<ResourceCondition>('GOOD');
  const [walkInLocation, setWalkInLocation] = useState('Central Warehouse - Kersa, Room 12');
  const [walkInNotes, setWalkInNotes] = useState('');
  const [processingWalkIn, setProcessingWalkIn] = useState(false);

  // Employee Schedule Return Modal
  const [isScheduleReturnOpen, setIsScheduleReturnOpen] = useState(false);
  const [scheduledResourceId, setScheduledResourceId] = useState('');
  const [scheduledReason, setScheduledReason] = useState('');
  const [scheduling, setScheduling] = useState(false);

  const canReceiveReturns = ['STORE_KEEPER', 'ADMIN'].includes(currentRole);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rets, res] = await Promise.all([
        returnService.getAll(),
        resourceService.getAll()
      ]);
      setReturns(rets);
      const assigned = res.filter(r => r.status === 'ASSIGNED');
      setAssignedResources(assigned);
      if (assigned.length > 0) {
        setWalkInResourceId(assigned[0].id);
        setScheduledResourceId(assigned[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReceiveScheduled = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReturn) return;
    setReceiving(true);
    try {
      await returnService.receive({
        returnId: activeReturn.id,
        resourceId: activeReturn.resourceId,
        conditionOnReturn,
        returnLocation,
        receivedBy: `${currentUser.name} (${currentRole})`,
        handoverNotes
      });
      setIsReceiveModalOpen(false);
      setToastMessage('Asset received into store! Inventory marked AVAILABLE.');
      setTimeout(() => setToastMessage(null), 3500);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Intake failed');
    } finally {
      setReceiving(false);
    }
  };

  const handleWalkInReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingWalkIn(true);
    try {
      await returnService.receive({
        resourceId: walkInResourceId,
        conditionOnReturn: walkInCondition,
        returnLocation: walkInLocation,
        receivedBy: `${currentUser.name} (${currentRole})`,
        handoverNotes: walkInNotes,
        isWalkIn: true
      });
      setIsWalkInModalOpen(false);
      setToastMessage('Direct walk-in return processed. Asset custody released.');
      setTimeout(() => setToastMessage(null), 3500);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Walk-in return failed');
    } finally {
      setProcessingWalkIn(false);
    }
  };

  const handleScheduleReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    setScheduling(true);
    try {
      await returnService.requestReturn({
        resourceId: scheduledResourceId,
        reason: scheduledReason,
        employeeId: currentUser.id
      });
      setIsScheduleReturnOpen(false);
      setScheduledReason('');
      setToastMessage('Return scheduled! Please surrender equipment at central store counter.');
      setTimeout(() => setToastMessage(null), 3500);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Scheduling failed');
    } finally {
      setScheduling(false);
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
        title="Asset Returns & Custody Clearance"
        subtitle="Process scheduled equipment returns, execute walk-in clearances, and verify return condition"
        breadcrumbs={[
          { label: 'RMS', href: '/dashboard' },
          { label: 'Asset Returns' }
        ]}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsScheduleReturnOpen(true)}
            disabled={assignedResources.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs transition-colors disabled:opacity-50"
          >
            Schedule Return
          </button>

          {canReceiveReturns && (
            <button
              onClick={() => setIsWalkInModalOpen(true)}
              disabled={assignedResources.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-eec-primary hover:bg-[#0E5161] text-white rounded-xl font-bold text-xs transition-colors shadow-sm disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              Direct Walk-in Return
            </button>
          )}
        </div>
      </PageHeader>

      {/* Return History Table */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 border-4 border-eec-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : returns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Return Records</h3>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Return # / Type</th>
                  <th className="px-6 py-4">Equipment Description</th>
                  <th className="px-6 py-4">Surrendering Custodian</th>
                  <th className="px-6 py-4">Reason / Remarks</th>
                  <th className="px-6 py-4">Check-in Condition</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {returns.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-mono font-bold text-slate-900">{r.returnNumber}</div>
                      <span className="text-[10px] text-slate-400 font-semibold">{r.type}</span>
                    </td>
                    <td className="px-6 py-4">
                      <Link 
                        to={`/resources/${r.resourceId}`}
                        className="font-bold text-slate-900 hover:text-eec-primary transition-colors block"
                      >
                        {r.resourceName}
                      </Link>
                      <span className="font-mono text-[11px] text-slate-400">{r.resourceCode}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{r.employeeName}</div>
                      <div className="text-[11px] text-slate-400">{r.departmentName}</div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="line-clamp-2 max-w-xs text-slate-600">{r.reason}</p>
                    </td>
                    <td className="px-6 py-4">
                      {r.conditionOnReturn ? (
                        <StatusBadge condition={r.conditionOnReturn} />
                      ) : (
                        <span className="text-slate-400">Pending Inspection</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                        r.status === 'RECEIVED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {canReceiveReturns && r.status === 'PENDING' ? (
                        <button
                          onClick={() => {
                            setActiveReturn(r);
                            setIsReceiveModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-eec-primary hover:bg-[#0E5161] text-white rounded-lg font-bold text-[11px] transition-colors"
                        >
                          Receive Intake
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium">Cleared</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Receive Scheduled Return Modal */}
      <Modal
        isOpen={isReceiveModalOpen}
        onClose={() => setIsReceiveModalOpen(false)}
        title="Execute Scheduled Return Intake"
        subtitle={`Receive ${activeReturn?.resourceName} into store inventory`}
      >
        <form onSubmit={handleReceiveScheduled} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Physical Condition Upon Return *
            </label>
            <select
              value={conditionOnReturn}
              onChange={(e) => setConditionOnReturn(e.target.value as ResourceCondition)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none"
            >
              <option value="EXCELLENT">Excellent (Like New)</option>
              <option value="GOOD">Good (Operational)</option>
              <option value="FAIR">Fair (Normal Wear)</option>
              <option value="NEEDS_REPAIR">Needs Repair (Workshop required)</option>
              <option value="DAMAGED">Damaged in Field</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Designated Store Shelf / Room Location *
            </label>
            <input
              type="text"
              required
              value={returnLocation}
              onChange={(e) => setReturnLocation(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Store Keeper Verification Notes
            </label>
            <textarea
              rows={3}
              value={handoverNotes}
              onChange={(e) => setHandoverNotes(e.target.value)}
              placeholder="e.g. Serial checked, charging cables complete"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsReceiveModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={receiving}
              className="px-5 py-2 text-xs font-bold text-white bg-eec-primary hover:bg-[#0E5161] rounded-xl transition-all shadow-sm"
            >
              {receiving ? 'Processing...' : 'Complete Check-in'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Direct Walk-in Return Modal */}
      <Modal
        isOpen={isWalkInModalOpen}
        onClose={() => setIsWalkInModalOpen(false)}
        title="Direct Walk-in Return Clearance"
        subtitle="Immediately receive an assigned asset brought directly to the warehouse counter"
      >
        <form onSubmit={handleWalkInReturn} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Select Currently Assigned Asset *
            </label>
            <select
              value={walkInResourceId}
              onChange={(e) => setWalkInResourceId(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none"
            >
              {assignedResources.map(r => (
                <option key={r.id} value={r.id}>
                  {r.itemCode} • {r.name} (Holder: {r.currentAssigneeName})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Inspected Condition *
            </label>
            <select
              value={walkInCondition}
              onChange={(e) => setWalkInCondition(e.target.value as ResourceCondition)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none"
            >
              <option value="EXCELLENT">Excellent (Like New)</option>
              <option value="GOOD">Good (Operational)</option>
              <option value="FAIR">Fair (Normal Wear)</option>
              <option value="NEEDS_REPAIR">Needs Repair</option>
              <option value="DAMAGED">Damaged</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Return Storage Shelf / Bay *
            </label>
            <input
              type="text"
              required
              value={walkInLocation}
              onChange={(e) => setWalkInLocation(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Intake Notes
            </label>
            <textarea
              rows={2}
              value={walkInNotes}
              onChange={(e) => setWalkInNotes(e.target.value)}
              placeholder="e.g. Employee returned vehicle after field survey assignment"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsWalkInModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={processingWalkIn}
              className="px-5 py-2 text-xs font-bold text-white bg-eec-primary hover:bg-[#0E5161] rounded-xl transition-all shadow-sm"
            >
              {processingWalkIn ? 'Processing...' : 'Confirm Walk-in Return'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Schedule Return Modal */}
      <Modal
        isOpen={isScheduleReturnOpen}
        onClose={() => setIsScheduleReturnOpen(false)}
        title="Schedule Asset Return"
        subtitle="Notify Store Keepers of an upcoming equipment surrender"
      >
        <form onSubmit={handleScheduleReturn} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Select Asset in Custody *
            </label>
            <select
              value={scheduledResourceId}
              onChange={(e) => setScheduledResourceId(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none"
            >
              {assignedResources.map(r => (
                <option key={r.id} value={r.id}>
                  {r.itemCode} • {r.name} (Assigned: {r.currentAssigneeName})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Reason for Return *
            </label>
            <textarea
              required
              rows={3}
              value={scheduledReason}
              onChange={(e) => setScheduledReason(e.target.value)}
              placeholder="e.g. Project finished, equipment no longer required"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsScheduleReturnOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={scheduling}
              className="px-5 py-2 text-xs font-bold text-white bg-eec-primary hover:bg-[#0E5161] rounded-xl transition-all shadow-sm"
            >
              {scheduling ? 'Scheduling...' : 'Submit Return Notice'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
