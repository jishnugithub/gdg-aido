import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { OTPInput } from '@/components/ui/OTPInput';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

export const VerifyOTPPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyOTP, signInWithPhone } = useAuth();
  const { addToast } = useToast();

  const phoneNumber: string = (location.state as { phoneNumber?: string })?.phoneNumber || '';

  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async (codeToVerify?: string) => {
    const code = codeToVerify || otp;
    if (code.length < 6) {
      setError('Please enter all 6 digits.');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const userCredential = await verifyOTP(code);
      addToast('success', 'Phone Verified', 'Welcome to Aidmate!');

      // Check if user has an existing profile or needs to register
      // userCredential?.user will trigger AuthContext onAuthStateChanged
      navigate('/home');
    } catch (err: unknown) {
      console.error('[VerifyOTPPage] Verification failed:', err);
      const message =
        err instanceof Error ? err.message : 'Invalid verification code. Please try again.';
      setError(message);
      addToast('error', 'Verification Failed', message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!phoneNumber) {
      setError('Missing phone number to resend OTP.');
      return;
    }

    try {
      await signInWithPhone(phoneNumber);
      addToast('info', 'Code Resent', `A fresh 6-digit code was sent to ${phoneNumber}`);
      setError(null);
    } catch (err: unknown) {
      console.error('[VerifyOTPPage] Resend failed:', err);
      const msg = err instanceof Error ? err.message : 'Failed to resend code';
      addToast('error', 'Resend Error', msg);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFF8F5] via-[#FFFDFC] to-white flex flex-col justify-between px-4 sm:px-6 py-8">
      {/* Invisible reCAPTCHA container for resend */}
      <div id="recaptcha-container" />

      {/* Top Nav / Back Button */}
      <div className="w-full max-w-md mx-auto flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1A1D3E] hover:text-[#FF6B4A] transition-colors py-2 px-3 rounded-xl bg-white border border-slate-200/80 shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Change Number</span>
        </button>
      </div>

      {/* Center Form Card */}
      <main className="w-full max-w-md mx-auto my-auto py-6 flex flex-col items-center">
        <div className="w-full bg-white rounded-3xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(26,29,62,0.06)] border border-slate-100 flex flex-col items-center text-center">
          {/* Security Badge Icon */}
          <div className="w-14 h-14 rounded-2xl bg-[#FF6B4A]/10 text-[#FF6B4A] flex items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8 stroke-[2.2]" />
          </div>

          <h1 className="text-2xl font-bold text-[#1A1D3E]">Verify Your Number</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xs">
            We sent a 6-digit verification code to
          </p>
          <span className="font-bold text-sm text-[#1A1D3E] bg-slate-100 px-3 py-1 rounded-full mt-1.5 font-mono">
            {phoneNumber || 'your phone'}
          </span>

          {/* 6-Digit OTP Input */}
          <div className="my-8 w-full flex justify-center">
            <OTPInput
              length={6}
              value={otp}
              onChange={(code) => {
                setOtp(code);
                if (error) setError(null);
              }}
              onComplete={(code) => handleVerify(code)}
              error={error || undefined}
              expirySeconds={30}
              onResend={handleResend}
              disabled={isVerifying}
              autoFocus
            />
          </div>

          {/* Manual Verify Button */}
          <Button
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isVerifying}
            loadingText="Verifying..."
            onClick={() => handleVerify()}
            disabled={otp.length !== 6 || isVerifying}
            rightIcon={<CheckCircle2 className="w-4 h-4" />}
          >
            Verify & Proceed
          </Button>

          {/* Alternative Link */}
          <p className="text-xs text-slate-400 mt-6">
            Wrong phone number?{' '}
            <Link to="/login" className="text-[#FF6B4A] font-semibold hover:underline">
              Enter again
            </Link>
          </p>
        </div>
      </main>

      {/* Footer support */}
      <footer className="w-full max-w-md mx-auto text-center text-xs text-slate-400 py-2">
        Having trouble?{' '}
        <Link to="/support" className="text-[#1A1D3E] underline font-medium hover:text-[#FF6B4A]">
          Contact Support
        </Link>
      </footer>
    </div>
  );
};

export default VerifyOTPPage;
