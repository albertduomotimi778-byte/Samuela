
import React, { useEffect, useState } from 'react';
import { activateSubscription, isPremium, checkAndHandleExpiration } from '../services/premiumService';

interface Props {
  onClose: () => void;
  onSuccess?: () => void;
  forceRenewal?: boolean;
}

// Declare global for the native bridge
declare global {
    interface Window {
        onNativePremiumActive?: () => void;
    }
}

// --- REALISTIC 3D CARD COMPONENT ---
const RealisticCard = ({ size }: { size: 'small' | 'large' }) => {
  const containerClass = size === 'large' ? 'w-80 h-48' : 'w-24 h-14'; 
  const numberSize = size === 'large' ? 'text-xl tracking-[0.2em]' : 'text-[6px] tracking-widest';
  const labelSize = size === 'large' ? 'text-[9px]' : 'text-[3px]';
  const nameSize = size === 'large' ? 'text-sm' : 'text-[4px]';
  const logoSize = size === 'large' ? 'w-10 h-10' : 'w-3 h-3';
  const chipSize = size === 'large' ? 'w-11 h-8' : 'w-3 h-2';
  const padding = size === 'large' ? 'p-6' : 'p-1.5';

  return (
    <div className={`${containerClass} perspective-1000 mx-auto select-none group`}>
      <div className="relative w-full h-full preserve-3d animate-spin-y-slow shadow-2xl">
        {/* FRONT FACE */}
        <div className={`absolute inset-0 backface-hidden rounded-xl overflow-hidden bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#0f172a] border border-indigo-400/30 ${padding} flex flex-col justify-between shadow-xl z-20`}>
            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-black/40 pointer-events-none"></div>
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-500/20 blur-3xl rounded-full pointer-events-none"></div>
            <div className="flex justify-between items-start relative z-10">
                <div className={`${chipSize} bg-gradient-to-b from-yellow-200 to-yellow-600 rounded-md border border-yellow-700 relative overflow-hidden shadow-sm`}>
                    <div className="absolute top-1/2 left-0 w-full h-[1px] bg-black/20"></div>
                    <div className="absolute left-1/2 top-0 h-full w-[1px] bg-black/20"></div>
                    <div className="absolute inset-2 border border-black/10 rounded-[1px]"></div>
                </div>
                 <svg className={`${size === 'large' ? 'w-6 h-6' : 'w-3 h-3'} text-white/40`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                 </svg>
            </div>
            <div className={`font-mono text-gray-200 font-bold ${numberSize} relative z-10 drop-shadow-md flex items-center gap-2 mt-2`}>
                <span>••••</span><span>••••</span><span>••••</span><span>8892</span>
            </div>
            <div className="flex justify-between items-end relative z-10">
                <div>
                    <div className={`${labelSize} text-indigo-200 uppercase opacity-70 mb-0.5`}>Card Holder</div>
                    <div className={`${nameSize} text-white uppercase font-bold tracking-wider text-shadow-sm`}>SoulSync User</div>
                </div>
                <div className="flex -space-x-2 opacity-90">
                    <div className={`${logoSize} rounded-full bg-red-600/90 shadow-sm backdrop-blur-sm`}></div>
                    <div className={`${logoSize} rounded-full bg-yellow-500/90 shadow-sm backdrop-blur-sm`}></div>
                </div>
            </div>
        </div>
        {/* BACK FACE */}
        <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-xl overflow-hidden bg-[#0f172a] border border-white/10 flex flex-col pt-4 shadow-xl z-10">
            <div className="w-full h-[20%] bg-black mb-3 relative">
                 <div className="absolute inset-0 bg-gradient-to-b from-gray-800 to-black opacity-50"></div>
            </div>
            <div className={`px-4 flex flex-col ${size === 'large' ? 'gap-2' : 'gap-1'}`}>
                 <div className="flex items-center gap-2">
                     <div className="flex-1 h-6 bg-white/10 relative overflow-hidden">
                         <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, #fff 2px, #fff 4px)'}}></div>
                     </div>
                     <div className="bg-white text-black font-mono font-bold flex items-center justify-center px-2 h-6 rounded-sm transform -skew-x-6">
                         <span className={`${size === 'large' ? 'text-xs' : 'text-[4px]'}`}>123</span>
                     </div>
                 </div>
                 <p className={`${labelSize} text-gray-500 text-justify leading-tight opacity-70 mt-2`}>
                     Use this card for instant verification on SoulSync. Issued by Egeluo Technologies.
                 </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export const PremiumModal: React.FC<Props> = ({ onClose, onSuccess, forceRenewal }) => {
  const [stage, setStage] = useState<'landing' | 'processing' | 'waiting' | 'success'>('landing');
  const [isRenewal, setIsRenewal] = useState(false);
  const [expiryDateDisplay, setExpiryDateDisplay] = useState<string>('');

  useEffect(() => {
      if (forceRenewal || checkAndHandleExpiration()) {
          setIsRenewal(true);
      }
  }, [forceRenewal]);

  useEffect(() => {
    // 1. Listen for Web Messages
    const handleMessage = (event: MessageEvent) => {
        if (event.data === 'PAYMENT_VERIFIED' || event.data === 'PAYMENT_SUCCESS') {
            handleSuccess();
        }
    };
    
    // 2. Listen for Storage Signals (Popup writes to LocalStorage)
    const handleStorage = (e: StorageEvent) => {
        if (e.key === 'soulsync_payment_signal' || e.key === 'soulsync_license_tag' || e.key === 'soulsync_premium_status') {
            handleSuccess();
        }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
    };
  }, [stage]);

  const openPaymentPopup = () => {
      if (!navigator.onLine) {
          alert("Internet connection required for renewal.");
          return;
      }
      setStage('waiting');
      const width = 450;
      const height = 750;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;
      const features = `width=${width},height=${height},top=${top},left=${left},toolbar=no,menubar=no,location=yes,status=no,scrollbars=yes,resizable=yes`;
      
      // Open popup
      window.open('https://selar.com/csf148s0v1', 'SelarSecurePayment', features);
  };

  const handleSuccess = () => {
      if (stage === 'success') return; 
      
      // Activate 1 Month (30 Days)
      const durationMs = 30 * 24 * 60 * 60 * 1000;
      activateSubscription(durationMs); 
      
      const expiry = new Date(Date.now() + durationMs);
      setExpiryDateDisplay(expiry.toLocaleDateString(undefined, { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }));

      setStage('success');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 animate-fade-in">
      <div className="w-full max-w-md h-[90vh] md:h-[800px] bg-surface rounded-2xl shadow-2xl flex flex-col overflow-hidden relative border border-white/10 transition-colors duration-300">
        
        {stage === 'landing' && (
            <div className={`p-6 flex justify-between items-start shrink-0 ${isRenewal ? 'bg-red-900/20 border-b border-red-900/30' : 'bg-gradient-to-b from-surface to-darker'}`}>
                <div>
                    <h2 className={`text-2xl font-serif font-bold tracking-tight ${isRenewal ? 'text-red-400' : 'text-txt'}`}>
                        {isRenewal ? 'Subscription Expired' : 'SoulSync Premium'}
                    </h2>
                    <p className={`text-sm mt-1 ${isRenewal ? 'text-red-300/70' : 'text-muted'}`}>
                        {isRenewal ? 'Renew to regain access to your neural data.' : 'Unlock the full potential of your AI.'}
                    </p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-muted hover:text-txt">
                    ✕
                </button>
            </div>
        )}

        <div className="flex-1 relative overflow-hidden flex flex-col bg-darker">
            {stage === 'landing' && (
                <div className="h-full flex flex-col overflow-y-auto custom-scrollbar">
                    <div className="flex-1 p-6 space-y-6">
                        <div className="space-y-3">
                            <div className="p-4 rounded-xl bg-surface border border-white/10 flex gap-4 items-center group hover:border-primary/50 transition-all shadow-sm">
                                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-on-primary shadow-[0_0_15px_rgba(99,102,241,0.5)] shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="font-bold text-txt text-base">Create Unlimited Bots</h4>
                                    <p className="text-xs text-muted">No limits. Design 100+ unique AI personalities.</p>
                                </div>
                            </div>
                            <div className="p-4 rounded-xl bg-surface border border-white/10 flex gap-4 items-center group hover:border-secondary/50 transition-all shadow-sm">
                                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-on-primary shadow-[0_0_15px_rgba(168,85,247,0.5)] shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="font-bold text-txt text-base">Import Unlimited Bots</h4>
                                    <p className="text-xs text-muted">Download and load any character file seamlessly.</p>
                                </div>
                            </div>
                        </div>
                         <div className="mt-6 p-4 bg-gray-900 border border-yellow-600/50 rounded-xl relative overflow-hidden group shadow-[0_0_15px_rgba(234,179,8,0.1)]">
                             <div className="absolute inset-0 bg-yellow-500/5 group-hover:bg-yellow-500/10 transition-all"></div>
                             <div className="relative flex items-center gap-4">
                                 <div className="shrink-0 scale-75 transform -translate-x-2">
                                     <RealisticCard size="small" />
                                 </div>
                                 <div className="flex-1">
                                     <p className="text-[10px] uppercase font-bold text-yellow-400 mb-1 flex items-center gap-1">
                                         <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse shadow-[0_0_8px_rgba(250,204,21,0.8)]"></span>
                                         Faster Approval
                                     </p>
                                     <p className="text-xs text-yellow-100 leading-snug">
                                         Bank transfers are slow. Use your <span className="font-bold text-white underline decoration-yellow-400 decoration-2 underline-offset-2">ATM Card</span> for instant activation.
                                     </p>
                                 </div>
                             </div>
                         </div>
                    </div>
                    <div className="bg-surface p-6 border-t border-white/5">
                        <div className="flex justify-between items-end mb-4">
                            <div>
                                <p className="text-xs text-muted uppercase tracking-wider mb-1">Monthly Plan</p>
                                <div className="text-3xl font-serif text-txt">$4.99</div>
                            </div>
                            <div className="text-right">
                                <span className="text-xs text-muted line-through block">$9.99</span>
                                <span className="text-xs text-secondary font-bold">50% OFF</span>
                            </div>
                        </div>
                        <button 
                            onClick={openPaymentPopup}
                            className={`w-full py-4 text-on-primary font-bold rounded-xl shadow-lg hover:opacity-90 transition-transform active:scale-95 mb-4 
                            ${isRenewal ? 'bg-gradient-to-r from-red-600 to-rose-600' : 'bg-gradient-to-r from-primary to-secondary'}`}
                        >
                            {isRenewal ? 'Renew Subscription' : 'Upgrade to Premium'}
                        </button>
                    </div>
                </div>
            )}

            {stage === 'waiting' && (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#020617]">
                     <span className="text-4xl mb-6 animate-bounce">🔒</span>
                     <h3 className="text-xl font-bold text-white mb-2">Awaiting Verification</h3>
                     <p className="text-sm text-gray-400 mb-8">
                         A secure payment window has opened.<br/>
                         Complete the payment to unlock instantly.
                     </p>
                     <div className="p-4 bg-white/5 rounded-lg border border-white/5 w-full">
                         <p className="text-xs text-gray-400 mb-2">Window didn't open?</p>
                         <button onClick={openPaymentPopup} className="text-xs text-primary hover:text-secondary underline">Click here to retry</button>
                     </div>
                </div>
            )}

            {stage === 'success' && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#020617] relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/20 to-black pointer-events-none"></div>
                    <div className="absolute -top-20 -left-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none"></div>
                    
                    <div className="relative z-10 w-full max-w-sm bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-8 flex flex-col items-center shadow-2xl animate-fade-in-up">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-[0_0_20px_rgba(52,211,153,0.4)] mb-6">
                            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>

                        <h2 className="text-2xl font-bold text-white mb-2 text-center">Payment Confirmed</h2>
                        <p className="text-gray-400 text-sm mb-6 text-center">Thank you for subscribing.</p>

                        <div className="w-full bg-white/5 rounded-xl p-4 border border-white/5 space-y-3 mb-8">
                            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest text-center mb-1">Subscription Activated</p>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">Plan</span>
                                <span className="text-white font-bold">1 Month Premium</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">Status</span>
                                <span className="text-emerald-400 font-bold uppercase text-xs tracking-wider border border-emerald-400/30 px-2 py-0.5 rounded bg-emerald-900/20">Active</span>
                            </div>
                            <div className="h-px bg-white/10 my-2"></div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">Expires</span>
                                <span className="text-indigo-300 font-mono text-[10px] sm:text-xs text-right">{expiryDateDisplay}</span>
                            </div>
                        </div>

                        <button 
                            onClick={() => {
                                if (onSuccess) onSuccess();
                                onClose();
                            }}
                            className="w-full py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors shadow-lg transform active:scale-95"
                        >
                            Continue to App
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
