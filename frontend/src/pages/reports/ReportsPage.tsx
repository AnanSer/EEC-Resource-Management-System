import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { mockStore } from '../../mock/store';
import { Resource, MaintenanceTicket, Department } from '../../types';
import { 
  Download, 
  Layers, 
  TrendingUp, 
  Wrench, 
  ShieldCheck, 
  CheckCircle2, 
  Building2,
  DollarSign
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const [resources, setResources] = useState<Resource[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceTicket[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [activeTab, setActiveTab] = useState<'REGISTRY' | 'STATUTORY' | 'MAINTENANCE' | 'DEPARTMENT'>('REGISTRY');
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [res, maint, depts] = await Promise.all([
        mockStore.getResources(),
        mockStore.getMaintenanceTickets(),
        mockStore.getDepartments()
      ]);
      setResources(res);
      setMaintenance(maint);
      setDepartments(depts);
    };
    load();
  }, []);

  // Aggregated calculations
  const totalCost = resources.reduce((sum, r) => sum + (r.purchaseCostETB || 0), 0);
  const totalBookValue = resources.reduce((sum, r) => sum + (r.currentValueETB || 0), 0);
  const totalMaintenanceCost = maintenance.reduce((sum, m) => sum + (m.actualCostETB || m.estimatedCostETB || 0), 0);

  const vehiclesAndMachinery = resources.filter(r => r.category === 'VEHICLES' || r.category === 'HEAVY_MACHINERY');
  const validBoloCount = vehiclesAndMachinery.filter(v => {
    const expiry = v.vehicleSpecs?.boloInspectionExpiry;
    return expiry && new Date(expiry) > new Date();
  }).length;
  const complianceRate = vehiclesAndMachinery.length > 0 ? Math.round((validBoloCount / vehiclesAndMachinery.length) * 100) : 100;

  // Category breakdown
  const categories = ['VEHICLES', 'HEAVY_MACHINERY', 'SURVEYING_GEOTECHNICAL', 'IT_EQUIPMENT', 'CAMP_FACILITY_FURNITURE'] as const;
  const categoryStats = categories.map(cat => {
    const items = resources.filter(r => r.category === cat);
    const catCost = items.reduce((s, i) => s + (i.purchaseCostETB || 0), 0);
    return {
      category: cat,
      total: items.length,
      available: items.filter(i => i.status === 'AVAILABLE').length,
      assigned: items.filter(i => i.status === 'ASSIGNED').length,
      maintenance: items.filter(i => i.status === 'MAINTENANCE').length,
      cost: catCost
    };
  });

  const handleSimulateExport = () => {
    let csv = 'Item Code,Resource Name,Category,Plate / Serial,Status,Location,Purchase Cost (ETB),Purchase Date\n';
    resources.forEach(r => {
      const identifier = r.vehicleSpecs?.plateNumber || r.itSpecs?.serialNumber || r.machinerySpecs?.serialNumber || r.surveyingSpecs?.serialNumber || 'N/A';
      csv += `"${r.itemCode}","${r.name}","${r.category}","${identifier}","${r.status}","${r.location}","${r.purchaseCostETB || 0}","${r.purchaseDate || 'N/A'}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `EEC_Fixed_Asset_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 4000);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <PageHeader
        title="Audits & Corporate Asset Reports"
        subtitle="Fixed asset valuation ledger, statutory roadworthiness schedule, and maintenance expenditure logs"
      >
        <button
          onClick={handleSimulateExport}
          className="inline-flex items-center gap-2 px-4 py-2 bg-eec-primary hover:bg-eec-secondary text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
        >
          <Download className="w-4 h-4" />
          Export Registry Ledger (CSV)
        </button>
      </PageHeader>

      {downloadSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>Export generated successfully. EEC Fixed Asset Ledger downloaded to your workstation.</span>
        </div>
      )}

      {/* Top Corporate Valuation KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Capital Acquisition Cost</span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <p className="text-xl font-bold text-slate-900 mt-2">
            {totalCost.toLocaleString()} <span className="text-xs font-semibold text-slate-400">ETB</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Verified EEC historic acquisition value</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Current Net Book Value</span>
            <span className="p-2 bg-sky-50 text-sky-600 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <p className="text-xl font-bold text-slate-900 mt-2">
            {Math.round(totalBookValue).toLocaleString()} <span className="text-xs font-semibold text-slate-400">ETB</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Straight-line corporate depreciation schedule</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Maintenance Expenditure</span>
            <span className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Wrench className="w-4 h-4" />
            </span>
          </div>
          <p className="text-xl font-bold text-slate-900 mt-2">
            {totalMaintenanceCost.toLocaleString()} <span className="text-xs font-semibold text-slate-400">ETB</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1">{maintenance.length} work orders logged</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Bolo & Regulatory Compliance</span>
            <span className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <p className="text-xl font-bold text-slate-900 mt-2">{complianceRate}%</p>
          <p className="text-[11px] text-slate-400 mt-1">{validBoloCount} / {vehiclesAndMachinery.length} fleet units valid</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-4 text-xs font-bold">
        {[
          { id: 'REGISTRY', label: 'Category Valuation Ledger', icon: Layers },
          { id: 'STATUTORY', label: 'Fleet & Bolo Schedule', icon: ShieldCheck },
          { id: 'MAINTENANCE', label: 'Maintenance Cost History', icon: Wrench },
          { id: 'DEPARTMENT', label: 'Directorate Allocations', icon: Building2 },
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

      {/* TAB 1: Category Valuation Ledger */}
      {activeTab === 'REGISTRY' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Fixed Asset Category Breakdown</h3>
            <span className="text-xs text-slate-500">{resources.length} active registered capital items</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wider font-semibold text-slate-500 border-b border-slate-200/80">
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3 text-center">Total Quantity</th>
                  <th className="px-5 py-3 text-center">Available</th>
                  <th className="px-5 py-3 text-center">In Custody</th>
                  <th className="px-5 py-3 text-center">Under Maintenance</th>
                  <th className="px-5 py-3 text-right">Total Acquisition (ETB)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {categoryStats.map(stat => (
                  <tr key={stat.category} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3.5 font-bold text-slate-900">{stat.category}</td>
                    <td className="px-5 py-3.5 text-center font-semibold">{stat.total}</td>
                    <td className="px-5 py-3.5 text-center text-emerald-600 font-semibold">{stat.available}</td>
                    <td className="px-5 py-3.5 text-center text-sky-600 font-semibold">{stat.assigned}</td>
                    <td className="px-5 py-3.5 text-center text-amber-600 font-semibold">{stat.maintenance}</td>
                    <td className="px-5 py-3.5 text-right font-bold text-slate-900">
                      {stat.cost.toLocaleString()} ETB
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50/80 font-bold text-slate-900 text-xs border-t border-slate-200">
                  <td className="px-5 py-3.5">Total Corporation Assets</td>
                  <td className="px-5 py-3.5 text-center">{resources.length}</td>
                  <td className="px-5 py-3.5 text-center text-emerald-700">
                    {resources.filter(r => r.status === 'AVAILABLE').length}
                  </td>
                  <td className="px-5 py-3.5 text-center text-sky-700">
                    {resources.filter(r => r.status === 'ASSIGNED').length}
                  </td>
                  <td className="px-5 py-3.5 text-center text-amber-700">
                    {resources.filter(r => r.status === 'MAINTENANCE').length}
                  </td>
                  <td className="px-5 py-3.5 text-right text-eec-primary">
                    {totalCost.toLocaleString()} ETB
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Fleet & Bolo Schedule */}
      {activeTab === 'STATUTORY' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Statutory Roadworthiness & NQI Calibration Roster</h3>
            <span className="text-xs text-slate-500">Ministry of Transport & Logistics Compliance</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wider font-semibold text-slate-500 border-b border-slate-200/80">
                  <th className="px-5 py-3">Vehicle / Machinery</th>
                  <th className="px-5 py-3">Plate / Serial</th>
                  <th className="px-5 py-3">Current Location</th>
                  <th className="px-5 py-3">Annual Bolo Expiry</th>
                  <th className="px-5 py-3 text-center">Compliance Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {vehiclesAndMachinery.map(item => {
                  const expiry = item.vehicleSpecs?.boloInspectionExpiry;
                  const hasBolo = !!expiry;
                  const isExpired = hasBolo && new Date(expiry) < new Date();
                  const identifier = item.vehicleSpecs?.plateNumber || item.machinerySpecs?.serialNumber || 'N/A';
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3.5 font-bold text-slate-900">
                        {item.name}
                        <span className="block text-[11px] font-normal text-slate-400">{item.itemCode}</span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs">{identifier}</td>
                      <td className="px-5 py-3.5">{item.location}</td>
                      <td className="px-5 py-3.5">
                        {expiry ? (
                          <span className={isExpired ? 'text-rose-600 font-bold' : 'text-slate-700'}>
                            {expiry}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Not recorded</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {!hasBolo ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">Pending Log</span>
                        ) : isExpired ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            EXPIRED - PROHIBITED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            VALID ROADWORTHY
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Maintenance Cost History */}
      {activeTab === 'MAINTENANCE' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Maintenance Ledger & Work Orders</h3>
            <span className="text-xs text-slate-500">Total Expenditure: {totalMaintenanceCost.toLocaleString()} ETB</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wider font-semibold text-slate-500 border-b border-slate-200/80">
                  <th className="px-5 py-3">Work Order #</th>
                  <th className="px-5 py-3">Issue Title</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Technician</th>
                  <th className="px-5 py-3 text-right">Cost (ETB)</th>
                  <th className="px-5 py-3">Opened Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {maintenance.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3.5 font-mono text-xs font-bold text-slate-900">{m.ticketNumber}</td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-900">{m.title}</p>
                      <p className="text-[11px] text-slate-400 truncate max-w-xs">{m.description}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                        {m.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">{m.assignedTechnician || 'Unassigned'}</td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-900">
                      {(m.actualCostETB || m.estimatedCostETB || 0).toLocaleString()} ETB
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">{new Date(m.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Directorate Allocations */}
      {activeTab === 'DEPARTMENT' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Asset Holdings by Directorate</h3>
            <span className="text-xs text-slate-500">{departments.length} Corporation Units</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wider font-semibold text-slate-500 border-b border-slate-200/80">
                  <th className="px-5 py-3">Department Name</th>
                  <th className="px-5 py-3">Code</th>
                  <th className="px-5 py-3">Operating Location</th>
                  <th className="px-5 py-3 text-center">Allocated Resources</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {departments.map(dept => {
                  const deptResources = resources.filter(r => r.currentDepartmentId === dept.id);
                  return (
                    <tr key={dept.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3.5 font-bold text-slate-900">{dept.name}</td>
                      <td className="px-5 py-3.5 font-mono text-xs">{dept.code}</td>
                      <td className="px-5 py-3.5">{dept.location || 'Head Office'}</td>
                      <td className="px-5 py-3.5 text-center font-bold text-eec-primary">
                        {deptResources.length} items
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
