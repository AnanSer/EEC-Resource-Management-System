import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { maintenanceService } from '../../services/maintenanceService';
import { resourceService } from '../../services/resourceService';
import { MaintenanceTicket, Resource, InspectionTest } from '../../types';
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
  } from 'lucide-react';
import { Link } from 'react-router-dom';

export const MaintenancePage: React.FC = () => {
  const { currentUser, currentRole } = useAuth();
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [inspections, setInspections] = useState<InspectionTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Create Ticket Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedResourceId, setSelectedResourceId] = useState('');
  const [ticketTitle, setTicketTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [technician, setTechnician] = useState('');
  const [estimatedCost, setEstimatedCost] = useState<number>(10000);
  const [creating, setCreating] = useState(false);

  // Status Update & QA Inspection Gate Modal
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [activeTicket, setActiveTicket] = useState<MaintenanceTicket | null>(null);
  const [newStatus, setNewStatus] = useState<'OPEN' | 'IN_PROGRESS' | 'TESTING' | 'COMPLETED' | 'CANCELLED'>('IN_PROGRESS');
  const [statusFindings, setStatusFindings] = useState('');
  const [actualCost, setActualCost] = useState<number>(0);
  const [updating, setUpdating] = useState(false);

  // Inline QA Inspection Modal
  const [isQAModalOpen, setIsQAModalOpen] = useState(false);
  const [qaPassed, setQaPassed] = useState(true);
  const [qaFindings, setQaFindings] = useState('');
  const [qaRemarks, setQaRemarks] = useState('');
  const [certNumber, setCertNumber] = useState('');
  const [recordingQA, setRecordingQA] = useState(false);

  const canManageMaintenance = ['IT_TECHNICIAN', 'ADMIN', 'STORE_KEEPER'].includes(currentRole);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tList, rList, iList] = await Promise.all([
        maintenanceService.getTickets(),
        resourceService.getAll(),
        maintenanceService.getInspections()
      ]);
      setTickets(tList);
      setResources(rList);
      setInspections(iList);
      if (rList.length > 0 && !selectedResourceId) {
        setSelectedResourceId(rList[0].id);
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

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await maintenanceService.createTicket({
        resourceId: selectedResourceId,
        title: ticketTitle,
        description,
        priority,
        reportedBy: `${currentUser.name} (${currentRole})`,
        assignedTechnician: technician || undefined,
        estimatedCostETB: Number(estimatedCost)
      });
      setIsCreateModalOpen(false);
      setTicketTitle('');
      setDescription('');
      setToastMessage('Maintenance work order created! Asset transitioned to MAINTENANCE status.');
      setTimeout(() => setToastMessage(null), 3500);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Ticket creation failed');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket) return;
    setUpdating(true);
    try {
      await maintenanceService.updateStatus(activeTicket.id, newStatus, {
        findings: statusFindings || activeTicket.findings,
        actualCostETB: actualCost ? Number(actualCost) : activeTicket.actualCostETB
      });
      setIsUpdateModalOpen(false);
      setToastMessage(`Ticket updated to ${newStatus}`);
      setTimeout(() => setToastMessage(null), 3500);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Status update failed');
    } finally {
      setUpdating(false);
    }
  };

  const handleRecordQA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket) return;
    setRecordingQA(true);
    try {
      await maintenanceService.recordInspection({
        ticketId: activeTicket.id,
        resourceId: activeTicket.resourceId,
        inspectionType: 'MAINTENANCE_QA',
        passed: qaPassed,
        findings: qaFindings,
        conductedBy: `${currentUser.name} (${currentRole})`,
        certificationNumber: certNumber || undefined,
        remarks: qaRemarks
      });
      setIsQAModalOpen(false);
      setToastMessage(`QA Inspection recorded as ${qaPassed ? 'PASSED' : 'FAILED'}`);
      setTimeout(() => setToastMessage(null), 3500);
      loadData();
    } catch (err: any) {
      alert(err.message || 'QA recording failed');
    } finally {
      setRecordingQA(false);
    }
  };

  const formatETB = (val: number) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      maximumFractionDigits: 0
    }).format(val);
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
        title="Maintenance Tickets & Fleet Servicing"
        subtitle="Manage diagnostic work orders, servicing logs, and mandatory QA completion gates"
        breadcrumbs={[
          { label: 'RMS', href: '/dashboard' },
          { label: 'Maintenance' }
        ]}
      >
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-eec-primary hover:bg-[#0E5161] text-white rounded-xl font-bold text-xs transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Open Maintenance Ticket
        </button>
      </PageHeader>

      {/* Strict QA Invariant Warning Banner */}
      <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 flex items-center gap-3 text-xs text-amber-900">
        <ShieldCheck className="w-5 h-5 text-amber-600 flex-shrink-0" />
        <div>
          <strong className="font-bold">EEC Quality Assurance Rule: </strong>
          <span>
            A maintenance ticket <strong>cannot be marked COMPLETED</strong> until an inspection test with passing QA is recorded. This prevents faulty engineering instruments or uncertified vehicles from returning to active field custody.
          </span>
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
          <h3 className="text-base font-bold text-slate-800">No Open Tickets</h3>
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map((t) => {
            const ticketInspections = inspections.filter(i => i.ticketId === t.id);
            const latestTest = ticketInspections[0];

            return (
              <div
                key={t.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card flex flex-col md:flex-row md:items-start justify-between gap-5"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {t.ticketNumber}
                    </span>
                    <CategoryBadge category={t.category} />
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      t.status === 'OPEN'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : t.status === 'IN_PROGRESS'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : t.status === 'TESTING'
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : t.status === 'COMPLETED'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {t.status}
                    </span>
                    <span className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                      t.priority === 'CRITICAL' || t.priority === 'HIGH'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {t.priority} PRIORITY
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 leading-tight">
                    {t.title}
                  </h3>

                  <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    {t.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                    <span>Asset: <Link to={`/resources/${t.resourceId}`} className="font-bold text-eec-primary hover:underline">{t.resourceName} ({t.resourceCode})</Link></span>
                    <span>•</span>
                    <span>Technician: <strong className="text-slate-800">{t.assignedTechnician || 'Unassigned'}</strong></span>
                    <span>•</span>
                    <span>Cost: <strong className="text-slate-800">{t.actualCostETB ? formatETB(t.actualCostETB) : `Est: ${formatETB(t.estimatedCostETB || 0)}`}</strong></span>
                  </div>

                  {/* QA Test Status Tag */}
                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-slate-400" />
                      <span className="font-semibold text-slate-700">QA Inspection Status: </span>
                      {latestTest ? (
                        latestTest.passed ? (
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            PASSED ({latestTest.inspectionType})
                          </span>
                        ) : (
                          <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            FAILED ({latestTest.inspectionType})
                          </span>
                        )
                      ) : (
                        <span className="text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Pending QA Test
                        </span>
                      )}
                    </div>

                    {t.findings && (
                      <span className="text-slate-500 italic max-w-sm truncate text-[11px]">
                        "{t.findings}"
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 md:flex-col md:items-end justify-end flex-shrink-0">
                  {canManageMaintenance && t.status !== 'COMPLETED' && (
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
                          setNewStatus(t.status === 'OPEN' ? 'IN_PROGRESS' : t.status === 'IN_PROGRESS' ? 'TESTING' : 'COMPLETED');
                          setStatusFindings(t.findings || '');
                          setActualCost(t.actualCostETB || t.estimatedCostETB || 0);
                          setIsUpdateModalOpen(true);
                        }}
                        className="px-3.5 py-1.5 bg-eec-primary hover:bg-[#0E5161] text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        Update Work Order
                      </button>
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
        title="Open Maintenance Ticket"
        subtitle="Initiate repair or diagnostic order for EEC equipment"
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
              {resources.map(r => (
                <option key={r.id} value={r.id}>
                  {r.itemCode} • {r.name} ({r.category})
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
              placeholder="e.g. Engine overheating under heavy load or Total Station EDM error"
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
              placeholder="Describe symptoms, error codes, and field context"
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
                <option value="CRITICAL">Critical (Site Blocked)</option>
              </select>
            </div>

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
              {creating ? 'Creating...' : 'Open Work Order'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Update Work Order Modal */}
      <Modal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        title="Update Work Order Status"
        subtitle={`Work Order ${activeTicket?.ticketNumber} for ${activeTicket?.resourceName}`}
      >
        <form onSubmit={handleUpdateStatus} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">New Workflow Status *</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as any)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none"
            >
              <option value="OPEN">OPEN (Logged)</option>
              <option value="IN_PROGRESS">IN_PROGRESS (Under Servicing)</option>
              <option value="TESTING">TESTING (Workshop QA Required)</option>
              <option value="COMPLETED">COMPLETED (Passing QA Required)</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          {newStatus === 'COMPLETED' && (
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs text-purple-900 space-y-1">
              <strong className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                QA Verification Check
              </strong>
              <p className="text-[11px] leading-relaxed">
                Before submitting, ensure you have clicked "Record QA Test" and logged a passing inspection. The system will throw an error if no passing test exists.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Technician Findings / Repair Log</label>
            <textarea
              rows={3}
              value={statusFindings}
              onChange={(e) => setStatusFindings(e.target.value)}
              placeholder="e.g. Replaced fuel filter, pressure tested at 8.5 bar"
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
              {updating ? 'Saving...' : 'Update Status'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Record QA Inspection Modal */}
      <Modal
        isOpen={isQAModalOpen}
        onClose={() => setIsQAModalOpen(false)}
        title="Record Workshop QA Inspection Test"
        subtitle={`Pre-requisite for completing ${activeTicket?.ticketNumber}`}
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
