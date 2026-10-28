import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { employeeService } from '../../services/employeeService';
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
  UserCheck
} from 'lucide-react';

export const EmployeesPage: React.FC = () => {
  const { currentUser, currentRole } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+251 911 ');
  const [departmentId, setDepartmentId] = useState('');
  const [designation, setDesignation] = useState('');
  const [role, setRole] = useState<UserRole>('EMPLOYEE');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isDepartmentManager = currentRole === 'DEPARTMENT_MANAGER';
  const isAdmin = currentRole === 'ADMIN';

  const loadData = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const scope = { role: currentRole, departmentId: currentUser.departmentId };
      const [eList, dList] = await Promise.all([
        employeeService.getAll(scope),
        departmentService.getAll(scope),
      ]);
      setEmployees(eList);
      setDepartments(dList);
      if (dList.length > 0 && !departmentId) {
        setDepartmentId(isDepartmentManager ? currentUser.departmentId : dList[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setApiError(err.response?.data?.message || err.message || 'Failed to load employee directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentRole, currentUser]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const targetDeptId = isDepartmentManager ? currentUser.departmentId : departmentId;
      const dept = departments.find(d => d.id === targetDeptId);
      await employeeService.addEmployee({
        employeeId: `EEC-EMP-${Math.floor(100 + Math.random() * 900)}`,
        name,
        email,
        phone,
        departmentId: targetDeptId,
        departmentName: dept?.name || currentUser.departmentName || 'Engineering Directorate',
        designation,
        role,
        isActive: true,
        hireDate: new Date().toISOString().split('T')[0],
      });

      setToastMessage(`Successfully registered ${name} into the corporate directory.`);
      setIsModalOpen(false);
      setName('');
      setEmail('');
      setDesignation('');
      loadData();
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || 'Failed to register employee.');
    } finally {
      setSaving(false);
    }
  };

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.designation.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <PageHeader
        title="Personnel & Engineering Staff Directory"
        subtitle={
          isDepartmentManager
            ? `Department personnel roster for ${currentUser.departmentName || 'your directorate'}`
            : "Authorized corporate personnel, roles, contact profiles, and departmental assignments"
        }
        breadcrumbs={[
          { label: 'RMS', href: '/dashboard' },
          { label: 'Employees' }
        ]}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          {(isAdmin || isDepartmentManager) && (
            <button
              onClick={() => {
                if (isDepartmentManager) {
                  setDepartmentId(currentUser.departmentId);
                }
                setFormError(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-eec-primary hover:bg-[#0E5161] text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Register Staff Member</span>
            </button>
          )}
        </div>
      </PageHeader>

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
            Scoped to Directorate
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

      {/* Search & Statistics Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by staff name, employee ID, or designation..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-accent/30 text-slate-800"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Showing {filteredEmployees.length} personnel {isDepartmentManager ? 'in your department' : 'across corporation'}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 border-4 border-eec-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-card">
          <UserCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Personnel Found</h3>
          <p className="text-xs text-slate-500 mt-1">
            {searchQuery
              ? `No staff records matched the search term "${searchQuery}".`
              : 'No personnel registered under this directorate yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEmployees.map((emp) => (
            <div
              key={emp.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-eec-primary text-white flex items-center justify-center font-bold text-xs">
                      {emp.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm leading-tight">{emp.name}</h3>
                      <span className="font-mono text-[10px] text-slate-400">{emp.employeeId}</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    {emp.role}
                  </span>
                </div>

                <p className="text-xs font-semibold text-slate-700">{emp.designation}</p>
                <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                  <Building2 className="w-3 h-3 text-slate-400" />
                  {emp.departmentName}
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
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span>Hired: {emp.hireDate}</span>
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Active Personnel
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Employee Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add New Personnel Record"
        subtitle="Register engineering staff for resource assignments and requisitions"
      >
        {formError && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bethlehem Girma"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Corporate Email *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. bethlehem.girma@eec.gov.et"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
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
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none"
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Designation / Title *</label>
              <input
                type="text"
                required
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g. Structural Design Engineer"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">User Role Access *</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none"
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
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-bold text-white bg-eec-primary hover:bg-[#0E5161] rounded-xl transition-all shadow-sm"
            >
              {saving ? 'Creating...' : 'Save Employee'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
