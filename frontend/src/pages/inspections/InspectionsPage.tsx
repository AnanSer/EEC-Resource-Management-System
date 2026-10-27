import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { maintenanceService } from '../../services/maintenanceService';
import { resourceService } from '../../services/resourceService';
import { InspectionTest, Resource } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Modal } from '../../components/ui/Modal';
import { 
   
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
   
  Check, 
   
  AlertCircle 
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const InspectionsPage: React.FC = () => {
  const { currentUser, currentRole } = useAuth();
  const [inspections, setInspections] = useState<InspectionTest[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Inspection Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedResourceId, setSelectedResourceId] = useState('');
  const [inspectionType, setInspectionType] = useState<'CALIBRATION' | 'ROADWORTHINESS_BOLO' | 'HYDRAULIC' | 'SAFETY_AUDIT'>('ROADWORTHINESS_BOLO');
  const [passed, setPassed] = useState(true);
  const [findings, setFindings] = useState('');
  const [certNumber, setCertNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('2027-10-25');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const canRecord = ['ADMIN', 'IT_TECHNICIAN', 'STORE_KEEPER'].includes(currentRole);

  const loadData = async () => {
    setLoading(true);
    try {
      const [iList, rList] = await Promise.all([
        maintenanceService.getInspections(),
        resourceService.getAll()
      ]);
      setInspections(iList);
      setResources(rList);
      if (rList.length > 0 && !selectedResourceId) {
        setSelectedResourceId(rList[0].id);
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

  const handleRecordInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await maintenanceService.recordInspection({
        resourceId: selectedResourceId,
        inspectionType,
        passed,
        findings,
        conductedBy: `${currentUser.name} (${currentRole})`,
        certificationNumber: certNumber || undefined,
        expiryDate: expiryDate || undefined,
        remarks
      });
      setIsModalOpen(false);
      setFindings('');
      setRemarks('');
      setCertNumber('');
      setToastMessage('Inspection audit certificate logged successfully');
      setTimeout(() => setToastMessage(null), 3500);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Inspection failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-slideUp">
          <Check className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      <PageHeader
        title="Testing, Bolo & Calibration Inspections"
        subtitle="Annual roadworthiness (Bolo), NQI surveying calibration, and hydraulic safety records"
        breadcrumbs={[
          { label: 'RMS', href: '/dashboard' },
          { label: 'Inspections & Tests' }
        ]}
      >
        {canRecord && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-eec-primary hover:bg-[#0E5161] text-white rounded-xl font-bold text-xs transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Log Inspection / Bolo Test
          </button>
        )}
      </PageHeader>

      {/* Inspections Table */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 border-4 border-eec-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : inspections.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Inspection Records</h3>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Inspection Type</th>
                  <th className="px-6 py-4">Equipment Description</th>
                  <th className="px-6 py-4">Outcome</th>
                  <th className="px-6 py-4">Findings & Measurements</th>
                  <th className="px-6 py-4">Certificate # / Expiry</th>
                  <th className="px-6 py-4">Auditor / Date</th>
                  <th className="px-6 py-4 text-right">Asset</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {inspections.map((insp) => (
                  <tr key={insp.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-900 block">{insp.inspectionType}</span>
                      <span className="text-[10px] text-slate-400">{insp.ticketId ? 'Work Order QA' : 'Statutory Audit'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <Link 
                        to={`/resources/${insp.resourceId}`}
                        className="font-bold text-slate-900 hover:text-eec-primary transition-colors block"
                      >
                        {insp.resourceName}
                      </Link>
                      <span className="font-mono text-[11px] text-slate-400">{insp.resourceCode}</span>
                    </td>
                    <td className="px-6 py-4">
                      {insp.passed ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          PASSED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          FAILED
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="line-clamp-2 max-w-xs text-slate-600">{insp.findings}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-mono font-bold text-slate-800">{insp.certificationNumber || 'N/A'}</div>
                      {insp.expiryDate && (
                        <div className="text-[10px] text-emerald-600 mt-0.5">Expires: {insp.expiryDate}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-800">{insp.conductedBy}</div>
                      <div className="text-[10px] text-slate-400">{insp.date}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/resources/${insp.resourceId}`}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-eec-primary hover:text-white rounded-lg font-bold text-[11px] transition-colors inline-block"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Log Inspection Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Log Statutory Inspection or Calibration"
        subtitle="Record official compliance test or annual vehicle Bolo inspection"
      >
        <form onSubmit={handleRecordInspection} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Select Equipment *</label>
            <select
              value={selectedResourceId}
              onChange={(e) => setSelectedResourceId(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none"
            >
              {resources.map(r => (
                <option key={r.id} value={r.id}>
                  {r.itemCode} • {r.name} ({r.category})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Inspection Type *</label>
              <select
                value={inspectionType}
                onChange={(e) => setInspectionType(e.target.value as any)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none"
              >
                <option value="ROADWORTHINESS_BOLO">Annual Roadworthiness (Bolo)</option>
                <option value="CALIBRATION">NQI Instrument Calibration</option>
                <option value="HYDRAULIC">Hydraulic Plant Safety Test</option>
                <option value="SAFETY_AUDIT">Comprehensive Safety Audit</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Result Outcome *</label>
              <select
                value={passed ? 'true' : 'false'}
                onChange={(e) => setPassed(e.target.value === 'true')}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none"
              >
                <option value="true">PASSED (Certified)</option>
                <option value="false">FAILED (Requires Remediation)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Technical Findings & Tolerances *</label>
            <textarea
              required
              rows={3}
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              placeholder="e.g. Brake efficiency verified at 68%. Lighting and suspension aligned."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Certificate / Stamp Number</label>
              <input
                type="text"
                value={certNumber}
                onChange={(e) => setCertNumber(e.target.value)}
                placeholder="e.g. BOLO-2026-ADDIS-9921"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Next Expiry Due Date</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Remarks</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Certified by Federal Transport Center #3"
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
              {saving ? 'Logging...' : 'Save Inspection Certificate'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
