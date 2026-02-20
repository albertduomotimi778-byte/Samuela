
import React, { useState, useEffect } from 'react';
import { checkDevPassword } from '../services/premiumService';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export const DevUnlockModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [animationStage, setAnimationStage] = useState(0);

  // Animation sequence for success
  useEffect(() => {
    if (isSuccess) {
        const timers: ReturnType<typeof setTimeout>[] = [];

        timers.push(setTimeout(() => setAnimationStage(1), 100)); // Blackout start
        timers.push(setTimeout(() => setAnimationStage(2), 800)); // Access Granted
        timers.push(setTimeout(() => setAnimationStage(3), 2000)); // Background Bloom
        timers.push(setTimeout(() => setAnimationStage(4), 2500)); // Main Title
        timers.push(setTimeout(() => setAnimationStage(5), 3500)); // CEO Title
        timers.push(setTimeout(() => setAnimationStage(6), 4500)); // Creator Title
        
        // Final Action - call onSuccess instead of reload
        timers.push(setTimeout(() => {
            onSuccess(); 
            onClose();   
        }, 5500)); 

        return () => timers.forEach(clearTimeout);
    }
  }, [isSuccess, onClose, onSuccess]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (checkDevPassword(password)) {
        setIsSuccess(true);
    } else {
        setError(true);
        setTimeout(() => setError(false), 1000);
        setPassword('');
    }
  };

  if (isSuccess) {
      return (
          <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center p-8 overflow-hidden cursor-none select-none">
              <div className={`absolute inset-0 bg-gradient-to-br from-[#020617] via-[#1e1b4b] to-[#312e81] transition-opacity duration-[2000ms] ${animationStage >= 3 ? 'opacity-100' : 'opacity-0'}`}></div>
              <div className={`absolute z-20 font-mono text-emerald-400 text-sm tracking-[0.5em] uppercase border border-emerald-500/30 px-4 py-2 rounded bg-black/50 backdrop-blur transition-all duration-700 ${animationStage === 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>Access Granted</div>
              <div className="relative z-30 text-center space-y-6">
                  <h1 className={`text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-indigo-200 tracking-tight transition-all duration-[1500ms] ease-out transform ${animationStage >= 4 ? 'opacity-100 translate-y-0 filter-none' : 'opacity-0 translate-y-10 blur-sm'}`}>Welcome,<br/>Albert Samuel Duomotimi</h1>
                  <div className={`flex flex-col items-center gap-2 transition-all duration-[1500ms] ease-out ${animationStage >= 5 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                      <div className="h-px w-24 bg-gradient-to-r from-transparent via-indigo-400 to-transparent"></div>
                      <p className="text-sm md:text-base font-sans tracking-[0.2em] text-indigo-200 uppercase font-medium">CEO of Egeluo Technologies</p>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="fixed inset-0 z-[999] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-fade-in font-mono">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-[#0a0a0a] border border-[#1f1f1f] p-8 rounded-none shadow-[0_0_50px_rgba(0,0,0,0.8)] relative">
          <div className="flex justify-between items-center mb-8 border-b border-[#1f1f1f] pb-4">
              <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-900/50"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-900/50"></div>
                  <div className="w-3 h-3 rounded-full bg-green-900/50"></div>
              </div>
              <span className="text-[10px] text-gray-600 uppercase tracking-widest">Secure Terminal</span>
          </div>
          <div className="text-center mb-8">
            <h2 className="text-gray-200 text-sm tracking-[0.2em] uppercase font-bold">Identity Verification</h2>
          </div>
          <div className="relative group mb-8">
            <input 
                type="password" 
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full bg-black border text-center text-white py-4 px-4 focus:outline-none tracking-[0.5em] text-xl transition-all ${error ? 'border-red-500/50 text-red-500 shadow-[0_0_15px_rgba(220,38,38,0.1)]' : 'border-[#333] focus:border-indigo-500/50 focus:shadow-[0_0_15px_rgba(99,102,241,0.1)]'}`}
                placeholder="ACCESS KEY"
            />
            {error && <p className="absolute -bottom-6 left-0 right-0 text-center text-[10px] text-red-500 tracking-wider">INVALID CREDENTIALS</p>}
          </div>
          <div className="flex justify-between items-center mt-8">
            <button type="button" onClick={onClose} className="text-[10px] text-gray-500 hover:text-gray-300 uppercase tracking-widest transition-colors flex items-center gap-1"><span className="text-lg">←</span> Abort</button>
            <button type="submit" className="text-[10px] bg-white/5 hover:bg-white/10 text-gray-300 px-4 py-2 border border-white/5 uppercase tracking-widest transition-colors">Authenticate</button>
          </div>
      </form>
    </div>
  );
};
