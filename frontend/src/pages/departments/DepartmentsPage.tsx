import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { departmentService } from '../../services/departmentService';
import { Department } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Modal } from '../../components/ui/Modal';
import { 
  Plus, 
  Users, 
  Layers, 
  MapPin, 
  Check, 
  Building2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

export const DepartmentsPage: React.FC = () => {
  const { currentUser, currentRole } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [managerName, setManagerName] = useState('');
  const [location, setLocation] = useState('Headquarters - Addis Ababa');
  const [budgetCode, setBudgetCode] = useState('BUD2026-');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isAdmin = currentRole === 'ADMIN';
  const isDepartmentManager = currentRole === 'DEPARTMENT_MANAGER';

  const loadData = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const scope = { role: currentRole, departmentId: currentUser.departmentId };
      const list = await departmentService.getAll(scope);
      setDepartments(list);
    } catch (err: any) {
      console.error(err);
      setApiError(err.response?.data?.message || err.message || 'Failed to load corporate directorates.');
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
      await departmentService.create({
        name,
        code,
        description,
        managerName,
        location,
        budgetCode,
      });

      setToastMessage(`Directorate ${name} (${code}) successfully established.`);
      setIsModalOpen(false);
      setName('');
      setCode('');
      setDescription('');
      setManagerName('');
      loadData();
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || 'Failed to create department.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <PageHeader
        title="Corporate Directorates & Operational Divisions"
        subtitle={
          isDepartmentManager
            ? `Operational profile and resource allocations for ${currentUser.departmentName || 'your directorate'}`
            : 'Organizational hierarchy, functional divisions, and custody distribution centers'
        }
        breadcrumbs={[
          { label: 'RMS', href: '/dashboard' },
          { label: 'Departments' }
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
          {isAdmin && (
            <button
              onClick={() => {
                setFormError(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-eec-primary hover:bg-[#0E5161] text-white rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>New Directorate</span>
            </button>
          )}
        </div>
      </PageHeader>

      {/* Scope Banner for Department Managers */}
      {isDepartmentManager && (
        <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-center justify-between text-xs text-emerald-900 shadow-sm">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
            <span>
              <strong>Department Scope:</strong> Displaying your designated operational unit. Corporate structural changes require System Administrator authority.
            </span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Directorate Profile
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

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 border-4 border-eec-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : departments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-card">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Directorates Registered</h3>
          <p className="text-xs text-slate-500 mt-1">
            {isDepartmentManager
              ? 'Your account is not currently assigned to an active operational directorate.'
              : 'Click "New Directorate" above to establish corporate organizational units.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {departments.map((dept) => (
            <div
              key={dept.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-bold text-slate-900 text-sm leading-snug">{dept.name}</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-100 text-slate-700 border border-slate-200 flex-shrink-0">
                    {dept.code}
                  </span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-4">
                  {dept.description || 'Corporate engineering and operational division'}
                </p>

                <div className="space-y-1.5 text-xs text-slate-600 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Director:</span>
                    <span className="font-semibold text-slate-800">{dept.managerName || 'Pending Appointment'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Location:
                    </span>
                    <span className="truncate max-w-[160px] text-right font-medium">{dept.location}</span>
                  </div>
                  {dept.budgetCode && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Budget Code:</span>
                      <span className="font-mono text-[11px] font-semibold text-slate-700">{dept.budgetCode}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-slate-600 font-semibold">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span>{dept.employeeCount} Personnel</span>
                </div>
                <div className="flex items-center gap-1.5 text-eec-primary font-bold">
                  <Layers className="w-4 h-4" />
                  <span>{dept.assetCount} Allocated</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Directorate Modal (Admin Only) */}
      {isAdmin && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Create New Corporate Directorate"
          subtitle="Define a corporate organizational division and budget center"
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
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Directorate Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Geotechnical Engineering"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Corporate Code *</label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. EEC-GEO"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Mandate & Description</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Scope of work and responsibilities..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Designated Director</label>
                <input
                  type="text"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  placeholder="e.g. Dr. Kassahun Tadesse"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Budget Cost Center</label>
                <input
                  type="text"
                  value={budgetCode}
                  onChange={(e) => setBudgetCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Primary Operating Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              />
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
                {saving ? 'Creating...' : 'Create Directorate'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
