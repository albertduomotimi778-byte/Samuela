
import React, { useState, useEffect } from 'react';
import { PersonaProfile, TrainingPair, TimeOfDay, TrainingResponse, LogicRule } from '../types';
import * as db from '../services/db';
import { isPremium, isDeveloperMode } from '../services/premiumService';

interface Props {
  persona: PersonaProfile;
  onUpdate: (p: PersonaProfile) => void;
  onClose: () => void;
  onExport: () => void;
  onPremiumRequired: () => void;
}

const shareOrDownload = async (filename: string, mimeType: string, dataString: string) => {
    // 1. Try Native Share first (Best UX for supported mobile)
    try {
        const file = new File([new Blob([dataString], { type: mimeType })], filename, { type: mimeType });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: filename,
                text: 'Exported from SoulSync'
            });
            return;
        }
    } catch (e) {
        console.warn("Native share failed, attempting download strategy.", e);
    }

    // 2. APK Download Strategy: Mini Iframe + Anchor
    // Using application/octet-stream forces browser to treat as download to avoid viewing JSON in browser
    try {
        const blob = new Blob([dataString], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        
        // Mini Iframe (Requested Solution for APKs)
        // This forces the WebView to trigger a download event
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = url;
        document.body.appendChild(iframe);

        // Anchor Link Fallback (Standard Web)
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a); 
        a.click();

        // Cleanup & Toast
        setTimeout(() => {
            document.body.removeChild(iframe);
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            window.notify("Saved to device downloads", "success");
        }, 1500);
    } catch (e) {
        console.error("Download failed", e);
        window.notify("Export failed", "error");
    }
};

export const TrainingModal: React.FC<Props> = ({ persona, onUpdate, onClose, onExport, onPremiumRequired }) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'visual' | 'audio' | 'conditions' | 'settings'>('chat');
  const [patterns, setPatterns] = useState<TrainingPair[]>(persona.neuralMap.customTraining || []);
  const [logicRules, setLogicRules] = useState<LogicRule[]>(persona.neuralMap.logicRules || []);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [triggerInput, setTriggerInput] = useState("");
  const [triggerList, setTriggerList] = useState<string[]>([]);
  const [responseInput, setResponseInput] = useState("");
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('any');
  const [stagedResponses, setStagedResponses] = useState<TrainingResponse[]>([]);
  const [visTag, setVisTag] = useState("");
  const [audioData, setAudioData] = useState<string | null>(null);

  const [editingLogicId, setEditingLogicId] = useState<string | null>(null);
  const [conditionTarget, setConditionTarget] = useState("");
  const [conditionMonitor, setConditionMonitor] = useState<'user_says_keyword' | 'bot_sends_imagetag'>('user_says_keyword');
  const [conditionThreshold, setConditionThreshold] = useState(3);
  const [conditionAction, setConditionAction] = useState<'send_text' | 'send_image_tag' | 'send_audio'>('send_text');
  const [conditionPayload, setConditionPayload] = useState("");
  const [conditionReset, setConditionReset] = useState(true);

  const [showExportOptions, setShowExportOptions] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [preparedExport, setPreparedExport] = useState<{ filename: string, data: string, type: string } | null>(null);
  
  const chatCount = patterns.filter(p => p.type === 'text').length;
  const visCount = patterns.filter(p => p.type === 'image_trigger').length;
  const audioCount = patterns.filter(p => p.type === 'audio_trigger').length;
  const conditionCount = logicRules.length;

  const addTrigger = () => {
      if (!triggerInput.trim()) return;
      if (!triggerList.includes(triggerInput.trim())) {
          setTriggerList([...triggerList, triggerInput.trim()]);
      }
      setTriggerInput("");
  };

  const removeTrigger = (idx: number) => {
      setTriggerList(triggerList.filter((_, i) => i !== idx));
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          e.preventDefault();
          addTrigger();
      }
  };

  const addStagedResponse = () => {
      if (!responseInput.trim()) return;
      setStagedResponses([...stagedResponses, { text: responseInput, timeOfDay }]);
      setResponseInput("");
  };

  const removeStagedResponse = (idx: number) => {
      setStagedResponses(stagedResponses.filter((_, i) => i !== idx));
  };

  useEffect(() => {
    const loadTags = async () => {
        try {
            const images = await db.getImagesByPersona(persona.id);
            const tags = new Set<string>();
            images.forEach(img => img.tags.forEach(t => tags.add(t)));
            setAvailableTags(Array.from(tags).sort());
        } catch (e) {
            console.error("Failed to load tags", e);
        }
    };
    loadTags();
  }, [persona.id]);

  const updatePatterns = (newPatterns: TrainingPair[]) => {
      setPatterns(newPatterns);
      const updated = {
          ...persona,
          neuralMap: {
              ...persona.neuralMap,
              customTraining: newPatterns
          }
      };
      onUpdate(updated);
  };

  const updateLogicRules = (newRules: LogicRule[]) => {
      setLogicRules(newRules);
      const updated = {
          ...persona,
          neuralMap: {
              ...persona.neuralMap,
              logicRules: newRules
          }
      };
      onUpdate(updated);
  };

  const startEditing = (rule: TrainingPair) => {
      setEditingId(rule.id);
      
      const currentTriggers = rule.inputPatterns && rule.inputPatterns.length > 0
          ? rule.inputPatterns
          : [rule.inputPattern];
      setTriggerList(currentTriggers);
      setTriggerInput("");

      if (rule.responses) {
          setStagedResponses(rule.responses);
      } else if (rule.response) {
          setStagedResponses([{ text: rule.response, timeOfDay: 'any' }]);
      } else {
          setStagedResponses([]);
      }

      setResponseInput("");
      setTimeOfDay('any');

      if (rule.type === 'text') {
          setActiveTab('chat');
      } else if (rule.type === 'image_trigger') {
          setActiveTab('visual');
          setVisTag(rule.imageTag || "");
      } else if (rule.type === 'audio_trigger') {
          setActiveTab('audio');
          setAudioData(rule.audioData || null);
      }
  };

  const cancelEditing = () => {
      setEditingId(null);
      setTriggerList([]);
      setTriggerInput("");
      setStagedResponses([]);
      setResponseInput("");
      setTimeOfDay('any');
      setVisTag("");
      setAudioData(null);
  };

  const startEditingLogic = (rule: LogicRule) => {
      setEditingLogicId(rule.id);
      setConditionMonitor(rule.monitor);
      setConditionTarget(rule.target);
      setConditionThreshold(rule.threshold);
      setConditionAction(rule.action);
      setConditionPayload(rule.actionPayload);
      setConditionReset(rule.resetOnTrigger);
  };

  const cancelEditingLogic = () => {
      setEditingLogicId(null);
      setConditionTarget("");
      setConditionPayload("");
      setConditionThreshold(3);
  };

  const handleSaveRule = (type: 'text' | 'image_trigger' | 'audio_trigger') => {
      let finalTriggers = [...triggerList];
      if (triggerInput.trim() && !finalTriggers.includes(triggerInput.trim())) {
          finalTriggers.push(triggerInput.trim());
      }

      if (finalTriggers.length === 0) {
          window.notify("Add at least one trigger phrase", "error");
          return;
      }

      let finalResponses = [...stagedResponses];
      if (responseInput.trim()) {
          finalResponses.push({ text: responseInput, timeOfDay });
      }

      if (finalResponses.length === 0) {
           if (type === 'audio_trigger') {
               finalResponses.push({ text: "(Audio Message)", timeOfDay: 'any' });
           } else {
               window.notify("Add at least one response text", "error");
               return;
           }
      }

      if (type === 'image_trigger' && !visTag) {
          window.notify("Select an image tag", "error");
          return;
      }
      if (type === 'audio_trigger' && !audioData && !editingId) {
           window.notify("Please upload audio", "error");
           return;
      }

      if (!editingId) {
          const existingRuleIndex = patterns.findIndex(p => 
             p.type === type && 
             p.inputPatterns && 
             p.inputPatterns.some(existingT => finalTriggers.includes(existingT))
          );

          if (existingRuleIndex !== -1) {
              const existingRule = patterns[existingRuleIndex];
              const confirmMerge = window.confirm(`Similar rule found! \n\nExisting Rule: "${existingRule.inputPatterns?.join(', ')}"\n\nDo you want to MERGE these new triggers/responses into it instead of creating a duplicate?`);
              
              if (confirmMerge) {
                  const mergedTriggers = Array.from(new Set([...(existingRule.inputPatterns || []), ...finalTriggers]));
                  const mergedResponses = [...(existingRule.responses || []), ...finalResponses];
                  
                  const updatedPatterns = [...patterns];
                  updatedPatterns[existingRuleIndex] = {
                      ...existingRule,
                      inputPatterns: mergedTriggers,
                      responses: mergedResponses
                  };
                  
                  updatePatterns(updatedPatterns);
                  window.notify("Rules Merged Successfully!", "success");
                  cancelEditing();
                  return;
              }
          }
      }

      if (editingId) {
          const updatedPatterns = patterns.map(p => {
              if (p.id === editingId) {
                  return {
                      ...p,
                      inputPattern: finalTriggers[0],
                      inputPatterns: finalTriggers,
                      responses: finalResponses,
                      imageTag: type === 'image_trigger' ? visTag : undefined,
                      audioData: type === 'audio_trigger' ? (audioData || p.audioData) : undefined
                  };
              }
              return p;
          });
          updatePatterns(updatedPatterns);
          window.notify("Rule Updated!", "success");
          cancelEditing();
      } else {
          const newRule: TrainingPair = {
              id: Date.now().toString(),
              type: type,
              inputPattern: finalTriggers[0],
              inputPatterns: finalTriggers,
              responses: finalResponses,
              imageTag: type === 'image_trigger' ? visTag : undefined,
              audioData: type === 'audio_trigger' ? audioData! : undefined
          };
          updatePatterns([...patterns, newRule]);
          window.notify("Rule Added!", "success");
          cancelEditing();
      }
  };

  const handleSaveCondition = () => {
      if (!conditionTarget || !conditionPayload) {
          window.notify("Please fill in all fields", "error");
          return;
      }

      if (editingLogicId) {
          const updatedRules = logicRules.map(r => {
              if (r.id === editingLogicId) {
                  return {
                      ...r,
                      name: `${conditionMonitor} -> ${conditionAction}`,
                      monitor: conditionMonitor,
                      target: conditionTarget.toLowerCase().trim(),
                      threshold: conditionThreshold,
                      action: conditionAction,
                      actionPayload: conditionPayload,
                      resetOnTrigger: conditionReset
                  };
              }
              return r;
          });
          updateLogicRules(updatedRules);
          window.notify("Condition Updated!", "success");
          cancelEditingLogic();
      } else {
          const newRule: LogicRule = {
              id: Date.now().toString(),
              name: `${conditionMonitor} -> ${conditionAction}`,
              monitor: conditionMonitor,
              target: conditionTarget.toLowerCase().trim(),
              threshold: conditionThreshold,
              action: conditionAction,
              actionPayload: conditionPayload,
              resetOnTrigger: conditionReset
          };
          updateLogicRules([...logicRules, newRule]);
          window.notify("Condition Added!", "success");
          setConditionTarget("");
          setConditionPayload("");
      }
  };

  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
          setAudioData(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
  };

  const handleDelete = (id: string) => {
      if (editingId === id) cancelEditing();
      updatePatterns(patterns.filter(p => p.id !== id));
      window.notify("Rule Deleted", "info");
  };
  
  const handleDeleteLogic = (id: string) => {
      if (editingLogicId === id) cancelEditingLogic();
      updateLogicRules(logicRules.filter(r => r.id !== id));
      window.notify("Condition Deleted", "info");
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
              const img = new Image();
              img.onload = () => {
                  const canvas = document.createElement('canvas');
                  let width = img.width;
                  let height = img.height;
                  const MAX = 512;
                  if (width > MAX || height > MAX) {
                      if (width > height) { height *= MAX / width; width = MAX; }
                      else { width *= MAX / height; height = MAX; }
                  }
                  canvas.width = width;
                  canvas.height = height;
                  const ctx = canvas.getContext('2d');
                  ctx?.drawImage(img, 0, 0, width, height);
                  onUpdate({ ...persona, avatarUrl: canvas.toDataURL('image/jpeg', 0.8) });
              };
              img.src = ev.target?.result as string;
          };
          reader.readAsDataURL(file);
      }
  };

  const handleWallpaperChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
              const img = new Image();
              img.onload = () => {
                  const canvas = document.createElement('canvas');
                  let width = img.width;
                  let height = img.height;
                  const MAX = 1024;
                  if (width > MAX || height > MAX) {
                      if (width > height) { height *= MAX / width; width = MAX; }
                      else { width *= MAX / height; height = MAX; }
                  }
                  canvas.width = width;
                  canvas.height = height;
                  const ctx = canvas.getContext('2d');
                  ctx?.drawImage(img, 0, 0, width, height);
                  onUpdate({ ...persona, chatWallpaper: canvas.toDataURL('image/jpeg', 0.7) });
              };
              img.src = ev.target?.result as string;
          };
          reader.readAsDataURL(file);
      }
  };

  const handleExportClick = async () => {
      if (!isDeveloperMode()) return;

      // Step 2: Share Immediately (Synchronous User Gesture)
      if (preparedExport) {
          await shareOrDownload(preparedExport.filename, preparedExport.type, preparedExport.data);
          setPreparedExport(null); // Reset after share
          return;
      }

      // Step 1: Prepare (Async)
      setIsExporting(true);
      try {
          const json = await db.exportPersonaBundle(persona.id);
          const filename = `${persona.name.replace(/\s+/g, '_')}_Soul.json`;
          
          setPreparedExport({ filename, data: json, type: 'application/json' });
          
      } catch (err) {
          console.error(err);
          window.notify("Export preparation failed", "error");
      } finally {
          setIsExporting(false);
      }
  };

  const handleSegmentedExport = async (filterType: 'all' | 'text' | 'image_trigger' | 'audio_trigger') => {
    if (!isDeveloperMode()) return;

    let dataToExport = patterns;
    let label = "all";

    if (filterType !== 'all') {
        dataToExport = patterns.filter(p => p.type === filterType);
        label = filterType === 'text' ? 'chat' : (filterType === 'image_trigger' ? 'visual' : 'audio');
    }

    if (dataToExport.length === 0) {
        window.notify("No rules found for this category", "error");
        return;
    }

    const rulesJson = JSON.stringify(dataToExport, null, 2);
    const filename = `${persona.name.replace(/\s+/g, '_')}_${label}_rules.json`;
    
    await shareOrDownload(filename, 'application/json', rulesJson);
    setShowExportOptions(false);
  };

  const handleImportRules = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (ev) => {
          try {
              const content = ev.target?.result as string;
              const importedRules = JSON.parse(content);
              if (Array.isArray(importedRules)) {
                  const newRules = importedRules.map((r: any) => ({ ...r, id: Date.now() + Math.random().toString() }));
                  updatePatterns([...patterns, ...newRules]);
                  window.notify(`Successfully imported ${newRules.length} rules`, "success");
              } else {
                  window.notify("Invalid format", "error");
              }
          } catch (err) {
              window.notify("Failed to read file", "error");
          }
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  // --- UI COMPONENTS ---
  const renderTriggerSection = (placeholder: string) => (
      <div className="space-y-2">
           <label className="text-xs text-gray-400 font-bold uppercase">1. When User Says (Triggers)</label>
           <div className="flex flex-wrap gap-2 bg-black border border-gray-700 rounded p-2 min-h-[42px]">
               {triggerList.map((t, i) => (
                   <span key={i} className="bg-indigo-900 text-indigo-100 text-xs px-2 py-1 rounded flex items-center gap-1">
                       {t}
                       <button onClick={() => removeTrigger(i)} className="hover:text-white font-bold">×</button>
                   </span>
               ))}
               <input 
                   value={triggerInput} 
                   onChange={e => setTriggerInput(e.target.value)} 
                   onKeyDown={handleTriggerKeyDown}
                   placeholder={triggerList.length === 0 ? placeholder : ""} 
                   className="bg-transparent text-sm text-white focus:outline-none flex-1 min-w-[120px]" 
               />
           </div>
           <button onClick={addTrigger} className="text-[10px] text-indigo-400 hover:text-indigo-300 bg-white/5 px-2 py-1 rounded">
               + Add Phrase
           </button>
      </div>
  );

  const renderResponseSection = (captionPlaceholder: string) => (
      <div className="space-y-2">
           <label className="text-xs text-gray-400 font-bold uppercase">2. Bot Responses (Randomized)</label>
           
           {stagedResponses.length > 0 && (
               <div className="space-y-1 bg-black/20 p-2 rounded">
                   {stagedResponses.map((r, i) => (
                       <div key={i} className="flex justify-between items-center bg-white/5 p-2 rounded text-xs">
                           <span className="text-gray-300">{r.text}</span>
                           <div className="flex items-center gap-2">
                               <span className="text-[10px] uppercase text-gray-500 bg-gray-900 px-1 rounded">{r.timeOfDay}</span>
                               <button onClick={() => removeStagedResponse(i)} className="text-red-400 hover:text-white">✕</button>
                           </div>
                       </div>
                   ))}
               </div>
           )}

           <div className="flex gap-2">
               <textarea 
                   value={responseInput} 
                   onChange={e => setResponseInput(e.target.value)} 
                   placeholder={captionPlaceholder} 
                   className="flex-1 bg-black border border-gray-700 rounded p-2 text-sm text-white h-12" 
               />
               <div className="w-24 flex flex-col gap-1">
                   <select 
                       value={timeOfDay} 
                       onChange={e => setTimeOfDay(e.target.value as TimeOfDay)}
                       className="h-full bg-black border border-gray-700 rounded p-1 text-xs text-white focus:outline-none"
                   >
                       <option value="any">Any Time</option>
                       <option value="morning">Morning</option>
                       <option value="afternoon">Afternoon</option>
                       <option value="evening">Evening</option>
                       <option value="lateNight">Late Night</option>
                   </select>
               </div>
               <button onClick={addStagedResponse} className="bg-gray-700 hover:bg-gray-600 text-white px-3 rounded">
                   +
               </button>
           </div>
      </div>
  );

  const TabButton = ({ id, label, count, disabled }: { id: typeof activeTab, label: string, count?: number, disabled?: boolean }) => (
      <button 
        onClick={() => !disabled && setActiveTab(id)} 
        className={`flex-1 min-w-[100px] p-3 text-sm font-medium whitespace-nowrap flex items-center justify-center gap-2
        ${activeTab === id ? 'text-primary border-b-2 border-primary' : 'text-gray-400'} 
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:text-white'}`}
      >
          {label}
          {count !== undefined && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === id ? 'bg-primary/20 text-primary' : 'bg-white/10 text-gray-500'}`}>
                  {count}
              </span>
          )}
      </button>
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="bg-surface border border-gray-700 w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        
        <div className="p-4 border-b border-gray-700 bg-darker flex justify-between items-center">
            <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    {editingId ? '✏️ Editing Rule' : '🧠 Offline Neural Trainer'}
                </h2>
                <p className="text-xs text-gray-400">Hardcode specific patterns into {persona.name}'s offline brain.</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="flex bg-darker border-b border-gray-700 overflow-x-auto">
            <TabButton id="chat" label="Chat Rules" count={chatCount} disabled={!!editingId} />
            <TabButton id="visual" label="Visual" count={visCount} disabled={!!editingId} />
            <TabButton id="audio" label="Audio" count={audioCount} disabled={!!editingId} />
            <TabButton id="conditions" label="Logic" count={conditionCount} disabled={!!editingId} />
            <TabButton id="settings" label="Settings" disabled={!!editingId} />
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-[#0a0a0a]">
            {/* ... [Chat/Visual/Audio/Logic Tab Content remains unchanged] ... */}
            {activeTab === 'chat' && (
                <div className="space-y-6">
                    <div className={`bg-white/5 p-4 rounded-lg space-y-4 border ${editingId ? 'border-primary' : 'border-transparent'}`}>
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-bold text-white">{editingId ? 'Edit Rule' : 'Add New Rule'}</h3>
                            {editingId && <button onClick={cancelEditing} className="text-xs text-gray-400 hover:text-white">Cancel Edit</button>}
                        </div>
                        
                        {renderTriggerSection("e.g. 'Good Morning'")}
                        {renderResponseSection("Bot reply variation...")}

                        <button onClick={() => handleSaveRule('text')} className={`px-4 py-2 rounded text-white text-sm w-full ${editingId ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-primary hover:bg-indigo-600'}`}>
                            {editingId ? 'Save Changes' : 'Add Rule'}
                        </button>
                    </div>

                    <div className="space-y-2">
                        {patterns.filter(p => p.type === 'text').map(p => {
                             const isEditingThis = editingId === p.id;
                             const displayPatterns = p.inputPatterns || [p.inputPattern];
                             return (
                                 <div key={p.id} className={`bg-white/5 p-3 rounded border transition-colors ${isEditingThis ? 'border-primary bg-primary/10' : 'border-white/5'}`}>
                                     <div className="flex-1 mr-2 flex flex-wrap gap-1">
                                         {displayPatterns.map((pat, i) => (
                                             <span key={i} className="text-xs bg-indigo-900/50 text-indigo-300 px-1.5 rounded border border-indigo-500/20">{pat}</span>
                                         ))}
                                     </div>
                                     <div className="mt-2 text-xs text-gray-500">
                                         {p.responses[0]?.text || "No response text"} {p.responses.length > 1 && `+ ${p.responses.length - 1} more`}
                                     </div>
                                     <div className="flex gap-2 mt-2">
                                         <button onClick={() => startEditing(p)} className="text-indigo-400 hover:text-indigo-300 text-xs font-bold disabled:opacity-50" disabled={!!editingId && !isEditingThis}>Edit</button>
                                         <button onClick={() => handleDelete(p.id)} className="text-red-400 hover:text-red-300 text-xs disabled:opacity-50" disabled={!!editingId && !isEditingThis}>Delete</button>
                                     </div>
                                 </div>
                             );
                        })}
                    </div>
                </div>
            )}

            {activeTab === 'visual' && (
                <div className="space-y-6">
                    <div className={`bg-white/5 p-4 rounded-lg space-y-4 border ${editingId ? 'border-primary' : 'border-transparent'}`}>
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                {editingId ? 'Edit Visual Trigger' : 'Add Visual Trigger'}
                            </h3>
                            {editingId && <button onClick={cancelEditing} className="text-xs text-gray-400 hover:text-white">Cancel Edit</button>}
                        </div>
                        
                        {renderTriggerSection("e.g. 'Show me your outfit'")}
                        
                        <div>
                            <label className="block text-xs text-gray-400 font-bold uppercase mb-1">Target Image Tag</label>
                            <div className="flex gap-2">
                                <input 
                                    value={visTag} 
                                    onChange={e => setVisTag(e.target.value)} 
                                    placeholder="e.g. 'gym' or 'naughty'" 
                                    className="flex-1 bg-black border border-gray-700 rounded p-2 text-sm text-white" 
                                    list="tag-options"
                                />
                                <datalist id="tag-options">
                                    {availableTags.map((t, idx) => <option key={idx} value={t} />)}
                                </datalist>
                            </div>
                        </div>

                        {renderResponseSection("Caption for photo (Optional)...")}

                        <button 
                            onClick={() => handleSaveRule('image_trigger')} 
                            className={`px-4 py-2 rounded text-white text-sm w-full flex justify-center items-center gap-2 ${editingId ? 'bg-indigo-600' : 'bg-secondary'}`}
                        >
                             {editingId ? 'Save Changes' : 'Add Visual Rule'}
                        </button>
                    </div>

                    <div className="space-y-2">
                        {patterns.filter(p => p.type === 'image_trigger').map(p => {
                            const isEditingThis = editingId === p.id;
                            const displayPatterns = p.inputPatterns || [p.inputPattern];
                            return (
                                <div key={p.id} className={`flex justify-between items-start bg-white/5 p-3 rounded border transition-colors ${isEditingThis ? 'border-primary bg-primary/10' : 'border-white/5'}`}>
                                    <div className="flex-1">
                                        <div className="flex flex-wrap gap-1 mb-1">
                                            {displayPatterns.map((pat, i) => (
                                                <span key={i} className="text-xs bg-purple-900/50 text-purple-300 px-1.5 rounded border border-purple-500/20">{pat}</span>
                                            ))}
                                        </div>
                                        <p className="text-sm text-gray-300 mt-1">Sends photo tagged <span className="text-white bg-white/10 px-1 rounded">#{p.imageTag}</span></p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => startEditing(p)} className="text-indigo-400 hover:text-indigo-300 text-xs font-bold disabled:opacity-50" disabled={!!editingId && !isEditingThis}>Edit</button>
                                        <button onClick={() => handleDelete(p.id)} className="text-red-400 hover:text-red-300 text-xs disabled:opacity-50" disabled={!!editingId && !isEditingThis}>Delete</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {activeTab === 'audio' && (
                <div className="space-y-6">
                    <div className={`bg-white/5 p-4 rounded-lg space-y-4 border ${editingId ? 'border-primary' : 'border-transparent'}`}>
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                {editingId ? 'Edit Audio Trigger' : 'Add Audio Trigger'}
                            </h3>
                            {editingId && <button onClick={cancelEditing} className="text-xs text-gray-400 hover:text-white">Cancel Edit</button>}
                        </div>
                        
                        {renderTriggerSection("e.g. 'Sing for me'")}
                        
                        <div>
                            <label className="block text-xs text-gray-400 font-bold uppercase mb-1">Audio File (Max 2MB)</label>
                            <input type="file" accept="audio/*" onChange={handleAudioFileChange} className="block w-full text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700" />
                        </div>

                        {audioData && (
                            <audio src={audioData} controls className="w-full h-8 mt-2" />
                        )}

                        {renderResponseSection("Text message to accompany audio...")}
                        
                        <button 
                            onClick={() => handleSaveRule('audio_trigger')} 
                            disabled={!audioData && !editingId} 
                            className={`px-4 py-2 rounded text-white text-sm w-full disabled:opacity-50 flex justify-center items-center gap-2 ${editingId ? 'bg-indigo-600' : 'bg-emerald-600'}`}
                        >
                             {editingId ? 'Save Changes' : 'Save Audio Rule'}
                        </button>
                    </div>

                    <div className="space-y-2">
                        {patterns.filter(p => p.type === 'audio_trigger').map(p => {
                            const isEditingThis = editingId === p.id;
                            const displayPatterns = p.inputPatterns || [p.inputPattern];
                            return (
                                <div key={p.id} className={`flex justify-between items-start bg-white/5 p-3 rounded border transition-colors ${isEditingThis ? 'border-primary bg-primary/10' : 'border-white/5'}`}>
                                    <div className="flex-1 mr-4">
                                        <div className="flex flex-wrap gap-1 mb-1">
                                            {displayPatterns.map((pat, i) => (
                                                <span key={i} className="text-xs bg-emerald-900/50 text-emerald-300 px-1.5 rounded border border-emerald-500/20">{pat}</span>
                                            ))}
                                        </div>
                                        <audio src={p.audioData} controls className="w-full h-6 mt-1" />
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => startEditing(p)} className="text-indigo-400 hover:text-indigo-300 text-xs font-bold disabled:opacity-50" disabled={!!editingId && !isEditingThis}>Edit</button>
                                        <button onClick={() => handleDelete(p.id)} className="text-red-400 hover:text-red-300 text-xs disabled:opacity-50" disabled={!!editingId && !isEditingThis}>Delete</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            
            {activeTab === 'conditions' && (
                <div className="space-y-6">
                    <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-lg">
                        <p className="text-xs text-blue-200">
                            <strong>Dynamic Logic:</strong> Chain events together. For example, "If the user asks for photos 3 times, send a specific audio message."
                        </p>
                    </div>

                    <div className={`bg-white/5 p-4 rounded-lg space-y-4 border ${editingLogicId ? 'border-primary' : 'border-white/5'}`}>
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-bold text-white flex gap-2">
                                {editingLogicId ? 'Edit Logic Rule' : 'Add Logic Rule'}
                            </h3>
                            {editingLogicId && <button onClick={cancelEditingLogic} className="text-xs text-gray-400 hover:text-white">Cancel Edit</button>}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-gray-400 font-bold uppercase mb-1">1. Monitor Event</label>
                                <select 
                                    value={conditionMonitor} 
                                    onChange={(e) => setConditionMonitor(e.target.value as any)}
                                    className="w-full bg-black border border-gray-700 rounded p-2 text-sm text-white"
                                >
                                    <option value="user_says_keyword">When User says Keyword...</option>
                                    <option value="bot_sends_imagetag">When Bot sends Image Tag...</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 font-bold uppercase mb-1">Target (Keyword/Tag)</label>
                                <input 
                                    value={conditionTarget}
                                    onChange={(e) => setConditionTarget(e.target.value)}
                                    placeholder="e.g. 'love' or 'selfie'"
                                    className="w-full bg-black border border-gray-700 rounded p-2 text-sm text-white"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-gray-400 font-bold uppercase mb-1">2. Threshold (Count)</label>
                            <input 
                                type="number"
                                min="1"
                                value={conditionThreshold}
                                onChange={(e) => setConditionThreshold(parseInt(e.target.value))}
                                className="w-full bg-black border border-gray-700 rounded p-2 text-sm text-white"
                            />
                            <p className="text-[10px] text-gray-500 mt-1">Triggers when this event happens {conditionThreshold} times.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-gray-400 font-bold uppercase mb-1">3. Perform Action</label>
                                <select 
                                    value={conditionAction} 
                                    onChange={(e) => setConditionAction(e.target.value as any)}
                                    className="w-full bg-black border border-gray-700 rounded p-2 text-sm text-white"
                                >
                                    <option value="send_text">Send Text Message</option>
                                    <option value="send_image_tag">Send Image (Tag)</option>
                                    <option value="send_audio">Send Audio (Base64)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 font-bold uppercase mb-1">Action Payload</label>
                                <input 
                                    value={conditionPayload}
                                    onChange={(e) => setConditionPayload(e.target.value)}
                                    placeholder={conditionAction === 'send_text' ? "Message to send..." : (conditionAction === 'send_image_tag' ? "Tag to search..." : "Base64 Audio String...")}
                                    className="w-full bg-black border border-gray-700 rounded p-2 text-sm text-white"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                checked={conditionReset}
                                onChange={(e) => setConditionReset(e.target.checked)}
                                id="resetCheck"
                            />
                            <label htmlFor="resetCheck" className="text-xs text-gray-300">Reset count after triggering?</label>
                        </div>

                        <button onClick={handleSaveCondition} className={`w-full py-2 rounded font-bold text-sm text-white ${editingLogicId ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-pink-600 hover:bg-pink-500'}`}>
                            {editingLogicId ? 'Update Condition' : 'Save Condition'}
                        </button>
                    </div>

                    <div className="space-y-2">
                        {logicRules.map(rule => {
                            const isEditingThis = editingLogicId === rule.id;
                            return (
                                <div key={rule.id} className={`bg-white/5 p-3 rounded border transition-colors flex justify-between items-center ${isEditingThis ? 'border-primary bg-primary/10' : 'border-white/5'}`}>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold text-pink-400">IF</span>
                                            <span className="text-xs bg-gray-800 px-1 rounded text-gray-300">{rule.monitor === 'user_says_keyword' ? 'User says' : 'Bot sends tag'}</span>
                                            <span className="text-xs font-mono text-white">"{rule.target}"</span>
                                            <span className="text-xs font-bold text-pink-400">x{rule.threshold}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-green-400">THEN</span>
                                            <span className="text-xs text-gray-300">{rule.action === 'send_text' ? 'Say:' : (rule.action === 'send_image_tag' ? 'Show:' : 'Play Audio')}</span>
                                            <span className="text-xs text-white truncate max-w-[150px]">{rule.actionPayload}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => startEditingLogic(rule)} className="text-indigo-400 hover:text-white text-xs font-bold disabled:opacity-50" disabled={!!editingLogicId && !isEditingThis}>Edit</button>
                                        <button onClick={() => handleDeleteLogic(rule.id)} className="text-red-400 hover:text-white text-xs disabled:opacity-50" disabled={!!editingLogicId && !isEditingThis}>Delete</button>
                                    </div>
                                </div>
                            );
                        })}
                        {logicRules.length === 0 && <p className="text-center text-xs text-gray-600 italic">No logic rules yet.</p>}
                    </div>
                </div>
            )}

            {activeTab === 'settings' && (
                 <div className="space-y-6">
                     <div className="bg-white/5 p-4 rounded-lg space-y-2">
                         <h3 className="text-sm font-bold text-white">Identity Details</h3>
                          <div>
                             <label className="text-xs text-gray-400">Name</label>
                             <input 
                                 type="text" 
                                 value={persona.name} 
                                 onChange={(e) => onUpdate({ ...persona, name: e.target.value })}
                                 className="w-full bg-black border border-gray-700 rounded p-2 text-sm text-white focus:border-primary focus:outline-none"
                             />
                         </div>
                     </div>
                     
                     <div className="bg-white/5 p-4 rounded-lg flex flex-col gap-4">
                          <div className="flex items-center gap-4">
                             <img src={persona.avatarUrl} className="w-16 h-16 rounded-full object-cover border-2 border-white/20" />
                             <div className="flex-1">
                                  <h3 className="text-sm font-bold text-white">Profile Picture</h3>
                                  <input type="file" accept="image/*" onChange={handleAvatarChange} className="text-xs text-gray-400 mt-1" />
                             </div>
                          </div>
                          
                          <div className="h-px bg-white/5 my-1"></div>

                          <div className="flex items-center gap-4">
                             <div className="w-16 h-16 rounded-lg border-2 border-white/20 overflow-hidden bg-black relative">
                                  {persona.chatWallpaper ? (
                                     <img src={persona.chatWallpaper} className="w-full h-full object-cover" />
                                  ) : (
                                     <div className="w-full h-full bg-gradient-to-br from-indigo-900 to-black"></div>
                                  )}
                             </div>
                             <div className="flex-1">
                                  <h3 className="text-sm font-bold text-white">Chat Wallpaper</h3>
                                  <input type="file" accept="image/*" onChange={handleWallpaperChange} className="text-xs text-gray-400 mt-1" />
                                  {persona.chatWallpaper && (
                                      <button onClick={() => onUpdate({...persona, chatWallpaper: undefined})} className="text-xs text-red-400 block mt-1 hover:underline">Remove Wallpaper</button>
                                  )}
                             </div>
                          </div>
                     </div>

                     <div className="bg-white/5 p-4 rounded-lg space-y-4 relative">
                        <h3 className="text-sm font-bold text-white">Data Management</h3>
                        
                        <div className="flex gap-3 relative">
                             {/* EXPORT RULES: DEVELOPER ONLY */}
                             {isDeveloperMode() && (
                                <button 
                                    onClick={() => setShowExportOptions(!showExportOptions)} 
                                    className="flex-1 py-2 bg-indigo-900/50 border border-indigo-500/30 text-indigo-200 rounded text-xs font-bold hover:bg-indigo-900/80 shadow-lg flex items-center justify-center gap-2"
                                >
                                    Export Rules
                                </button>
                             )}

                             <div className="flex-1 relative">
                                <button className="w-full h-full py-2 bg-gray-700 rounded text-xs font-bold hover:bg-gray-600 shadow-lg">Import Rules JSON</button>
                                <input type="file" accept=".json" onChange={handleImportRules} className="absolute inset-0 opacity-0 cursor-pointer" />
                             </div>

                             {isDeveloperMode() && showExportOptions && (
                                 <div className="absolute top-12 left-0 w-64 bg-black border border-gray-600 rounded-xl shadow-2xl z-50 p-2 flex flex-col gap-1 animate-fade-in">
                                     <p className="text-[10px] text-gray-500 uppercase font-bold px-2 py-1">Select Export Type</p>
                                     <button onClick={() => handleSegmentedExport('text')} className="text-left px-3 py-2 text-xs text-white hover:bg-white/10 rounded">💬 Chat Rules Only</button>
                                     <button onClick={() => handleSegmentedExport('image_trigger')} className="text-left px-3 py-2 text-xs text-white hover:bg-white/10 rounded">📸 Visual Rules Only</button>
                                     <button onClick={() => handleSegmentedExport('audio_trigger')} className="text-left px-3 py-2 text-xs text-white hover:bg-white/10 rounded">🎤 Audio Rules Only</button>
                                     <div className="h-px bg-white/10 my-1"></div>
                                     <button onClick={() => handleSegmentedExport('all')} className="text-left px-3 py-2 text-xs text-green-400 hover:bg-white/10 rounded font-bold">All Rules (Backup)</button>
                                     <button onClick={() => setShowExportOptions(false)} className="text-left px-3 py-2 text-xs text-red-400 hover:bg-white/10 rounded mt-1">Cancel</button>
                                 </div>
                             )}
                        </div>

                        {/* EXPORT SOUL: DEVELOPER ONLY */}
                        {isDeveloperMode() ? (
                            <button 
                                onClick={handleExportClick} 
                                disabled={isExporting}
                                className={`w-full py-4 rounded-lg text-white font-serif font-bold tracking-wider shadow-[0_4px_20px_rgba(217,119,6,0.2)] border border-yellow-400/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 
                                ${preparedExport 
                                    ? 'bg-gradient-to-r from-emerald-600 to-green-600 animate-pulse' 
                                    : 'bg-gradient-to-r from-yellow-700 via-amber-600 to-yellow-700'}
                                ${isExporting ? 'opacity-70 cursor-wait' : ''}`}
                            >
                                {isExporting 
                                    ? 'Packing Soul...' 
                                    : (preparedExport ? 'Ready! Tap to Share' : `Export Soul of ${persona.name}`)
                                }
                            </button>
                        ) : (
                            <p className="text-[10px] text-gray-500 italic text-center mt-2">Export options are restricted to Developer Mode.</p>
                        )}
                     </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
