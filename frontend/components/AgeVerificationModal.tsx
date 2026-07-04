import React, { useEffect } from 'react';
import { Users, CheckCircle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { UI } from '../constants/i18n';

interface AgeVerificationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onReject: () => void;
}

/** 进入地图前的社区准则确认 */
const AgeVerificationModal: React.FC<AgeVerificationModalProps> = ({ isOpen, onConfirm, onReject }) => {
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="bg-gradient-to-br from-violet-500 to-fuchsia-500 p-8 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <Users className="w-16 h-16 mx-auto mb-4 relative z-10 drop-shadow-lg" />
          <h2 className="text-2xl font-black relative z-10">{UI.appName}</h2>
          <p className="text-violet-100 mt-2 font-medium relative z-10">{UI.ageGateSubtitle}</p>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <p className="text-gray-700 leading-relaxed text-center">
              {UI.ageGateBody}
            </p>
            <div className="bg-violet-50 border-l-4 border-violet-500 p-4 rounded-r-lg">
              <p className="text-sm text-violet-900 font-bold">
                {UI.ageGateSafety}
              </p>
            </div>
          </div>

          <div className="text-center text-xs text-gray-400">
            继续即表示你同意我们的{' '}
            <Link
              to="/terms"
              className="text-violet-600 hover:underline font-bold flex items-center justify-center gap-1 mt-1"
            >
              {UI.communityGuidelines} <ExternalLink size={12} />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <button
              onClick={onReject}
              className="py-3.5 px-4 rounded-xl border-2 border-gray-200 text-gray-500 font-bold hover:bg-gray-50 hover:border-gray-300 transition-all"
            >
              {UI.leave}
            </button>
            <button
              onClick={onConfirm}
              className="py-3.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle size={20} />
              {UI.continue}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgeVerificationModal;
