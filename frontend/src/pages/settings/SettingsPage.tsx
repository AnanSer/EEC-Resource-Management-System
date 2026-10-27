import React, { useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { mockStore } from '../../mock/store';
import { 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Building2, 
  Hash, 
  Cpu
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [codePrefixes, setCodePrefixes] = useState({
    vehicle: 'EEC-VEH-',
    machinery: 'EEC-MAC-',
    surveying: 'EEC-SRV-',
    it: 'EEC-IT-',
    furniture: 'EEC-FUR-'
  });
  const [boloNoticeDays, setBoloNoticeDays] = useState(30);
  const [calibrationNoticeDays, setCalibrationNoticeDays] = useState(45);

  const handleReset = async () => {
    setResetting(true);
    if ((mockStore as any).resetToInitial) {
      await (mockStore as any).resetToInitial();
    }
    setResetting(false);
    setResetSuccess(true);
    setTimeout(() => setResetSuccess(false), 4000);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <PageHeader
        title="System & Corporate Configuration"
        subtitle="Corporate asset numbering formats, statutory expiry thresholds, and prototype test controls"
      />

      {resetSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>Demo notifications and prototype state have been reset to default baseline.</span>
        </div>
      )}

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

        {/* Section 4: Prototype Diagnostics & In-Memory Store Controls */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Cpu className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Prototype Diagnostics & Controls</h3>
              <p className="text-xs text-slate-500">In-memory mock store and compliance verification</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
              <span className="font-bold text-slate-800">Stack Verification</span>
              <p className="text-slate-500 text-[11px]">React 18 + Vite 6 + Tailwind CSS 3 + TypeScript 5. Zero Better Auth dependencies.</p>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/60 space-y-2">
              <div className="flex items-center gap-2 text-amber-800 font-bold">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>Reset Prototype State</span>
              </div>
              <p className="text-amber-700 text-[11px]">
                Resets notifications and in-memory mock alerts back to clean demonstration state.
              </p>
              <button
                onClick={handleReset}
                disabled={resetting}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {resetting ? 'Resetting...' : 'Reset In-Memory State'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
