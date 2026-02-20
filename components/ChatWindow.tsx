
import React, { useState, useEffect, useRef } from 'react';
import { Message, MessageRole, MessageType, PersonaProfile } from '../types';
import { GalleryModal } from './GalleryModal';
import { TrainingModal } from './TrainingModal';

interface Props {
  persona: PersonaProfile;
  messages: Message[];
  onSendMessage: (text: string, type?: MessageType) => void;
  isTyping: boolean;
  isTraining?: boolean;
  onBack: () => void;
  onUpdatePersona?: (p: PersonaProfile) => void;
  onRefresh: () => void;
  onPremiumRequired: () => void;
}

// --- VOICE NOTE COMPONENT (Player) ---
const VoiceNote: React.FC<{ audioSrc: string }> = ({ audioSrc }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const setAudioData = () => {
             if(audio.duration !== Infinity && !isNaN(audio.duration)) {
                 setDuration(audio.duration);
             }
        };
        const setAudioTime = () => setCurrentTime(audio.currentTime);
        const handleEnded = () => setIsPlaying(false);

        audio.addEventListener('loadedmetadata', setAudioData);
        audio.addEventListener('durationchange', setAudioData);
        audio.addEventListener('timeupdate', setAudioTime);
        audio.addEventListener('ended', handleEnded);

        if (audio.readyState >= 1) {
            setAudioData();
        }

        return () => {
            audio.removeEventListener('loadedmetadata', setAudioData);
            audio.removeEventListener('durationchange', setAudioData);
            audio.removeEventListener('timeupdate', setAudioTime);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [audioSrc]);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const formatTime = (time: number) => {
        if(isNaN(time) || time === Infinity) return "0:00";
        const min = Math.floor(time / 60);
        const sec = Math.floor(time % 60);
        return `${min}:${sec < 10 ? '0' + sec : sec}`;
    };

    return (
        <div className="flex items-center gap-3 w-48 sm:w-64 p-1">
            <audio ref={audioRef} src={audioSrc} className="hidden" preload="metadata" />
            
            <button 
                onClick={togglePlay}
                type="button"
                className="w-10 h-10 rounded-full bg-white text-indigo-600 flex items-center justify-center shadow-md hover:scale-105 transition-transform"
            >
                {isPlaying ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-0.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                )}
            </button>

            <div className="flex-1 flex flex-col justify-center gap-1">
                <div className="flex items-center gap-0.5 h-6 overflow-hidden">
                    {[...Array(15)].map((_, i) => {
                        const progress = duration > 0 ? (currentTime / duration) * 15 : 0;
                        const isPlayed = i < progress;
                        return (
                            <div 
                                key={i} 
                                className={`w-1 rounded-full transition-all duration-300 ${isPlayed ? 'bg-white' : 'bg-white/40'}`} 
                                style={{ height: `${20 + Math.random() * 80}%` }}
                            ></div>
                        );
                    })}
                </div>
                <div className="text-[10px] text-white/80 font-mono flex justify-between">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>
        </div>
    );
};

// --- MEMOIZED MESSAGE ITEM ---
const MessageItem = React.memo(({ msg }: { msg: Message }) => {
    const isUser = msg.role === MessageRole.USER;
    
    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
            <div
                className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3 shadow-md relative group
                  ${isUser 
                    ? 'bg-primary text-on-primary rounded-br-sm' 
                    : 'bg-surface text-gray-100 rounded-bl-sm border border-white/5'
                  }`}
            >
                {/* Image Content */}
                {msg.type === MessageType.IMAGE && (
                    <div className="mb-2 rounded-lg overflow-hidden border border-white/10">
                        <img src={msg.content} alt="Sent image" className="max-w-full h-auto" loading="lazy" />
                    </div>
                )}

                {/* Audio Content */}
                {msg.type === MessageType.AUDIO && (
                    <VoiceNote audioSrc={msg.content} />
                )}

                {/* Text Content */}
                {(msg.type === MessageType.TEXT || (msg.content && !msg.content.startsWith('data:'))) && (
                     <div className="whitespace-pre-wrap text-sm leading-relaxed break-words">
                         {msg.content}
                     </div>
                )}

                {/* Timestamp */}
                <p className={`text-[10px] mt-1 opacity-50 text-right ${isUser ? 'text-white' : 'text-gray-400'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </p>
            </div>
        </div>
    );
}, (prev, next) => prev.msg.id === next.msg.id && prev.msg.content === next.msg.content);

const ChatWindow: React.FC<Props> = ({ persona, messages, onSendMessage, isTyping, isTraining, onBack, onUpdatePersona, onRefresh, onPremiumRequired }) => {
  const [inputText, setInputText] = useState('');
  const [showGallery, setShowGallery] = useState(false);
  const [showTraining, setShowTraining] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, isTyping]); 

  const handleSend = () => {
    if (inputText.trim()) {
      onSendMessage(inputText);
      setInputText('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-darker relative overflow-hidden">
      
      {/* Background */}
      <div className="absolute inset-0 z-0">
         {persona.chatWallpaper ? (
             <>
                <div 
                    className="absolute inset-0 bg-cover bg-center opacity-30 blur-sm scale-105" 
                    style={{ backgroundImage: `url(${persona.chatWallpaper})` }}
                ></div>
                <div className="absolute inset-0 bg-gradient-to-b from-darker/80 via-darker/90 to-darker"></div>
             </>
         ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/10 to-purple-900/10"></div>
         )}
      </div>

      {/* Header */}
      <div className="p-4 bg-surface/90 backdrop-blur-md border-b border-white/5 flex items-center gap-3 shadow-sm z-50 relative">
        <button
          onClick={onBack}
          type="button"
          className="md:hidden p-2 rounded-full hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <div className="relative group cursor-pointer" onClick={() => onUpdatePersona && setShowTraining(true)}>
          <img
            src={persona.avatarUrl}
            alt={persona.name}
            className="w-10 h-10 rounded-full object-cover ring-2 ring-primary/50 group-hover:ring-primary transition-all"
          />
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-surface rounded-full"></div>
        </div>
        
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onUpdatePersona && setShowTraining(true)}>
          <h2 className="font-bold text-txt truncate">{persona.name}</h2>
          <p className="text-xs text-primary truncate">Online • {persona.relationship}</p>
        </div>

        <div className="flex items-center gap-1">
             <button 
                onClick={() => setShowGallery(true)}
                type="button"
                className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Visual Memory"
             >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
             </button>
             
             {isTraining && (
                 <button 
                    onClick={() => setShowTraining(true)}
                    type="button"
                    className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                    title="Brain Training"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                 </button>
             )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar z-0 pb-20">
        {messages.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-full p-6 text-center animate-fade-in opacity-80 mt-8 space-y-4">
                 <div className="relative">
                     <img 
                        src={persona.avatarUrl} 
                        alt={persona.name} 
                        className="w-24 h-24 rounded-full object-cover border-4 border-surface shadow-xl"
                     />
                     <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-2 border-surface rounded-full"></div>
                 </div>
                 
                 <div>
                     <h3 className="text-2xl font-bold text-txt">{persona.name}</h3>
                     <p className="text-sm text-primary font-medium capitalize mt-1">
                        {persona.relationship} • {persona.neuralMap.coreIdentity.occupation}
                     </p>
                 </div>

                 <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
                     {persona.neuralMap.coreIdentity.backstory}
                 </p>
                 
                 <div className="pt-4">
                     <p className="text-xs text-gray-500">You are connected with {persona.name}.<br/>Say hello to start the conversation.</p>
                 </div>
             </div>
        ) : (
            <>
                <div className="flex justify-center my-4">
                    <div className="bg-white/5 px-3 py-1 rounded-full text-[10px] text-gray-500 flex items-center gap-1 border border-white/5">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                        Messages are stored locally.
                    </div>
                </div>
                {messages.map((msg) => (
                    <MessageItem key={msg.id} msg={msg} />
                ))}
            </>
        )}

        {isTyping && (
          <div className="flex justify-start animate-fade-in">
             <div className="bg-surface border border-white/5 rounded-2xl rounded-bl-sm px-4 py-3 shadow-md flex items-center gap-1 h-10">
                 <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                 <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                 <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-200"></div>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-surface border-t border-white/5 z-10">
        <div className="flex items-end gap-2 max-w-4xl mx-auto bg-darker border border-white/10 rounded-2xl p-2 focus-within:border-primary/50 transition-colors shadow-lg">
          <button 
             className="p-2 text-gray-400 hover:text-white transition-colors"
             type="button"
             disabled={true} 
          >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
             </svg>
          </button>

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={`Message ${persona.name}...`}
            className="flex-1 bg-transparent text-white placeholder-gray-500 resize-none max-h-32 py-2 focus:outline-none custom-scrollbar text-sm"
            rows={1}
            style={{ minHeight: '40px' }}
          />
          
          <button
            onClick={handleSend}
            type="button"
            disabled={!inputText.trim()}
            className={`p-2 rounded-xl transition-all ${inputText.trim() ? 'bg-primary text-white shadow-lg shadow-primary/20 hover:scale-105 active:scale-95' : 'bg-white/5 text-gray-500 cursor-not-allowed'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform rotate-90" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
      </div>

      {showGallery && (
          <GalleryModal 
             persona={persona} 
             onUpdatePersona={(p) => onUpdatePersona && onUpdatePersona(p)}
             onClose={() => setShowGallery(false)}
             onPremiumRequired={onPremiumRequired}
          />
      )}

      {showTraining && onUpdatePersona && (
          <TrainingModal 
              persona={persona}
              onUpdate={onUpdatePersona}
              onClose={() => setShowTraining(false)}
              onExport={() => {}}
              onPremiumRequired={onPremiumRequired}
          />
      )}

    </div>
  );
};

export default ChatWindow;
