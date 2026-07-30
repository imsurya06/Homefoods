import React, { useState } from 'react';
import { X, Lock, Mail, AlertCircle, CheckCircle2, ShieldCheck, Eye, EyeOff, KeyRound, ArrowLeft } from 'lucide-react';
import { loginOrSignupCustomer, sendForgotPasswordOtp, resetPasswordWithOtp, type UserProfile } from '../services/authService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [viewMode, setViewMode] = useState<'login' | 'forgot_request' | 'forgot_verify'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handler for regular Login / Signup
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email.trim() || !password.trim()) {
      setError('Please enter both your email address and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await loginOrSignupCustomer(email, password);
      if (res.success && res.user) {
        onSuccess(res.user);
        onClose();
      } else {
        setError('Authentication failed. Please check your email and password.');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handler for requesting OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await sendForgotPasswordOtp(email);
      if (res.success) {
        setSuccessMessage(res.message || '6-Digit OTP sent to your email.');
        setViewMode('forgot_verify');
      } else {
        setError(res.message || 'Failed to send OTP.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  // Handler for verifying OTP & setting new password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!otpCode.trim() || !password.trim()) {
      setError('Please enter the 6-digit OTP code and your new password.');
      return;
    }

    setLoading(true);
    try {
      const res = await resetPasswordWithOtp(email, otpCode, password);
      if (res.success && res.user) {
        onSuccess(res.user);
        onClose();
      } else {
        setError('Invalid OTP code or password reset failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid OTP code. Please check and try again.');
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
            {viewMode === 'login' ? <ShieldCheck className="w-6 h-6" /> : <KeyRound className="w-6 h-6" />}
          </div>
          <h3 className="font-serif-headline text-2xl font-extrabold text-[#1F2937]">
            {viewMode === 'login' ? 'Login / Signup' : 'Reset Password with OTP'}
          </h3>
          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed max-w-xs mx-auto">
            {viewMode === 'login'
              ? "Enter your email and password below. If an account exists, you will be logged in; otherwise, a new account will be created automatically!"
              : "We will send a 6-digit verification OTP code to your email to securely reset your password."}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-600 font-semibold">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-lime-50 border border-lime-200 rounded-xl flex items-center gap-2 text-xs text-lime-700 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-[#95CD1A] shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* View Mode 1: Regular Login / Signup */}
        {viewMode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@email.com"
                  className="w-full pl-10 pr-3.5 py-3 bg-gray-50 rounded-2xl border border-gray-200 focus:border-[#95CD1A] focus:bg-white focus:outline-none font-medium transition-all text-sm"
                />
                <Mail className="w-4.5 h-4.5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 bg-gray-50 rounded-2xl border border-gray-200 focus:border-[#95CD1A] focus:bg-white focus:outline-none font-medium transition-all text-sm"
                />
                <Lock className="w-4.5 h-4.5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1 transition-colors cursor-pointer"
                  title={showPassword ? 'Hide Password' : 'Show Password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-[#95CD1A]" />
                  ) : (
                    <Eye className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
              <div className="flex justify-end mt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setSuccessMessage(null);
                    setViewMode('forgot_request');
                  }}
                  className="text-[11px] font-extrabold text-[#95CD1A] hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
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
                    <span>Continue with Login / Signup</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] text-gray-400 text-center font-medium pt-1">
              * Address and mobile number will be asked when you checkout items in your cart.
            </p>
          </form>
        )}

        {/* View Mode 2: Request OTP */}
        {viewMode === 'forgot_request' && (
          <form onSubmit={handleSendOtp} className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Your Account Email</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@email.com"
                  className="w-full pl-10 pr-3.5 py-3 bg-gray-50 rounded-2xl border border-gray-200 focus:border-[#95CD1A] focus:bg-white focus:outline-none font-medium transition-all text-sm"
                />
                <Mail className="w-4.5 h-4.5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-[#95CD1A] hover:bg-[#7EB30E] text-white font-extrabold text-sm rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <KeyRound className="w-4.5 h-4.5" />
                    <span>Send 6-Digit OTP</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setViewMode('login')}
                className="w-full py-2.5 text-xs font-extrabold text-gray-500 hover:text-gray-800 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Login / Signup</span>
              </button>
            </div>
          </form>
        )}

        {/* View Mode 3: Enter OTP & New Password */}
        {viewMode === 'forgot_verify' && (
          <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Enter 6-Digit OTP Code</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="e.g. 123456"
                  className="w-full pl-10 pr-3.5 py-3 bg-gray-50 rounded-2xl border border-gray-200 focus:border-[#95CD1A] focus:bg-white focus:outline-none font-black tracking-widest text-center text-base"
                />
                <KeyRound className="w-4.5 h-4.5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Enter New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full pl-10 pr-10 py-3 bg-gray-50 rounded-2xl border border-gray-200 focus:border-[#95CD1A] focus:bg-white focus:outline-none font-medium transition-all text-sm"
                />
                <Lock className="w-4.5 h-4.5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4 text-[#95CD1A]" /> : <Eye className="w-4 h-4 text-gray-400" />}
                </button>
              </div>
            </div>

            <div className="pt-2 space-y-2">
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
                    <span>Verify OTP & Reset Password</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setViewMode('login')}
                className="w-full py-2.5 text-xs font-extrabold text-gray-500 hover:text-gray-800 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Login / Signup</span>
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
