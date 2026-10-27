import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { useAuth } from '../../context/AuthContext';
import { mockStore } from '../../mock/store';
import { AssetAssignment, Resource, ResourceRequisition } from '../../types';
import { 
  Mail, 
  Phone, 
  Building2, 
  Shield, 
  Layers, 
  CheckCircle2, 
  ClipboardList,
  ExternalLink
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const ProfilePage: React.FC = () => {
  const { currentUser, currentRole } = useAuth();
  const [activeAssignments, setActiveAssignments] = useState<AssetAssignment[]>([]);
  const [userRequisitions, setUserRequisitions] = useState<ResourceRequisition[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'CUSTODY' | 'REQUISITIONS' | 'PERMISSIONS'>('CUSTODY');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [asgns, reqs, resList] = await Promise.all([
        mockStore.getAssignments(),
        mockStore.getRequisitions(),
        mockStore.getResources()
      ]);
      // Find current assignments for this employee
      setActiveAssignments(asgns.filter(a => a.employeeId === currentUser.employeeId && a.isCurrent));
      setUserRequisitions(reqs.filter(r => r.requesterId === currentUser.employeeId));
      setResources(resList);
      setLoading(false);
    };
    load();
  }, [currentUser]);

  const getResource = (resourceId: string) => resources.find(r => r.id === resourceId);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <PageHeader
        title="Officer Profile & Custody Portfolio"
        subtitle="Corporation personnel credentials, direct asset custody holdings, and requisition history"
      />

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
            <span>+251 11 551 2233</span>
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-400" />
            <span>Kality Central Yard & Head Office</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-4 text-xs font-bold">
        {[
          { id: 'CUSTODY', label: `Active Custody Holdings (${activeAssignments.length})`, icon: Layers },
          { id: 'REQUISITIONS', label: `My Requisitions (${userRequisitions.length})`, icon: ClipboardList },
          { id: 'PERMISSIONS', label: 'Role Capabilities', icon: Shield },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 pb-3 border-b-2 transition-all ${
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
          {activeAssignments.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200/80">
              <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No assets currently in your custody</p>
              <p className="text-xs text-slate-400 mt-1">Submit a resource requisition to request tools, vehicles, or IT equipment.</p>
              <Link
                to="/requisitions"
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-eec-primary text-white text-xs font-semibold rounded-xl"
              >
                Submit Requisition
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeAssignments.map(asgn => {
                const res = getResource(asgn.resourceId);
                return (
                  <div key={asgn.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                          {res?.itemCode || 'CODE'}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 mt-1">{res?.name || 'Resource Asset'}</h3>
                        <p className="text-xs text-slate-500">{res?.category}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                        In Custody
                      </span>
                    </div>

                    <div className="text-xs space-y-1 py-2 border-y border-slate-100 text-slate-600">
                      <p><span className="text-slate-400">Purpose:</span> {asgn.purpose}</p>
                      <p><span className="text-slate-400">Assigned On:</span> {new Date(asgn.assignedAt).toLocaleDateString()}</p>
                      <p><span className="text-slate-400">Location:</span> {res?.location || 'EEC Site'}</p>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <Link
                        to={`/resources/${res?.id}`}
                        className="text-xs font-semibold text-eec-primary hover:underline inline-flex items-center gap-1"
                      >
                        <span>View Details</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>

                      <div className="flex items-center gap-2">
                        <Link
                          to="/returns"
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold"
                        >
                          Initiate Return
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Requisitions */}
      {activeTab === 'REQUISITIONS' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Requisition History</h3>
            <Link
              to="/requisitions"
              className="text-xs font-semibold text-eec-primary hover:underline"
            >
              Open Requisitions Module
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wider font-semibold text-slate-500 border-b border-slate-200/80">
                  <th className="px-5 py-3">Req #</th>
                  <th className="px-5 py-3">Item Requested</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Submitted Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {userRequisitions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-400">No requisitions submitted yet.</td>
                  </tr>
                ) : (
                  userRequisitions.map(req => (
                    <tr key={req.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3.5 font-mono text-xs font-bold text-slate-900">{req.requisitionNumber}</td>
                      <td className="px-5 py-3.5 font-semibold text-slate-900">{req.itemDescription}</td>
                      <td className="px-5 py-3.5">{req.category}</td>
                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                          {req.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">{new Date(req.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Permissions */}
      {activeTab === 'PERMISSIONS' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Role Authorization & Scope: {currentRole}</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            In accordance with the Ethiopian Engineering Corporation Resource Governance Charter (handover doc 02-roles-and-permissions.md),
            your persona is granted specific capabilities across the custody, maintenance, and registry modules:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
              <span className="font-bold text-slate-900 block">Resource Requisitions</span>
              <p className="text-slate-500">Authorized to submit equipment, vehicle, and hardware requests for corporate assignments.</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
              <span className="font-bold text-slate-900 block">Custody & Returns</span>
              <p className="text-slate-500">Authorized to submit scheduled return notices for items in your custody to Kality / Gerji stores.</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
              <span className="font-bold text-slate-900 block">Issue Reporting</span>
              <p className="text-slate-500">Authorized to flag breakdown or defect reports directly on assets in custody.</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
              <span className="font-bold text-slate-900 block">Registry Visibility</span>
              <p className="text-slate-500">Read-only browsing of corporate asset registry and technical specifications.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
