import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { assignmentService } from '../../services/assignmentService';
import { resourceService } from '../../services/resourceService';
import { employeeService } from '../../services/employeeService';
import { AssetAssignment, Resource, Employee } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Modal } from '../../components/ui/Modal';
import { 
  ArrowLeftRight, 
  Plus, 
  Search, 
  Check, 
  AlertCircle,
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
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Direct Assign Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedResourceId, setSelectedResourceId] = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Transfer Modal
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferResourceId, setTransferResourceId] = useState('');
  const [transferNewEmpId, setTransferNewEmpId] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferring, setTransferring] = useState(false);

  const canManageAssignments = ['ADMIN', 'STORE_KEEPER'].includes(currentRole);

  const loadData = async () => {
    setLoading(true);
    try {
      const [asgns, allRes, emps] = await Promise.all([
        assignmentService.getAll(),
        resourceService.getAll(),
        employeeService.getAll()
      ]);
      setAssignments(asgns);
      setAvailableResources(allRes.filter(r => r.status === 'AVAILABLE'));
      setAssignedResources(allRes.filter(r => r.status === 'ASSIGNED'));
      setEmployees(emps.filter(e => e.isActive));

      if (allRes.filter(r => r.status === 'AVAILABLE').length > 0 && !selectedResourceId) {
        setSelectedResourceId(allRes.filter(r => r.status === 'AVAILABLE')[0].id);
      }
      if (emps.length > 0 && !selectedEmpId) {
        setSelectedEmpId(emps[0].id);
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

  const handleDirectAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssigning(true);
    try {
      await assignmentService.createDirect({
        resourceId: selectedResourceId,
        employeeId: selectedEmpId,
        purpose,
        expectedReturnDate: expectedReturnDate || undefined,
        assignedBy: `${currentUser.name} (${currentRole})`
      });
      setIsAssignModalOpen(false);
      setPurpose('');
      setToastMessage('Resource assigned successfully and marked in field custody');
      setTimeout(() => setToastMessage(null), 3500);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Assignment failed');
    } finally {
      setAssigning(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferring(true);
    try {
      await assignmentService.transfer({
        resourceId: transferResourceId,
        newEmployeeId: transferNewEmpId,
        transferNotes,
        transferredBy: `${currentUser.name} (${currentRole})`
      });
      setIsTransferModalOpen(false);
      setTransferNotes('');
      setToastMessage('Custody transferred and previous assignment closed');
      setTimeout(() => setToastMessage(null), 3500);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Transfer failed');
    } finally {
      setTransferring(false);
    }
  };

  const filteredAssignments = assignments.filter(a => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      a.resourceName.toLowerCase().includes(q) ||
      a.resourceCode.toLowerCase().includes(q) ||
      a.employeeName.toLowerCase().includes(q) ||
      a.departmentName.toLowerCase().includes(q) ||
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
                  setTransferResourceId(assignedResources[0].id);
                  const otherEmps = employees.filter(e => e.id !== assignedResources[0].currentAssigneeId);
                  if (otherEmps.length > 0) setTransferNewEmpId(otherEmps[0].id);
                }
                setIsTransferModalOpen(true);
              }}
              disabled={assignedResources.length === 0}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs transition-colors"
            >
              <ArrowLeftRight className="w-4 h-4" />
              Transfer Custody
            </button>

            <button
              onClick={() => setIsAssignModalOpen(true)}
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
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by equipment, item code, or employee..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-accent/30 text-slate-800"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Showing {filteredAssignments.length} custody records
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
          <h3 className="text-base font-bold text-slate-800">No assignment records</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            No equipment assignments matched your query.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Assigned Resource</th>
                  <th className="px-6 py-4">Current Custodian</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4">Purpose / Mission</th>
                  <th className="px-6 py-4">Handover Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
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
                      <span className="font-mono text-[11px] text-slate-400">{a.resourceCode}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{a.employeeName}</div>
                      <div className="text-[10px] text-slate-400">By {a.assignedBy}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-800 font-medium">{a.departmentName}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-600 line-clamp-1 max-w-xs">{a.purpose}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div>{new Date(a.assignedAt).toLocaleDateString()}</div>
                      {a.expectedReturnDate && (
                        <div className="text-[10px] text-slate-400 mt-0.5">Due: {a.expectedReturnDate}</div>
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
                      <Link
                        to={`/resources/${a.resourceId}`}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-eec-primary hover:text-white rounded-lg font-bold text-[11px] transition-colors inline-block"
                      >
                        View Asset
                      </Link>
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
              disabled={assigning}
              className="px-5 py-2 text-xs font-bold text-white bg-eec-primary hover:bg-[#0E5161] rounded-xl transition-all shadow-sm"
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
                  {r.itemCode} • {r.name} (Held by: {r.currentAssigneeName})
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
              className="px-5 py-2 text-xs font-bold text-white bg-eec-primary hover:bg-[#0E5161] rounded-xl transition-all shadow-sm"
            >
              {transferring ? 'Transferring...' : 'Execute Custody Transfer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
