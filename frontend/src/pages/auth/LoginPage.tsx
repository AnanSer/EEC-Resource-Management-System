import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { EECLogo } from '../../components/brand/EECLogo';
import { 
  Lock, 
  Mail, 
  ArrowRight, 
  AlertCircle, 
  Clock, 
  ShieldCheck, 
  Eye, 
  EyeOff,
  UserCheck
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setErrorCode(null);
    setLoading(true);

    try {
      const result = await login(email, password);
      if (result.success) {
        navigate('/dashboard', { replace: true });
      } else {
        setErrorMessage(result.error || 'Login failed');
        setErrorCode(result.code || null);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (userEmail: string) => {
    setEmail(userEmail);
    setPassword('EEC-Secure2026!');
    setErrorMessage(null);
    setErrorCode(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center mb-4">
          <EECLogo />
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          Resource Management System
        </h2>
        <p className="mt-1 text-xs text-slate-500 font-medium">
          Ethiopian Engineering Corporation Corporate Portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-card sm:rounded-2xl sm:px-10 border border-slate-200/80">
          {/* Error & Status Alerts */}
          {errorMessage && (
            <div className={`mb-6 p-4 rounded-xl text-xs flex items-start gap-3 border ${
              errorCode === 'ACCOUNT_PENDING'
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : errorCode === 'ACCOUNT_REJECTED'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              {errorCode === 'ACCOUNT_PENDING' ? (
                <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 leading-relaxed">
                <span className="font-bold block mb-0.5">
                  {errorCode === 'ACCOUNT_PENDING'
                    ? 'Registration Pending Approval'
                    : errorCode === 'ACCOUNT_REJECTED'
                    ? 'Access Application Rejected'
                    : 'Authentication Failed'}
                </span>
                {errorMessage}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Institutional Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. name@eec.gov.et"
                  className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-primary/20 focus:border-eec-primary text-slate-900 transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-primary/20 focus:border-eec-primary text-slate-900 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-eec-primary hover:bg-eec-primary/90 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In to EEC-RMS</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Pre-fill section */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Quick Sign-In Personas (Development Seed):
            </p>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => fillCredentials('admin@eec.gov.et')}
                className="text-left px-2.5 py-1.5 bg-slate-50 hover:bg-purple-50 text-slate-700 hover:text-purple-800 rounded-lg border border-slate-200/80 transition-colors"
              >
                <span className="font-bold block text-purple-700">Administrator</span>
                <span className="text-[10px] text-slate-400">admin@eec.gov.et</span>
              </button>
              <button
                type="button"
                onClick={() => fillCredentials('storekeeper@eec.gov.et')}
                className="text-left px-2.5 py-1.5 bg-slate-50 hover:bg-amber-50 text-slate-700 hover:text-amber-800 rounded-lg border border-slate-200/80 transition-colors"
              >
                <span className="font-bold block text-amber-700">Store Keeper</span>
                <span className="text-[10px] text-slate-400">storekeeper@eec.gov.et</span>
              </button>
              <button
                type="button"
                onClick={() => fillCredentials('technician@eec.gov.et')}
                className="text-left px-2.5 py-1.5 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-800 rounded-lg border border-slate-200/80 transition-colors"
              >
                <span className="font-bold block text-blue-700">IT Technician</span>
                <span className="text-[10px] text-slate-400">technician@eec.gov.et</span>
              </button>
              <button
                type="button"
                onClick={() => fillCredentials('manager@eec.gov.et')}
                className="text-left px-2.5 py-1.5 bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 rounded-lg border border-slate-200/80 transition-colors"
              >
                <span className="font-bold block text-emerald-700">Dept Manager</span>
                <span className="text-[10px] text-slate-400">manager@eec.gov.et</span>
              </button>
              <button
                type="button"
                onClick={() => fillCredentials('employee@eec.gov.et')}
                className="text-left px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200/80 transition-colors"
              >
                <span className="font-bold block text-slate-800">Engineer / Officer</span>
                <span className="text-[10px] text-slate-400">employee@eec.gov.et</span>
              </button>
              <button
                type="button"
                onClick={() => fillCredentials('pending.applicant@eec.gov.et')}
                className="text-left px-2.5 py-1.5 bg-slate-50 hover:bg-rose-50 text-slate-700 hover:text-rose-800 rounded-lg border border-slate-200/80 transition-colors"
              >
                <span className="font-bold block text-rose-700">Pending User</span>
                <span className="text-[10px] text-slate-400">pending.applicant...</span>
              </button>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link
              to="/register"
              className="text-xs font-semibold text-eec-primary hover:underline flex items-center justify-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>New Personnel? Request Corporate Account</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
