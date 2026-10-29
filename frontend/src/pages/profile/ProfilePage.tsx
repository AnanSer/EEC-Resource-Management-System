import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { useAuth } from '../../context/AuthContext';
import { assignmentService } from '../../services/assignmentService';
import { requisitionService } from '../../services/requisitionService';
import { AssetAssignment, ResourceRequisition } from '../../types';
import { CategoryBadge } from '../../components/ui/CategoryBadge';
import { 
  Mail, 
  Phone, 
  Building2, 
  Shield, 
  Layers, 
  CheckCircle2, 
  ClipboardList,
  ExternalLink,
  History,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const ProfilePage: React.FC = () => {
  const { currentUser, currentRole } = useAuth();
  const [activeAssignments, setActiveAssignments] = useState<AssetAssignment[]>([]);
  const [pastAssignments, setPastAssignments] = useState<AssetAssignment[]>([]);
  const [userRequisitions, setUserRequisitions] = useState<ResourceRequisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'CUSTODY' | 'REQUISITIONS' | 'HISTORY' | 'PERMISSIONS'>('CUSTODY');

  const loadProfileData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [custodyData, reqs] = await Promise.all([
        assignmentService.getMyCustody(),
        requisitionService.getAll(),
      ]);

      setActiveAssignments(custodyData.activeHoldings || []);
      setPastAssignments(custodyData.historicalHoldings || []);
      setUserRequisitions(reqs || []);
    } catch (err: any) {
      console.error('[ProfilePage loadProfileData Error]', err);
      setLoadError(err.message || 'Failed to load profile custody data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfileData();
  }, [currentUser?.id, currentRole]);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <PageHeader
        title="Officer Profile & Custody Portfolio"
        subtitle="Corporation personnel credentials, direct asset custody holdings, and requisition history"
      >
        <button
          onClick={loadProfileData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Holdings
        </button>
      </PageHeader>

      {/* Main Profile Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-eec-primary text-white flex items-center justify-center font-bold text-xl shadow-md">
              {currentUser.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">{currentUser.name}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-eec-primary/10 text-eec-primary border border-eec-primary/20">
                  {currentRole}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">{currentUser.designation}</p>
              <p className="text-[11px] font-mono text-slate-400 mt-1">Employee ID: {currentUser.employeeId}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full sm:w-auto text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Department</span>
              <span className="font-semibold text-slate-800">{currentUser.departmentName}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Assigned Holdings</span>
              <span className="font-bold text-eec-primary">{activeAssignments.length} assets</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 col-span-2 sm:col-span-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Status</span>
              <span className="font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Active Personnel
              </span>
            </div>
          </div>
        </div>

        {/* Contact details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 mt-6 border-t border-slate-100 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-400" />
            <span>{currentUser.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-slate-400" />
            <span>{currentUser.phone || '+251 11 551 2233'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-400" />
            <span>Kality Central Yard & Head Office</span>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{loadError}</span>
          </div>
          <button
            onClick={loadProfileData}
            className="px-3 py-1 bg-rose-100 hover:bg-rose-200 rounded-lg font-bold transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-4 text-xs font-bold overflow-x-auto">
        {[
          { id: 'CUSTODY', label: `Active Custody Holdings (${activeAssignments.length})`, icon: Layers },
          { id: 'REQUISITIONS', label: `My Requisitions (${userRequisitions.length})`, icon: ClipboardList },
          { id: 'HISTORY', label: `Past Assignments (${pastAssignments.length})`, icon: History },
          { id: 'PERMISSIONS', label: 'Role Capabilities', icon: Shield },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 pb-3 border-b-2 transition-all whitespace-nowrap ${
                activeTab === t.id
                  ? 'border-eec-primary text-eec-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Active Custody Holdings */}
      {activeTab === 'CUSTODY' && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center min-h-[220px] bg-white rounded-2xl border border-slate-200/80">
              <div className="w-8 h-8 border-4 border-eec-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : activeAssignments.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200/80">
              <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No assets currently in your custody</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Submit a resource requisition to request engineering equipment, tools, or vehicles for your projects.
              </p>
              <Link
                to="/requisitions"
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-eec-primary text-white text-xs font-semibold rounded-xl hover:bg-[#0E5161] transition-colors"
              >
                Submit Requisition
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeAssignments.map(asgn => (
                <div key={asgn.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-3 hover:border-slate-300 transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                          {asgn.resourceCode}
                        </span>
                        {asgn.resourceCategory && <CategoryBadge category={asgn.resourceCategory} />}
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 mt-1.5">{asgn.resourceName}</h3>
                      <p className="text-[11px] text-slate-400 font-mono">{asgn.assignmentNumber}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      In Custody
                    </span>
                  </div>

                  <div className="text-xs space-y-1.5 py-2.5 border-y border-slate-100 text-slate-600">
                    <p><span className="text-slate-400 font-medium">Purpose:</span> {asgn.purpose}</p>
                    <p><span className="text-slate-400 font-medium">Assigned On:</span> {new Date(asgn.assignedAt).toLocaleDateString()}</p>
                    {asgn.expectedReturnDate && (
                      <p><span className="text-slate-400 font-medium">Return Due:</span> <strong className="text-amber-600">{asgn.expectedReturnDate}</strong></p>
                    )}
                    <p><span className="text-slate-400 font-medium">Condition:</span> <span className="font-semibold text-slate-800">{asgn.conditionOnAssignment}</span></p>
                    {asgn.returnLocation && (
                      <p><span className="text-slate-400 font-medium">Location:</span> {asgn.returnLocation}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <Link
                      to={`/resources/${asgn.resourceId}`}
                      className="text-xs font-semibold text-eec-primary hover:underline inline-flex items-center gap-1"
                    >
                      <span>View Resource Record</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>

                    <div className="flex items-center gap-2">
                      <Link
                        to="/assignments"
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors"
                      >
                        Custody Log
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Requisitions */}
      {activeTab === 'REQUISITIONS' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">My Requisitions History</h3>
            <Link
              to="/requisitions"
              className="text-xs font-semibold text-eec-primary hover:underline"
            >
              Open Requisitions Module
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wider font-semibold text-slate-500 border-b border-slate-200/80">
                  <th className="px-5 py-3">Req #</th>
                  <th className="px-5 py-3">Item Requested</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Submitted Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {userRequisitions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-400 text-xs">
                      No personal requisitions submitted yet.
                    </td>
                  </tr>
                ) : (
                  userRequisitions.map(req => (
                    <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3 font-mono font-bold text-slate-900">
                        {req.requisitionNumber}
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-semibold text-slate-800">{req.itemDescription}</div>
                        <div className="text-[11px] text-slate-400 line-clamp-1">{req.justification}</div>
                      </td>
                      <td className="px-5 py-3">
                        <CategoryBadge category={req.category} />
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                          req.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          req.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          req.status === 'FULFILLED' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                          req.status === 'CANCELLED' ? 'bg-slate-100 text-slate-500' :
                          'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Past Assignments */}
      {activeTab === 'HISTORY' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Past Custody & Handover Archive</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Historical equipment previously assigned and subsequently returned or transferred</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wider font-semibold text-slate-500 border-b border-slate-200/80">
                  <th className="px-5 py-3">Resource</th>
                  <th className="px-5 py-3">Assignment #</th>
                  <th className="px-5 py-3">Purpose</th>
                  <th className="px-5 py-3">Assigned Date</th>
                  <th className="px-5 py-3">Conclusion Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {pastAssignments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-400 text-xs">
                      No historical assignments recorded for your profile.
                    </td>
                  </tr>
                ) : (
                  pastAssignments.map(asgn => (
                    <tr key={asgn.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3">
                        <Link to={`/resources/${asgn.resourceId}`} className="font-bold text-slate-900 hover:text-eec-primary block">
                          {asgn.resourceName}
                        </Link>
                        <span className="font-mono text-[11px] text-slate-400">{asgn.resourceCode}</span>
                      </td>
                      <td className="px-5 py-3 font-mono text-slate-600">
                        {asgn.assignmentNumber || 'N/A'}
                      </td>
                      <td className="px-5 py-3 text-slate-600 max-w-xs truncate">
                        {asgn.purpose}
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {new Date(asgn.assignedAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                          asgn.status === 'TRANSFERRED' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {asgn.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Role Capabilities */}
      {activeTab === 'PERMISSIONS' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4 text-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Shield className="w-5 h-5 text-eec-primary" />
            <h3 className="text-sm font-bold text-slate-900">Enterprise Role Governance & Authority</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/70 space-y-2">
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Permitted Capabilities
              </h4>
              <ul className="space-y-1.5 text-slate-600 list-disc list-inside">
                {currentRole === 'ADMIN' && (
                  <>
                    <li>Enterprise-wide physical asset registration and deletion</li>
                    <li>Requisition approval and rejection authority</li>
                    <li>Direct asset allocation without requisition</li>
                    <li>Inter-departmental custody transfers</li>
                    <li>Personnel accounts approval and role assignments</li>
                  </>
                )}
                {currentRole === 'STORE_KEEPER' && (
                  <>
                    <li>Central warehouse inventory management</li>
                    <li>Fulfillment of approved requisitions by selecting physical assets</li>
                    <li>Direct equipment assignments across all directorates</li>
                    <li>Equipment return processing and physical intake inspections</li>
                  </>
                )}
                {currentRole === 'DEPARTMENT_MANAGER' && (
                  <>
                    <li>Directorate-scoped resource registration and custody oversight</li>
                    <li>Submit requisitions on behalf of department projects and staff</li>
                    <li>Direct assignment of department assets to department engineers</li>
                    <li>Return processing for department assets</li>
                  </>
                )}
                {currentRole === 'IT_TECHNICIAN' && (
                  <>
                    <li>Hardware specification logging and diagnostics</li>
                    <li>Operational condition and location updates</li>
                    <li>Corporation-wide inventory visibility for maintenance</li>
                  </>
                )}
                {currentRole === 'EMPLOYEE' && (
                  <>
                    <li>View assigned personal assets in field custody</li>
                    <li>Submit resource requisitions for engineering equipment</li>
                    <li>View department resources and equipment directory</li>
                  </>
                )}
              </ul>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/70 space-y-2">
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-eec-primary" />
                Directorate Scoping Policy
              </h4>
              <p className="text-slate-600 leading-relaxed">
                Your account is bound to <strong>{currentUser.departmentName}</strong>. 
                {currentRole === 'ADMIN' || currentRole === 'STORE_KEEPER' || currentRole === 'IT_TECHNICIAN'
                  ? ' Your operational role grants corporation-wide inventory logistics and governance authority.'
                  : ' All asset operations, requests, and metrics are strictly confined to your assigned directorate.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
