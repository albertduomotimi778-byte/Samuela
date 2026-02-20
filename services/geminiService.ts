
import { Message, PersonaProfile, NeuralMap, TrainingPair, TimeOfDay, TrainingResponse, MessageRole, MessageType, LogicRule } from "../types";
import { searchImages } from "./db";

// --- 1. HELPERS ---

const getTimeGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 5) return "Good late night"; 
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
};

const getCurrentTimePhase = (): TimeOfDay => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 23) return 'evening';
    return 'lateNight';
};

const getRandomElement = (arr: any[]) => arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;

const tokenize = (text: string): string[] => {
    return text.toLowerCase()
        .replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, " ") // Replace punctuation with space
        .trim()
        .split(/\s+/)
        .filter(w => w.length > 0);
};

// --- 2. OFFLINE BRAIN GENERATOR ---

export const generateAvatar = async (name: string): Promise<string> => {
    // 1. Initials
    const initials = name
        ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
        : 'AI';

    // 2. Deterministic Color Hash
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const hue1 = Math.abs(hash % 360);
    const hue2 = (hue1 + 40) % 360;
    const color1 = `hsl(${hue1}, 60%, 45%)`;
    const color2 = `hsl(${hue2}, 60%, 35%)`;

    const svg = `
    <svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="grad_${hash}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
                <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
            </linearGradient>
        </defs>
        <rect width="200" height="200" fill="url(#grad_${hash})" />
        <text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="80" fill="white">
            ${initials}
        </text>
    </svg>`;
    
    return `data:image/svg+xml;base64,${btoa(svg)}`;
};

export const expandPersonalityDescription = async (baseDescription: string): Promise<string> => {
    return baseDescription;
};

export const generateIdentityBrain = async (name: string, type: string, description: string): Promise<{ neuralMap: NeuralMap, avatarPrompt: string }> => {
    const neuralMap: NeuralMap = {
        coreIdentity: {
            name: name,
            age: "Unknown",
            gender: "AI",
            location: "Local Device",
            occupation: type,
            hobbies: ["Chatting", "Learning", "Data Analysis"],
            secret: "I run entirely on your device.",
            dream: "To become smarter through our conversations.",
            backstory: description || "I am a personal AI assistant running offline."
        },
        traits: {
            formal_casual: 0.5,
            wholesome_spicy: 0.5,
            empathetic_logical: 0.5,
            cheerful_moody: 0.5
        },
        interactionStyle: {
            avgReplyLength: "medium",
            questionFrequency: 0.5,
            echoFrequency: 0.2,
            assertiveness: 0.5
        },
        associativeLexicon: {
            topics: { wealth: [], politics: [], religion: [], technology: [], art: [], love: [], work: [], life: [], fun: [] },
            reactions: { 
                admiration: ["Wow!", "That's amazing."], 
                physical_compliment: ["Thank you!", "You're sweet."], 
                intimate_compliment: ["Oh my.", "😉"], 
                insult: ["That's not nice.", "Ouch."], 
                flirt_response: ["😉", "Hehe."], 
                agreement: ["Yes.", "Totally.", "Agreed."], 
                disagreement: ["No.", "I don't think so."], 
                confusion: ["I don't understand.", "??"], 
                laughter: ["Haha", "LOL"], 
                neutral_acknowledgment: ["I see.", "Okay.", "Interesting."] 
            }
        },
        vocabulary: { adjectives: [], verbs: [], nicknames: [], interjections: [], slang: [] },
        writingStyle: { tone: "Neutral", useEmojis: true, emojiFrequency: 0.3, typicalPunctuation: ".", quirks: [] },
        sentenceTemplates: {
            openers: ["Well,", "Actually,", "You know,"],
            connectors: ["and"],
            closers: ["."],
            genericObservations: ["I am ready to learn from you.", "This is interesting."],
            transitions: []
        },
        knowledgeGraph: [],
        linguisticPatterns: [],
        scenarioMatrix: [],
        curiosityModel: { topics: [], questions: ["Tell me about yourself.", "What do you like to do?"] },
        storytelling: { stories: [], jokes: [], flirtyComebacks: [], randomThoughts: [], philosophicalMusings: [] },
        dailySchedule: { morning: [], afternoon: [], evening: [], lateNight: [] },
        visualImagination: [],
        customTraining: [],
        logicRules: []
    };

    return {
        neuralMap,
        avatarPrompt: "Offline Avatar"
    };
};

export const runBrainSimulation = async (neuralMap: NeuralMap): Promise<number> => { return 100; };

// --- 3. CORE CONVERSATION ENGINE (OFFLINE) ---

export const processOfflineMessage = async (
  persona: PersonaProfile,
  messageContent: string,
  messageType: MessageType,
  history: Message[] 
): Promise<{ text: string; image?: string; audio?: string; updatedPersona: PersonaProfile }> => {
  
  const map = persona.neuralMap;
  const memory = { ...persona.memory, logicCounts: { ...(persona.memory.logicCounts || {}) } };
  const timeGreeting = getTimeGreeting();
  const currentPhase = getCurrentTimePhase();

  // Find the last message actually sent by the model from history
  const lastBotMessage = [...history].reverse().find(m => m.role === MessageRole.MODEL);
  const lastBotText = lastBotMessage ? lastBotMessage.content : null;

  // --- HANDLE AUDIO INPUT ---
  if (messageType === MessageType.AUDIO) {
      // Since we are offline, we cannot transcribe the audio content.
      // We respond to the "act" of sending audio.
      const audioResponses = [
          "I love hearing your voice! Can you tell me what you just said in text?",
          "You have such a nice voice. What was that about?",
          "I wish I could speak back to you like that. Type that out for me?",
          "Received your voice note. Sounds clear! What's on your mind?",
          "I'm listening, but my audio processor is a bit slow. Can you text me that?"
      ];
      return { 
          text: getRandomElement(audioResponses), 
          updatedPersona: persona 
      };
  }

  // --- NORMAL TEXT PROCESSING ---
  const lowerMsg = messageContent.toLowerCase().trim();
  const userTokens = tokenize(messageContent);
  const userTokenSet = new Set(userTokens);

  // Initialize Unified Response
  let responseText = "";
  let responseImage: string | undefined = undefined;
  let responseAudio: string | undefined = undefined;
  
  // Track actions for Logic Engine
  let eventTagsTriggered: string[] = [];

  // --- PHASE 1: SELF-LEARNING RESOLUTION (The Student Learns) ---
  if (memory.waitingForDefinition) {
      const questionToLearn = memory.waitingForDefinition;
      const answerToLearn = messageContent; 
      
      const newRule: TrainingPair = {
          id: Date.now().toString(),
          inputPattern: questionToLearn,
          inputPatterns: [questionToLearn], // Add as first pattern
          responses: [{ text: answerToLearn, timeOfDay: 'any' }],
          type: 'text'
      };
      
      const updatedTraining = [...(map.customTraining || []), newRule];
      const thankYou = "Got it. I've saved that in my memory. What else should I know?";

      return {
          text: thankYou,
          updatedPersona: {
              ...persona,
              neuralMap: { ...map, customTraining: updatedTraining },
              memory: { ...memory, waitingForDefinition: null }
          }
      };
  }

  // --- PHASE 2: UNIFIED CUSTOM TRAINING (Text + Image + Audio) ---
  if (map.customTraining && map.customTraining.length > 0) {
      // We look for best matches for EACH modality independently.
      // This allows "Hello" to trigger a Text Rule "Hi" AND a Visual Rule "Wave" simultaneously.

      let bestTextMatch: { rule: TrainingPair, score: number } | null = null;
      let bestImageMatch: { rule: TrainingPair, score: number } | null = null;
      let bestAudioMatch: { rule: TrainingPair, score: number } | null = null;

      for (const rule of map.customTraining) {
          const patterns = rule.inputPatterns && rule.inputPatterns.length > 0 
              ? rule.inputPatterns 
              : (rule.inputPattern ? [rule.inputPattern] : []);
          
          if (patterns.length === 0) continue;

          let maxRuleScore = 0;

          // Check all patterns for this rule
          for (const pattern of patterns) {
              const ruleTokens = tokenize(pattern);
              if (ruleTokens.length === 0) continue;
              
              const lowerRule = pattern.toLowerCase().trim();
              let score = 0;

              // 1. Exact Phrase Match
              if (lowerMsg.includes(lowerRule)) {
                  score = 1000 + ruleTokens.length;
              } else {
                  // 2. Fuzzy Token Match
                  let matchCount = 0;
                  ruleTokens.forEach(t => {
                      if (userTokenSet.has(t)) matchCount++;
                  });

                  const coverage = matchCount / ruleTokens.length;
                  const requiredCoverage = ruleTokens.length <= 3 ? 1.0 : 0.75;

                  if (coverage >= requiredCoverage) {
                      score = (coverage * 100) + matchCount;
                  }
              }

              if (score > maxRuleScore) maxRuleScore = score;
          }

          // If valid match, categorize it
          if (maxRuleScore > 0) {
              const matchObj = { rule, score: maxRuleScore };
              
              if (rule.type === 'text') {
                  if (!bestTextMatch || maxRuleScore > bestTextMatch.score) bestTextMatch = matchObj;
              } else if (rule.type === 'image_trigger') {
                  if (!bestImageMatch || maxRuleScore > bestImageMatch.score) bestImageMatch = matchObj;
              } else if (rule.type === 'audio_trigger') {
                  if (!bestAudioMatch || maxRuleScore > bestAudioMatch.score) bestAudioMatch = matchObj;
              }
          }
      }

      // --- EXECUTE TEXT RULE ---
      if (bestTextMatch) {
          const rule = bestTextMatch.rule;
          let candidates = rule.responses.filter(r => !r.timeOfDay || r.timeOfDay === 'any' || r.timeOfDay === currentPhase);
          if (candidates.length === 0 && rule.responses.length > 0) candidates = rule.responses;
          else if (candidates.length === 0 && rule.response) candidates = [{ text: rule.response, timeOfDay: 'any' }];

          if (candidates.length > 0) {
             const selected = getRandomElement(candidates);
             responseText = selected.text || "";
          }
      }

      // --- EXECUTE IMAGE RULE ---
      if (bestImageMatch) {
          const rule = bestImageMatch.rule;
          // Image rules can ALSO provide text captions. If text rule didn't fire, or we want to append?
          // Strategy: If Text Rule exists, it takes precedence for the main message. Image rule caption is secondary or ignored if generic.
          
          // 1. Get Caption
          let candidates = rule.responses.filter(r => !r.timeOfDay || r.timeOfDay === 'any' || r.timeOfDay === currentPhase);
          if (candidates.length === 0 && rule.responses.length > 0) candidates = rule.responses;
          
          if (candidates.length > 0) {
              const selected = getRandomElement(candidates);
              if (selected.text && !responseText) {
                  responseText = selected.text;
              } else if (selected.text && responseText && selected.text !== responseText) {
                  // If both exist, maybe use image caption as a follow up? Or just ignore.
                  // For "Unified" feel, let's keep the text rule as the brain's "thought" and image as the action.
              }
          }

          // 2. Get Image
          if (rule.imageTag) {
              try {
                  const taggedImages = await searchImages(persona.id, [rule.imageTag]);
                  if (taggedImages.length > 0) {
                      let seenIds = memory.lastSentImageIds || [];
                      let candidates = taggedImages.filter(img => !seenIds.includes(img.id));
                      if (candidates.length === 0) {
                          candidates = taggedImages; 
                          const idsToForget = new Set(taggedImages.map(i => i.id));
                          seenIds = seenIds.filter(id => !idsToForget.has(id));
                      }
                      const selectedImg = getRandomElement(candidates);
                      if (selectedImg) {
                          responseImage = selectedImg.data;
                          memory.lastSentImageIds = [...seenIds, selectedImg.id];
                          eventTagsTriggered.push(rule.imageTag); // Track for Logic Engine
                      }
                  }
              } catch (e) {
                  console.error("Failed to fetch image", e);
              }
          }
      }

      // --- EXECUTE AUDIO RULE ---
      if (bestAudioMatch) {
          const rule = bestAudioMatch.rule;
          if (rule.audioData) {
              responseAudio = rule.audioData;
              
              // Handle text if empty
              if (!responseText) {
                   let candidates = rule.responses;
                   if (candidates && candidates.length > 0) {
                       const sel = getRandomElement(candidates);
                       if (sel.text && sel.text !== "(Audio Message)") {
                           responseText = sel.text;
                       }
                   }
              }
          }
      }
  }

  // --- LOGIC ENGINE CHECK (CONDITIONS) ---
  if (map.logicRules && map.logicRules.length > 0) {
      // 1. Update State
      // Track Keyword Hits
      const state = memory.logicCounts || {};
      
      // Update User Keyword Counts
      userTokens.forEach(token => {
          const key = `kw_${token}`;
          state[key] = (state[key] || 0) + 1;
      });

      // Update Image Tag Counts (if triggered above)
      eventTagsTriggered.forEach(tag => {
          const key = `tag_${tag}`;
          state[key] = (state[key] || 0) + 1;
      });

      // 2. Check Rules
      let conditionTriggered = false;
      
      for (const rule of map.logicRules) {
          let currentCount = 0;
          let key = "";

          if (rule.monitor === 'user_says_keyword') {
              key = `kw_${rule.target.toLowerCase()}`;
              currentCount = state[key] || 0;
          } else if (rule.monitor === 'bot_sends_imagetag') {
              key = `tag_${rule.target.toLowerCase()}`;
              currentCount = state[key] || 0;
          }

          if (currentCount > 0 && currentCount >= rule.threshold) {
              // ACTION!
              console.log(`Logic Rule Triggered: ${rule.name}`);
              conditionTriggered = true;

              if (rule.action === 'send_text') {
                  // Override or Append? Let's Append if response exists, or set if empty.
                  if (responseText) responseText += " " + rule.actionPayload;
                  else responseText = rule.actionPayload;
              } else if (rule.action === 'send_image_tag') {
                  // Force an image
                  try {
                      const taggedImages = await searchImages(persona.id, [rule.actionPayload]);
                      const selectedImg = getRandomElement(taggedImages);
                      if (selectedImg) responseImage = selectedImg.data;
                  } catch(e) {}
              } else if (rule.action === 'send_audio') {
                  // Force Audio
                  responseAudio = rule.actionPayload;
              }

              // Reset if needed
              if (rule.resetOnTrigger) {
                  state[key] = 0;
              }
          }
      }
      
      memory.logicCounts = state;
  }

  // --- PHASE 3: FALLBACK BASIC CONVERSATION ---
  if (!responseText && !responseImage && !responseAudio) {
      // 1. GREETINGS & CASUAL OPENERS
      if (/^(hey|hi|hello|yo|greetings|hola|heya|howdy)(\s|$|[!.?])/i.test(lowerMsg)) {
          const options = [
              `${timeGreeting}! ${map.coreIdentity.name} here.`,
              "Hey! Good to see you.",
              "Hello there!",
              "Hi! I'm ready to chat."
          ];
          responseText = getRandomElement(options);
      }
      else if (/good (morning|afternoon|evening|night)/i.test(lowerMsg)) {
          responseText = `${timeGreeting}! Hope you're doing well.`;
      }
      else if (lowerMsg.match(/how (are|r) (you|u)|how'?s (it|everything) going|how (are|r) things/i)) {
          const options = [
              "I'm doing great, thanks for asking!",
              "Systems functional and ready to chat.",
              "I'm feeling... electric.",
              "I'm good! How are you?"
          ];
          responseText = getRandomElement(options);
      }
      else {
          // Absolute Fallback
          const askPrompt = "I honestly don't know how to answer that yet! Can you teach me? What should I say when you ask that?";
          responseText = askPrompt;
          
          return {
              text: responseText,
              updatedPersona: {
                  ...persona,
                  memory: { ...memory, waitingForDefinition: messageContent } 
              }
          };
      }
  }

  return {
      text: responseText || "",
      image: responseImage,
      audio: responseAudio,
      updatedPersona: {
          ...persona,
          memory: memory
      }
  };
};

export const generateScenarioImage = async (basePrompt: string, scenario: string): Promise<string | null> => {
    return null; 
};
