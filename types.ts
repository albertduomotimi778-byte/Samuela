
export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
}

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  AUDIO = 'audio',
}

export interface Message {
  id: string;
  role: MessageRole;
  type: MessageType;
  content: string; // Text content or Base64 data
  timestamp: number;
}

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'lateNight' | 'any';

export interface TrainingResponse {
  text: string;
  timeOfDay?: TimeOfDay;
  mood?: string; // Prepared for future expansion
}

export interface TrainingPair {
  id: string;
  
  // New Structure: Multiple triggers for one rule
  inputPatterns?: string[]; 
  
  // Legacy support (to be migrated at runtime)
  inputPattern: string; 
  
  // New Structure
  responses: TrainingResponse[];
  
  // Legacy support (optional, for migration)
  response?: string; 

  type: 'text' | 'image_trigger' | 'audio_trigger';
  imageTag?: string; // If type is image_trigger, which tag to search for
  audioData?: string; // Base64 audio string for audio_trigger
}

// --- LOGIC & CONDITIONS ---
export interface LogicRule {
    id: string;
    name: string;
    // When to check
    monitor: 'user_says_keyword' | 'bot_sends_imagetag';
    // What to check for
    target: string; // The keyword or the tag
    // How many times?
    threshold: number;
    // What to do
    action: 'send_text' | 'send_image_tag' | 'send_audio';
    actionPayload: string; // text, tag, or base64 audio
    resetOnTrigger: boolean;
}

// --- THE HYPER-BRAIN STRUCTURE ---

export interface Scenario {
  id: string;
  category: 'romance' | 'conflict' | 'intellectual' | 'casual' | 'intimate' | 'crisis' | 'learning';
  triggers: string[];
  responses: string[];
  followUpQuestions: string[];
  minAffection: number; 
}

export interface StoryArc {
  title: string;
  parts: string[];
}

export interface NeuralMap {
  coreIdentity: {
    name: string;
    age: string;
    gender: string;
    location: string;
    occupation: string;
    hobbies: string[];
    secret: string;
    dream: string;
    backstory: string;
  };

  traits: {
      formal_casual: number; 
      wholesome_spicy: number; 
      empathetic_logical: number; 
      cheerful_moody: number; 
  };

  interactionStyle: {
      avgReplyLength: 'short' | 'medium' | 'long';
      questionFrequency: number; 
      echoFrequency: number; 
      assertiveness: number; 
  };
  
  associativeLexicon: {
      topics: {
          wealth: string[];
          politics: string[];
          religion: string[];
          technology: string[];
          art: string[];
          love: string[];
          work: string[];
          life: string[];
          fun: string[];
      },
      reactions: {
          admiration: string[];
          physical_compliment: string[];
          intimate_compliment: string[];
          insult: string[];
          flirt_response: string[];
          agreement: string[];
          disagreement: string[];
          confusion: string[];
          laughter: string[];
          neutral_acknowledgment: string[];
      }
  };

  vocabulary: {
      adjectives: string[];
      verbs: string[];
      nicknames: string[];
      interjections: string[]; 
      slang: string[]; 
  };

  writingStyle: {
    tone: string;
    useEmojis: boolean;
    emojiFrequency: number; 
    typicalPunctuation: string;
    quirks: string[];
  };

  sentenceTemplates: {
      openers: string[]; 
      connectors: string[]; 
      closers: string[]; 
      genericObservations: string[]; 
      transitions: string[]; 
  };

  knowledgeGraph: { 
      domain: string; 
      keywords: string[]; 
      facts: string[]; 
      opinions: string[]; 
  }[];
  
  linguisticPatterns: {
      pattern: string; 
      intent: 'question' | 'statement' | 'emotion' | 'greeting' | 'other';
      responses: string[]; 
  }[];
  
  // NEW: User Defined Training
  customTraining?: TrainingPair[];
  
  // NEW: Dynamic Logic Rules
  logicRules?: LogicRule[];

  scenarioMatrix: Scenario[];
  
  curiosityModel: {
      topics: string[]; 
      questions: string[]; 
  };

  storytelling: {
    stories: StoryArc[];
    jokes: string[];
    flirtyComebacks: string[];
    randomThoughts: string[]; 
    philosophicalMusings: string[]; 
  };

  dailySchedule: {
    morning: string[];
    afternoon: string[];
    evening: string[];
    lateNight: string[];
  };
  visualImagination: string[]; 
}

export interface PersonaProfile {
  id: string;
  name: string;
  avatarUrl: string;
  avatarPrompt: string; 
  relationship: 'friend' | 'romantic' | 'mentor' | 'assistant' | 'other';
  
  // Permissions
  allowTraining: boolean; // Can the user access training mode?
  canGenerateImages: boolean; // Can the user use AI generation (false for imported chats)

  // Customization
  chatWallpaper?: string; // Base64 or URL

  neuralMap: NeuralMap;

  memory: {
    userFacts: string[]; 
    sharedExperiences: string[];
    mood: number; 
    affection: number; 
    currentStory?: { 
        storyIndex: number;
        partIndex: number;
    };
    waitingForCompliment?: boolean;
    waitingForDefinition?: string | null; // NEW: Stores the question AI didn't know
    lastTopic?: string; 
    lastSubject?: string; 
    lastResponses: string[]; 
    lastSentImageIds?: string[]; // NEW: For shuffling logic
    
    // NEW: Counter state for Logic Rules
    logicCounts?: Record<string, number>; // e.g. "tag_gym": 3, "kw_hello": 5
  };

  lastMessage?: string;
  lastMessageTime?: number;
  evolutionCount: number;
  
  simulationScore?: number;
}

export interface ChatSession {
  personaId: string;
  messages: Message[];
}
