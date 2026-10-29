import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { resourceService } from '../../services/resourceService';
import { assignmentService, ResourceCustodyHistory } from '../../services/assignmentService';
import { Resource, ResourceStatus } from '../../types';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { CategoryBadge } from '../../components/ui/CategoryBadge';
import { Modal } from '../../components/ui/Modal';
import { 
  ArrowLeft, 
  MapPin, 
  User, 
  Truck, 
  Compass, 
  Laptop, 
  Tag, 
  Building2, 
  QrCode,
  AlertTriangle,
  History,
  Check,
  Trash2,
  ShieldAlert,
  Clock,
  Wrench
} from 'lucide-react';

export const ResourceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [resource, setResource] = useState<Resource | null>(null);
  const [custodyHistory, setCustodyHistory] = useState<ResourceCustodyHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ status?: number; message?: string } | null>(null);

  // Status Change Modal
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<ResourceStatus>('AVAILABLE');
  const [statusRemarks, setStatusRemarks] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Admin Delete Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { currentRole, currentUser } = useAuth();

  // Success Feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadResource() {
      if (!id) return;
      setLoading(true);
      setLoadError(null);
      try {
        const [item, history] = await Promise.all([
          resourceService.getById(id),
          assignmentService.getHistory(id).catch(() => null),
        ]);
        setResource(item);
        setCustodyHistory(history);
        if (item) {
          setNewStatus(item.status);
        }
      } catch (err: any) {
        console.error('Failed to load resource', err);
        setLoadError({
          status: err.response?.status,
          message: err.response?.data?.message || err.message || 'Failed to load resource'
        });
      } finally {
        setLoading(false);
      }
    }
    loadResource();
  }, [id]);

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resource) return;
    setSavingStatus(true);
    setStatusError(null);
    try {
      const updated = await resourceService.update(resource.id, {
        status: newStatus,
        notes: statusRemarks ? `${resource.notes || ''} [Status change to ${newStatus}: ${statusRemarks}]` : resource.notes
      });
      if (updated) {
        setResource(updated);
        setIsStatusModalOpen(false);
        setStatusRemarks('');
        setToastMessage(`Updated status to ${newStatus}`);
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (err: any) {
      console.error(err);
      setStatusError(err.response?.data?.message || err.message || 'Failed to update resource status');
    } finally {
      setSavingStatus(false);
    }
  };

  const handleDeleteResource = async () => {
    if (!resource) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await resourceService.delete(resource.id);
      setToastMessage(`Successfully deleted ${resource.itemCode} from registry`);
      setIsDeleteModalOpen(false);
      setTimeout(() => {
        navigate('/resources');
      }, 900);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-eec-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!resource) {
    const isForbidden = loadError?.status === 403;
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-8 md:p-12 text-center max-w-lg mx-auto shadow-sm space-y-4">
        {isForbidden ? (
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
        ) : (
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
        )}
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {isForbidden ? 'Access Restricted' : 'Historical Record Unavailable'}
          </h2>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            {isForbidden
              ? 'This asset belongs to another department and is not available in your department-scoped active registry, nor is there an authorized historical custody assignment linked to your employee profile.'
              : (loadError?.message || 'The requested asset identifier does not exist in the active registry or may have been decommissioned or deleted from the corporate database.')}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => navigate('/resources')}
            className="w-full sm:w-auto px-4 py-2.5 bg-eec-primary text-white text-xs font-bold rounded-xl hover:bg-[#0E5161] transition-colors"
          >
            Return to Registry
          </button>
          <button
            onClick={() => navigate('/profile')}
            className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
          >
            View My Profile & Archive
          </button>
        </div>
      </div>
    );
  }

  const isHistorical = Boolean(resource.historicalContext?.isHistoricalAccess);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-slideUp">
          <Check className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Back button */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link
          to="/resources"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-eec-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Resource Registry
        </Link>
        {isHistorical && (
          <>
            <span className="text-slate-300">•</span>
            <Link
              to="/profile"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-800 transition-colors"
            >
              <History className="w-3.5 h-3.5" />
              Back to My Past Assignments
            </Link>
          </>
        )}
      </div>

      {/* Historical Custody Banner */}
      {isHistorical && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-amber-500/20 text-amber-800 rounded-xl mt-0.5 shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded">
                  Historical Custody Archive
                </span>
                <span className="text-xs text-amber-800 font-bold">
                  Past Assignment Record
                </span>
              </div>
              <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                You are viewing an archived custody record for an asset previously in your possession. This resource is currently managed under{' '}
                <strong className="font-bold">{resource.currentDepartmentName}</strong>. Operational status updates and custody transfers are restricted to current authorized custodians.
              </p>
            </div>
          </div>
          <Link
            to="/profile"
            className="px-4 py-2 bg-white text-amber-900 border border-amber-300 text-xs font-bold rounded-xl hover:bg-amber-50 transition-colors shrink-0 shadow-sm"
          >
            Past Assignments
          </Link>
        </div>
      )}

      {/* Resource Overview Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3.5 rounded-2xl bg-eec-primary/10 text-eec-primary border border-eec-primary/20 flex-shrink-0">
              {resource.category === 'VEHICLES' && <Truck className="w-8 h-8" />}
              {resource.category === 'SURVEYING_GEOTECHNICAL' && <Compass className="w-8 h-8" />}
              {resource.category === 'IT_EQUIPMENT' && <Laptop className="w-8 h-8" />}
              {resource.category === 'HEAVY_MACHINERY' && <Truck className="w-8 h-8" />}
              {resource.category === 'CAMP_FACILITY_FURNITURE' && <Tag className="w-8 h-8" />}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <CategoryBadge category={resource.category} />
                <StatusBadge status={resource.status} />
                <StatusBadge condition={resource.condition} />
                {isHistorical && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    <History className="w-3 h-3" />
                    Past Assignment
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {resource.name}
              </h1>
              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500">
                <span className="font-mono font-bold text-eec-primary bg-eec-primary/5 px-2 py-0.5 rounded border border-eec-primary/10">
                  {resource.itemCode}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  {resource.currentDepartmentName}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {resource.location}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            {isHistorical ? (
              <div className="px-3.5 py-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                Read-Only Historical Record
              </div>
            ) : (
              <>
                {(currentRole === 'ADMIN' || currentRole === 'STORE_KEEPER' || (currentRole === 'DEPARTMENT_MANAGER' && (!resource.currentDepartmentId || resource.currentDepartmentId === currentUser?.departmentId))) && (
                  <button
                    onClick={() => {
                      setStatusError(null);
                      setIsStatusModalOpen(true);
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors"
                  >
                    Update Custody / Status
                  </button>
                )}

                {currentRole === 'ADMIN' && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setIsDeleteModalOpen(true);
                    }}
                    disabled={resource.status === 'ASSIGNED' || Boolean(resource.currentAssigneeId)}
                    title={
                      resource.status === 'ASSIGNED' || Boolean(resource.currentAssigneeId)
                        ? 'Assigned resources cannot be deleted while in personnel custody. A return workflow must be completed first.'
                        : 'Permanently delete this unassigned resource from the registry'
                    }
                    className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-sm ${
                      resource.status === 'ASSIGNED' || Boolean(resource.currentAssigneeId)
                        ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                        : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 hover:border-rose-300'
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Resource
                  </button>
                )}

                {/* Report Fault Action */}
                {resource.status !== 'MAINTENANCE' && (
                  (currentRole === 'ADMIN' ||
                   currentRole === 'IT_TECHNICIAN' ||
                   currentRole === 'STORE_KEEPER' ||
                   (currentRole === 'DEPARTMENT_MANAGER' && resource.currentDepartmentId === currentUser?.departmentId) ||
                   (currentRole === 'EMPLOYEE' && (resource.currentDepartmentId === currentUser?.departmentId || resource.currentAssigneeId === currentUser?.id)))
                ) && (
                  <button
                    type="button"
                    onClick={() => navigate('/maintenance', { state: { openReportModal: true, resourceId: resource.id } })}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold rounded-xl transition-colors shadow-sm"
                  >
                    <Wrench className="w-3.5 h-3.5 text-amber-700" />
                    Report Fault
                  </button>
                )}
              </>
            )}

            <button
              onClick={() => alert('Simulating barcode generation')}
              className="p-2 border border-slate-200 hover:border-slate-300 text-slate-600 rounded-xl transition-colors"
              title="Print Asset QR / Barcode"
            >
              <QrCode className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Details & Custody Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Technical & Procurement Specs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Category-Specific Engineering Specification Card */}
          {resource.vehicleSpecs && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card">
              <div className="flex items-center gap-2 pb-4 border-b border-slate-100 mb-4">
                <Truck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Vehicle Roadworthiness & Fleet Telemetry</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Plate Number</p>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">{resource.vehicleSpecs.plateNumber}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Current Odometer</p>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">{resource.vehicleSpecs.currentMileageKm.toLocaleString()} KM</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Annual Bolo Due</p>
                  <p className="font-bold text-amber-600 text-sm mt-0.5">{resource.vehicleSpecs.boloInspectionExpiry}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Chassis Number</p>
                  <p className="font-mono text-slate-800 mt-0.5 truncate">{resource.vehicleSpecs.chassisNumber}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Engine Number</p>
                  <p className="font-mono text-slate-800 mt-0.5">{resource.vehicleSpecs.engineNumber}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Fuel Type</p>
                  <p className="font-bold text-slate-800 mt-0.5">{resource.vehicleSpecs.fuelType}</p>
                </div>
              </div>
            </div>
          )}

          {resource.surveyingSpecs && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card">
              <div className="flex items-center gap-2 pb-4 border-b border-slate-100 mb-4">
                <Compass className="w-5 h-5 text-cyan-600" />
                <h3 className="text-sm font-bold text-slate-900">Geodetic Calibration & Metrology</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Angular Accuracy</p>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">{resource.surveyingSpecs.accuracyGrade}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Calibration Cert #</p>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">{resource.surveyingSpecs.calibrationCertificateNumber}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Next Calibration</p>
                  <p className="font-bold text-emerald-600 text-sm mt-0.5">{resource.surveyingSpecs.nextCalibrationDue}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Laser Safety</p>
                  <p className="font-medium text-slate-800 mt-0.5">{resource.surveyingSpecs.laserClass || 'Class 2'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Instrument Make</p>
                  <p className="font-medium text-slate-800 mt-0.5">{resource.surveyingSpecs.make}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Serial Number</p>
                  <p className="font-mono text-slate-800 mt-0.5">{resource.surveyingSpecs.serialNumber}</p>
                </div>
              </div>
            </div>
          )}

          {resource.itSpecs && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card">
              <div className="flex items-center gap-2 pb-4 border-b border-slate-100 mb-4">
                <Laptop className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">IT Hardware & Systems Engineering</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Processor / SoC</p>
                  <p className="font-bold text-slate-900 mt-0.5 truncate">{resource.itSpecs.processor || 'Multi-core Xeon/i7'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-slate-400 text-[10px] uppercase font-bold">System Memory (RAM)</p>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">{resource.itSpecs.ramGb} GB DDR5</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Storage Capacity</p>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">{resource.itSpecs.storageGb} GB NVMe</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Operating System</p>
                  <p className="font-medium text-slate-800 mt-0.5">{resource.itSpecs.os || 'Enterprise OS'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-slate-400 text-[10px] uppercase font-bold">MAC Address</p>
                  <p className="font-mono text-slate-800 mt-0.5">{resource.itSpecs.macAddress || 'N/A'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Warranty Expiry</p>
                  <p className="font-medium text-slate-800 mt-0.5">{resource.itSpecs.warrantyExpiry || 'Active'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Financial & Procurement Records */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card">
            <h3 className="text-sm font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">
              Procurement & Asset Value
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <p className="text-slate-400 text-[10px] uppercase font-bold">Purchase Date</p>
                <p className="font-semibold text-slate-900 mt-0.5">{resource.purchaseDate}</p>
              </div>
              <div>
                <p className="text-slate-400 text-[10px] uppercase font-bold">Original Cost</p>
                <p className="font-mono font-bold text-slate-900 mt-0.5">{formatETB(resource.purchaseCostETB)}</p>
              </div>
              <div>
                <p className="text-slate-400 text-[10px] uppercase font-bold">Current Book Value</p>
                <p className="font-mono font-bold text-emerald-700 mt-0.5">{formatETB(resource.currentValueETB)}</p>
              </div>
              <div>
                <p className="text-slate-400 text-[10px] uppercase font-bold">Registered Supplier</p>
                <p className="font-semibold text-slate-900 mt-0.5">{resource.supplier || 'EEC Central Tender'}</p>
              </div>
            </div>

            {resource.notes && (
              <div className="mt-4 pt-3 border-t border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Corporate Notes & Operational Log</p>
                <p className="text-xs text-slate-700 mt-1 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                  {resource.notes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Custody & Movement Audit Timeline */}
        <div className="space-y-6">
          {/* Custodian / Past Custody Card */}
          {isHistorical && resource.historicalContext ? (
            <div className="bg-white rounded-2xl border border-amber-200/90 p-6 shadow-card space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-amber-100">
                <History className="w-5 h-5 text-amber-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Your Past Assignment Record</h3>
                  <p className="text-[11px] text-amber-700">Archived personnel custody details</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 bg-amber-50/60 rounded-xl text-xs space-y-2 border border-amber-200/60">
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="text-[11px] font-medium text-slate-500">Assignment #:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {resource.historicalContext.assignmentNumber || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="text-[11px] font-medium text-slate-500">Historical Assignee:</span>
                    <span className="font-semibold text-slate-900">
                      {resource.historicalContext.historicalAssigneeName}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="text-[11px] font-medium text-slate-500">Department at Assignment:</span>
                    <span className="font-medium text-slate-800">
                      {resource.historicalContext.assignmentDepartmentName}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="text-[11px] font-medium text-slate-500">Assigned Date:</span>
                    <span className="font-medium text-slate-800">
                      {resource.historicalContext.assignedAt
                        ? new Date(resource.historicalContext.assignedAt).toLocaleDateString()
                        : 'Historical Archive'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="text-[11px] font-medium text-slate-500">Conclusion Date:</span>
                    <span className="font-medium text-slate-800">
                      {resource.historicalContext.returnedAt
                        ? new Date(resource.historicalContext.returnedAt).toLocaleDateString()
                        : 'Historical Record'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="text-[11px] font-medium text-slate-500">Conclusion Status:</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      resource.historicalContext.conclusionStatus === 'TRANSFERRED'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {resource.historicalContext.conclusionStatus}
                    </span>
                  </div>
                  {resource.historicalContext.purpose && (
                    <div className="pt-2 border-t border-amber-200/50 text-slate-600">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Assignment Purpose</span>
                      <p className="text-[11px] font-medium text-slate-700 leading-relaxed">
                        {resource.historicalContext.purpose}
                      </p>
                    </div>
                  )}
                </div>

                {/* Current Enterprise State */}
                <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1.5 border border-slate-100">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Current Corporation Custody</p>
                  <div className="flex justify-between text-slate-600 pt-1">
                    <span className="text-[11px]">Current Directorate:</span>
                    <span className="font-bold text-slate-800">{resource.currentDepartmentName}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span className="text-[11px]">Active Custodian:</span>
                    <span className="font-medium text-slate-800">
                      {resource.currentAssigneeName || 'Central Store / Available'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span className="text-[11px]">Asset Status:</span>
                    <span className="font-bold text-slate-800">{resource.status}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card">
              <div className="flex items-center gap-2 pb-4 border-b border-slate-100 mb-4">
                <User className="w-5 h-5 text-eec-primary" />
                <h3 className="text-sm font-bold text-slate-900">Current Custodian</h3>
              </div>

              {resource.currentAssigneeName ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-eec-primary text-white flex items-center justify-center font-bold text-sm">
                      {resource.currentAssigneeName.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{resource.currentAssigneeName}</h4>
                      <p className="text-[11px] text-slate-500">{resource.currentDepartmentName}</p>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1.5 border border-slate-100">
                    <div className="flex justify-between text-slate-500">
                      <span>Assigned At:</span>
                      <span className="font-medium text-slate-800">
                        {resource.assignedAt ? new Date(resource.assignedAt).toLocaleDateString() : 'Active Assignment'}
                      </span>
                    </div>
                    {custodyHistory?.currentAssignment?.expectedReturnDate && (
                      <div className="flex justify-between text-slate-500">
                        <span>Expected Return:</span>
                        <span className="font-medium text-amber-600">
                          {custodyHistory.currentAssignment.expectedReturnDate}
                        </span>
                      </div>
                    )}
                    {custodyHistory?.currentAssignment?.purpose && (
                      <div className="text-slate-500 pt-1 border-t border-slate-200/60">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Purpose</span>
                        <span className="font-medium text-slate-700 text-[11px]">
                          {custodyHistory.currentAssignment.purpose}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-500 pt-1">
                      <span>Location:</span>
                      <span className="font-medium text-slate-800">{resource.location}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500">
                  <p className="font-semibold text-slate-700">Currently in Central Store</p>
                  <p className="mt-0.5 text-[11px]">Unassigned to individual employee. Available for assignment.</p>
                </div>
              )}
            </div>
          )}

          {/* Movement & Custody History Timeline */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">Custody & Service History</h3>
              </div>
              <Link
                to="/assignments"
                className="text-[11px] font-bold text-eec-primary hover:underline"
              >
                Manage
              </Link>
            </div>

            {custodyHistory && custodyHistory.timeline.length > 0 ? (
              <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 text-xs">
                {custodyHistory.timeline.map((evt, idx) => (
                  <div key={idx} className="relative">
                    <span className={`absolute -left-6 top-0.5 w-4 h-4 rounded-full border-2 border-white ${
                      evt.type === 'ASSIGNMENT'
                        ? 'bg-emerald-500'
                        : evt.type === 'TRANSFER'
                        ? 'bg-sky-500'
                        : evt.type === 'RETURN'
                        ? 'bg-amber-500'
                        : 'bg-slate-400'
                    }`}></span>
                    <p className="font-bold text-slate-900">{evt.title}</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">{evt.description}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                      <span>{new Date(evt.date).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>By {evt.actor}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 text-xs">
                <div className="relative">
                  <span className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-slate-400 border-2 border-white"></span>
                  <p className="font-bold text-slate-900">Initial Procurement Intake</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">Central store intake recorded. Supplier: {resource.supplier || 'EEC Central Tender'}</p>
                  <span className="text-[10px] text-slate-400">{resource.purchaseDate || new Date().toLocaleDateString()}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Custody / Status Update Modal */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title="Update Asset Status & Custody"
        subtitle={`Modify operational status for ${resource.itemCode}`}
      >
        <form onSubmit={handleUpdateStatus} className="space-y-4">
          {statusError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{statusError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Select New Operational Status
            </label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as ResourceStatus)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none"
            >
              <option value="AVAILABLE">Available in Store</option>
              <option value="ASSIGNED" disabled>Assigned / In Field Use (Managed by Assignment Workflow)</option>
              <option value="MAINTENANCE" disabled>Under Maintenance (Managed by Maintenance Workflow)</option>
              <option value="TESTING" disabled>Inspection / Testing (Managed by QA Workflow)</option>
              <option value="RETIRED">Retired / Decommissioned</option>
              <option value="DISPOSED">Disposed</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Operational transitions to ASSIGNED, MAINTENANCE, and TESTING are managed by custody workflows. Direct registry changes support AVAILABLE, RETIRED, and DISPOSED.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Action Remarks / Justification
            </label>
            <textarea
              rows={3}
              value={statusRemarks}
              onChange={(e) => setStatusRemarks(e.target.value)}
              placeholder="e.g. Returned from Awash project after completion; inspection verified."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsStatusModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingStatus}
              className="px-5 py-2 text-xs font-bold text-white bg-eec-primary hover:bg-[#0E5161] rounded-xl transition-all shadow-sm"
            >
              {savingStatus ? 'Updating...' : 'Save Status Change'}
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
            setDeleteError(null);
          }
        }}
        title="Delete Resource from Registry"
        subtitle={`Administrator deletion safeguard for ${resource.itemCode}`}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          {deleteError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{deleteError}</span>
            </div>
          )}

          <p className="text-xs text-slate-600 leading-relaxed">
            Are you sure you want to permanently delete <strong className="text-slate-900">{resource.name}</strong> (<span className="font-mono text-eec-primary">{resource.itemCode}</span>) from the corporate asset registry?
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
        </div>
      </Modal>
    </div>
  );
};
