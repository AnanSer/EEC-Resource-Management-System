import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { EECLogo } from '../../components/brand/EECLogo';
import { requestPasswordReset } from '../../services/authService';
import { 
  Mail, 
  ArrowRight, 
  ArrowLeft, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ShieldCheck 
} from 'lucide-react';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      await requestPasswordReset(email.trim());
      setSubmitted(true);
    } catch (err: any) {
      // In case of network failure or 429 rate limit
      const serverMessage = err.response?.data?.message || err.message || 'Unable to submit password reset request. Please try again.';
      setErrorMessage(serverMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center mb-4">
          <EECLogo size="lg" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          Forgot Your Password?
        </h2>
        <p className="mt-1 text-xs text-slate-500 font-medium">
          Ethiopian Engineering Corporation Corporate Portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-card sm:rounded-2xl sm:px-10 border border-slate-200/80">
          {submitted ? (
            /* Confirmation State */
            <div className="text-center py-2">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-center mx-auto mb-4 text-emerald-600">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">
                Check Your Email
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                If an account with institutional address <span className="font-semibold text-slate-900">{email}</span> exists in our system, we have sent a secure password reset link to it.
              </p>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-6 text-left flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-800 leading-relaxed">
                  <span className="font-bold block">20-Minute Link Validity</span>
                  Please check your inbox and spam folder. For your security, this password reset link will expire in 20 minutes.
                </div>
              </div>

              <div className="space-y-3">
                <Link
                  to="/login"
                  className="w-full py-2.5 px-4 bg-eec-primary hover:bg-eec-primary/90 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Return to Sign In</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setEmail('');
                  }}
                  className="text-xs text-slate-500 hover:text-slate-700 font-medium py-1 transition-colors"
                >
                  Need to try a different email?
                </button>
              </div>
            </div>
          ) : (
            /* Form State */
            <>
              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                Enter your registered corporate email address below. We'll send you a secure verification link to reset your account credentials.
              </p>

              {errorMessage && (
                <div className="mb-6 p-4 rounded-xl text-xs flex items-start gap-3 bg-rose-50 text-rose-700 border border-rose-200">
                  <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 leading-relaxed">
                    <span className="font-bold block mb-0.5">Request Failed</span>
                    {errorMessage}
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Institutional Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. yourname@eec.gov.et"
                      className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eec-primary/20 focus:border-eec-primary text-slate-900 transition-all"
                    />
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
                      <span>Send Password Reset Link</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-slate-100 text-center">
                <Link
                  to="/login"
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </>
          )}

          {/* Institutional Trust Notice */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-[10px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Encrypted EEC Corporate Security Gateway</span>
          </div>
        </div>
      </div>
    </div>
  );
};

