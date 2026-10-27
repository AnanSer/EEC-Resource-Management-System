import React, { useState, useEffect } from 'react';
import { api } from '../lib/axios';
import {
  Server,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FolderTree,
  BookOpen,
  Layers,
  Cpu,
  ShieldCheck,
} from 'lucide-react';

interface HealthData {
  status: string;
  service: string;
  timestamp: string;
  version: string;
  environment?: string;
}

export const FoundationPage: React.FC = () => {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<HealthData>('/health');
      setHealthData(response.data);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to connect to backend server';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="min-h-screen bg-eec-bg text-eec-text flex flex-col">
      {/* Top EEC Header Bar */}
      <header className="bg-eec-primary text-white shadow-md border-b-4 border-eec-cyan">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-lg bg-eec-cyan/20 border border-eec-cyan/40 flex items-center justify-center font-bold text-xl tracking-wider text-white shadow-inner">
              EEC
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-eec-cyan font-semibold">
                Ethiopian Engineering Corporation
              </div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                Resource Management System (RMS)
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-white/10 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm border border-white/10">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-200">Phase 1: Foundation Active</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        {/* Welcome Hero Banner */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-6 sm:p-8">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center space-x-1.5 text-xs font-semibold px-2.5 py-1 rounded bg-eec-cyan/10 text-eec-primary border border-eec-cyan/20">
              <Layers className="w-3.5 h-3.5 text-eec-cyan" />
              <span>System Initialization Phase</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-eec-primary tracking-tight">
              Enterprise Resource Architecture Setup
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              This repository represents the independent, clean Single-Page Application (SPA) foundation for the EEC Resource Management System. It manages nationwide physical and capital resources spanning vehicles, heavy construction machinery, surveying instruments, site camp infrastructure, and IT assets.
            </p>
          </div>
        </div>

        {/* Live Backend Health Verification Card */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-eec-primary/5 text-eec-primary">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-eec-primary">
                  Express API Backend Connection Status
                </h3>
                <p className="text-xs text-slate-500">
                  Target: <code className="text-slate-700 bg-slate-100 px-1 py-0.5 rounded font-mono">GET http://localhost:5000/api/health</code> (CORS & Axios credentials enabled)
                </p>
              </div>
            </div>

            <button
              onClick={fetchHealth}
              disabled={isLoading}
              className="inline-flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-eec-primary text-white hover:bg-eec-primary/90 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Re-check Health</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-lg border border-slate-100 bg-slate-50/50 space-y-1">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Connection Status
              </span>
              <div className="flex items-center space-x-2 pt-1">
                {isLoading ? (
                  <span className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 animate-spin text-eec-cyan" />
                    Connecting...
                  </span>
                ) : error ? (
                  <span className="text-xs font-semibold text-rose-600 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                    Disconnected / Offline
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Online & Healthy (200 OK)
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 rounded-lg border border-slate-100 bg-slate-50/50 space-y-1">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Service Identifier
              </span>
              <div className="text-sm font-bold text-eec-primary pt-1">
                {healthData?.service || (isLoading ? 'Checking...' : 'Not Connected')}
              </div>
            </div>

            <div className="p-4 rounded-lg border border-slate-100 bg-slate-50/50 space-y-1">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Server Timestamp
              </span>
              <div className="text-xs font-mono text-slate-700 pt-1 truncate">
                {healthData?.timestamp || (isLoading ? 'Checking...' : '—')}
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold">Backend Unreachable:</span> {error}. Ensure Express backend is running on port 5000 (<code className="font-mono bg-rose-100 px-1 py-0.5 rounded">npm run dev:backend</code>).
              </div>
            </div>
          )}
        </section>

        {/* EEC Design Tokens Palette Showcase */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-6 space-y-4">
          <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
            <div className="p-2.5 rounded-lg bg-eec-cyan/10 text-eec-cyan">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-eec-primary">
                Official EEC Design Tokens & Palette
              </h3>
              <p className="text-xs text-slate-500">
                Verified visual standards from EEC handover design specifications
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
            <div className="p-4 rounded-xl border border-slate-200 space-y-2 bg-white">
              <div className="w-full h-12 rounded-lg bg-eec-primary shadow-inner" />
              <div>
                <div className="text-xs font-bold text-slate-900">Primary Teal</div>
                <div className="text-xs font-mono text-slate-500">#083D4A</div>
                <div className="text-[11px] text-slate-400">Headers, Primary Buttons, Sidebar</div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 space-y-2 bg-white">
              <div className="w-full h-12 rounded-lg bg-eec-cyan shadow-inner" />
              <div>
                <div className="text-xs font-bold text-slate-900">Electric Cyan</div>
                <div className="text-xs font-mono text-slate-500">#00A7D6</div>
                <div className="text-[11px] text-slate-400">Focus Rings, Active Links, Accents</div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 space-y-2 bg-white">
              <div className="w-full h-12 rounded-lg bg-eec-terracotta shadow-inner" />
              <div>
                <div className="text-xs font-bold text-slate-900">Terracotta</div>
                <div className="text-xs font-mono text-slate-500">#C96F59</div>
                <div className="text-[11px] text-slate-400">Urgent Badges, Active Borders</div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 space-y-2 bg-white">
              <div className="w-full h-12 rounded-lg bg-eec-bg border border-slate-300 shadow-inner" />
              <div>
                <div className="text-xs font-bold text-slate-900">Background Canvas</div>
                <div className="text-xs font-mono text-slate-500">#F4F8FA</div>
                <div className="text-[11px] text-slate-400">High-Contrast Page Backdrop</div>
              </div>
            </div>
          </div>
        </section>

        {/* Foundation Repository Structure Matrix */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-6 space-y-4">
          <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600">
              <FolderTree className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-eec-primary">
                Repository Architecture Overview
              </h3>
              <p className="text-xs text-slate-500">
                Independent packages with unified monorepo orchestration
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="p-4 rounded-lg border border-slate-200/80 bg-slate-50/50 space-y-2">
              <div className="flex items-center space-x-2 text-eec-primary font-bold text-sm">
                <Cpu className="w-4 h-4 text-eec-cyan" />
                <span>Frontend Architecture</span>
              </div>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                <li><strong className="text-slate-800">Framework:</strong> React 18 + Vite SPA (Port 5173)</li>
                <li><strong className="text-slate-800">Styling:</strong> Tailwind CSS + EEC Design Tokens</li>
                <li><strong className="text-slate-800">Routing:</strong> React Router v6</li>
                <li><strong className="text-slate-800">HTTP Client:</strong> Axios (<code className="font-mono text-eec-primary">withCredentials: true</code>)</li>
                <li><strong className="text-slate-800">Typing:</strong> Strict TypeScript configuration</li>
              </ul>
            </div>

            <div className="p-4 rounded-lg border border-slate-200/80 bg-slate-50/50 space-y-2">
              <div className="flex items-center space-x-2 text-eec-primary font-bold text-sm">
                <Server className="w-4 h-4 text-eec-primary" />
                <span>Backend Architecture</span>
              </div>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                <li><strong className="text-slate-800">Runtime:</strong> Node.js + Express (Port 5000)</li>
                <li><strong className="text-slate-800">ORM & Database:</strong> Prisma ORM + PostgreSQL</li>
                <li><strong className="text-slate-800">CORS:</strong> Trusted origins with cookie session support</li>
                <li><strong className="text-slate-800">Health Endpoint:</strong> <code className="font-mono text-eec-primary">GET /api/health</code></li>
                <li><strong className="text-slate-800">Typing:</strong> Strict TypeScript compilation via <code className="font-mono">tsc</code></li>
              </ul>
            </div>
          </div>

          <div className="mt-4 p-4 rounded-lg border border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2 text-xs text-slate-600">
              <BookOpen className="w-4 h-4 text-eec-primary shrink-0" />
              <span>
                <strong>Documentation Preserved:</strong> All 8 original handover documents in <code className="font-mono text-eec-primary">docs/handover/</code> + Gemini RMS Implementation Plan in <code className="font-mono text-eec-primary">docs/RMS-IMPLEMENTATION-PLAN.md</code>.
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        Ethiopian Engineering Corporation (EEC) &copy; 2026. Resource Management System (RMS) — Foundation Phase.
      </footer>
    </div>
  );
};

export default FoundationPage;
