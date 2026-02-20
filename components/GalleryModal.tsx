
import React, { useState, useEffect } from 'react';
import { PersonaProfile } from '../types';
import * as db from '../services/db';
import { isPremium, isDeveloperMode } from '../services/premiumService';

interface Props {
  persona: PersonaProfile;
  onUpdatePersona: (p: PersonaProfile) => void;
  onClose: () => void;
  onPremiumRequired: () => void;
}

// --- HELPER: OBJECT URL MANAGER ---
// Stores Blob URLs to prevent memory leaks by revoking on unmount
const useObjectUrls = (images: db.DBImage[]) => {
    const [urls, setUrls] = useState<Record<string, string>>({});

    useEffect(() => {
        const newUrls: Record<string, string> = {};
        let mounted = true;
        
        images.forEach(img => {
            if (!img.data) return; // Safety check
            
            try {
                if (typeof img.data !== 'string') {
                    // It's a Blob/File
                    newUrls[img.id] = URL.createObjectURL(img.data);
                } else {
                    // It's a Base64 string
                    newUrls[img.id] = img.data as string;
                }
            } catch (e) {
                console.error("Failed to create URL for image", img.id, e);
                newUrls[img.id] = ''; 
            }
        });

        if (mounted) {
            setUrls(prev => {
                 // Revoke old ones that are missing in new set
                 Object.keys(prev).forEach(key => {
                     if (!newUrls[key] && prev[key] && prev[key].startsWith('blob:')) {
                         URL.revokeObjectURL(prev[key]);
                     }
                 });
                 return newUrls;
            });
        }

        return () => {
            mounted = false;
            Object.values(newUrls).forEach(url => {
                if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
            });
        };
    }, [images]);

    return urls;
};

// --- IMAGE EDITOR COMPONENT ---
interface EditorProps {
    image: db.DBImage;
    src: string;
    onClose: () => void;
    onUpdate: () => void;
}

const ImageEditor: React.FC<EditorProps> = ({ image, src, onClose, onUpdate }) => {
    const [tags, setTags] = useState(image.tags.join(', '));
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const handleSave = async () => {
        const newTags = tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        await db.updateImage({
            ...image,
            tags: newTags
        });
        window.notify("Memory updated", "success");
        onUpdate();
        onClose();
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await db.deleteImage(image.id);
            window.notify("Memory deleted", "info");
            onClose(); 
            onUpdate();
        } catch (e) {
            console.error(e);
            window.notify("Delete failed", "error");
            setIsDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col animate-fade-in select-none">
            <div className="p-4 flex justify-between items-center border-b border-gray-800 bg-gray-900">
                <div className="text-white font-bold text-lg">Edit Memory</div>
                <button onClick={onClose} className="text-gray-400 hover:text-white px-3 py-1 rounded hover:bg-white/10">Close</button>
            </div>
            <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-black overflow-hidden relative">
                <div className="relative inline-block max-w-full max-h-full">
                    <img 
                        src={src} 
                        className="max-w-full max-h-[70vh] object-contain shadow-2xl block" 
                        alt="Editing"
                        draggable={false}
                    />
                </div>
            </div>
            <div className="p-6 bg-gray-900 border-t border-gray-800 flex flex-col md:flex-row gap-6 items-center justify-center z-20">
                {showDeleteConfirm ? (
                        <div className="flex items-center gap-3 bg-red-900/20 p-2 rounded-lg border border-red-900/50 animate-fade-in">
                            <span className="text-red-300 text-sm font-bold">Delete this?</span>
                            <button onClick={handleDelete} disabled={isDeleting} className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-bold">
                                {isDeleting ? '...' : 'Yes'}
                            </button>
                            <button onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs">
                                No
                            </button>
                        </div>
                ) : (
                    <>
                        <div className="flex-1 w-full md:max-w-md flex gap-2">
                            <div className="flex-1">
                                <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Tags</label>
                                <input 
                                    value={tags} 
                                    onChange={e => setTags(e.target.value)} 
                                    className="w-full bg-black border border-gray-700 rounded-lg p-2 text-white focus:outline-none focus:border-indigo-500 transition-colors" 
                                    placeholder="e.g. happy, selfie"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowDeleteConfirm(true)} className="p-3 rounded-full bg-gray-800 text-red-400 hover:bg-red-900 transition-colors" title="Delete">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                        <button onClick={handleSave} className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg font-bold shadow-lg transition-all">
                            Save Changes
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

// Define structure for prepared uploads
interface PendingUpload {
    name: string;
    data: string; // Base64
}

export const GalleryModal: React.FC<Props> = ({ persona, onUpdatePersona, onClose, onPremiumRequired }) => {
  const [activeTab, setActiveTab] = useState<'view' | 'upload'>('view');
  const [allImages, setAllImages] = useState<db.DBImage[]>([]);
  const [visibleImages, setVisibleImages] = useState<db.DBImage[]>([]);
  const [page, setPage] = useState(1);
  const [editingImage, setEditingImage] = useState<db.DBImage | null>(null);
  
  // Developer Check
  const isDev = isDeveloperMode();

  // Render Helpers
  const imageUrls = useObjectUrls(visibleImages);
  
  // Upload State - CHANGED: Store Base64 strings instead of File objects
  const [pendingFiles, setPendingFiles] = useState<PendingUpload[]>([]);
  const [uploadTags, setUploadTags] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadImages();
  }, [persona.id]);

  useEffect(() => {
      // Pagination Logic
      const PAGE_SIZE = 24;
      setVisibleImages(allImages.slice(0, page * PAGE_SIZE));
  }, [allImages, page]);

  const loadImages = async () => {
    try {
        const imgs = await db.getImagesByPersona(persona.id);
        // Sort by newest first
        imgs.sort((a, b) => b.timestamp - a.timestamp);
        setAllImages(imgs || []);
        setPage(1); // Reset page on reload
    } catch (e) {
        console.error("Failed to load images", e);
        setAllImages([]);
    }
  };

  // CHANGED: Process files to Base64 immediately to avoid WebView file access loss
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const filePromises: Promise<PendingUpload>[] = [];

      for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const p = new Promise<PendingUpload>((resolve) => {
              const reader = new FileReader();
              reader.onload = (ev) => {
                  resolve({
                      name: file.name,
                      data: ev.target?.result as string
                  });
              };
              reader.readAsDataURL(file);
          });
          filePromises.push(p);
      }

      try {
          const processedFiles = await Promise.all(filePromises);
          setPendingFiles(prev => [...prev, ...processedFiles]);
      } catch (err) {
          console.error("Error reading files", err);
          window.notify("Failed to process some images.", "error");
      }
      
      // Clear input safely
      e.target.value = '';
  };

  const removePendingFile = (index: number) => {
      setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveToMemory = async () => {
      if (!isPremium()) {
          onPremiumRequired();
          return;
      }

      if (pendingFiles.length === 0) return;

      setIsUploading(true);
      
      try {
          const tags = uploadTags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
          
          // Save sequentially to avoid DB locking and ensure stability
          for (let i = 0; i < pendingFiles.length; i++) {
              const fileObj = pendingFiles[i];
              const uniqueId = (Date.now() + i).toString() + Math.random().toString(36).substr(2, 5);
              
              // Use Base64 string directly - safer for APKs/WebViews than Blobs
              const newEntry: db.DBImage = {
                id: uniqueId,
                personaId: persona.id,
                data: fileObj.data, 
                tags: tags,
                description: "Imported High Quality",
                timestamp: Date.now()
              };
              await db.saveImage(newEntry);
          }
          
          await loadImages();
          window.notify(`Saved ${pendingFiles.length} photos`, "success");
          
          setPendingFiles([]);
          setUploadTags("");
          setTimeout(() => setActiveTab('view'), 300);
          
      } catch (error) {
          console.error(error);
          window.notify("Failed to save. Storage might be full.", "error");
      } finally {
          setIsUploading(false);
      }
  };

  return (
    <>
    {editingImage && (
        <ImageEditor 
            image={editingImage}
            src={imageUrls[editingImage.id] || (typeof editingImage.data === 'string' ? editingImage.data : '')}
            onClose={() => setEditingImage(null)} 
            onUpdate={loadImages}
        />
    )}

    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="bg-surface border border-gray-700 w-full max-w-4xl h-[80vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        
        <div className="p-4 border-b border-gray-700 bg-darker flex justify-between items-center">
            <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    Offline Visual Memory
                    {!isPremium() && <span className="text-[10px] bg-yellow-600 text-white px-2 py-0.5 rounded font-bold">PREMIUM LOCK</span>}
                </h2>
                <p className="text-xs text-gray-400">Manage images {persona.name} uses during chats.</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="flex bg-darker border-b border-gray-700">
            <button onClick={() => setActiveTab('view')} className={`flex-1 p-3 text-sm font-medium ${activeTab === 'view' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-white'}`}>Gallery ({allImages.length})</button>
            {isDev && (
                <button onClick={() => setActiveTab('upload')} className={`flex-1 p-3 text-sm font-medium ${activeTab === 'upload' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-white'}`}>Upload Custom</button>
            )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-[#0a0a0a] custom-scrollbar">
            {activeTab === 'view' && (
                <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {visibleImages.length > 0 ? (
                        visibleImages.map(img => (
                            <div 
                                key={img.id} 
                                onClick={() => setEditingImage(img)}
                                className="relative group rounded-lg overflow-hidden border border-white/10 aspect-square cursor-pointer hover:border-primary transition-colors bg-gray-900"
                            >
                                <img 
                                    src={imageUrls[img.id]} 
                                    className="w-full h-full object-cover" 
                                    loading="lazy" 
                                />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                                    <p className="text-xs text-white font-bold truncate">{img.tags.join(', ')}</p>
                                    <p className="text-[10px] text-gray-400">Click to edit</p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full flex flex-col items-center justify-center py-12 text-center space-y-4 animate-fade-in">
                            {isDev ? (
                                <>
                                    <div className="text-4xl">📂</div>
                                    <p className="text-gray-500">No images in memory.</p>
                                    <button onClick={() => setActiveTab('upload')} className="text-primary text-xs hover:underline bg-white/5 px-4 py-2 rounded-full">
                                        Upload Custom Photos
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-2 shadow-inner">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-gray-300 font-bold text-lg">Visual Memory Locked</p>
                                        <p className="text-xs text-gray-500 max-w-xs mx-auto mt-2 leading-relaxed">
                                            This Soul hasn't shared any photos yet. <br/>
                                            <span className="text-amber-500">Buy Souls</span> or expand your collection to unlock exclusive gallery content.
                                        </p>
                                    </div>
                                    <button className="px-8 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white text-xs font-bold rounded-full shadow-lg shadow-orange-900/20 hover:scale-105 transition-transform flex items-center gap-2">
                                        <span>💎</span> Acquire Souls
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
                {visibleImages.length < allImages.length && (
                    <div className="mt-6 flex justify-center">
                        <button 
                            onClick={() => setPage(p => p + 1)}
                            className="px-6 py-2 bg-white/5 hover:bg-white/10 rounded-full text-xs font-bold text-gray-300"
                        >
                            Load More Photos ({allImages.length - visibleImages.length} remaining)
                        </button>
                    </div>
                )}
                </>
            )}

            {activeTab === 'upload' && isDev && (
                <div className="max-w-xl mx-auto space-y-6">
                    <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center hover:border-gray-500 transition cursor-pointer relative group bg-white/5">
                        <input 
                            type="file" 
                            accept="image/*" 
                            multiple 
                            onChange={handleFileSelect}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50"
                        />
                        <div className="space-y-2 group-hover:scale-105 transition-transform">
                            <span className="text-4xl text-gray-500">📸</span>
                            <p className="text-gray-300 font-medium">Click to select photos</p>
                            <p className="text-xs text-gray-500">Supports Bulk Upload (5000+) • Original Quality</p>
                        </div>
                    </div>

                    {pendingFiles.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs text-gray-400 font-bold uppercase">Pending Uploads ({pendingFiles.length})</p>
                            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                                {pendingFiles.map((file, idx) => (
                                    <div key={idx} className="bg-gray-800 text-gray-300 text-[10px] px-2 py-1 rounded flex items-center gap-2">
                                        <span className="truncate max-w-[100px]">{file.name}</span>
                                        <button onClick={() => removePendingFile(idx)} className="hover:text-red-400">✕</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Context Tags for Batch (Comma separated)</label>
                        <input 
                            type="text" 
                            className="w-full bg-darker border border-gray-700 rounded-lg p-3 text-white text-sm focus:border-primary focus:outline-none"
                            placeholder="e.g. selfie, beach, happy"
                            value={uploadTags}
                            onChange={(e) => setUploadTags(e.target.value)}
                        />
                        <p className="text-[10px] text-gray-600 mt-1">These tags will apply to all {pendingFiles.length} images.</p>
                    </div>

                    <button 
                        onClick={handleSaveToMemory}
                        disabled={pendingFiles.length === 0 || isUploading}
                        className={`w-full py-3 rounded-lg text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors shadow-lg
                        ${isPremium() ? 'bg-primary hover:bg-indigo-500' : 'bg-gray-700 hover:bg-gray-600'}
                        `}
                    >
                        {!isPremium() && (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                        )}
                        {isUploading ? (
                            <>
                                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                                <span>Saving High-Res Images...</span>
                            </>
                        ) : (
                            `Save ${pendingFiles.length > 0 ? pendingFiles.length : ''} to Memory`
                        )}
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
    </>
  );
};
