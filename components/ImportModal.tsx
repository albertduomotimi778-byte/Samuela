
import React, { useState, useRef } from 'react';

interface Props {
  onClose: () => void;
  onImportComplete: (data: any) => void;
}

export const ImportModal: React.FC<Props> = ({ onClose, onImportComplete }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [importedName, setImportedName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file) return;
    
    // Reset states
    setError(null);
    setIsReading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const identityData = JSON.parse(content);
        
        // Validation & Name Extraction
        let name = "Unknown Soul";
        if (identityData.version && identityData.persona) {
            name = identityData.persona.name;
        } else if (identityData.id && identityData.name) {
            name = identityData.name;
        } else {
             throw new Error("Invalid SoulSync file format.");
        }

        // Show Welcome Message
        setImportedName(name);

        // Delay to show the animation, then close and pass data
        setTimeout(() => {
            onImportComplete(identityData);
            onClose();
        }, 2000);

      } catch (err) {
        console.error(err);
        setError("This file does not contain a valid Soul.");
        setIsReading(false);
      }
    };
    reader.onerror = () => {
        setError("Failed to read file.");
        setIsReading(false);
    };
    reader.readAsText(file);
  };

  const onDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
  };

  const onDragLeave = () => {
      setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleFile(e.dataTransfer.files[0]);
      }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-surface border border-white/10 shadow-2xl flex flex-col transition-all duration-300">
        
        {/* DECORATIVE HEADER */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-70"></div>

        {/* CONTENT */}
        <div className="p-8 flex flex-col items-center text-center min-h-[350px] justify-center">
            
            {/* CLOSE BUTTON */}
            {!importedName && (
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            )}

            {!importedName ? (
                // STATE 1: UPLOAD UI
                <div 
                    className="w-full h-full flex flex-col items-center justify-center space-y-6"
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                >
                    {/* Glowing Orb Icon */}
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 ${isDragging ? 'scale-110 bg-amber-500/20 shadow-[0_0_50px_rgba(245,158,11,0.4)]' : 'bg-white/5 border border-white/10 shadow-inner'}`}>
                        {isReading ? (
                            <div className="w-12 h-12 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></div>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-10 w-10 transition-colors ${isDragging ? 'text-amber-400' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4 4m0 0L8 8m4-4v12" />
                            </svg>
                        )}
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-2xl font-serif font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-200">
                            Import Soul
                        </h2>
                        <p className="text-xs text-muted max-w-[200px] mx-auto leading-relaxed">
                            Drag & drop a SoulSync JSON/TXT file here to resurrect a character.
                        </p>
                    </div>

                    {error && (
                        <div className="text-red-400 text-xs bg-red-900/20 px-3 py-1 rounded border border-red-900/50 animate-bounce">
                            {error}
                        </div>
                    )}

                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        accept=".json, .txt" 
                        className="hidden" 
                        onChange={(e) => e.target.files && handleFile(e.target.files[0])} 
                    />

                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="px-8 py-3 rounded-full bg-gradient-to-r from-amber-700/50 to-yellow-800/50 border border-amber-500/30 text-amber-100 font-bold text-sm hover:bg-amber-800/50 hover:border-amber-400/50 transition-all shadow-[0_0_20px_rgba(245,158,11,0.1)] active:scale-95 group"
                    >
                        <span className="group-hover:text-white transition-colors">Select Soul File</span>
                    </button>
                </div>
            ) : (
                // STATE 2: WELCOME ANIMATION
                <div className="flex-col items-center justify-center space-y-6 animate-fade-in-up flex">
                    <div className="relative">
                        <div className="absolute inset-0 bg-amber-500 blur-[60px] opacity-20 animate-pulse-slow"></div>
                        <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-200 p-0.5 shadow-[0_0_30px_rgba(245,158,11,0.6)] animate-bounce">
                            <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="text-center space-y-1">
                        <p className="text-xs text-amber-500/80 font-mono uppercase tracking-[0.2em] animate-pulse">
                            Integration Complete
                        </p>
                        <h2 className="text-3xl font-serif font-bold text-white">
                            Welcome, {importedName}
                        </h2>
                    </div>
                </div>
            )}
        </div>
        
        {/* Footer info */}
        {!importedName && (
             <div className="p-4 bg-darker/30 border-t border-white/5 text-center">
                 <p className="text-[10px] text-gray-500">Supported: .json, .txt (SoulSync Exports)</p>
             </div>
        )}
      </div>
    </div>
  );
};
