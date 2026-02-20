
import React, { useEffect, useState } from 'react';

interface Props {
  onComplete: () => void;
}

export const IntroAnimation: React.FC<Props> = ({ onComplete }) => {
  const [stage, setStage] = useState(0);
  const [showOfflinePrompt, setShowOfflinePrompt] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    
    // Timeline in ms:
    // 0: Start
    // 500: Logo Reveal
    // 1500: Text Reveal + Download Start
    // 4000: Cache Complete / System Ready (Pause here for user interaction)

    timers.push(setTimeout(() => setStage(1), 500)); 
    timers.push(setTimeout(() => setStage(2), 1500)); 
    timers.push(setTimeout(() => setStage(3), 4000)); // Shows "Initialize" button

    return () => timers.forEach(clearTimeout);
  }, []);

  const handleEnter = async () => {
      // 1. Set Persistent Flag for "Sticky" Fullscreen
      sessionStorage.setItem('soul_fullscreen_mode', 'true');

      // 2. Force Fullscreen (Requires User Gesture)
      try {
          if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
          }
          
          // 3. Lock Orientation (Mobile)
          if (screen.orientation && 'lock' in screen.orientation) {
              // @ts-ignore
              screen.orientation.lock('portrait').catch(() => {});
          }

          // 4. Request Wake Lock (Keep Screen On)
          if ('wakeLock' in navigator) {
              // @ts-ignore
              navigator.wakeLock.request('screen').catch(() => {});
          }

      } catch (err) {
          console.log("Fullscreen/WakeLock denied or not supported", err);
      }

      // 5. Show Offline Prompt
      setStage(4); // Move to fading out state
      setShowOfflinePrompt(true);

      // 6. Complete after showing prompt
      setTimeout(() => {
          onComplete();
      }, 3500); // Give user 3.5s to read the offline message
  };

  return (
    <div className={`fixed inset-0 z-[9999] bg-[#020617] flex flex-col items-center justify-center transition-opacity duration-1000 ease-in-out ${stage === 4 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-900/10 rounded-full blur-[120px] transition-all duration-3000 ${stage >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}></div>
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(white 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      </div>

      <div className="relative z-10 flex flex-col items-center">
        {/* Animated Logo Icon */}
        <div className={`mb-8 relative transition-all duration-1000 cubic-bezier(0.34, 1.56, 0.64, 1) transform ${stage >= 1 ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-0 translate-y-10'}`}>
             <div className="w-24 h-24 relative flex items-center justify-center">
                <div className="absolute inset-0 border border-indigo-500/30 rounded-full animate-[spin_10s_linear_infinite]"></div>
                <div className="absolute inset-2 border border-purple-500/30 rounded-full animate-[spin_8s_linear_infinite_reverse]"></div>
                <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl animate-pulse"></div>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white drop-shadow-[0_0_15px_rgba(168,85,247,0.8)] relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <div className="absolute inset-0 animate-[spin_3s_linear_infinite]">
                    <div className="w-1.5 h-1.5 bg-white rounded-full absolute top-0 left-1/2 -translate-x-1/2 -translate-y-0.5 shadow-[0_0_10px_white]"></div>
                </div>
             </div>
        </div>

        {/* Text Logo */}
        <div className="overflow-hidden mb-2">
            <h1 className={`text-6xl md:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-white to-purple-300 transition-all duration-1000 transform ${stage >= 2 ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
            SoulSync
            </h1>
        </div>

        {/* Subtitle / Status / Button */}
        <div className={`flex flex-col items-center space-y-6 transition-all duration-1000 delay-300 ${stage >= 2 ? 'opacity-100' : 'opacity-0'}`}>
            
            {stage < 3 ? (
                <>
                    <div className="h-px w-24 bg-gradient-to-r from-transparent via-indigo-500 to-transparent"></div>
                    <p className="text-xs font-mono text-indigo-300/80 tracking-[0.4em] uppercase">
                        Downloading Core Assets...
                    </p>
                    {/* Loading Bar */}
                    <div className={`mt-4 w-64 h-0.5 bg-gray-900 rounded-full overflow-hidden transition-all duration-500 opacity-100 max-w-xs`}>
                        <div className={`h-full bg-gradient-to-r from-indigo-500 to-purple-500 w-full origin-left animate-[loading_2.5s_ease-in-out_forwards]`}></div>
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center gap-4 animate-fade-in-up">
                    <p className="text-xs font-mono text-green-400 tracking-[0.2em] uppercase mb-2">
                        System Ready
                    </p>
                    <button 
                        onClick={handleEnter}
                        className="group relative px-8 py-4 bg-transparent overflow-hidden rounded-full transition-all hover:scale-105 active:scale-95"
                    >
                        <div className="absolute inset-0 border border-white/20 rounded-full group-hover:border-white/50 transition-colors"></div>
                        <div className="absolute inset-0 bg-white/5 group-hover:bg-white/10 blur-xl"></div>
                        <span className="relative z-10 text-white font-bold tracking-[0.2em] text-sm group-hover:text-shadow-lg transition-all">
                            INITIALIZE INTERFACE
                        </span>
                    </button>
                </div>
            )}
        </div>
      </div>

      {/* OFFLINE PROMPT TOAST */}
      {showOfflinePrompt && (
          <div className="fixed top-10 left-0 right-0 z-[10000] flex justify-center animate-fade-in-up">
              <div className="bg-emerald-900/80 backdrop-blur-md border border-emerald-500/50 text-emerald-100 px-6 py-4 rounded-xl shadow-[0_0_30px_rgba(16,185,129,0.3)] flex items-center gap-4 max-w-sm mx-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 animate-pulse">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
                      </svg>
                  </div>
                  <div>
                      <h4 className="font-bold text-sm uppercase text-emerald-300">Offline Mode Ready</h4>
                      <p className="text-xs opacity-90 leading-tight">System cached. You may now turn off your internet for total privacy.</p>
                  </div>
              </div>
          </div>
      )}
      
      {/* Version Footer */}
      <div className={`absolute bottom-10 text-[10px] text-gray-700 font-mono transition-opacity duration-1000 ${stage >= 2 ? 'opacity-100' : 'opacity-0'}`}>
         SECURE CONNECTION // LOCAL_DEVICE_STORAGE
      </div>

      <style>{`
        @keyframes loading {
            0% { transform: scaleX(0); }
            50% { transform: scaleX(0.7); }
            100% { transform: scaleX(1); }
        }
      `}</style>
    </div>
  );
};
