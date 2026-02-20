import React, { useState } from 'react';
import { generateIdentityBrain, generateAvatar } from '../services/geminiService';
import { PersonaProfile } from '../types';

interface Props {
  onClose: () => void;
  onSave: (persona: PersonaProfile) => void;
}

export const BotCreationModal: React.FC<Props> = ({ onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    type: 'friend',
    description: '',
  });
  
  const handleSave = async () => {
    if (!formData.name) return;
    
    // Instant Offline Generation
    const { neuralMap, avatarPrompt } = await generateIdentityBrain(formData.name, formData.type, formData.description);
    const avatarUrl = await generateAvatar(formData.name); // Use name as seed for consistent avatar

    const newPersona: PersonaProfile = {
      id: Date.now().toString(),
      name: formData.name,
      avatarPrompt: avatarPrompt,
      relationship: formData.type as any,
      avatarUrl: avatarUrl,
      neuralMap: neuralMap,
      simulationScore: 100,
      allowTraining: true,
      canGenerateImages: false, // Disabled for offline
      memory: {
          userFacts: [],
          sharedExperiences: [],
          mood: 50,
          affection: 50,
          lastResponses: []
      },
      evolutionCount: 1
    };
    onSave(newPersona);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-surface border border-gray-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-700 bg-darker/50">
          <h2 className="text-xl font-bold text-white">
            Create Offline Identity
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Design a new local chatbot personality.
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
            <input
              type="text"
              className="w-full bg-darker border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary focus:outline-none transition-all"
              placeholder="e.g. Sarah, Dr. Stone"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Relationship Type</label>
            <select
              className="w-full bg-darker border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary focus:outline-none"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            >
              <option value="friend">Best Friend</option>
              <option value="romantic">Romantic / Partner</option>
              <option value="mentor">Mentor / Coach</option>
              <option value="assistant">Business Assistant</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Description (Optional)</label>
            <textarea
              className="w-full bg-darker border border-gray-600 rounded-lg p-3 text-white h-24 focus:ring-2 focus:ring-primary focus:outline-none resize-none"
              placeholder="Briefly describe their personality..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 flex justify-end gap-3 bg-darker/50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          
          <button
            onClick={handleSave}
            disabled={!formData.name}
            className={`px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-secondary text-white font-medium shadow-lg hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Create Chatbot
          </button>
        </div>
      </div>
    </div>
  );
};