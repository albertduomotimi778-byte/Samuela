
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { PersonaProfile } from '../types';
import { getPremiumStatusText, isDeveloperMode, disableDeveloperMode } from '../services/premiumService';

interface Props {
  personas: PersonaProfile[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAddClick: () => void;
  onImportClick?: () => void;
  onDelete: (ids: string[]) => void;
  onDevTrigger: () => void;
  onSettingsClick: () => void;
  onPremiumChange: () => void;
  onOpenPremiumModal: (isRenewalTest?: boolean) => void;
}

const ChatList: React.FC<Props> = ({ personas, activeId, onSelect, onAddClick, onImportClick, onDelete, onDevTrigger, onSettingsClick, onPremiumChange, onOpenPremiumModal }) => {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Dev Trigger Logic
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
      const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
      document.addEventListener('fullscreenchange', handleFsChange);
      return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []); 

  const handleLogoClick = () => {
      tapCountRef.current += 1;
      
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      
      tapTimerRef.current = setTimeout(() => {
          tapCountRef.current = 0;
      }, 2000);

      if (tapCountRef.current >= 5) {
          if (isDeveloperMode()) {
               disableDeveloperMode();
               onPremiumChange(); // Updates parent state without reload
               window.notify("Developer Mode Deactivated", "info");
          } else {
               onDevTrigger();
          }
          tapCountRef.current = 0;
      }
  };

  const handleExitFullscreen = () => {
      if (document.fullscreenElement) {
          document.exitFullscreen().catch(err => console.error(err));
      }
  };

  const isSelectionMode = selectedIds.size > 0;
  
  // OPTIMIZATION: Memoize filter to prevent recalculation on every render
  const filtered = useMemo(() => {
      if (!search) return personas;
      return personas.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  }, [personas, search]);

  const startLongPress = (id: string) => {
    longPressTriggeredRef.current = false; 
    longPressTimerRef.current = setTimeout(() => {
        longPressTriggeredRef.current = true; 
        const newSet = new Set(selectedIds);
        newSet.add(id);
        setSelectedIds(newSet);
        if (navigator.vibrate) navigator.vibrate(50); 
    }, 600); 
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
    }
  };

  const handleItemClick = (id: string) => {
      if (longPressTriggeredRef.current) {
          longPressTriggeredRef.current = false;
          return;
      }
      if (isSelectionMode) {
          const newSet = new Set(selectedIds);
          if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
          setSelectedIds(newSet);
      } else {
          onSelect(id);
      }
  };

  const handleBulkDelete = (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
  };

  return (
    <div className="flex flex-col h-full bg-darker border-r border-white/5 transition-colors">
      <div className={`p-5 flex flex-col gap-4 border-b border-white/5 transition-colors duration-300 pt-[calc(1.25rem+env(safe-area-inset-top))] ${isSelectionMode ? 'bg-indigo-900/20' : 'bg-white/5'}`}>
        <div className="flex items-center justify-between min-h-[40px]">
            {isSelectionMode ? (
                <>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setSelectedIds(new Set())} className="text-gray-300 hover:text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <span className="text-lg font-bold text-txt">{selectedIds.size} Selected</span>
                    </div>
                    <button 
                        onClick={handleBulkDelete}
                        className="p-2 rounded-full bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white transition-colors"
                        title="Delete Selected"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </>
            ) : (
                <>
                    <div 
                        className="flex flex-col items-start select-none cursor-pointer active:scale-95 transition-transform"
                        onClick={handleLogoClick}
                        title="SoulSync AI"
                    >
                        <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary tracking-tight">
                        SoulSync
                        </h1>
                        <span className="text-[10px] text-muted flex items-center gap-1">
                            {getPremiumStatusText().toUpperCase()}
                        </span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                    <button
                        onClick={onSettingsClick}
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-muted hover:text-txt transition-colors border border-white/5"
                        title="Settings"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                        </svg>
                    </button>
                    
                    {isFullscreen && (
                        <button
                            onClick={handleExitFullscreen}
                            className="p-2 rounded-full bg-red-900/30 text-red-400 hover:bg-red-900/50 hover:text-white transition-all border border-red-500/30 animate-pulse-slow"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </button>
                    )}

                    {onImportClick && (
                        <button onClick={onImportClick} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-muted hover:text-txt transition-colors border border-white/5">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        </button>
                    )}
                    <button onClick={onAddClick} className="p-2 rounded-full bg-primary hover:opacity-90 text-on-primary transition-colors shadow-lg shadow-indigo-900/20">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    </button>
                    </div>
                </>
            )}
        </div>
        
        <div className="relative px-5 pb-0">
            <input 
                type="text" 
                placeholder="Search conversations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={isSelectionMode}
                className={`w-full bg-black/20 border border-white/10 rounded-lg py-2 px-3 pl-9 text-base md:text-sm text-txt focus:outline-none focus:border-primary/50 transition-colors ${isSelectionMode ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted absolute left-8 top-3 md:top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar bg-darker pb-[env(safe-area-inset-bottom)]">
        {personas.length === 0 ? (
          <div className="p-8 text-center text-muted mt-10">
            <p className="mb-2 font-medium">No active chats.</p>
            <p className="text-xs opacity-50">Click the + button to create a new offline chatbot.</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {filtered.map((persona) => {
              const isSelected = selectedIds.has(persona.id);
              return (
                <li key={persona.id} className="relative group/item select-none">
                  <div
                    onClick={() => handleItemClick(persona.id)}
                    onMouseDown={() => startLongPress(persona.id)}
                    onMouseUp={cancelLongPress}
                    onMouseLeave={cancelLongPress}
                    onTouchStart={() => startLongPress(persona.id)}
                    onTouchEnd={cancelLongPress}
                    onTouchMove={cancelLongPress} 
                    
                    className={`w-full p-4 flex items-center gap-4 transition-all duration-200 cursor-pointer text-left
                      ${isSelectionMode && isSelected ? 'bg-primary/20' : ''}
                      ${!isSelectionMode && activeId === persona.id ? 'bg-white/5 border-l-4 border-primary pl-[1.15rem]' : 'pl-4 border-l-4 border-transparent hover:bg-white/5'}
                    `}
                  >
                    {isSelectionMode && (
                        <div className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-primary border-primary' : 'border-muted'}`}>
                            {isSelected && (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            )}
                        </div>
                    )}

                    <div className="relative shrink-0">
                      <img src={persona.avatarUrl} alt={persona.name} className="w-12 h-12 rounded-full object-cover bg-surface ring-2 ring-white/5 pointer-events-none" />
                    </div>
                    
                    <div className="flex-1 min-w-0 pointer-events-none">
                      <div className="flex justify-between items-baseline mb-1">
                        <h3 className={`text-sm font-bold truncate ${activeId === persona.id && !isSelectionMode ? 'text-txt' : 'text-gray-300'}`}>{persona.name}</h3>
                        <span className="text-[10px] text-muted font-medium">{persona.lastMessageTime ? new Date(persona.lastMessageTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'New'}</span>
                      </div>
                      <p className={`text-xs truncate ${activeId === persona.id && !isSelectionMode ? 'text-primary' : 'text-muted'} pr-6`}>
                        {persona.lastMessage || <span className="italic opacity-50">Tap to start talking...</span>}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ChatList;
