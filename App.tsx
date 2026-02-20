
import React, { useState, useEffect, useRef } from 'react';
import ChatList from './components/ChatList';
import ChatWindow from './components/ChatWindow';
import { BotCreationModal } from './components/BotCreationModal';
import { IntroAnimation } from './components/IntroAnimation';
import { DevUnlockModal } from './components/DevUnlockModal';
import { SettingsModal } from './components/SettingsModal';
import { ImportModal } from './components/ImportModal';
import { processOfflineMessage } from './services/geminiService';
import { applyTheme, getSavedTheme } from './services/themeService';
import { PersonaProfile, Message, MessageRole, MessageType, ChatSession } from './types';
import * as db from './services/db';

// Declare Native Interface & Global Notify
declare global {
    interface Window {
        onNativePremiumActive?: () => void;
    }
    function notify(message: string, type?: 'success' | 'error' | 'info'): void;
}

// --- NATIVE NOTIFICATION COMPONENT ---
const NativeToast = () => {
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' | 'info' } | null>(null);

    useEffect(() => {
        const handleEvent = (e: CustomEvent) => {
            setToast(e.detail);
            setTimeout(() => setToast(null), 3000);
        };
        window.addEventListener('soulsync-toast', handleEvent as any);
        return () => window.removeEventListener('soulsync-toast', handleEvent as any);
    }, []);

    if (!toast) return null;

    const bgColors = {
        success: 'bg-emerald-600',
        error: 'bg-red-600',
        info: 'bg-indigo-600'
    };

    return (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[99999] animate-fade-in-up w-full max-w-sm px-4 pt-[env(safe-area-inset-top)]">
            <div className={`${bgColors[toast.type]} text-white px-6 py-3 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex items-center gap-3 border border-white/10 backdrop-blur-md justify-center w-full`}>
                {toast.type === 'success' && (
                    <svg className="w-5 h-5 text-emerald-200 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                )}
                {toast.type === 'error' && (
                    <svg className="w-5 h-5 text-red-200 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                )}
                <span className="font-bold text-sm tracking-wide truncate">{toast.msg}</span>
            </div>
        </div>
    );
};

export function App() {
  const [showIntro, setShowIntro] = useState(true);
  const [personas, setPersonas] = useState<PersonaProfile[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null);
  
  // Forces ChatWindow to remount entirely when incremented, ensuring clear state
  const [chatResetVersion, setChatResetVersion] = useState(0); 

  // UI Version state to force re-renders when global settings (like Dev Mode) change
  const [uiVersion, setUiVersion] = useState(0);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [isDevModalOpen, setIsDevModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [isTyping, setIsTyping] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  
  // Track when a chat was last cleared to prevent old bot processes from replying
  const lastClearTimeRef = useRef<Record<string, number>>({});
  
  // Expose Notify Globally
  useEffect(() => {
      window.notify = (msg, type = 'info') => {
          window.dispatchEvent(new CustomEvent('soulsync-toast', { detail: { msg, type } }));
      };
  }, []);

  // --- STICKY FULLSCREEN LOGIC ---
  useEffect(() => {
      const restoreFullscreen = () => {
          if (document.hidden) return;
          const shouldBeFullscreen = sessionStorage.getItem('soul_fullscreen_mode') === 'true';
          
          if (shouldBeFullscreen && !document.fullscreenElement) {
              document.documentElement.requestFullscreen().catch(() => {});
          }
      };

      window.addEventListener('click', restoreFullscreen);
      window.addEventListener('touchstart', restoreFullscreen);

      return () => {
          window.removeEventListener('click', restoreFullscreen);
          window.removeEventListener('touchstart', restoreFullscreen);
      };
  }, []);

  // Load state from IndexedDB on mount and apply theme
  useEffect(() => {
    const init = async () => {
        applyTheme(getSavedTheme());

        try {
            const savedPersonas = await db.getAllPersonas();
            const savedSessions = await db.getAllSessions();
            
            if (savedPersonas.length > 0) {
                setPersonas(savedPersonas);
                if (savedSessions.length > 0) setSessions(savedSessions);
            }
        } catch (e) {
            console.error("Failed to load from DB", e);
        }
    };
    init();
  }, []);

  const handleCreatePersona = async (newPersona: PersonaProfile) => {
    newPersona.allowTraining = true;
    newPersona.canGenerateImages = true;

    await db.savePersona(newPersona);
    setPersonas((prev) => [newPersona, ...prev]);
    
    const newSession = { personaId: newPersona.id, messages: [] };
    await db.saveSession(newSession);
    setSessions((prev) => [...prev, newSession]);

    setActivePersonaId(newPersona.id);
    setIsModalOpen(false);
    setMobileShowChat(true);
    notify(`${newPersona.name} created successfully`, 'success');
  };
  
  const handleUpdatePersona = async (updatedPersona: PersonaProfile) => {
      await db.savePersona(updatedPersona);
      setPersonas(prev => prev.map(p => p.id === updatedPersona.id ? updatedPersona : p));
  };

  const handleBulkDelete = async (ids: string[]) => {
      if (ids.length === 0) return;
      
      setPersonas(prev => prev.filter(p => !ids.includes(p.id)));
      setSessions(prev => prev.filter(s => !ids.includes(s.personaId)));
      
      if (activePersonaId && ids.includes(activePersonaId)) {
          setActivePersonaId(null);
          setMobileShowChat(false);
      }

      try {
          for (const id of ids) {
              await db.deletePersona(id);
              await db.deleteSession(id);
              await db.deleteImagesByPersona(id);
          }
          notify(`Deleted ${ids.length} conversations`, 'success');
      } catch (err) {
          console.error("Bulk delete failed in DB", err);
          notify("Failed to delete some items", 'error');
      }
  };

  const handleRefreshChat = () => {
      if (!activePersonaId) return;
      
      if (window.confirm("Start fresh? This clears the conversation history but keeps the bot's training.")) {
          // 1. Mark timestamp to ignore pending replies
          lastClearTimeRef.current[activePersonaId] = Date.now();
          setIsTyping(false);

          // 2. Prepare empty session
          const emptySession: ChatSession = { 
              personaId: activePersonaId, 
              messages: [] 
          };

          // 3. OPTIMISTIC UPDATE: Update State Immediately using Functional Updates
          // This ensures we don't rely on stale closure variables
          setSessions(prev => prev.map(s => 
              s.personaId === activePersonaId ? emptySession : s
          ));
          
          setPersonas(prev => prev.map(p => {
              if (p.id === activePersonaId) {
                  return { ...p, lastMessage: undefined, lastMessageTime: undefined };
              }
              return p;
          }));

          // 4. CRITICAL: Use Date.now() to ensure the key is always unique
          setChatResetVersion(Date.now());

          notify("Chat history cleared", 'success');

          // 5. Background DB Sync
          db.saveSession(emptySession).catch(e => console.error("Session save failed", e));
          
          const currentPersona = personas.find(p => p.id === activePersonaId);
          if (currentPersona) {
              const resetPersona = { 
                  ...currentPersona, 
                  lastMessage: undefined, 
                  lastMessageTime: undefined 
              };
              db.savePersona(resetPersona).catch(e => console.error("Persona update failed", e));
          }
      }
  };

  const handleSendMessage = async (text: string, type: MessageType = MessageType.TEXT) => {
    if (!activePersonaId) return;

    const currentPersona = personas.find((p) => p.id === activePersonaId);
    if (!currentPersona) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      type: type,
      content: text,
      timestamp: Date.now(),
    };

    // Use Functional Updates to append message safely
    setSessions(prev => prev.map((s) => {
      if (s.personaId === activePersonaId) {
        return { ...s, messages: [...s.messages, newMessage] };
      }
      return s;
    }));

    // For DB, we need to construct what we just added. 
    // We grab the existing session from the state (or DB) and append.
    // NOTE: This creates a parallel update, but the UI is already updated via setSessions above.
    const sessionToSave = sessions.find(s => s.personaId === activePersonaId);
    if (sessionToSave) {
        const updatedSession = { ...sessionToSave, messages: [...sessionToSave.messages, newMessage] };
        await db.saveSession(updatedSession);
    }
    
    setIsTyping(true);

    const updatedPersonaForList = {
        ...currentPersona,
        lastMessage: type === MessageType.TEXT ? text : (type === MessageType.IMAGE ? 'Sent a photo' : 'Sent audio'),
        lastMessageTime: Date.now()
    };
    
    setPersonas(prev => prev.map(p => p.id === activePersonaId ? updatedPersonaForList : p));
    await db.savePersona(updatedPersonaForList);

    try {
        // We fetch the latest history from the 'sessions' state reference in this render
        // But since we just updated it, we should manually append the message to the history we pass to the bot.
        const existingMessages = sessions.find(s => s.personaId === activePersonaId)?.messages || [];
        const historyForBot = [...existingMessages, newMessage];
        
        setTimeout(async () => {
            const currentClearTime = lastClearTimeRef.current[activePersonaId] || 0;
            const messageTime = newMessage.timestamp;
            
            // If chat was cleared after this message was sent, do not reply
            if (currentClearTime > messageTime) {
                setIsTyping(false);
                return;
            }

            const response = await processOfflineMessage(updatedPersonaForList, text, type, historyForBot);
            
            if (response) {
                // Double check clear time
                if (lastClearTimeRef.current[activePersonaId] > messageTime) {
                    setIsTyping(false);
                    return;
                }

                const botMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: MessageRole.MODEL,
                    type: MessageType.TEXT,
                    content: response.text,
                    timestamp: Date.now()
                };
                
                // Functional Update for Bot Reply
                setSessions(prev => prev.map(s => {
                    if (s.personaId === activePersonaId) {
                         const msgs = [...s.messages, botMsg];
                         if (response.image) {
                             msgs.push({
                                id: (Date.now() + 2).toString(),
                                role: MessageRole.MODEL,
                                type: MessageType.IMAGE,
                                content: response.image,
                                timestamp: Date.now() + 1
                             });
                         }
                         if (response.audio) {
                             msgs.push({
                                id: (Date.now() + 3).toString(),
                                role: MessageRole.MODEL,
                                type: MessageType.AUDIO,
                                content: response.audio,
                                timestamp: Date.now() + 2
                             });
                         }
                         // Async DB Save inside the update logic to ensure we have the full list
                         const sessionToSave = { ...s, messages: msgs };
                         db.saveSession(sessionToSave).catch(e => console.error("Bot reply save failed", e));
                         return sessionToSave;
                    }
                    return s;
                }));
                
                const finalPersonaState = {
                    ...response.updatedPersona,
                    lastMessage: response.text || (response.image ? 'Sent a photo' : 'Sent audio'),
                    lastMessageTime: Date.now()
                };
                setPersonas(prev => prev.map(p => p.id === activePersonaId ? finalPersonaState : p));
                await db.savePersona(finalPersonaState);
            }
            setIsTyping(false);
        }, 1000 + Math.random() * 1000); 

    } catch (error) {
        console.error("Chat Error", error);
        setIsTyping(false);
    }
  };

  const handleImport = async (data: any) => {
      if (!data.persona || !data.images) {
          notify("Invalid file structure.", 'error');
          return;
      }
      
      const newPersona = { ...data.persona, id: Date.now().toString() }; 
      await db.savePersona(newPersona);
      
      if (Array.isArray(data.images)) {
          for (const img of data.images) {
              await db.saveImage({ 
                  ...img, 
                  id: Date.now() + Math.random().toString(), 
                  personaId: newPersona.id 
              });
          }
      }

      const newSession = { personaId: newPersona.id, messages: [] };
      await db.saveSession(newSession);

      setPersonas(prev => [newPersona, ...prev]);
      setSessions(prev => [...prev, newSession]);
      
      notify(`Imported ${newPersona.name} successfully!`, 'success');
  };

  const activeSession = sessions.find((s) => s.personaId === activePersonaId);
  const activePersona = personas.find((p) => p.id === activePersonaId);

  if (showIntro) {
    return <IntroAnimation onComplete={() => setShowIntro(false)} />;
  }

  return (
    <div className="flex h-[100dvh] w-screen overflow-hidden bg-darker text-txt font-sans transition-colors duration-300 relative">
      
      <NativeToast />

      {/* Sidebar (Chat List) */}
      <div className={`${mobileShowChat ? 'hidden' : 'flex'} md:flex w-full md:w-80 lg:w-96 flex-col border-r border-white/5 bg-darker z-20`}>
        <ChatList
          personas={personas}
          activeId={activePersonaId}
          onSelect={(id) => {
            setActivePersonaId(id);
            setMobileShowChat(true);
          }}
          onAddClick={() => setIsModalOpen(true)}
          onImportClick={() => setIsImportModalOpen(true)}
          onDelete={handleBulkDelete}
          onDevTrigger={() => setIsDevModalOpen(true)}
          onSettingsClick={() => setIsSettingsOpen(true)}
          onPremiumChange={() => setUiVersion(prev => prev + 1)} 
          onOpenPremiumModal={() => {}} 
        />
      </div>

      <div className={`${!mobileShowChat ? 'hidden' : 'flex'} md:flex flex-1 flex-col bg-surface relative z-10`}>
        {activePersona && activeSession ? (
          <ChatWindow
            // The key forces a complete re-mount when chat is cleared,
            // visually resetting the component state instantly.
            key={`${activePersonaId}-${chatResetVersion}`} 
            persona={activePersona}
            messages={activeSession.messages}
            onSendMessage={handleSendMessage}
            isTyping={isTyping}
            isTraining={activePersona.allowTraining}
            onBack={() => setMobileShowChat(false)}
            onUpdatePersona={handleUpdatePersona}
            onRefresh={handleRefreshChat}
            onPremiumRequired={() => {}} // No-op, premium removed
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted p-8 text-center bg-darker">
             <div className="w-24 h-24 mb-6 rounded-full bg-white/5 flex items-center justify-center animate-pulse-slow">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                 </svg>
             </div>
             <h2 className="text-2xl font-bold mb-2 text-txt">SoulSync AI</h2>
             <p className="max-w-md text-sm leading-relaxed opacity-70">
                 Select a conversation from the list or create a new offline identity to begin.
             </p>
             <button 
                onClick={() => setIsModalOpen(true)}
                className="mt-8 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-full text-sm font-bold transition-all border border-white/5"
             >
                 + Create New Identity
             </button>
          </div>
        )}
      </div>

      {isModalOpen && (
        <BotCreationModal
          onClose={() => setIsModalOpen(false)}
          onSave={handleCreatePersona}
        />
      )}

      {isDevModalOpen && (
          <DevUnlockModal 
             onClose={() => setIsDevModalOpen(false)}
             onSuccess={() => {
                 setUiVersion(prev => prev + 1);
                 // No page reload needed. 
                 // The modal will effectively close itself via the timeout calling onClose from parent props,
                 // or we can manually close it if desired, but existing logic handles the flow nicely without reload.
             }}
          />
      )}

      {isSettingsOpen && (
          <SettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}

      {isImportModalOpen && (
          <ImportModal 
             onClose={() => setIsImportModalOpen(false)}
             onImportComplete={handleImport}
          />
      )}

    </div>
  );
}
