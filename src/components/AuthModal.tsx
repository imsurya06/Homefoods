import React, { useState, useEffect } from 'react';
import { X, Mail, AlertCircle, CheckCircle2, ShieldCheck, KeyRound, ArrowLeft } from 'lucide-react';
import { sendEmailOtp, verifyEmailOtp, type UserProfile } from '../services/authService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserProfile, accessToken: string, refreshToken: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [viewMode, setViewMode] = useState<'enter_email' | 'enter_otp'>('enter_email');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [name, setName] = useState('');
  const [isExistingUser, setIsExistingUser] = useState<boolean>(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setOtpCode('');
      setName('');
      setIsExistingUser(false);
      setError(null);
      setSuccessMessage(null);
      setViewMode('enter_email');
      setResendTimer(0);
    }
  }, [isOpen]);

  useEffect(() => {
    let interval: any = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendTimer]);

  if (!isOpen) return null;

  // Request OTP from backend
  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await sendEmailOtp(cleanEmail, 'login');
      if (res.success) {
        setIsExistingUser(!!res.isExistingUser);
        setSuccessMessage(res.message || 'A 6-digit verification code has been sent to your email.');
        setViewMode('enter_otp');
        setResendTimer(60); // 60 seconds cooldown
      } else {
        setError(res.message || 'Failed to send verification code. Please try again.');
      }
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('Too many') || msg.includes('429')) {
        setError('Too many verification attempts. Please try again in a few minutes.');
      } else {
        setError(msg || 'Failed to send verification code. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP & login/signup
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const cleanOtp = otpCode.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setError('Please enter a valid 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const res = await verifyEmailOtp(email, cleanOtp, 'login', name);
      if (res.success && res.user && res.accessToken) {
        onSuccess(res.user, res.accessToken, res.refreshToken || '');
        onClose();
      } else {
        setError(res.message || 'Incorrect verification code. Please check and try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid or expired code. Please request a new OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden text-[#1F2937] flex items-center justify-center p-4">
      {/* Dark Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Main Unified Card */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-8 z-10 overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200 text-left">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Header Section */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#F7FCE8] text-[#95CD1A] flex items-center justify-center mx-auto mb-3 shadow-xs border border-[#ECF9CA]">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="font-serif-headline text-2xl font-extrabold text-[#1F2937]">
            {viewMode === 'enter_email' ? 'Sign Up / Sign In' : 'Verify Email Address'}
          </h3>
          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed max-w-xs mx-auto">
            {viewMode === 'enter_email'
              ? "We use secure email codes instead of passwords. Enter your email below to log in or create a free account instantly!"
              : `We sent a 6-digit login verification code to ${email}.`}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-600 font-semibold animate-in slide-in-from-top-1">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-lime-50 border border-lime-200 rounded-xl flex items-center gap-2 text-xs text-lime-700 font-semibold animate-in slide-in-from-top-1">
            <CheckCircle2 className="w-4.5 h-4.5 text-[#95CD1A] shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* View Mode 1: Enter Email address */}
        {viewMode === 'enter_email' && (
          <form onSubmit={handleRequestOtp} autoComplete="off" className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  name="hf_auth_email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@email.com"
                  className="w-full pl-10 pr-3.5 py-3 bg-gray-50 rounded-2xl border border-gray-200 focus:border-[#95CD1A] focus:bg-white focus:outline-none font-medium transition-all text-sm"
                />
                <Mail className="w-4.5 h-4.5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-[#95CD1A] hover:bg-[#7EB30E] text-white font-extrabold text-sm rounded-2xl transition-all shadow-md shadow-[#95CD1A]/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4.5 h-4.5" />
                    <span>Send Verification Code</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] text-gray-400 text-center font-medium pt-1">
              * Delivery address and mobile details can be saved in your profile after logging in.
            </p>
          </form>
        )}

        {/* View Mode 2: Enter Verification Code OTP */}
        {viewMode === 'enter_otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4 text-xs">
            {!isExistingUser && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full px-3.5 py-3 bg-gray-50 rounded-2xl border border-gray-200 focus:border-[#95CD1A] focus:bg-white focus:outline-none font-medium transition-all text-sm mb-1"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Enter 6-Digit Code</label>
              <div className="relative">
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  required
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full pl-10 pr-3.5 py-3 bg-gray-50 rounded-2xl border border-gray-200 focus:border-[#95CD1A] focus:bg-white focus:outline-none font-black tracking-[8px] text-center text-lg sm:text-xl font-numeric"
                />
                <KeyRound className="w-4.5 h-4.5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="pt-2 space-y-2.5">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-[#95CD1A] hover:bg-[#7EB30E] text-white font-extrabold text-sm rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4.5 h-4.5" />
                    <span>Verify & Sign In</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setViewMode('enter_email')}
                  className="text-xs font-extrabold text-gray-500 hover:text-gray-800 flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Change Email</span>
                </button>

                <button
                  type="button"
                  disabled={resendTimer > 0 || loading}
                  onClick={() => handleRequestOtp()}
                  className="text-xs font-extrabold text-[#95CD1A] hover:underline disabled:text-gray-400 disabled:no-underline cursor-pointer"
                >
                  {resendTimer > 0 ? `Resend Code (${resendTimer}s)` : 'Resend Code'}
                </button>
              </div>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
