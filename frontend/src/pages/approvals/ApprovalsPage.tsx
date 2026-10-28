import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Modal } from '../../components/ui/Modal';
import { approvalService } from '../../services/approvalService';
import { UserApproval, UserRole } from '../../types';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Check, 
  Clock, 
  ShieldCheck, 
  RefreshCw, 
  UserCheck 
} from 'lucide-react';

export const ApprovalsPage: React.FC = () => {
  const [approvals, setApprovals] = useState<UserApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Approval Modal State
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<UserApproval | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('EMPLOYEE');
  const [approving, setApproving] = useState(false);

  // Reject Modal State
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<string>('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await approvalService.getAll();
      setApprovals(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openApproveModal = (user: UserApproval) => {
    setTargetUser(user);
    setSelectedRole(user.requestedRole || 'EMPLOYEE');
    setIsApproveModalOpen(true);
  };

  const handleConfirmApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;
    setApproving(true);
    try {
      await approvalService.approve(targetUser.id, selectedRole);
      setIsApproveModalOpen(false);
      setToastMessage(`Account for ${targetUser.name} approved with role ${selectedRole}`);
      setTimeout(() => setToastMessage(null), 3500);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Approval failed');
    } finally {
      setApproving(false);
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    setRejecting(true);
    try {
      await approvalService.reject(rejectTargetId, rejectReason);
      setIsRejectModalOpen(false);
      setRejectReason('');
      setToastMessage('User registration application was rejected');
      setTimeout(() => setToastMessage(null), 3500);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Rejection failed');
    } finally {
      setRejecting(false);
    }
  };

  const pendingApprovals = approvals.filter(a => a.status === 'PENDING');
  const reviewedApprovals = approvals.filter(a => a.status !== 'PENDING');

  return (
    <div className="space-y-6 animate-fadeIn">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-slideUp">
          <Check className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      <PageHeader
        title="User Registration Approvals & Access Governance"
        subtitle="Review new corporate signups, assign authorized roles, and enforce security policies against the live database"
        breadcrumbs={[
          { label: 'RMS', href: '/dashboard' },
          { label: 'User Approvals' }
        ]}
      >
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Roster</span>
        </button>
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 border-4 border-eec-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : approvals.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No User Accounts Found</h3>
          <p className="text-xs text-slate-500 mt-1">New user signups will appear here for administrator review.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pending Approvals Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
            <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Pending Applications ({pendingApprovals.length})
                </h3>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">Requires Admin Sign-off</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3.5">Applicant</th>
                    <th className="px-6 py-3.5">Current Role</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Requested Date</th>
                    <th className="px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {pendingApprovals.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                        No pending applications at this time. All users are reviewed.
                      </td>
                    </tr>
                  ) : (
                    pendingApprovals.map((appr) => (
                      <tr key={appr.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900">{appr.name}</div>
                          <div className="text-[11px] text-slate-400">{appr.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {appr.requestedRole}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border bg-amber-50 text-amber-700 border-amber-200">
                            PENDING
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {new Date(appr.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openApproveModal(appr)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-sm"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => {
                                setRejectTargetId(appr.id);
                                setIsRejectModalOpen(true);
                              }}
                              className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Active / Reviewed Accounts */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
            <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Active & Reviewed Personnel Directory ({reviewedApprovals.length})
                </h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3.5">Personnel Name & Email</th>
                    <th className="px-6 py-3.5">Assigned Authority</th>
                    <th className="px-6 py-3.5">Account Status</th>
                    <th className="px-6 py-3.5 text-right">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {reviewedApprovals.map((appr) => (
                    <tr key={appr.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="font-bold text-slate-900">{appr.name}</div>
                        <div className="text-[11px] text-slate-400">{appr.email}</div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                          appr.requestedRole === 'ADMIN'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : appr.requestedRole === 'STORE_KEEPER'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : appr.requestedRole === 'IT_TECHNICIAN'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : appr.requestedRole === 'DEPARTMENT_MANAGER'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {appr.requestedRole}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          appr.status === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {appr.status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right text-slate-400">
                        {appr.reviewedAt ? new Date(appr.reviewedAt).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Approve User Modal */}
      <Modal
        isOpen={isApproveModalOpen}
        onClose={() => setIsApproveModalOpen(false)}
        title="Approve User Account"
        subtitle="Authorize corporate access and assign operational role authority"
      >
        {targetUser && (
          <form onSubmit={handleConfirmApprove} className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Applicant:</span>
                <span className="font-bold text-slate-900">{targetUser.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Institutional Email:</span>
                <span className="font-mono text-slate-800">{targetUser.email}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Assign System Role *
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-primary/20"
              >
                <option value="EMPLOYEE">EMPLOYEE (Engineer / Field Officer)</option>
                <option value="DEPARTMENT_MANAGER">DEPARTMENT_MANAGER (Directorate Approvals & Scope)</option>
                <option value="IT_TECHNICIAN">IT_TECHNICIAN (Hardware & Diagnostics)</option>
                <option value="STORE_KEEPER">STORE_KEEPER (Chief Central Inventory)</option>
                <option value="ADMIN">ADMIN (Full Governance Authority)</option>
              </select>
              <p className="text-[10px] text-slate-400 mt-1">
                Role dictates operational navigation, approval workflows, and resource visibility boundaries.
              </p>
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
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
              >
                {approving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    <span>Confirm & Activate Account</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="Reject User Access Application"
        subtitle="Specify reasons why this account cannot be activated"
      >
        <form onSubmit={handleConfirmReject} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Rejection Reason *</label>
            <textarea
              required
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Email domain does not match official EEC government directory or unverified contractor"
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
              disabled={rejecting}
              className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-sm"
            >
              {rejecting ? 'Rejecting...' : 'Confirm Rejection'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
