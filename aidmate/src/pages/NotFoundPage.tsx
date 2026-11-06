import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#FFF8F5] flex flex-col items-center justify-center px-4 py-8 text-[#1A1D3E] text-center">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-100 shadow-xl flex flex-col items-center gap-4 animate-scale-in">
        <div className="w-20 h-20 rounded-full bg-[#FF6B4A]/10 text-[#FF6B4A] flex items-center justify-center animate-bounce-subtle">
          <Compass className="w-10 h-10 stroke-[2.2]" />
        </div>

        <span className="text-4xl font-black text-[#FF6B4A] tracking-wider font-mono">
          404
        </span>

        <h1 className="text-2xl font-black text-[#1A1D3E] -mt-1">
          Lost in the Neighborhood?
        </h1>

        <p className="text-xs sm:text-sm text-slate-500 max-w-xs leading-relaxed">
          The page or help request you are searching for might have been moved, completed, or does not exist.
        </p>

        <div className="w-full flex flex-col sm:flex-row items-center gap-3 mt-4">
          <Button
            type="button"
            variant="outline"
            size="md"
            fullWidth
            onClick={() => navigate(-1)}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Go Back
          </Button>

          <Button
            type="button"
            variant="primary"
            size="md"
            fullWidth
            onClick={() => navigate('/home')}
            leftIcon={<Home className="w-4 h-4" />}
          >
            Go Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
