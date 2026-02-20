
import React, { useState } from 'react';
import { themes, applyTheme, getSavedTheme, ThemeId } from '../services/themeService';

interface Props {
  onClose: () => void;
}

export const SettingsModal: React.FC<Props> = ({ onClose }) => {
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(getSavedTheme());
  const [isResetting, setIsResetting] = useState(false);

  const handleThemeSelect = (id: ThemeId) => {
    applyTheme(id);
    setCurrentTheme(id);
  };

  const handleResetApp = async () => {
      if (window.confirm("Force update the app? Your chats are safe. This clears old cached files.")) {
          setIsResetting(true);
          if ('serviceWorker' in navigator) {
              const registrations = await navigator.serviceWorker.getRegistrations();
              for (const registration of registrations) await registration.unregister();
          }
          if ('caches' in window) {
              const keys = await caches.keys();
              await Promise.all(keys.map(key => caches.delete(key)));
          }
          window.location.reload();
      }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-surface border border-white/10 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-5 border-b border-white/10 bg-darker/50 flex justify-between items-center">
            <h2 className="text-xl font-bold text-txt">Settings</h2>
            <button onClick={onClose} className="text-muted hover:text-txt">✕</button>
        </div>
        <div className="p-6 overflow-y-auto custom-scrollbar">
            <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-4">Appearance</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                {themes.map(theme => (
                    <button 
                        key={theme.id}
                        onClick={() => handleThemeSelect(theme.id)}
                        className={`relative flex items-center p-3 rounded-xl border-2 transition-all ${currentTheme === theme.id ? 'border-primary bg-primary/10' : 'border-white/5 bg-dark'}`}
                    >
                        <div className="w-10 h-10 rounded-full mr-3 overflow-hidden relative border border-white/10">
                             <div className="absolute inset-0" style={{ backgroundColor: theme.colors.darker }}></div>
                             <div className="absolute top-0 left-0 w-1/2 h-1/2 rounded-br-full" style={{ backgroundColor: theme.colors.primary }}></div>
                        </div>
                        <div className="flex-1 text-left min-w-0">
                            <h4 className="font-bold text-txt text-sm truncate">{theme.name}</h4>
                        </div>
                    </button>
                ))}
            </div>

            <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-4">System</h3>
            <div className="bg-white/5 p-4 rounded-xl mb-8">
                 <p className="text-sm text-white font-medium">SoulSync Free & Unlimited</p>
                 <p className="text-[10px] text-gray-500">Full access enabled.</p>
            </div>

            <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-4">Maintenance</h3>
            <div className="bg-red-900/10 border border-red-500/20 p-4 rounded-xl">
                 <p className="text-xs text-gray-400 mb-3">If changes aren't showing, click below to force a refresh.</p>
                 <button 
                    onClick={handleResetApp}
                    disabled={isResetting}
                    className="w-full py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/50 text-red-300 rounded-lg text-xs font-bold uppercase"
                 >
                    {isResetting ? "Updating..." : "Force Update & Reset Cache"}
                 </button>
            </div>
        </div>
        <div className="p-4 bg-darker/50 text-center border-t border-white/10">
            <p className="text-[10px] text-muted">SoulSync v1.2.5 • Full Offline Access</p>
        </div>
      </div>
    </div>
  );
};
