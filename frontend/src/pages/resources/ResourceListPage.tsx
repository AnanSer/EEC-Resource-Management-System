import React, { useEffect, useState } from 'react';
import { resourceService } from '../../services/resourceService';
import { departmentService } from '../../services/departmentService';
import { Resource, ResourceCategory, ResourceStatus, ResourceCondition, Department } from '../../types';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { CategoryBadge } from '../../components/ui/CategoryBadge';
import { PageHeader } from '../../components/ui/PageHeader';
import { Modal } from '../../components/ui/Modal';
import { 
  Search, 
  Plus, 
  LayoutGrid, 
  List as ListIcon, 
  MapPin, 
  ArrowUpRight, 
  Check,
  AlertCircle
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const CATEGORIES: { label: string; value: ResourceCategory | 'ALL' }[] = [
  { label: 'All Equipment', value: 'ALL' },
  { label: 'IT Equipment', value: 'IT_EQUIPMENT' },
  { label: 'Vehicles', value: 'VEHICLES' },
  { label: 'Heavy Machinery', value: 'HEAVY_MACHINERY' },
  { label: 'Surveying & Geotechnical', value: 'SURVEYING_GEOTECHNICAL' },
  { label: 'Furniture & Facilities', value: 'CAMP_FACILITY_FURNITURE' },
];

export const ResourceListPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [resources, setResources] = useState<Resource[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const { currentRole } = useAuth();
  const canRegister = currentRole === 'ADMIN' || currentRole === 'STORE_KEEPER' || currentRole === 'DEPARTMENT_MANAGER';

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<ResourceCategory | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<ResourceStatus | 'ALL'>('ALL');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');

  // Register Modal state
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [newCategory, setNewCategory] = useState<ResourceCategory>('IT_EQUIPMENT');
  const [newName, setNewName] = useState('');
  const [newSubcategory, setNewSubcategory] = useState('');
  const [newLocation, setNewLocation] = useState('Central Store - Kersa');
  const [newDepartmentId, setNewDepartmentId] = useState('');
  const [newCostETB, setNewCostETB] = useState<number>(50000);
  const [newCondition, setNewCondition] = useState<ResourceCondition>('EXCELLENT');
  // Dynamic fields
  const [plateNumber, setPlateNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [accuracyGrade, setAccuracyGrade] = useState('');

  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Check action query param
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setIsRegisterModalOpen(true);
    }
  }, [searchParams]);

  const loadResources = async () => {
    setLoading(true);
    try {
      const [list, depts] = await Promise.all([
        resourceService.getAll({
          category: selectedCategory,
          status: selectedStatus,
          departmentId: selectedDept,
          search: searchQuery
        }),
        departmentService.getAll()
      ]);
      setResources(list);
      setDepartments(depts);
      if (depts.length > 0 && !newDepartmentId) {
        setNewDepartmentId(depts[0].id);
      }
      setFetchError(null);
    } catch (err: any) {
      console.error('Failed to load resources', err);
      setFetchError(err.response?.data?.message || 'Failed to load resources from server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResources();
  }, [selectedCategory, selectedStatus, selectedDept, searchQuery]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const selectedDeptObj = departments.find(d => d.id === newDepartmentId);
      const codePrefix = newCategory === 'IT_EQUIPMENT' ? 'EEC-IT' : 
                         newCategory === 'VEHICLES' ? 'EEC-VEHC' :
                         newCategory === 'HEAVY_MACHINERY' ? 'EEC-MACH' :
                         newCategory === 'SURVEYING_GEOTECHNICAL' ? 'EEC-SURV' : 'EEC-FURN';
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const itemCode = `${codePrefix}-2026-${randomNum}`;

      await resourceService.create({
        itemCode,
        name: newName,
        category: newCategory,
        subcategory: newSubcategory || 'Standard Equipment',
        status: 'AVAILABLE',
        condition: newCondition,
        location: newLocation,
        currentDepartmentId: newDepartmentId,
        currentDepartmentName: selectedDeptObj?.name || 'Central Warehouse',
        purchaseDate: new Date().toISOString().split('T')[0],
        purchaseCostETB: Number(newCostETB),
        currentValueETB: Number(newCostETB),
        vehicleSpecs: newCategory === 'VEHICLES' ? {
          plateNumber: plateNumber || '3-99999 ET',
          chassisNumber: 'JT199042948',
          engineNumber: '1HZ-883921',
          make: 'Toyota',
          model: 'Hilux Double Cab',
          year: 2026,
          fuelType: 'DIESEL',
          currentMileageKm: 120,
          lastServiceKm: 120,
          insuranceExpiry: '2027-10-01',
          boloInspectionExpiry: '2027-10-01'
        } : undefined,
        itSpecs: newCategory === 'IT_EQUIPMENT' ? {
          serialNumber: serialNumber || 'SN-EEC-99012',
          brand: 'Dell',
          model: 'Latitude 5540',
          processor: 'Intel Core i7-1365U',
          ramGb: 32,
          storageGb: 1000,
          os: 'Windows 11 Pro'
        } : undefined,
        surveyingSpecs: newCategory === 'SURVEYING_GEOTECHNICAL' ? {
          serialNumber: serialNumber || 'SN-LEICA-2026',
          make: 'Leica',
          model: 'TS16',
          accuracyGrade: accuracyGrade || '1 arc-second',
          calibrationDate: '2026-01-10',
          nextCalibrationDue: '2027-01-10',
          calibrationCertificateNumber: 'CERT-2026-0099'
        } : undefined
      });

      setIsRegisterModalOpen(false);
      // Reset form
      setNewName('');
      setNewSubcategory('');
      setPlateNumber('');
      setSerialNumber('');
      setRegisterError(null);
      setToastMessage(`Successfully registered asset ${itemCode}`);
      setTimeout(() => setToastMessage(null), 4000);
      loadResources();
    } catch (err: any) {
      console.error(err);
      setRegisterError(err.response?.data?.message || err.message || 'Failed to register equipment');
    } finally {
      setSaving(false);
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
      {/* Toast message */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-slideUp">
          <Check className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <PageHeader
        title="Resource Registry & Equipment"
        subtitle="Complete inventory registry, technical specifications, and custody across all projects"
        breadcrumbs={[
          { label: 'RMS', href: '/dashboard' },
          { label: 'Resource Registry' }
        ]}
      >
        {canRegister && (
          <button
            onClick={() => {
              setRegisterError(null);
              setIsRegisterModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-eec-primary text-white rounded-xl font-bold text-xs hover:bg-[#0E5161] transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Register New Resource
          </button>
        )}
      </PageHeader>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-slate-200">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setSelectedCategory(cat.value)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === cat.value
                ? 'bg-eec-primary text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

{fetchError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-rose-800 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{fetchError}</span>
          </div>
          <button
            onClick={() => loadResources()}
            className="px-3 py-1.5 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by equipment name, item code, plate, or location..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-accent/30 focus:border-eec-accent text-slate-800"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end flex-wrap">
          {/* Status Select */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as any)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="AVAILABLE">Available in Store</option>
            <option value="ASSIGNED">Assigned / In Use</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="TESTING">Testing / Inspection</option>
            <option value="RETIRED">Retired</option>
          </select>

          {/* Department Select */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none max-w-[200px] truncate"
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs ${viewMode === 'table' ? 'bg-white shadow text-eec-primary' : 'text-slate-500 hover:text-slate-900'}`}
              title="Table view"
            >
              <ListIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs ${viewMode === 'grid' ? 'bg-white shadow text-eec-primary' : 'text-slate-500 hover:text-slate-900'}`}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content Rendering */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 border-4 border-eec-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : resources.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No resources found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Try adjusting your search query, selecting a different department, or clearing category filters.
          </p>
          <button
            onClick={() => {
              setSelectedCategory('ALL');
              setSelectedStatus('ALL');
              setSelectedDept('ALL');
              setSearchQuery('');
            }}
            className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* Table View */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Resource Identifier</th>
                  <th className="px-6 py-4">Category / Type</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Condition</th>
                  <th className="px-6 py-4">Current Department & Location</th>
                  <th className="px-6 py-4 text-right">Value (ETB)</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {resources.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4">
                      <Link 
                        to={`/resources/${item.id}`}
                        className="font-bold text-slate-900 hover:text-eec-primary transition-colors block"
                      >
                        {item.name}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[11px] text-slate-400">{item.itemCode}</span>
                        {item.vehicleSpecs && (
                          <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded border border-emerald-200">
                            Plate: {item.vehicleSpecs.plateNumber}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <CategoryBadge category={item.category} />
                      <div className="text-[11px] text-slate-400 mt-1">{item.subcategory}</div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge condition={item.condition} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{item.currentDepartmentName || 'Central Warehouse'}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {item.location}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                      {formatETB(item.currentValueETB)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/resources/${item.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-eec-primary hover:text-white rounded-lg font-bold text-[11px] transition-colors"
                      >
                        View
                        <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {resources.map((item) => (
            <div 
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <CategoryBadge category={item.category} />
                  <StatusBadge status={item.status} />
                </div>

                <Link
                  to={`/resources/${item.id}`}
                  className="font-bold text-slate-900 text-sm hover:text-eec-primary transition-colors block line-clamp-2"
                >
                  {item.name}
                </Link>
                <p className="text-[11px] font-mono text-slate-400 mt-1">{item.itemCode}</p>

                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Department:</span>
                    <span className="font-semibold text-slate-800 truncate max-w-[170px]">{item.currentDepartmentName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Location:</span>
                    <span className="text-slate-700 truncate max-w-[170px]">{item.location}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Valuation:</span>
                    <span className="font-mono font-bold text-slate-900">{formatETB(item.currentValueETB)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <StatusBadge condition={item.condition} />
                <Link
                  to={`/resources/${item.id}`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-eec-primary hover:text-eec-accent transition-colors"
                >
                  Details & Custody
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Register Resource Modal */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title="Register New Enterprise Resource"
        subtitle="Add a new engineering asset, vehicle, or equipment into EEC corporate custody"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleRegister} className="space-y-4">
          {registerError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{registerError}</span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Category *
              </label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as ResourceCategory)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-eec-accent/30"
              >
                <option value="IT_EQUIPMENT">IT Equipment</option>
                <option value="VEHICLES">Vehicles & Transport</option>
                <option value="HEAVY_MACHINERY">Heavy Machinery</option>
                <option value="SURVEYING_GEOTECHNICAL">Surveying & Geotechnical</option>
                <option value="CAMP_FACILITY_FURNITURE">Furniture & Facilities</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Subcategory
              </label>
              <input
                type="text"
                value={newSubcategory}
                onChange={(e) => setNewSubcategory(e.target.value)}
                placeholder="e.g. Field Laptop, 4x4 Wagon, Total Station"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-accent/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Resource Title / Commercial Description *
            </label>
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Leica TS16 Robotic Total Station 1 arc-sec"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-accent/30"
            />
          </div>

          {/* Category-specific extra inputs */}
          {newCategory === 'VEHICLES' && (
            <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-emerald-800 uppercase mb-1">Plate Number</label>
                <input
                  type="text"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                  placeholder="e.g. 3-45892 ET"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-emerald-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-emerald-800 uppercase mb-1">Fuel & Type</label>
                <input
                  type="text"
                  readOnly
                  value="Diesel 4x4 Station Wagon"
                  className="w-full px-3 py-1.5 text-xs bg-emerald-100/50 border border-emerald-200 rounded-lg text-emerald-900"
                />
              </div>
            </div>
          )}

          {newCategory === 'SURVEYING_GEOTECHNICAL' && (
            <div className="p-3 bg-cyan-50/50 rounded-xl border border-cyan-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-cyan-800 uppercase mb-1">Serial Number</label>
                <input
                  type="text"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="e.g. TS16-99014"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-cyan-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-cyan-800 uppercase mb-1">Accuracy Grade</label>
                <input
                  type="text"
                  value={accuracyGrade}
                  onChange={(e) => setAccuracyGrade(e.target.value)}
                  placeholder="e.g. 0.5 arc-second"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-cyan-200 rounded-lg"
                />
              </div>
            </div>
          )}

          {newCategory === 'IT_EQUIPMENT' && (
            <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-blue-800 uppercase mb-1">Hardware Serial / Service Tag</label>
                <input
                  type="text"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="e.g. DELL-TAG-9912"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-blue-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-blue-800 uppercase mb-1">Operating System</label>
                <input
                  type="text"
                  readOnly
                  value="Windows 11 Pro Enterprise"
                  className="w-full px-3 py-1.5 text-xs bg-blue-100/50 border border-blue-200 rounded-lg text-blue-900"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Department Owner
              </label>
              <select
                value={newDepartmentId}
                onChange={(e) => setNewDepartmentId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none"
              >
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Initial Condition
              </label>
              <select
                value={newCondition}
                onChange={(e) => setNewCondition(e.target.value as ResourceCondition)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none"
              >
                <option value="EXCELLENT">Excellent (Brand New)</option>
                <option value="GOOD">Good (Operational)</option>
                <option value="FAIR">Fair (Needs Inspection)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Purchase Value (ETB)
              </label>
              <input
                type="number"
                value={newCostETB}
                onChange={(e) => setNewCostETB(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Store / Depot Location
            </label>
            <input
              type="text"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              placeholder="e.g. Kersa Central Stores, Bay 4"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsRegisterModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-bold text-white bg-eec-primary hover:bg-[#0E5161] rounded-xl transition-all shadow-sm flex items-center gap-2"
            >
              {saving ? 'Registering...' : 'Save & Register Asset'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
