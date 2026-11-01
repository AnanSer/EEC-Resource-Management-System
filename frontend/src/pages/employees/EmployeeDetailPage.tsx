import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { employeeService } from '../../services/employeeService';
import { departmentService } from '../../services/departmentService';
import { EmployeeProfileDossier, Department, UserRole } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  Building2, 
  Calendar, 
  Shield, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  XCircle, 
  Package, 
  History, 
  Repeat, 
  FileText, 
  Wrench, 
  ScrollText, 
  AlertCircle,
  ExternalLink,
  Edit3,
  Check,
  RefreshCw
} from 'lucide-react';

const VALID_ROLES: { value: UserRole; label: string }[] = [
  { value: 'EMPLOYEE', label: 'Employee (Standard Staff)' },
  { value: 'DEPARTMENT_MANAGER', label: 'Department Manager' },
  { value: 'STORE_KEEPER', label: 'Store Keeper (Logistics)' },
  { value: 'IT_TECHNICIAN', label: 'IT Technician (Support)' },
  { value: 'ADMIN', label: 'System Administrator' },
];

export const EmployeeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentRole } = useAuth();

  const [data, setData] = useState<EmployeeProfileDossier | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'custody' | 'assignments' | 'transfers' | 'requisitions' | 'maintenance' | 'audit'>('custody');
  const [assignmentFilter, setAssignmentFilter] = useState<'ALL' | 'ACTIVE' | 'PAST'>('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editDeptId, setEditDeptId] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('EMPLOYEE');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Approve Modal State
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [approveRole, setApproveRole] = useState<UserRole>('EMPLOYEE');
  const [approveDeptId, setApproveDeptId] = useState('');
  const [approveDesignation, setApproveDesignation] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isAdmin = currentRole === 'ADMIN';

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadProfile = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [profileData, depts] = await Promise.all([
        employeeService.getProfile(id),
        departmentService.getAll(),
      ]);
      setData(profileData);
      setDepartments(depts);

      // Pre-fill edit state
      setEditName(profileData.employee.name);
      setEditPhone(profileData.employee.phone || '');
      setEditDesignation(profileData.employee.designation || '');
      setEditDeptId(profileData.employee.departmentId);
      setEditRole(profileData.employee.role || 'EMPLOYEE');

      // Pre-fill approve state
      setApproveRole(profileData.employee.role || 'EMPLOYEE');
      setApproveDeptId(profileData.employee.departmentId);
      setApproveDesignation(profileData.employee.designation || '');
    } catch (err: any) {
      console.error('[EEC-RMS] Profile load error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load employee dossier.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [id]);

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setEditSaving(true);
    setEditError(null);
    try {
      await employeeService.updateEmployee(id, {
        name: editName.trim(),
        phone: editPhone.trim(),
        designation: editDesignation.trim(),
        departmentId: isAdmin ? editDeptId : undefined,
        role: isAdmin ? editRole : undefined,
      });

      showToast('Personnel profile updated successfully.');
      setIsEditOpen(false);
      loadProfile();
    } catch (err: any) {
      setEditError(err.response?.data?.message || err.message || 'Failed to update profile.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleApproveSave = async () => {
    if (!id) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await employeeService.approveEmployee(id, {
        role: approveRole,
        departmentId: approveDeptId || undefined,
        designation: approveDesignation.trim() || undefined,
      });

      showToast(`Account approved with role ${approveRole}.`);
      setIsApproveOpen(false);
      loadProfile();
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || 'Failed to approve account.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspendToggle = async () => {
    if (!data) return;
    const isSuspended = data.employee.accountStatus === 'SUSPENDED';

    if (!isSuspended) {
      if (!window.confirm(`Suspend ${data.employee.name}'s account? The employee will be locked out of EEC RMS.`)) {
        return;
      }
      try {
        await employeeService.suspendEmployee(data.employee.id, 'Administrative suspension');
        showToast('Account suspended.');
        loadProfile();
      } catch (err: any) {
        alert(err.response?.data?.message || 'Failed to suspend account.');
      }
    } else {
      try {
        await employeeService.reactivateEmployee(data.employee.id);
        showToast('Account reactivated.');
        loadProfile();
      } catch (err: any) {
        alert(err.response?.data?.message || 'Failed to reactivate account.');
      }
    }
  };

  const renderStatusBadge = (status?: string, isActive?: boolean) => {
    const s = (status || (isActive ? 'APPROVED' : 'UNREGISTERED')).toUpperCase();

    switch (s) {
      case 'APPROVED':
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Active Personnel
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Pending Approval
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            Suspended Account
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <XCircle className="w-3.5 h-3.5 text-slate-500" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
            Unregistered Staff
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <div className="w-10 h-10 border-4 border-eec-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Retrieving personnel profile dossier...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Personnel Dossier Unavailable</h2>
        <p className="text-xs text-slate-600">{error || 'Requested employee profile could not be loaded.'}</p>
        <button
          onClick={() => navigate('/employees')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Employee Directory</span>
        </button>
      </div>
    );
  }

  const { employee, dossier } = data;
  const isPending = employee.accountStatus === 'PENDING';
  const isSuspended = employee.accountStatus === 'SUSPENDED';

  const activeHoldings = dossier.assignedResources;
  const activeAssignments = dossier.assignments.filter(a => a.isCurrent && a.status === 'ACTIVE');
  const pastAssignments = dossier.assignments.filter(a => !a.isCurrent || a.status !== 'ACTIVE');

  const filteredAssignments = assignmentFilter === 'ACTIVE'
    ? activeAssignments
    : assignmentFilter === 'PAST'
    ? pastAssignments
    : dossier.assignments;

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/employees')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Employee Directory</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={loadProfile}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          {isAdmin && (
            <>
              {isPending && (
                <button
                  onClick={() => setIsApproveOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Review & Approve Account</span>
                </button>
              )}
              <button
                onClick={() => setIsEditOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
              {!isPending && (
                <button
                  onClick={handleSuspendToggle}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isSuspended
                      ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>{isSuspended ? 'Reactivate Account' : 'Suspend Account'}</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {toastMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 animate-fadeIn shadow-sm">
          <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Profile Overview Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-eec-primary to-[#18758d] text-white flex items-center justify-center font-black text-xl shadow-md">
              {employee.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900">{employee.name}</h1>
                <span className="font-mono text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                  {employee.employeeId}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-600 mt-0.5">{employee.designation}</p>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1 font-medium text-slate-700">
                  <Building2 className="w-3.5 h-3.5 text-eec-primary" />
                  {employee.departmentName} ({employee.departmentCode})
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Hired: {employee.hireDate || 'N/A'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-slate-400" />
                  Role: <strong>{employee.role}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:items-end gap-2">
            {renderStatusBadge(employee.accountStatus, employee.isActive)}
            <div className="flex items-center gap-4 text-xs text-slate-600 mt-1">
              <a
                href={`mailto:${employee.email}`}
                className="flex items-center gap-1.5 hover:text-eec-primary transition-colors"
              >
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>{employee.email}</span>
              </a>
              {employee.phone && (
                <a
                  href={`tel:${employee.phone}`}
                  className="flex items-center gap-1.5 hover:text-eec-primary transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{employee.phone}</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-card">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">In Custody</span>
            <Package className="w-4 h-4 text-eec-primary" />
          </div>
          <div className="text-2xl font-black text-slate-900">{activeHoldings.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Active equipment held</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-card">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Assignments</span>
            <History className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{dossier.assignments.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{pastAssignments.length} past / {activeAssignments.length} active</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-card">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Requisitions</span>
            <FileText className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{dossier.requisitions.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Resource requests filed</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-card">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Fault Reports</span>
            <Wrench className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{dossier.maintenanceRequests.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Reported maintenance issues</div>
        </div>
      </div>

      {/* Tabbed Dossier Navigation */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-2 sm:space-x-4 overflow-x-auto pb-px">
          <button
            onClick={() => setActiveTab('custody')}
            className={`py-2.5 px-3 border-b-2 text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-colors ${
              activeTab === 'custody'
                ? 'border-eec-primary text-eec-primary'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Active Custody ({dossier.assignedResources.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('assignments')}
            className={`py-2.5 px-3 border-b-2 text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-colors ${
              activeTab === 'assignments'
                ? 'border-eec-primary text-eec-primary'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Assignment History ({dossier.assignments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('transfers')}
            className={`py-2.5 px-3 border-b-2 text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-colors ${
              activeTab === 'transfers'
                ? 'border-eec-primary text-eec-primary'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Repeat className="w-4 h-4" />
            <span>Transfers ({dossier.transfers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('requisitions')}
            className={`py-2.5 px-3 border-b-2 text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-colors ${
              activeTab === 'requisitions'
                ? 'border-eec-primary text-eec-primary'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Requisitions ({dossier.requisitions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('maintenance')}
            className={`py-2.5 px-3 border-b-2 text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-colors ${
              activeTab === 'maintenance'
                ? 'border-eec-primary text-eec-primary'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>Maintenance ({dossier.maintenanceRequests.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`py-2.5 px-3 border-b-2 text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-colors ${
              activeTab === 'audit'
                ? 'border-eec-primary text-eec-primary'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ScrollText className="w-4 h-4" />
            <span>Administrative Audit ({dossier.auditEvents.length})</span>
          </button>
        </nav>
      </div>

      {/* Tab Content Panes */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card min-h-[300px]">
        {/* TAB 1: Active Custody */}
        {activeTab === 'custody' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Package className="w-4 h-4 text-eec-primary" />
              <span>Resources Currently Held in Employee Custody</span>
            </h3>

            {dossier.assignedResources.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                No physical resources currently allocated to this personnel.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 font-bold">Item Code</th>
                      <th className="py-2.5 px-3 font-bold">Resource Name</th>
                      <th className="py-2.5 px-3 font-bold">Category</th>
                      <th className="py-2.5 px-3 font-bold">Condition</th>
                      <th className="py-2.5 px-3 font-bold">Location</th>
                      <th className="py-2.5 px-3 font-bold">Assigned Since</th>
                      <th className="py-2.5 px-3 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dossier.assignedResources.map((res) => (
                      <tr key={res.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-eec-primary">
                          <Link to={`/resources/${res.id}`} className="hover:underline">
                            {res.itemCode}
                          </Link>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800">{res.name}</td>
                        <td className="py-3 px-3 text-slate-600">{res.category}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {res.condition}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600">{res.location}</td>
                        <td className="py-3 px-3 text-slate-500">
                          {res.assignedAt ? res.assignedAt.split('T')[0] : 'N/A'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <Link
                            to={`/resources/${res.id}`}
                            className="inline-flex items-center gap-1 text-eec-primary hover:underline font-semibold"
                          >
                            <span>Inspect</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Assignment History */}
        {activeTab === 'assignments' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-600" />
                <span>Full Record of Resource Assignments</span>
              </h3>
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setAssignmentFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    assignmentFilter === 'ALL'
                      ? 'bg-white text-slate-900 shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({dossier.assignments.length})
                </button>
                <button
                  onClick={() => setAssignmentFilter('ACTIVE')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    assignmentFilter === 'ACTIVE'
                      ? 'bg-white text-emerald-800 shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Active ({activeAssignments.length})
                </button>
                <button
                  onClick={() => setAssignmentFilter('PAST')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    assignmentFilter === 'PAST'
                      ? 'bg-white text-slate-900 shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Past Assignments ({pastAssignments.length})
                </button>
              </div>
            </div>

            {filteredAssignments.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No {assignmentFilter.toLowerCase()} assignment records found for this employee.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 font-bold">Assignment #</th>
                      <th className="py-2.5 px-3 font-bold">Resource</th>
                      <th className="py-2.5 px-3 font-bold">Status</th>
                      <th className="py-2.5 px-3 font-bold">Assigned At</th>
                      <th className="py-2.5 px-3 font-bold">Expected Return</th>
                      <th className="py-2.5 px-3 font-bold">Returned At</th>
                      <th className="py-2.5 px-3 font-bold">Purpose / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAssignments.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-slate-800">{a.assignmentNumber}</td>
                        <td className="py-3 px-3">
                          <Link to={`/resources/${a.resourceId}`} className="font-semibold text-eec-primary hover:underline">
                            {a.resourceName}
                          </Link>
                          <div className="font-mono text-[10px] text-slate-400">{a.resourceCode}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            a.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : a.status === 'TRANSFERRED'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {a.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600">{a.assignedAt ? a.assignedAt.split('T')[0] : '—'}</td>
                        <td className="py-3 px-3 text-slate-600">{a.expectedReturnDate ? a.expectedReturnDate.split('T')[0] : 'N/A'}</td>
                        <td className="py-3 px-3 text-slate-600">{a.returnedAt ? a.returnedAt.split('T')[0] : '—'}</td>
                        <td className="py-3 px-3 text-slate-500 max-w-xs truncate">{a.purpose || a.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Custody Transfers */}
        {activeTab === 'transfers' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Repeat className="w-4 h-4 text-eec-primary" />
              <span>Inter-Custodian Equipment Transfers</span>
            </h3>

            {dossier.transfers.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No transfer events registered for this personnel.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 font-bold">Transfer #</th>
                      <th className="py-2.5 px-3 font-bold">Resource</th>
                      <th className="py-2.5 px-3 font-bold">Direction</th>
                      <th className="py-2.5 px-3 font-bold">Counterparty</th>
                      <th className="py-2.5 px-3 font-bold">Date</th>
                      <th className="py-2.5 px-3 font-bold">Reason / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dossier.transfers.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-slate-800">{t.transferNumber}</td>
                        <td className="py-3 px-3">
                          <Link to={`/resources/${t.resourceId}`} className="font-semibold text-eec-primary hover:underline">
                            {t.resourceName}
                          </Link>
                          <div className="font-mono text-[10px] text-slate-400">{t.resourceCode}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.isOrigin
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {t.isOrigin ? 'Handed Over' : 'Received'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-700">
                          {t.isOrigin ? t.toEmployeeName : t.fromEmployeeName}
                        </td>
                        <td className="py-3 px-3 text-slate-600">{t.transferredAt.split('T')[0]}</td>
                        <td className="py-3 px-3 text-slate-500 max-w-xs truncate">{t.reason || t.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Requisitions */}
        {activeTab === 'requisitions' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-500" />
              <span>Resource Requisitions Filed by Personnel</span>
            </h3>

            {dossier.requisitions.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No requisitions recorded from this employee.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 font-bold">Requisition #</th>
                      <th className="py-2.5 px-3 font-bold">Category</th>
                      <th className="py-2.5 px-3 font-bold">Item Description</th>
                      <th className="py-2.5 px-3 font-bold">Urgency</th>
                      <th className="py-2.5 px-3 font-bold">Status</th>
                      <th className="py-2.5 px-3 font-bold">Required Date</th>
                      <th className="py-2.5 px-3 font-bold">Fulfilled Item</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dossier.requisitions.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-slate-800">{r.requisitionNumber}</td>
                        <td className="py-3 px-3 text-slate-600">{r.category}</td>
                        <td className="py-3 px-3 font-semibold text-slate-800">{r.itemDescription}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.urgency === 'CRITICAL'
                              ? 'bg-rose-100 text-rose-800'
                              : r.urgency === 'HIGH'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {r.urgency}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                            {r.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600">{r.requiredDate || '—'}</td>
                        <td className="py-3 px-3 text-slate-700">
                          {r.fulfilledResourceName ? (
                            <div>
                              <span className="font-semibold">{r.fulfilledResourceName}</span>
                              <div className="font-mono text-[10px] text-slate-400">{r.fulfilledResourceCode}</div>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: Maintenance */}
        {activeTab === 'maintenance' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-blue-500" />
              <span>Maintenance Faults Reported</span>
            </h3>

            {dossier.maintenanceRequests.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No maintenance tickets submitted by this employee.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 font-bold">Ticket #</th>
                      <th className="py-2.5 px-3 font-bold">Resource</th>
                      <th className="py-2.5 px-3 font-bold">Issue Title</th>
                      <th className="py-2.5 px-3 font-bold">Priority</th>
                      <th className="py-2.5 px-3 font-bold">Status</th>
                      <th className="py-2.5 px-3 font-bold">Reported Date</th>
                      <th className="py-2.5 px-3 font-bold text-right">Cost (ETB)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dossier.maintenanceRequests.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-slate-800">{m.requestNumber}</td>
                        <td className="py-3 px-3">
                          <Link to={`/resources/${m.resourceId}`} className="font-semibold text-eec-primary hover:underline">
                            {m.resourceName}
                          </Link>
                          <div className="font-mono text-[10px] text-slate-400">{m.resourceCode}</div>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800">{m.title}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            m.priority === 'CRITICAL'
                              ? 'bg-rose-100 text-rose-800'
                              : m.priority === 'HIGH'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {m.priority}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                            {m.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600">{m.reportedDate.split('T')[0]}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          {m.actualCostETB ? `${m.actualCostETB.toLocaleString()} ETB` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 6: Administrative Audit Events */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ScrollText className="w-4 h-4 text-purple-600" />
              <span>Administrative Lifecycle & Security Trail</span>
            </h3>

            {dossier.auditEvents.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No administrative audit entries found for this personnel ID.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 font-bold">Timestamp</th>
                      <th className="py-2.5 px-3 font-bold">Action Type</th>
                      <th className="py-2.5 px-3 font-bold">Authorized Actor</th>
                      <th className="py-2.5 px-3 font-bold">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dossier.auditEvents.map((ev) => (
                      <tr key={ev.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 font-mono text-slate-500 whitespace-nowrap">
                          {ev.timestamp.replace('T', ' ').slice(0, 19)}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                            {ev.actionType}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-slate-800">{ev.actorName}</span>
                          <span className="text-[10px] text-slate-400 ml-1">({ev.actorRole})</span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 max-w-md">{ev.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {isEditOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsEditOpen(false)}
          title={`Edit Profile: ${employee.name}`}
          subtitle={`Employee ID: ${employee.employeeId} | ${employee.email}`}
        >
          {editError && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{editError}</span>
            </div>
          )}

          <form onSubmit={handleEditSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Mobile Phone
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-primary/20"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Designation / Operational Title *
                </label>
                <input
                  type="text"
                  required
                  value={editDesignation}
                  onChange={(e) => setEditDesignation(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-primary/20"
                />
              </div>

              {isAdmin && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Directorate / Office *
                    </label>
                    <select
                      value={editDeptId}
                      onChange={(e) => setEditDeptId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-eec-primary/20"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      System Role *
                    </label>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-eec-primary/20"
                    >
                      {VALID_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editSaving}
                className="px-5 py-2 text-xs font-bold text-white bg-eec-primary hover:bg-[#0E5161] rounded-xl transition-all shadow-sm disabled:opacity-50"
              >
                {editSaving ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Review & Approve Modal */}
      {isApproveOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsApproveOpen(false)}
          title={`Review & Approve: ${employee.name}`}
          subtitle={`Institutional Email: ${employee.email} | ID: ${employee.employeeId}`}
        >
          {actionError && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start gap-2">
              <Shield className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Administrator Access Decision:</strong> You are confirming this employee's institutional status and assigning their RMS system authorization level.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Assign System Role *
                </label>
                <select
                  value={approveRole}
                  onChange={(e) => setApproveRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-eec-primary/20"
                >
                  {VALID_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Confirm Directorate *
                </label>
                <select
                  value={approveDeptId}
                  onChange={(e) => setApproveDeptId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-eec-primary/20"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Designation / Operational Role
                </label>
                <input
                  type="text"
                  value={approveDesignation}
                  onChange={(e) => setApproveDesignation(e.target.value)}
                  placeholder="e.g. Senior Hydrological Engineer"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-primary/20"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsApproveOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveSave}
                disabled={actionLoading}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                {actionLoading ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>Confirm & Activate Account</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
