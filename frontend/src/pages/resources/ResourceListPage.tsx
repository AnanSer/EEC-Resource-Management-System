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
  AlertCircle,
  AlertTriangle,
  Trash2,
  Sparkles,
  Layers,
  Info,
  ShieldCheck,
  Cpu,
  Car,
  Wrench,
  Compass,
  Armchair
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
  const [newCostETB, setNewCostETB] = useState<number | ''>(50000);
  const [newCondition, setNewCondition] = useState<ResourceCondition>('EXCELLENT');
  const [newPurchaseDate, setNewPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [newWarrantyExpiry, setNewWarrantyExpiry] = useState('');
  const [newManufacturer, setNewManufacturer] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newSerialNumber, setNewSerialNumber] = useState('');
  const [newSupplier, setNewSupplier] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Category-specific specs
  // IT Equipment
  const [itType, setItType] = useState('Laptop');
  const [itOs, setItOs] = useState('Windows 11 Pro');
  const [itProcessor, setItProcessor] = useState('');
  const [itRam, setItRam] = useState('');
  const [itStorage, setItStorage] = useState('');

  // Vehicles
  const [vehType, setVehType] = useState('Pickup 4x4');
  const [plateNumber, setPlateNumber] = useState('');
  const [chassisNumber, setChassisNumber] = useState('');
  const [engineNumber, setEngineNumber] = useState('');
  const [fuelType, setFuelType] = useState<'DIESEL' | 'PETROL' | 'HYBRID' | 'ELECTRIC'>('DIESEL');
  const [mileage, setMileage] = useState('');

  // Heavy Machinery
  const [machType, setMachType] = useState('');
  const [machCapacity, setMachCapacity] = useState('');
  const [operatingHours, setOperatingHours] = useState('');

  // Surveying / Lab
  const [survType, setSurvType] = useState('');
  const [accuracyGrade, setAccuracyGrade] = useState('');
  const [calibrationCert, setCalibrationCert] = useState('');
  const [nextCalibrationDue, setNextCalibrationDue] = useState('');

  // Furniture / Site
  const [furnType, setFurnType] = useState('');
  const [furnMaterial, setFurnMaterial] = useState('');
  const [furnDimensions, setFurnDimensions] = useState('');
  const [furnColor, setFurnColor] = useState('');

  // Delete Modal state (Admin only)
  const [itemToDelete, setItemToDelete] = useState<Resource | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const resetRegisterForm = () => {
    setNewName('');
    setNewSubcategory('');
    setNewLocation('Central Store - Kersa');
    setNewCostETB(50000);
    setNewCondition('EXCELLENT');
    setNewPurchaseDate(new Date().toISOString().split('T')[0]);
    setNewWarrantyExpiry('');
    setNewManufacturer('');
    setNewModel('');
    setNewSerialNumber('');
    setNewSupplier('');
    setNewDescription('');
    setNewNotes('');

    setItType('Laptop');
    setItOs('Windows 11 Pro');
    setItProcessor('');
    setItRam('');
    setItStorage('');

    setVehType('Pickup 4x4');
    setPlateNumber('');
    setChassisNumber('');
    setEngineNumber('');
    setFuelType('DIESEL');
    setMileage('');

    setMachType('');
    setMachCapacity('');
    setOperatingHours('');

    setSurvType('');
    setAccuracyGrade('');
    setCalibrationCert('');
    setNextCalibrationDue('');

    setFurnType('');
    setFurnMaterial('');
    setFurnDimensions('');
    setFurnColor('');

    setRegisterError(null);
  };

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
    setRegisterError(null);
    try {
      const selectedDeptObj = departments.find(d => d.id === newDepartmentId);

      // Build category-specific specs flexibly (optional fields)
      let itSpecs = undefined;
      if (newCategory === 'IT_EQUIPMENT') {
        itSpecs = {
          serialNumber: newSerialNumber.trim() || undefined,
          computerType: itType || undefined,
          brand: newManufacturer.trim() || undefined,
          model: newModel.trim() || undefined,
          os: itOs.trim() || undefined,
          processor: itProcessor.trim() || undefined,
          ramGb: itRam ? parseInt(itRam, 10) || undefined : undefined,
          storageGb: itStorage ? parseInt(itStorage, 10) || undefined : undefined,
          storage: itStorage.trim() || undefined,
        };
      }

      let vehicleSpecs = undefined;
      if (newCategory === 'VEHICLES') {
        vehicleSpecs = {
          plateNumber: plateNumber.trim() || undefined,
          chassisNumber: chassisNumber.trim() || newSerialNumber.trim() || undefined,
          engineNumber: engineNumber.trim() || undefined,
          make: newManufacturer.trim() || undefined,
          model: newModel.trim() || undefined,
          vehicleType: vehType || undefined,
          fuelType: fuelType,
          currentMileageKm: mileage ? Number(mileage) || 0 : 0,
        };
      }

      let machinerySpecs = undefined;
      if (newCategory === 'HEAVY_MACHINERY') {
        machinerySpecs = {
          machineType: machType.trim() || undefined,
          make: newManufacturer.trim() || undefined,
          model: newModel.trim() || undefined,
          serialNumber: newSerialNumber.trim() || undefined,
          capacity: machCapacity.trim() || undefined,
          operatingHours: operatingHours ? Number(operatingHours) || 0 : 0,
        };
      }

      let surveyingSpecs = undefined;
      if (newCategory === 'SURVEYING_GEOTECHNICAL') {
        surveyingSpecs = {
          equipmentType: survType.trim() || undefined,
          make: newManufacturer.trim() || undefined,
          model: newModel.trim() || undefined,
          serialNumber: newSerialNumber.trim() || undefined,
          accuracyGrade: accuracyGrade.trim() || undefined,
          calibrationCertificateNumber: calibrationCert.trim() || undefined,
          nextCalibrationDue: nextCalibrationDue || undefined,
        };
      }

      let furnitureSpecs = undefined;
      if (newCategory === 'CAMP_FACILITY_FURNITURE') {
        furnitureSpecs = {
          itemType: furnType.trim() || undefined,
          material: furnMaterial.trim() || undefined,
          dimensions: furnDimensions.trim() || undefined,
          color: furnColor.trim() || undefined,
        };
      }

      const created = await resourceService.create({
        name: newName.trim(),
        category: newCategory,
        subcategory: newSubcategory.trim() || undefined,
        currentDepartmentId: newDepartmentId,
        departmentId: newDepartmentId,
        currentDepartmentName: selectedDeptObj?.name || undefined,
        condition: newCondition,
        location: newLocation.trim() || 'Central Store - Kersa',
        purchaseDate: newPurchaseDate || new Date().toISOString().split('T')[0],
        purchaseCostETB: newCostETB !== '' ? Number(newCostETB) : 0,
        currentValueETB: newCostETB !== '' ? Number(newCostETB) : 0,
        warrantyExpiry: newWarrantyExpiry || undefined,
        manufacturer: newManufacturer.trim() || undefined,
        model: newModel.trim() || undefined,
        serialNumber: newSerialNumber.trim() || undefined,
        supplier: newSupplier.trim() || undefined,
        description: newDescription.trim() || undefined,
        notes: newNotes.trim() || undefined,
        itSpecs,
        vehicleSpecs,
        machinerySpecs,
        surveyingSpecs,
        furnitureSpecs,
      } as any);

      setIsRegisterModalOpen(false);
      resetRegisterForm();
      setToastMessage(`Successfully registered asset ${created.itemCode} (${created.name})`);
      setTimeout(() => setToastMessage(null), 4000);
      loadResources();
    } catch (err: any) {
      console.error(err);
      setRegisterError(err.response?.data?.message || err.message || 'Failed to register equipment');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteResource = async () => {
    if (!itemToDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await resourceService.delete(itemToDelete.id);
      setToastMessage(`Successfully deleted ${itemToDelete.itemCode} from registry`);
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
      setTimeout(() => setToastMessage(null), 4000);
      loadResources();
    } catch (err: any) {
      console.error('Failed to delete resource', err);
      setDeleteError(err.response?.data?.message || err.message || 'Failed to delete resource');
    } finally {
      setDeleting(false);
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
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          to={`/resources/${item.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-eec-primary hover:text-white rounded-lg font-bold text-[11px] transition-colors"
                        >
                          View
                          <ArrowUpRight className="w-3 h-3" />
                        </Link>
                        {currentRole === 'ADMIN' && (
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteError(null);
                              setItemToDelete(item);
                              setIsDeleteModalOpen(true);
                            }}
                            disabled={item.status === 'ASSIGNED' || Boolean(item.currentAssigneeId)}
                            title={
                              item.status === 'ASSIGNED' || Boolean(item.currentAssigneeId)
                                ? 'Assigned resources cannot be deleted while in personnel custody'
                                : 'Delete resource (Admin only)'
                            }
                            className={`p-1.5 rounded-lg text-xs font-bold transition-colors ${
                              item.status === 'ASSIGNED' || Boolean(item.currentAssigneeId)
                                ? 'text-slate-300 cursor-not-allowed'
                                : 'text-rose-600 hover:bg-rose-50 hover:text-rose-700'
                            }`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
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
                <div className="flex items-center gap-2">
                  <Link
                    to={`/resources/${item.id}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-eec-primary hover:text-eec-accent transition-colors"
                  >
                    Details & Custody
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                  {currentRole === 'ADMIN' && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setItemToDelete(item);
                        setIsDeleteModalOpen(true);
                      }}
                      disabled={item.status === 'ASSIGNED' || Boolean(item.currentAssigneeId)}
                      title={
                        item.status === 'ASSIGNED' || Boolean(item.currentAssigneeId)
                          ? 'Assigned resources cannot be deleted while in personnel custody'
                          : 'Delete resource (Admin only)'
                      }
                      className={`p-1.5 rounded-lg text-xs font-bold transition-colors ${
                        item.status === 'ASSIGNED' || Boolean(item.currentAssigneeId)
                          ? 'text-slate-300 cursor-not-allowed'
                          : 'text-rose-600 hover:bg-rose-50 hover:text-rose-700'
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Register Resource Modal */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => {
          setIsRegisterModalOpen(false);
          resetRegisterForm();
        }}
        title="Register New Enterprise Resource"
        subtitle="Add a new engineering asset, vehicle, or equipment into EEC corporate registry"
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleRegister} className="space-y-4">
          {registerError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{registerError}</span>
            </div>
          )}

          {/* Automatic Item Code Notice */}
          <div className="p-3 bg-gradient-to-r from-teal-50 to-blue-50 border border-teal-200/80 rounded-xl flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
            <div className="text-xs text-slate-700 leading-relaxed">
              <span className="font-bold text-teal-900">Automatic Item Code Generation:</span> Unique corporate asset codes (e.g. <code className="bg-white/90 px-1 py-0.5 rounded text-teal-800 font-mono text-[11px] border border-teal-200">EEC-IT-2026-001</code>) are generated and assigned sequentially by the central registry upon submission.
            </div>
          </div>

          {/* 1. Classification & Basic Identity */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-100 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5 text-eec-primary" />
              1. Classification & Identification
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Asset Category *
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
                  placeholder="e.g. Field Laptop, 4x4 Station Wagon, Total Station"
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
          </div>

          {/* 2. Department Ownership & Storage Depot */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-100 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <MapPin className="w-3.5 h-3.5 text-eec-primary" />
              2. Department Ownership & Storage Location
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Owning Directorate / Department *
                </label>
                <select
                  value={newDepartmentId}
                  onChange={(e) => setNewDepartmentId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-eec-accent/30"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-500">Corporate department with budgetary and administrative accountability.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Physical Storage / Depot Location *
                </label>
                <input
                  type="text"
                  required
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="e.g. Central Store - Kersa, Bay 4"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-accent/30"
                />
                <p className="mt-1 text-[11px] text-slate-500">Physical warehouse or yard location where asset is stored.</p>
              </div>
            </div>
          </div>

          {/* 3. General & Commercial Information (Optional) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-100 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <Info className="w-3.5 h-3.5 text-eec-primary" />
              3. General & Commercial Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Manufacturer / Make
                </label>
                <input
                  type="text"
                  value={newManufacturer}
                  onChange={(e) => setNewManufacturer(e.target.value)}
                  placeholder="e.g. Dell, Toyota, CAT, Leica"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-accent/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Model Name / Number
                </label>
                <input
                  type="text"
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                  placeholder="e.g. Latitude 5540, HZ76, TS16"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-accent/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Hardware Serial Number
                </label>
                <input
                  type="text"
                  value={newSerialNumber}
                  onChange={(e) => setNewSerialNumber(e.target.value)}
                  placeholder="e.g. SN-982104"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-accent/30 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
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
                  Purchase Date
                </label>
                <input
                  type="date"
                  value={newPurchaseDate}
                  onChange={(e) => setNewPurchaseDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Purchase Value (ETB)
                </label>
                <input
                  type="number"
                  min="0"
                  value={newCostETB}
                  onChange={(e) => setNewCostETB(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Warranty Expiry
                </label>
                <input
                  type="date"
                  value={newWarrantyExpiry}
                  onChange={(e) => setNewWarrantyExpiry(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Supplier / Vendor
                </label>
                <input
                  type="text"
                  value={newSupplier}
                  onChange={(e) => setNewSupplier(e.target.value)}
                  placeholder="e.g. Nyala Motors, Dell East Africa"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Operational Notes / Remarks
                </label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="e.g. Supplied under project contract LOT-2"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 4. Category-Specific Specifications */}
          <div className="pt-2">
            {newCategory === 'IT_EQUIPMENT' && (
              <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200/80 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-900 uppercase tracking-wider">
                  <Cpu className="w-3.5 h-3.5 text-blue-700" />
                  IT Equipment Specifications
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-blue-800 uppercase mb-1">Computer / Device Type</label>
                    <select
                      value={itType}
                      onChange={(e) => setItType(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-blue-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
                    >
                      <option value="Laptop">Laptop / Notebook</option>
                      <option value="Desktop">Desktop Workstation</option>
                      <option value="Server">Rack / Tower Server</option>
                      <option value="Tablet">Field Tablet</option>
                      <option value="Network Device">Network Switch / Router</option>
                      <option value="Peripheral">Printer / Scanner / Peripheral</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-blue-800 uppercase mb-1">Operating System</label>
                    <input
                      type="text"
                      value={itOs}
                      onChange={(e) => setItOs(e.target.value)}
                      placeholder="e.g. Windows 11 Pro, Ubuntu 24.04"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-blue-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-blue-800 uppercase mb-1">Processor (CPU)</label>
                    <input
                      type="text"
                      value={itProcessor}
                      onChange={(e) => setItProcessor(e.target.value)}
                      placeholder="e.g. Intel Core i7-1365U, AMD Ryzen 7"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-blue-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-blue-800 uppercase mb-1">RAM Capacity (GB)</label>
                    <input
                      type="number"
                      min="1"
                      value={itRam}
                      onChange={(e) => setItRam(e.target.value)}
                      placeholder="e.g. 16, 32, 64"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-blue-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-blue-800 uppercase mb-1">Primary Storage</label>
                    <input
                      type="text"
                      value={itStorage}
                      onChange={(e) => setItStorage(e.target.value)}
                      placeholder="e.g. 512GB NVMe SSD, 1TB SSD"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-blue-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                </div>
              </div>
            )}

            {newCategory === 'VEHICLES' && (
              <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200/80 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 uppercase tracking-wider">
                  <Car className="w-3.5 h-3.5 text-emerald-700" />
                  Vehicle & Transport Specifications
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-800 uppercase mb-1">Vehicle Type</label>
                    <select
                      value={vehType}
                      onChange={(e) => setVehType(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-emerald-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    >
                      <option value="Pickup 4x4">Pickup 4x4 (Double Cab)</option>
                      <option value="Station Wagon">Station Wagon / SUV</option>
                      <option value="Sedan">Sedan / Service Car</option>
                      <option value="Minibus">Minibus / Staff Van</option>
                      <option value="Dump Truck">Heavy Dump Truck</option>
                      <option value="Water Tanker">Water Tanker Truck</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-800 uppercase mb-1">Plate Number</label>
                    <input
                      type="text"
                      value={plateNumber}
                      onChange={(e) => setPlateNumber(e.target.value)}
                      placeholder="e.g. 3-45892 ET"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-emerald-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-800 uppercase mb-1">Fuel Type</label>
                    <select
                      value={fuelType}
                      onChange={(e) => setFuelType(e.target.value as any)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-emerald-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 font-medium"
                    >
                      <option value="DIESEL">Diesel</option>
                      <option value="PETROL">Petrol</option>
                      <option value="HYBRID">Hybrid</option>
                      <option value="ELECTRIC">Electric</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-800 uppercase mb-1">Chassis / VIN Number</label>
                    <input
                      type="text"
                      value={chassisNumber}
                      onChange={(e) => setChassisNumber(e.target.value)}
                      placeholder="e.g. JT111HZ76098231"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-emerald-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-800 uppercase mb-1">Engine Number</label>
                    <input
                      type="text"
                      value={engineNumber}
                      onChange={(e) => setEngineNumber(e.target.value)}
                      placeholder="e.g. 1HZ-883921"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-emerald-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-800 uppercase mb-1">Current Mileage (km)</label>
                    <input
                      type="number"
                      min="0"
                      value={mileage}
                      onChange={(e) => setMileage(e.target.value)}
                      placeholder="e.g. 15000"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-emerald-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {newCategory === 'HEAVY_MACHINERY' && (
              <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200/80 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900 uppercase tracking-wider">
                  <Wrench className="w-3.5 h-3.5 text-amber-700" />
                  Heavy Machinery Specifications
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-amber-800 uppercase mb-1">Machine Type</label>
                    <input
                      type="text"
                      value={machType}
                      onChange={(e) => setMachType(e.target.value)}
                      placeholder="e.g. Crawler Excavator, Wheel Loader"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-amber-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-amber-800 uppercase mb-1">Capacity / Power Rating</label>
                    <input
                      type="text"
                      value={machCapacity}
                      onChange={(e) => setMachCapacity(e.target.value)}
                      placeholder="e.g. 20-ton, 1.8 m³ bucket, 350 kVA"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-amber-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-amber-800 uppercase mb-1">Current Operating Hours</label>
                    <input
                      type="number"
                      min="0"
                      value={operatingHours}
                      onChange={(e) => setOperatingHours(e.target.value)}
                      placeholder="e.g. 1250"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-amber-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400 font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {newCategory === 'SURVEYING_GEOTECHNICAL' && (
              <div className="p-3.5 bg-cyan-50/60 rounded-xl border border-cyan-200/80 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-cyan-900 uppercase tracking-wider">
                  <Compass className="w-3.5 h-3.5 text-cyan-700" />
                  Surveying & Geotechnical Specifications
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-cyan-800 uppercase mb-1">Equipment Type</label>
                    <input
                      type="text"
                      value={survType}
                      onChange={(e) => setSurvType(e.target.value)}
                      placeholder="e.g. Robotic Total Station, GNSS Receiver"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-cyan-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-cyan-800 uppercase mb-1">Measurement Accuracy Grade</label>
                    <input
                      type="text"
                      value={accuracyGrade}
                      onChange={(e) => setAccuracyGrade(e.target.value)}
                      placeholder="e.g. 0.5 arc-second, 1 mm + 1.5 ppm"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-cyan-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-400"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-cyan-800 uppercase mb-1">Calibration Certificate #</label>
                    <input
                      type="text"
                      value={calibrationCert}
                      onChange={(e) => setCalibrationCert(e.target.value)}
                      placeholder="e.g. EEC-CAL-2026-0442"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-cyan-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-400 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-cyan-800 uppercase mb-1">Next Calibration Due Date</label>
                    <input
                      type="date"
                      value={nextCalibrationDue}
                      onChange={(e) => setNextCalibrationDue(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-cyan-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-400 font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {newCategory === 'CAMP_FACILITY_FURNITURE' && (
              <div className="p-3.5 bg-purple-50/60 rounded-xl border border-purple-200/80 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-900 uppercase tracking-wider">
                  <Armchair className="w-3.5 h-3.5 text-purple-700" />
                  Furniture & Facility Specifications
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-purple-800 uppercase mb-1">Furniture / Item Type</label>
                    <input
                      type="text"
                      value={furnType}
                      onChange={(e) => setFurnType(e.target.value)}
                      placeholder="e.g. Executive Desk, Ergonomic Mesh Chair"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-purple-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-purple-800 uppercase mb-1">Construction Material</label>
                    <input
                      type="text"
                      value={furnMaterial}
                      onChange={(e) => setFurnMaterial(e.target.value)}
                      placeholder="e.g. Solid Wood / Oak, Steel Frame, Mesh"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-purple-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-purple-800 uppercase mb-1">Dimensions (W x D x H)</label>
                    <input
                      type="text"
                      value={furnDimensions}
                      onChange={(e) => setFurnDimensions(e.target.value)}
                      placeholder="e.g. 160 x 80 x 75 cm"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-purple-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-purple-800 uppercase mb-1">Color / Finish</label>
                    <input
                      type="text"
                      value={furnColor}
                      onChange={(e) => setFurnColor(e.target.value)}
                      placeholder="e.g. Walnut & Charcoal, Gunmetal Grey"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-purple-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 5. Custody & Status Protection Safeguard */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Initial Registration Status: <strong className="text-emerald-700">AVAILABLE IN STORE</strong></span>
            </div>
            <span className="text-[11px] text-slate-500 hidden sm:inline">Personnel custody is exclusively assigned through the Assignments workflow.</span>
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setIsRegisterModalOpen(false);
                resetRegisterForm();
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-bold text-white bg-eec-primary hover:bg-[#0E5161] rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? 'Registering...' : 'Save & Register Resource'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal (Admin only) */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!deleting) {
            setIsDeleteModalOpen(false);
            setItemToDelete(null);
            setDeleteError(null);
          }
        }}
        title="Delete Resource from Registry"
        subtitle={itemToDelete ? `Administrator deletion safeguard for ${itemToDelete.itemCode}` : ''}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          {deleteError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{deleteError}</span>
            </div>
          )}

          {itemToDelete && (
            <>
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to permanently delete <strong className="text-slate-900">{itemToDelete.name}</strong> (<span className="font-mono text-eec-primary">{itemToDelete.itemCode}</span>) from the corporate asset registry?
              </p>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  Administrative Safeguard Notice:
                </p>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  Only system administrators can delete records. Assets currently assigned to personnel cannot be deleted until a return workflow is completed. This action is irreversible.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setItemToDelete(null);
                    setDeleteError(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDeleteResource}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  {deleting ? 'Deleting...' : 'Confirm Permanent Deletion'}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};
