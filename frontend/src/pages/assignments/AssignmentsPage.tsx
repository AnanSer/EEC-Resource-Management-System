import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { assignmentService } from '../../services/assignmentService';
import { resourceService } from '../../services/resourceService';
import { employeeService } from '../../services/employeeService';
import { AssetAssignment, Resource, Employee, ResourceCondition } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Modal } from '../../components/ui/Modal';
import { 
  ArrowLeftRight, 
  Plus, 
  Search, 
  Check, 
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const AssignmentsPage: React.FC = () => {
  const { currentUser, currentRole } = useAuth();
  const [assignments, setAssignments] = useState<AssetAssignment[]>([]);
  const [availableResources, setAvailableResources] = useState<Resource[]>([]);
  const [assignedResources, setAssignedResources] = useState<Resource[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'TRANSFERRED' | 'RETURNED'>('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Direct Assign Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedResourceId, setSelectedResourceId] = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  // Transfer Modal
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferResourceId, setTransferResourceId] = useState('');
  const [transferNewEmpId, setTransferNewEmpId] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);

  // Return Modal
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnResourceId, setReturnResourceId] = useState('');
  const [returnCondition, setReturnCondition] = useState<ResourceCondition>('GOOD');
  const [returnLocation, setReturnLocation] = useState('Central Store - Kersa');
  const [returnNotes, setReturnNotes] = useState('');
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);

  const canManageAssignments = ['ADMIN', 'STORE_KEEPER', 'DEPARTMENT_MANAGER'].includes(currentRole);

  const loadData = async () => {
    setLoading(true);
    try {
      const [asgns, allRes, emps] = await Promise.all([
        assignmentService.getAll(),
        resourceService.getAll(),
        employeeService.getAll()
      ]);
      setAssignments(asgns);

      // Available resources for assignment
      const avail = allRes.filter(r => r.status === 'AVAILABLE');
      // Assigned resources for transfer or return
      const assigned = allRes.filter(r => r.status === 'ASSIGNED');

      // Filter eligible employees based on role
      const eligibleEmps = currentRole === 'DEPARTMENT_MANAGER' && currentUser?.departmentId
        ? emps.filter(e => e.isActive && e.departmentId === currentUser.departmentId)
        : emps.filter(e => e.isActive);

      setAvailableResources(avail);
      setAssignedResources(assigned);
      setEmployees(eligibleEmps);

      if (avail.length > 0 && !selectedResourceId) {
        setSelectedResourceId(avail[0].id);
      }
      if (assigned.length > 0 && !transferResourceId) {
        setTransferResourceId(assigned[0].id);
        const other = eligibleEmps.filter(e => e.id !== assigned[0].currentAssigneeId);
        if (other.length > 0) setTransferNewEmpId(other[0].id);
      }
      if (eligibleEmps.length > 0 && !selectedEmpId) {
        setSelectedEmpId(eligibleEmps[0].id);
      }
    } catch (err) {
      console.error('[AssignmentsPage Error]', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentRole, currentUser?.departmentId]);

  const handleDirectAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssigning(true);
    setAssignError(null);
    try {
      await assignmentService.createDirect({
        resourceId: selectedResourceId,
        employeeId: selectedEmpId,
        purpose,
        expectedReturnDate: expectedReturnDate || undefined,
        notes: assignNotes || undefined,
        assignedBy: `${currentUser?.name || 'Authorized Officer'} (${currentRole})`
      });
      setIsAssignModalOpen(false);
      setPurpose('');
      setAssignNotes('');
      setToastMessage('Resource assigned successfully and marked in field custody');
      setTimeout(() => setToastMessage(null), 3500);
      await loadData();
    } catch (err: any) {
      setAssignError(err.message || 'Assignment failed');
    } finally {
      setAssigning(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferring(true);
    setTransferError(null);
    try {
      await assignmentService.transfer({
        resourceId: transferResourceId,
        newEmployeeId: transferNewEmpId,
        reason: transferReason || undefined,
        transferNotes,
        transferredBy: `${currentUser?.name || 'Authorized Officer'} (${currentRole})`
      });
      setIsTransferModalOpen(false);
      setTransferNotes('');
      setTransferReason('');
      setToastMessage('Custody transferred and previous assignment closed');
      setTimeout(() => setToastMessage(null), 3500);
      await loadData();
    } catch (err: any) {
      setTransferError(err.message || 'Transfer failed');
    } finally {
      setTransferring(false);
    }
  };

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    setReturning(true);
    setReturnError(null);
    try {
      await assignmentService.returnResource({
        resourceId: returnResourceId,
        condition: returnCondition,
        returnLocation,
        notes: returnNotes || undefined,
      });
      setIsReturnModalOpen(false);
      setReturnNotes('');
      setToastMessage('Resource returned to central store and custody closed');
      setTimeout(() => setToastMessage(null), 3500);
      await loadData();
    } catch (err: any) {
      setReturnError(err.message || 'Return failed');
    } finally {
      setReturning(false);
    }
  };

  const openTransferModalForResource = (resId: string) => {
    setTransferResourceId(resId);
    setTransferError(null);
    const item = assignedResources.find(r => r.id === resId);
    const other = employees.filter(e => e.id !== item?.currentAssigneeId);
    if (other.length > 0) setTransferNewEmpId(other[0].id);
    setIsTransferModalOpen(true);
  };

  const openReturnModalForResource = (resId: string) => {
    setReturnResourceId(resId);
    setReturnError(null);
    const item = assignedResources.find(r => r.id === resId);
    if (item) {
      setReturnCondition(item.condition);
      setReturnLocation(item.location || 'Central Store - Kersa');
    }
    setIsReturnModalOpen(true);
  };

  const filteredAssignments = assignments.filter(a => {
    if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      a.resourceName.toLowerCase().includes(q) ||
      a.resourceCode.toLowerCase().includes(q) ||
      a.employeeName.toLowerCase().includes(q) ||
      a.departmentName.toLowerCase().includes(q) ||
      (a.assignmentNumber && a.assignmentNumber.toLowerCase().includes(q)) ||
      a.purpose.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-slideUp">
          <Check className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      <PageHeader
        title="Asset Assignments & Field Custody"
        subtitle="Manage equipment handovers, employee custody logs, and inter-departmental transfers"
        breadcrumbs={[
          { label: 'RMS', href: '/dashboard' },
          { label: 'Assignments' }
        ]}
      >
        {canManageAssignments && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (assignedResources.length > 0) {
                  openReturnModalForResource(assignedResources[0].id);
                }
              }}
              disabled={assignedResources.length === 0}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4 text-amber-600" />
              Process Return
            </button>

            <button
              onClick={() => {
                if (assignedResources.length > 0) {
                  openTransferModalForResource(assignedResources[0].id);
                }
              }}
              disabled={assignedResources.length === 0}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs transition-colors disabled:opacity-50"
            >
              <ArrowLeftRight className="w-4 h-4 text-blue-600" />
              Transfer Custody
            </button>

            <button
              onClick={() => {
                setAssignError(null);
                if (availableResources.length > 0 && !selectedResourceId) {
                  setSelectedResourceId(availableResources[0].id);
                }
                setIsAssignModalOpen(true);
              }}
              disabled={availableResources.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-eec-primary hover:bg-[#0E5161] text-white rounded-xl font-bold text-xs transition-colors shadow-sm disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Direct Assignment
            </button>
          </div>
        )}
      </PageHeader>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by equipment, item code, custodian, or assignment #..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-accent/30 text-slate-800"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl self-stretch sm:self-auto overflow-x-auto">
          {(['ALL', 'ACTIVE', 'TRANSFERRED', 'RETURNED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                statusFilter === s
                  ? 'bg-white text-eec-primary shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {s === 'ALL' ? 'All Records' : s === 'ACTIVE' ? 'Active Custody' : s === 'TRANSFERRED' ? 'Transferred' : 'Returned'}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing {filteredAssignments.length} of {assignments.length} custody records
        </div>
      </div>

      {/* Assignments Table */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 border-4 border-eec-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No assignment records found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery || statusFilter !== 'ALL'
              ? 'No equipment assignments matched your query and filters.'
              : 'No corporate equipment has been assigned yet. Use the Direct Assignment action above to allocate available resources.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Assigned Resource</th>
                  <th className="px-6 py-4">Custodian</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4">Purpose / Mission</th>
                  <th className="px-6 py-4">Timeline</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredAssignments.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <Link 
                        to={`/resources/${a.resourceId}`}
                        className="font-bold text-slate-900 hover:text-eec-primary transition-colors block"
                      >
                        {a.resourceName}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[11px] text-slate-500">{a.resourceCode}</span>
                        {a.assignmentNumber && (
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            {a.assignmentNumber}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{a.employeeName}</div>
                      <div className="text-[10px] text-slate-400">By {a.assignedBy}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-800 font-medium">{a.departmentName}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-600 line-clamp-2 max-w-xs">{a.purpose}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase">Assigned: </span>
                        {new Date(a.assignedAt).toLocaleDateString()}
                      </div>
                      {a.status === 'ACTIVE' && a.expectedReturnDate && (
                        <div className="text-[10px] text-amber-600 font-medium mt-0.5">
                          Due: {a.expectedReturnDate}
                        </div>
                      )}
                      {a.status === 'RETURNED' && a.returnedAt && (
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Returned: {new Date(a.returnedAt).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                        a.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : a.status === 'TRANSFERRED'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canManageAssignments && a.status === 'ACTIVE' && (
                          <>
                            <button
                              onClick={() => openTransferModalForResource(a.resourceId)}
                              title="Transfer Custody"
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <ArrowLeftRight className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openReturnModalForResource(a.resourceId)}
                              title="Process Return"
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <Link
                          to={`/resources/${a.resourceId}`}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-eec-primary hover:text-white rounded-lg font-bold text-[11px] transition-colors"
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Direct Assignment Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Direct Equipment Assignment"
        subtitle="Assign an available asset directly to an active corporate employee"
      >
        <form onSubmit={handleDirectAssign} className="space-y-4">
          {assignError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{assignError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Select Available Asset *
            </label>
            <select
              value={selectedResourceId}
              onChange={(e) => setSelectedResourceId(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none"
            >
              {availableResources.map(r => (
                <option key={r.id} value={r.id}>
                  {r.itemCode} • {r.name} ({r.category})
                </option>
              ))}
            </select>
            {availableResources.length === 0 && (
              <p className="text-[11px] text-amber-600 mt-1">No AVAILABLE assets currently in store.</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Assignee Employee *
            </label>
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none"
            >
              {employees.map(e => (
                <option key={e.id} value={e.id}>
                  {e.name} • {e.departmentName} ({e.designation})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Assignment Purpose & Site Location *
            </label>
            <textarea
              required
              rows={2}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Field supervision on Modjo-Hawassa expressway"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Expected Return Date (Optional)
            </label>
            <input
              type="date"
              value={expectedReturnDate}
              onChange={(e) => setExpectedReturnDate(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Handover Remarks / Condition Notes (Optional)
            </label>
            <input
              type="text"
              value={assignNotes}
              onChange={(e) => setAssignNotes(e.target.value)}
              placeholder="e.g. Dispatched with charger and protective carrying case"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsAssignModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={assigning || availableResources.length === 0}
              className="px-5 py-2 text-xs font-bold text-white bg-eec-primary hover:bg-[#0E5161] rounded-xl transition-all shadow-sm disabled:opacity-50"
            >
              {assigning ? 'Assigning...' : 'Confirm Assignment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Custody Transfer Modal */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title="Transfer Asset Custody"
        subtitle="Reassign active equipment directly from one employee to another"
      >
        <form onSubmit={handleTransfer} className="space-y-4">
          {transferError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{transferError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Select Currently Assigned Asset *
            </label>
            <select
              value={transferResourceId}
              onChange={(e) => {
                const rid = e.target.value;
                setTransferResourceId(rid);
                const item = assignedResources.find(r => r.id === rid);
                const other = employees.filter(emp => emp.id !== item?.currentAssigneeId);
                if (other.length > 0) setTransferNewEmpId(other[0].id);
              }}
              required
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none"
            >
              {assignedResources.map(r => (
                <option key={r.id} value={r.id}>
                  {r.itemCode} • {r.name} (Held by: {r.currentAssigneeName || 'Assigned'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Transfer To New Custodian *
            </label>
            <select
              value={transferNewEmpId}
              onChange={(e) => setTransferNewEmpId(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none"
            >
              {employees.map(e => (
                <option key={e.id} value={e.id}>
                  {e.name} • {e.departmentName} ({e.designation})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Operational Reason (Optional)
            </label>
            <input
              type="text"
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              placeholder="e.g. Inter-departmental project realignment"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Transfer Justification & Handover Notes *
            </label>
            <textarea
              required
              rows={3}
              value={transferNotes}
              onChange={(e) => setTransferNotes(e.target.value)}
              placeholder="e.g. Project phase 1 complete; equipment relocated to Soil Lab team"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsTransferModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={transferring}
              className="px-5 py-2 text-xs font-bold text-white bg-eec-primary hover:bg-[#0E5161] rounded-xl transition-all shadow-sm disabled:opacity-50"
            >
              {transferring ? 'Transferring...' : 'Execute Custody Transfer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Return to Store Modal */}
      <Modal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        title="Process Asset Return"
        subtitle="Close active custody and return resource to central or department inventory"
      >
        <form onSubmit={handleReturn} className="space-y-4">
          {returnError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{returnError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Select Assigned Resource *
            </label>
            <select
              value={returnResourceId}
              onChange={(e) => {
                const rid = e.target.value;
                setReturnResourceId(rid);
                const item = assignedResources.find(r => r.id === rid);
                if (item) {
                  setReturnCondition(item.condition);
                  setReturnLocation(item.location || 'Central Store - Kersa');
                }
              }}
              required
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none"
            >
              {assignedResources.map(r => (
                <option key={r.id} value={r.id}>
                  {r.itemCode} • {r.name} (Held by: {r.currentAssigneeName || 'Assigned'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Physical Condition Upon Return *
            </label>
            <select
              value={returnCondition}
              onChange={(e) => setReturnCondition(e.target.value as ResourceCondition)}
              required
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none"
            >
              <option value="EXCELLENT">EXCELLENT (Like new, fully operational)</option>
              <option value="GOOD">GOOD (Standard wear, fully operational)</option>
              <option value="FAIR">FAIR (Visible wear, operational)</option>
              <option value="NEEDS_REPAIR">NEEDS REPAIR (Routes to Maintenance)</option>
              <option value="DAMAGED">DAMAGED (Routes to Maintenance / QA)</option>
              <option value="RETIRED">RETIRED (End of lifecycle)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Return Storage Location *
            </label>
            <input
              type="text"
              required
              value={returnLocation}
              onChange={(e) => setReturnLocation(e.target.value)}
              placeholder="e.g. Central Store - Kersa or Head Office Room 204"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Return Inspection Notes & Remarks
            </label>
            <textarea
              rows={3}
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
              placeholder="e.g. Clean condition, all original cables returned, tested power-on."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsReturnModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={returning || assignedResources.length === 0}
              className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all shadow-sm disabled:opacity-50"
            >
              {returning ? 'Processing Return...' : 'Confirm Return'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
