import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { HeartHandshake, Sparkles, Shield, Users, Clock, ArrowRight } from 'lucide-react';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { signInWithPhone } = useAuth();
  const { addToast } = useToast();

  const [rawPhone, setRawPhone] = useState('');
  const [fullPhone, setFullPhone] = useState('');
  const [isValidPhone, setIsValidPhone] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePhoneChange = (number: string, fullNumber: string, isValid: boolean) => {
    setRawPhone(number);
    setFullPhone(fullNumber);
    setIsValidPhone(isValid);
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPhone || !fullPhone) {
      setError('Please enter a valid phone number to continue.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await signInWithPhone(fullPhone);
      addToast('success', 'OTP Sent!', `A 6-digit verification code was sent to ${fullPhone}`);
      navigate('/verify-otp', { state: { phoneNumber: fullPhone } });
    } catch (err: unknown) {
      console.error('[LoginPage] Sign in error:', err);
      const message =
        err instanceof Error ? err.message : 'Unable to send verification code. Please try again.';
      setError(message);
      addToast('error', 'Failed to send OTP', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFF8F5] via-[#FFFDFC] to-white flex flex-col justify-between px-4 sm:px-6 py-8">
      {/* Invisible reCAPTCHA container required by Firebase Phone Auth */}
      <div id="recaptcha-container" />

      {/* Top Header / Branding */}
      <header className="w-full max-w-md mx-auto flex flex-col items-center text-center pt-4 sm:pt-8 animate-fade-in">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#FF6B4A] to-[#FF8E75] flex items-center justify-center text-white shadow-lg shadow-[#FF6B4A]/30">
            <HeartHandshake className="w-7 h-7 stroke-[2.2]" />
          </div>
          <span className="text-3xl font-black tracking-tight text-[#1A1D3E]">
            Aid<span className="text-[#FF6B4A]">mate</span>
          </span>
        </div>
        <p className="text-sm font-medium text-[#1A1D3E]/70 tracking-wide">
          A little help goes a long way.
        </p>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-md mx-auto my-auto py-6 sm:py-8 flex flex-col items-center">
        {/* Warm Graphic / Illustration Area */}
        <div className="w-full relative h-48 sm:h-52 rounded-3xl bg-gradient-to-tr from-[#FF6B4A]/10 via-[#FFF0EB] to-[#F8F9FE] border border-[#FF6B4A]/15 overflow-hidden flex items-center justify-center p-6 shadow-sm mb-8 animate-scale-in">
          {/* Subtle decorative background circles */}
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-[#FF6B4A]/10 blur-xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-[#1A1D3E]/5 blur-xl pointer-events-none" />

          {/* Floating Community Feature Badges */}
          <div className="flex flex-col items-center gap-3 z-10 text-center">
            <div className="flex items-center gap-2 bg-white/90 backdrop-blur px-3.5 py-1.5 rounded-full shadow-sm border border-slate-100 text-xs font-semibold text-[#1A1D3E]">
              <Sparkles className="w-3.5 h-3.5 text-[#FF6B4A]" />
              <span>Hyperlocal Community Network</span>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 bg-white/80 px-2.5 py-1 rounded-xl shadow-xs border border-slate-100">
                <Shield className="w-3 h-3 text-[#22C55E]" /> Verified Helpers
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 bg-white/80 px-2.5 py-1 rounded-xl shadow-xs border border-slate-100">
                <Clock className="w-3 h-3 text-[#FF6B4A]" /> Instant Dispatch
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 bg-white/80 px-2.5 py-1 rounded-xl shadow-xs border border-slate-100">
                <Users className="w-3 h-3 text-blue-500" /> People for People
              </span>
            </div>

            <p className="text-xs text-[#1A1D3E]/60 max-w-xs mt-1">
              Connect with nearby neighbors to get everyday tasks done or offer a helping hand.
            </p>
          </div>
        </div>

        {/* Login Form Box */}
        <div className="w-full bg-white rounded-3xl p-6 sm:p-7 shadow-[0_8px_30px_rgb(26,29,62,0.06)] border border-slate-100">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-[#1A1D3E]">Welcome to Aidmate</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Enter your mobile number to sign in or create an account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <PhoneInput
              label="Mobile Number"
              value={rawPhone}
              defaultCountry="IN"
              onChange={handlePhoneChange}
              error={error || undefined}
              helperText="We'll send a 6-digit OTP verification code via SMS"
              disabled={isLoading}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isLoading}
              loadingText="Sending OTP..."
              rightIcon={<ArrowRight className="w-4 h-4" />}
              disabled={!isValidPhone || isLoading}
            >
              Continue
            </Button>
          </form>
        </div>
      </main>

      {/* Footer Legal Terms */}
      <footer className="w-full max-w-md mx-auto text-center text-xs text-slate-400 py-4 animate-fade-in">
        By continuing, you agree to Aidmate&apos;s{' '}
        <Link to="/terms" className="text-[#1A1D3E] underline font-medium hover:text-[#FF6B4A] transition-colors">
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link to="/privacy" className="text-[#1A1D3E] underline font-medium hover:text-[#FF6B4A] transition-colors">
          Privacy Policy
        </Link>
        .
      </footer>
    </div>
  );
};

export default LoginPage;
