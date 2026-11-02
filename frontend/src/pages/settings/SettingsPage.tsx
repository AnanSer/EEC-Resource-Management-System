import React, { useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { 
  ShieldCheck, 
  Building2, 
  Hash, 
  Cpu,
  Server,
  Database,
  Lock
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [codePrefixes, setCodePrefixes] = useState({
    vehicle: 'EEC-VEH-',
    machinery: 'EEC-MAC-',
    surveying: 'EEC-SRV-',
    it: 'EEC-IT-',
    furniture: 'EEC-FUR-'
  });
  const [boloNoticeDays, setBoloNoticeDays] = useState(30);
  const [calibrationNoticeDays, setCalibrationNoticeDays] = useState(45);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <PageHeader
        title="System & Corporate Configuration"
        subtitle="Corporate asset numbering formats, statutory regulatory thresholds, and corporation facilities"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1: Item Code Formats */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Hash className="w-5 h-5 text-eec-primary" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Asset Numbering Rules</h3>
              <p className="text-xs text-slate-500">Corporate prefixes assigned by EEC Store Keeper</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Vehicles Code Prefix</label>
              <input
                type="text"
                value={codePrefixes.vehicle}
                onChange={(e) => setCodePrefixes({...codePrefixes, vehicle: e.target.value})}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Heavy Machinery Prefix</label>
              <input
                type="text"
                value={codePrefixes.machinery}
                onChange={(e) => setCodePrefixes({...codePrefixes, machinery: e.target.value})}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Surveying Equipment Prefix</label>
              <input
                type="text"
                value={codePrefixes.surveying}
                onChange={(e) => setCodePrefixes({...codePrefixes, surveying: e.target.value})}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">IT Equipment Prefix</label>
              <input
                type="text"
                value={codePrefixes.it}
                onChange={(e) => setCodePrefixes({...codePrefixes, it: e.target.value})}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Statutory Expiry Thresholds */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <ShieldCheck className="w-5 h-5 text-purple-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Regulatory Notification Thresholds</h3>
              <p className="text-xs text-slate-500">Ministry of Transport & NQI metrology alerts</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Roadworthiness (Bolo) Expiration Warning Window</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={boloNoticeDays}
                  onChange={(e) => setBoloNoticeDays(Number(e.target.value))}
                  className="w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs"
                />
                <span className="text-slate-500">days prior to expiration</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Triggers WARNING banner in Dashboard and notifications feed.</p>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">NQI Metrology Calibration Warning Window</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={calibrationNoticeDays}
                  onChange={(e) => setCalibrationNoticeDays(Number(e.target.value))}
                  className="w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs"
                />
                <span className="text-slate-500">days prior to expiration</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Applicable to total stations, GPS units, and lab scales.</p>
            </div>
          </div>
        </div>

        {/* Section 3: Primary Corporation Locations */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building2 className="w-5 h-5 text-sky-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Corporation Facilities & Depots</h3>
              <p className="text-xs text-slate-500">Official dispatch yards and storage points</p>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            {[
              { name: 'Kality Central Workshop & Yard', type: 'Heavy Machinery & Fleet Depot' },
              { name: 'Gerji Central Yard', type: 'Surveying & General Store' },
              { name: 'Head Office (Bole Building)', type: 'Corporate Administration & IT' },
              { name: 'Awash Basin Project Yard', type: 'Remote Site Depot' },
              { name: 'Gode Irrigation Field Base', type: 'Remote Field Deployment' }
            ].map(loc => (
              <div key={loc.name} className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">{loc.name}</p>
                  <p className="text-[11px] text-slate-500">{loc.type}</p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">Operational</span>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Enterprise Platform & Deployment Architecture */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Cpu className="w-5 h-5 text-eec-primary" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Platform & System Architecture</h3>
              <p className="text-xs text-slate-500">EEC RMS production environment and governance profile</p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-slate-600" />
                <div>
                  <p className="font-bold text-slate-800">Backend Architecture</p>
                  <p className="text-[11px] text-slate-500">Native Node.js HTTP (node:http) + TypeScript</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700">Render</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-600" />
                <div>
                  <p className="font-bold text-slate-800">Relational Database</p>
                  <p className="text-[11px] text-slate-500">PostgreSQL + Prisma ORM Client</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">Supabase</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-purple-600" />
                <div>
                  <p className="font-bold text-slate-800">Security & Authentication</p>
                  <p className="text-[11px] text-slate-500">Strict RBAC, HttpOnly Session Cookies, CSP & HSTS</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700">Enforced</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
