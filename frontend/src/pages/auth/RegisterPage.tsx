import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { EECLogo } from '../../components/brand/EECLogo';
import api from '../../lib/axios';
import { 
  Lock, 
  Mail, 
  User, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Shield, 
  Eye, 
  EyeOff,
  Building2,
  Phone,
  Hash
} from 'lucide-react';

interface PublicDepartment {
  id: string;
  name: string;
  code: string;
  location?: string;
}

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [departments, setDepartments] = useState<PublicDepartment[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ message: string; email: string; departmentName: string } | null>(null);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await api.get('/auth/departments');
        if (res.data?.departments && Array.isArray(res.data.departments)) {
          setDepartments(res.data.departments);
          if (res.data.departments.length > 0) {
            setDepartmentId(res.data.departments[0].id);
          }
        }
      } catch (err) {
        console.error('[EEC-RMS] Could not load public directorates:', err);
      } finally {
        setLoadingDepts(false);
      }
    };
    fetchDepartments();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!departmentId) {
      setErrorMessage('Please select your assigned Directorate / Department');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const res = await register(
        fullName,
        email,
        password,
        departmentId,
        employeeId.trim() || undefined,
        phone.trim() || undefined
      );

      if (res.success) {
        const selectedDept = departments.find(d => d.id === departmentId);
        setSuccessInfo({
          message: res.message || 'Account registration submitted successfully.',
          email: email.trim().toLowerCase(),
          departmentName: selectedDept ? `${selectedDept.name} (${selectedDept.code})` : 'Assigned Directorate',
        });
      } else {
        setErrorMessage(res.error || 'Registration failed');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center">
        <div className="flex justify-center mb-4">
          <EECLogo />
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          Request Personnel Access
        </h2>
        <p className="mt-1 text-xs text-slate-500 font-medium">
          Ethiopian Engineering Corporation — Resource Management Portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-6 shadow-card sm:rounded-2xl sm:px-10 border border-slate-200/80">
          {successInfo ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900">Application Submitted!</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Your registration for <strong className="text-slate-900">{successInfo.email}</strong> was saved in the EEC corporate directory under{' '}
                  <span className="font-semibold text-eec-primary">{successInfo.departmentName}</span> with status:
                </p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 mt-2.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>PENDING ADMINISTRATOR APPROVAL</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-200/60 text-left space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-700">
                  <Shield className="w-3.5 h-3.5 text-eec-primary" />
                  <span>Next Steps for Account Activation:</span>
                </div>
                <p className="leading-relaxed">
                  1. An authorized EEC Administrator will review your institutional credentials.<br />
                  2. Your account will be verified and assigned the appropriate system role.<br />
                  3. You will receive an in-app and corporate confirmation when activated.
                </p>
              </div>

              <div className="pt-2">
                <Link
                  to="/login"
                  className="w-full py-2.5 px-4 bg-eec-primary hover:bg-eec-primary/90 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <span>Return to Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Notice regarding corporate policy */}
              <div className="mb-6 p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2.5 text-slate-600 text-xs">
                <Shield className="w-4 h-4 text-eec-primary flex-shrink-0 mt-0.5" />
                <p className="leading-relaxed text-[11px]">
                  <strong>EEC Access Governance:</strong> Public accounts are automatically registered as <strong>EMPLOYEE</strong> with <strong>PENDING</strong> status. An Administrator will review your department and assign system permissions upon approval.
                </p>
              </div>

              {errorMessage && (
                <div className="mb-6 p-4 rounded-xl text-xs bg-rose-50 text-rose-700 border border-rose-200 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium">{errorMessage}</div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Full Legal Name */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Full Legal Name *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Almaz Ayana Megersa"
                        className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-primary/20 focus:border-eec-primary text-slate-900 transition-all"
                      />
                    </div>
                  </div>

                  {/* Institutional Email */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Institutional Email *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. almaz.ayana@eec.gov.et"
                        className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-primary/20 focus:border-eec-primary text-slate-900 transition-all"
                      />
                    </div>
                  </div>

                  {/* Directorate / Department */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Department / Directorate *
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <select
                        required
                        value={departmentId}
                        onChange={(e) => setDepartmentId(e.target.value)}
                        disabled={loadingDepts}
                        className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-primary/20 focus:border-eec-primary text-slate-900 font-medium transition-all"
                      >
                        {loadingDepts ? (
                          <option value="">Loading directorates...</option>
                        ) : (
                          departments.map((dept) => (
                            <option key={dept.id} value={dept.id}>
                              {dept.name} ({dept.code})
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Employee ID (Optional) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Employee ID
                      </label>
                      <span className="text-[10px] text-slate-400">Optional</span>
                    </div>
                    <div className="relative">
                      <Hash className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={employeeId}
                        onChange={(e) => setEmployeeId(e.target.value)}
                        placeholder="e.g. EEC-EMP-1045"
                        className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-primary/20 focus:border-eec-primary text-slate-900 transition-all"
                      />
                    </div>
                  </div>

                  {/* Phone Number (Optional) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Phone Number
                      </label>
                      <span className="text-[10px] text-slate-400">Optional</span>
                    </div>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+251 91 123 4567"
                        className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-primary/20 focus:border-eec-primary text-slate-900 transition-all"
                      />
                    </div>
                  </div>

                  {/* Account Password */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Account Password *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 6 characters"
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

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Confirm Password *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-primary/20 focus:border-eec-primary text-slate-900 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading || loadingDepts}
                    className="w-full py-2.5 px-4 bg-eec-primary hover:bg-eec-primary/90 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Submit Access Application</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-6 text-center">
                <Link
                  to="/login"
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Already have an approved account? <span className="text-eec-primary font-bold">Sign In</span>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
