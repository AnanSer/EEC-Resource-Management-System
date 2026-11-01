import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { employeeService, EmployeeDirectoryResult } from '../../services/employeeService';
import { departmentService } from '../../services/departmentService';
import { Employee, Department, UserRole } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Modal } from '../../components/ui/Modal';
import { 
  Plus, 
  Search, 
  Mail, 
  Phone, 
  Building2, 
  Check,
  AlertCircle,
  RefreshCw,
  UserCheck,
  Clock,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ExternalLink,
  Shield,
  SlidersHorizontal,
  Users
} from 'lucide-react';

const VALID_ROLES: { value: UserRole; label: string }[] = [
  { value: 'EMPLOYEE', label: 'Employee (Standard Staff)' },
  { value: 'DEPARTMENT_MANAGER', label: 'Department Manager' },
  { value: 'STORE_KEEPER', label: 'Store Keeper (Logistics)' },
  { value: 'IT_TECHNICIAN', label: 'IT Technician (Support)' },
  { value: 'ADMIN', label: 'System Administrator' },
];

export const EmployeesPage: React.FC = () => {
  const { currentUser, currentRole } = useAuth();

  const [directoryData, setDirectoryData] = useState<EmployeeDirectoryResult>({
    employees: [],
    counts: { total: 0, active: 0, pending: 0, suspended: 0 },
    pagination: { total: 0, page: 1, limit: 100, totalPages: 1 },
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Register Modal state
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('+251 9');
  const [regDeptId, setRegDeptId] = useState('');
  const [regDesignation, setRegDesignation] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('EMPLOYEE');
  const [regSaving, setRegSaving] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  // Quick Approval Modal state
  const [approvingEmployee, setApprovingEmployee] = useState<Employee | null>(null);
  const [approvalRole, setApprovalRole] = useState<UserRole>('EMPLOYEE');
  const [approvalDeptId, setApprovalDeptId] = useState<string>('');
  const [approvalDesignation, setApprovalDesignation] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isDepartmentManager = currentRole === 'DEPARTMENT_MANAGER';
  const isAdmin = currentRole === 'ADMIN';

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const scope = { role: currentRole, departmentId: currentUser.departmentId };
      const [dList, dirResult] = await Promise.all([
        departmentService.getAll(scope),
        employeeService.getDirectory({
          search: searchQuery.trim() || undefined,
          departmentId: selectedDept !== 'ALL' ? selectedDept : undefined,
          role: selectedRole !== 'ALL' ? selectedRole : undefined,
          status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
          limit: 100,
        }),
      ]);

      setDepartments(dList);
      setDirectoryData(dirResult);

      if (dList.length > 0 && !regDeptId) {
        setRegDeptId(isDepartmentManager ? currentUser.departmentId : dList[0].id);
      }
    } catch (err: any) {
      console.error('[EEC-RMS] Directory load error:', err);
      setApiError(err.response?.data?.message || err.message || 'Failed to load employee directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentRole, selectedDept, selectedRole, selectedStatus]);

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegSaving(true);
    setRegError(null);
    try {
      const targetDeptId = isDepartmentManager ? currentUser.departmentId : regDeptId;
      const dept = departments.find(d => d.id === targetDeptId);

      await employeeService.addEmployee({
        employeeId: `EEC-EMP-${Math.floor(1000 + Math.random() * 9000)}`,
        name: regName.trim(),
        email: regEmail.trim(),
        phone: regPhone.trim(),
        departmentId: targetDeptId,
        departmentName: dept?.name || currentUser.departmentName || 'Engineering Directorate',
        designation: regDesignation.trim() || 'Engineering Personnel',
        role: regRole,
        isActive: true,
        hireDate: new Date().toISOString().split('T')[0],
      });

      showToast(`Successfully registered ${regName} into the corporate directory.`);
      setIsRegisterModalOpen(false);
      setRegName('');
      setRegEmail('');
      setRegDesignation('');
      loadData();
    } catch (err: any) {
      setRegError(err.response?.data?.message || err.message || 'Failed to register personnel.');
    } finally {
      setRegSaving(false);
    }
  };

  const openApproveModal = (emp: Employee) => {
    setApprovingEmployee(emp);
    setApprovalRole(emp.role || 'EMPLOYEE');
    setApprovalDeptId(emp.departmentId);
    setApprovalDesignation(emp.designation || 'Engineering Specialist');
    setActionError(null);
  };

  const handleApprove = async () => {
    if (!approvingEmployee) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await employeeService.approveEmployee(approvingEmployee.id, {
        role: approvalRole,
        departmentId: approvalDeptId || undefined,
        designation: approvalDesignation || undefined,
      });

      showToast(`Account for ${approvingEmployee.name} approved with role ${approvalRole}.`);
      setApprovingEmployee(null);
      loadData();
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || 'Failed to approve account.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickReject = async (emp: Employee) => {
    const confirmReason = window.prompt(`Reject application for ${emp.name}? Optional reason:`);
    if (confirmReason === null) return; // User cancelled prompt

    try {
      await employeeService.rejectEmployee(emp.id, confirmReason || undefined);
      showToast(`Application for ${emp.name} has been rejected.`);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to reject employee.');
    }
  };

  const handleQuickSuspend = async (emp: Employee) => {
    if (!window.confirm(`Are you sure you want to suspend ${emp.name}'s account? They will be locked out of EEC RMS.`)) {
      return;
    }
    try {
      await employeeService.suspendEmployee(emp.id, 'Administrative suspension');
      showToast(`Account for ${emp.name} has been suspended.`);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to suspend employee.');
    }
  };

  const handleQuickReactivate = async (emp: Employee) => {
    try {
      await employeeService.reactivateEmployee(emp.id);
      showToast(`Account for ${emp.name} has been reactivated.`);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to reactivate employee.');
    }
  };

  const renderStatusBadge = (status?: string, isActive?: boolean) => {
    const s = (status || (isActive ? 'APPROVED' : 'UNREGISTERED')).toUpperCase();

    switch (s) {
      case 'APPROVED':
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Active Staff
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            Pending Approval
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <ShieldAlert className="w-3 h-3 text-rose-600" />
            Suspended
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <XCircle className="w-3 h-3 text-slate-500" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
            Unregistered
          </span>
        );
    }
  };

  const renderRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">ADMIN</span>;
      case 'DEPARTMENT_MANAGER':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">MANAGER</span>;
      case 'STORE_KEEPER':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">LOGISTICS</span>;
      case 'IT_TECHNICIAN':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">IT TECH</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">STAFF</span>;
    }
  };

  const { employees, counts } = directoryData;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <PageHeader
        title="Personnel & Engineering Staff Directory"
        subtitle={
          isDepartmentManager
            ? `Department personnel roster for ${currentUser.departmentName || 'your directorate'}`
            : "Authorized corporate personnel, roles, contact profiles, departmental custody, and account lifecycles"
        }
        breadcrumbs={[
          { label: 'RMS', href: '/dashboard' },
          { label: 'Employees' }
        ]}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          {(isAdmin || isDepartmentManager) && (
            <button
              onClick={() => {
                if (isDepartmentManager) {
                  setRegDeptId(currentUser.departmentId);
                }
                setRegError(null);
                setIsRegisterModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-eec-primary hover:bg-[#0E5161] text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Register Staff Member</span>
            </button>
          )}
        </div>
      </PageHeader>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-card">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Personnel</span>
            <Users className="w-4 h-4 text-eec-primary" />
          </div>
          <div className="text-2xl font-black text-slate-900">{counts.total}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Corporate employee records</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-card">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Active Staff</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{counts.active}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Authorized for custody</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-card">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Pending Approval</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600">{counts.pending}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Awaiting admin review</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-card">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Directorates</span>
            <Building2 className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{departments.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Active operating divisions</div>
        </div>
      </div>

      {/* Department-Scope Notice Banner for Department Managers */}
      {isDepartmentManager && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200/80 rounded-2xl flex items-center justify-between text-xs text-emerald-950 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
            <span>
              <strong>Department Scope Active:</strong> Viewing personnel belonging exclusively to{' '}
              <strong className="underline decoration-emerald-500 underline-offset-2">{currentUser.departmentName}</strong>.
            </span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Directorate Boundary Enforced
          </span>
        </div>
      )}

      {/* API Error Alert */}
      {apiError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{apiError}</span>
          </div>
          <button
            onClick={loadData}
            className="px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg text-xs font-bold transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {toastMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 animate-fadeIn shadow-sm">
          <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Search & Filter Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search bar */}
          <div className="relative md:col-span-4">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by staff name, employee ID, or email..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-primary/20 focus:border-eec-primary text-slate-800"
            />
          </div>

          {/* Department Filter (Admin only) */}
          <div className="md:col-span-3">
            <div className="relative">
              <Building2 className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                disabled={isDepartmentManager}
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-primary/20 focus:border-eec-primary text-slate-800 font-medium disabled:opacity-60"
              >
                <option value="ALL">All Directorates</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Role Filter */}
          <div className="md:col-span-3">
            <div className="relative">
              <Shield className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-primary/20 focus:border-eec-primary text-slate-800 font-medium"
              >
                <option value="ALL">All System Roles</option>
                {VALID_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status Filter */}
          <div className="md:col-span-2">
            <div className="relative">
              <SlidersHorizontal className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-primary/20 focus:border-eec-primary text-slate-800 font-medium"
              >
                <option value="ALL">All Statuses</option>
                <option value="APPROVED">Active Staff</option>
                <option value="PENDING">Pending Approval</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="REJECTED">Rejected</option>
                <option value="UNREGISTERED">Unregistered</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <span>
            Showing <strong>{employees.length}</strong> personnel {isDepartmentManager ? 'in your directorate' : 'corporation-wide'}
          </span>
          {(selectedDept !== 'ALL' || selectedRole !== 'ALL' || selectedStatus !== 'ALL' || searchQuery) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedDept('ALL');
                setSelectedRole('ALL');
                setSelectedStatus('ALL');
              }}
              className="text-eec-primary hover:underline text-[11px] font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Employee Cards Grid */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 border-4 border-eec-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : employees.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-card">
          <UserCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Personnel Found</h3>
          <p className="text-xs text-slate-500 mt-1">
            {searchQuery || selectedRole !== 'ALL' || selectedStatus !== 'ALL' || selectedDept !== 'ALL'
              ? 'No staff records matched the specified filter criteria.'
              : 'No personnel registered under this directorate yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {employees.map((emp) => {
            const isPending = emp.accountStatus === 'PENDING';
            const isSuspended = emp.accountStatus === 'SUSPENDED';

            return (
              <div
                key={emp.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card hover:shadow-md transition-all flex flex-col justify-between group relative"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-eec-primary to-[#18758d] text-white flex items-center justify-center font-bold text-xs shadow-sm">
                        {emp.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <Link
                          to={`/employees/${emp.id}`}
                          className="font-bold text-slate-900 text-sm leading-tight hover:text-eec-primary transition-colors flex items-center gap-1"
                        >
                          <span>{emp.name}</span>
                          <ExternalLink className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                        <span className="font-mono text-[10px] text-slate-400">{emp.employeeId}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {renderRoleBadge(emp.role)}
                      {renderStatusBadge(emp.accountStatus, emp.isActive)}
                    </div>
                  </div>

                  <p className="text-xs font-semibold text-slate-700">{emp.designation}</p>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    <span>{emp.departmentName || emp.departmentCode || 'Engineering Directorate'}</span>
                  </p>

                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-2 text-slate-600 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{emp.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span>{emp.phone || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Active custody metrics */}
                  <div className="mt-3 grid grid-cols-3 gap-2 bg-slate-50 p-2 rounded-xl text-center text-[10px] text-slate-500">
                    <div>
                      <span className="block font-bold text-slate-800 text-xs">{emp.assignedResourcesCount ?? 0}</span>
                      <span>In Custody</span>
                    </div>
                    <div>
                      <span className="block font-bold text-slate-800 text-xs">{emp.assignmentsCount ?? 0}</span>
                      <span>Assignments</span>
                    </div>
                    <div>
                      <span className="block font-bold text-slate-800 text-xs">{emp.requisitionsCount ?? 0}</span>
                      <span>Requisitions</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Hired: {emp.hireDate || 'N/A'}</span>
                    <Link
                      to={`/employees/${emp.id}`}
                      className="text-eec-primary font-bold hover:underline inline-flex items-center gap-1"
                    >
                      <span>View Profile</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>

                  {/* Admin Direct Action Buttons */}
                  {isAdmin && (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100/80">
                      {isPending ? (
                        <>
                          <button
                            onClick={() => openApproveModal(emp)}
                            className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => handleQuickReject(emp)}
                            className="py-1.5 px-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 rounded-lg text-xs font-semibold transition-colors"
                          >
                            Reject
                          </button>
                        </>
                      ) : isSuspended ? (
                        <button
                          onClick={() => handleQuickReactivate(emp)}
                          className="w-full py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Reactivate Account</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleQuickSuspend(emp)}
                          className="w-full py-1.5 px-2 bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 rounded-lg text-[11px] font-semibold transition-colors flex items-center justify-center gap-1"
                        >
                          <ShieldAlert className="w-3 h-3 text-slate-400 hover:text-rose-600" />
                          <span>Suspend Access</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Employee Modal */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title="Add New Personnel Record"
        subtitle="Register engineering staff for resource assignments, custody tracking, and requisitions"
      >
        {regError && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{regError}</span>
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Full Legal Name *</label>
              <input
                type="text"
                required
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="e.g. Bethlehem Girma"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-primary/20"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Corporate Email *</label>
              <input
                type="email"
                required
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="e.g. bethlehem.girma@eec.gov.et"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-primary/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Directorate / Office *</label>
              {isDepartmentManager ? (
                <div className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-700 flex items-center justify-between">
                  <span>{currentUser.departmentName}</span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">Locked</span>
                </div>
              ) : (
                <select
                  value={regDeptId}
                  onChange={(e) => setRegDeptId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-eec-primary/20"
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Designation / Title *</label>
              <input
                type="text"
                required
                value={regDesignation}
                onChange={(e) => setRegDesignation(e.target.value)}
                placeholder="e.g. Structural Design Engineer"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-primary/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">User Role Access *</label>
              <select
                value={regRole}
                onChange={(e) => setRegRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-eec-primary/20"
              >
                <option value="EMPLOYEE">EMPLOYEE (Standard Staff)</option>
                <option value="DEPARTMENT_MANAGER">DEPARTMENT_MANAGER (Director)</option>
                {!isDepartmentManager && (
                  <>
                    <option value="STORE_KEEPER">STORE_KEEPER (Warehouse Officer)</option>
                    <option value="IT_TECHNICIAN">IT_TECHNICIAN (Hardware & Support)</option>
                    <option value="ADMIN">ADMIN (System Administrator)</option>
                  </>
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Mobile Phone</label>
              <input
                type="text"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-primary/20"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsRegisterModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={regSaving}
              className="px-5 py-2 text-xs font-bold text-white bg-eec-primary hover:bg-[#0E5161] rounded-xl transition-all shadow-sm disabled:opacity-50"
            >
              {regSaving ? 'Creating...' : 'Save Employee'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Admin Quick Review & Approval Modal */}
      {approvingEmployee && (
        <Modal
          isOpen={true}
          onClose={() => setApprovingEmployee(null)}
          title={`Review & Approve: ${approvingEmployee.name}`}
          subtitle={`Applicant Email: ${approvingEmployee.email} | ID: ${approvingEmployee.employeeId}`}
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
                  value={approvalRole}
                  onChange={(e) => setApprovalRole(e.target.value as UserRole)}
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
                  value={approvalDeptId}
                  onChange={(e) => setApprovalDeptId(e.target.value)}
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
                  value={approvalDesignation}
                  onChange={(e) => setApprovalDesignation(e.target.value)}
                  placeholder="e.g. Senior Hydrological Engineer"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-primary/20"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setApprovingEmployee(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
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
