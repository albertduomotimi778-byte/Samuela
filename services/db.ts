

import { PersonaProfile, ChatSession } from '../types';

const DB_NAME = 'SoulSyncDB';
const DB_VERSION = 3; // Bumped version to ensure schema updates apply

export interface DBImage {
  id: string;
  personaId: string;
  data: string | Blob; // Support Blob for efficient storage
  tags: string[];
  description: string;
  timestamp: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

export const getDB = (): Promise<IDBDatabase> => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        // Create personas store
        if (!db.objectStoreNames.contains('personas')) {
          db.createObjectStore('personas', { keyPath: 'id' });
        }
        // Create images store - CRITICAL for gallery
        if (!db.objectStoreNames.contains('images')) {
          const imgStore = db.createObjectStore('images', { keyPath: 'id' });
          imgStore.createIndex('personaId', 'personaId', { unique: false });
          imgStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
        }
        // Create sessions store
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'personaId' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      
      request.onerror = (event) => {
          console.error("IndexedDB Open Error:", request.error);
          reject(request.error);
      };
      
      request.onblocked = () => {
          console.warn("IndexedDB Blocked: Close other tabs with this app open.");
      };
    });
  }
  return dbPromise;
};

// --- PERSONAS ---
export const getAllPersonas = async (): Promise<PersonaProfile[]> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
        const tx = db.transaction('personas', 'readonly');
        const store = tx.objectStore('personas');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    } catch (e) {
        reject(e);
    }
  });
};

export const savePersona = async (persona: PersonaProfile): Promise<void> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
        const tx = db.transaction('personas', 'readwrite');
        const store = tx.objectStore('personas');
        const request = store.put(persona);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    } catch (e) {
        reject(e);
    }
  });
};

export const deletePersona = async (id: string): Promise<void> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('personas', 'readwrite');
    const store = tx.objectStore('personas');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// --- IMAGES ---
export const saveImage = async (image: DBImage): Promise<void> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
        // Ensure store exists before transaction
        if (!db.objectStoreNames.contains('images')) {
            throw new Error("Images store not found. Try reloading to upgrade DB.");
        }
        const tx = db.transaction('images', 'readwrite');
        const store = tx.objectStore('images');
        const request = store.put(image);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    } catch (e) {
        console.error("Save Image Exception:", e);
        reject(e);
    }
  });
};

export const updateImage = async (image: DBImage): Promise<void> => {
    return saveImage(image); // put() acts as update if key exists
};

export const deleteImage = async (id: string): Promise<void> => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('images', 'readwrite');
        const store = tx.objectStore('images');
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const getImagesByPersona = async (personaId: string): Promise<DBImage[]> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
        if (!db.objectStoreNames.contains('images')) {
             // Fallback if store missing
             resolve([]);
             return;
        }
        const tx = db.transaction('images', 'readonly');
        const store = tx.objectStore('images');
        const index = store.index('personaId');
        const request = index.getAll(personaId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    } catch (e) {
        console.warn("Get Images Exception:", e);
        resolve([]);
    }
  });
};

export const searchImages = async (personaId: string, tags: string[]): Promise<DBImage[]> => {
    const all = await getImagesByPersona(personaId);
    return all.filter(img => 
        tags.some(t => img.tags.includes(t) || img.description.toLowerCase().includes(t))
    );
};

export const deleteImagesByPersona = async (personaId: string): Promise<void> => {
    const db = await getDB();
    
    if (!db.objectStoreNames.contains('images')) {
        return Promise.resolve();
    }

    const images = await getImagesByPersona(personaId);
    if (images.length === 0) return Promise.resolve();

    return new Promise((resolve, reject) => {
        const tx = db.transaction('images', 'readwrite');
        const store = tx.objectStore('images');
        
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);

        images.forEach(img => {
            store.delete(img.id);
        });
    });
};

// --- EXPORT/IMPORT UTILS ---
export const exportPersonaBundle = async (personaId: string): Promise<string> => {
    const db = await getDB();
    
    // 1. Get Persona
    const personaReq = db.transaction('personas', 'readonly').objectStore('personas').get(personaId);
    const persona = await new Promise<PersonaProfile>((resolve) => {
        personaReq.onsuccess = () => resolve(personaReq.result);
    });

    // 2. Get Images
    // Note: If images are Blobs, we must convert to Base64 for JSON export
    const rawImages = await getImagesByPersona(personaId);
    const images = await Promise.all(rawImages.map(async (img) => {
        if (typeof img.data !== 'string') {
            return new Promise<DBImage>((res) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    res({ ...img, data: reader.result as string });
                };
                reader.readAsDataURL(img.data as Blob);
            });
        }
        return img;
    }));

    // 3. Bundle
    const bundle = {
        version: 1,
        persona,
        images
    };
    return JSON.stringify(bundle);
};

// --- SESSIONS ---
export const getAllSessions = async (): Promise<ChatSession[]> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
        const tx = db.transaction('sessions', 'readonly');
        const store = tx.objectStore('sessions');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    } catch (e) {
        resolve([]);
    }
  });
};

export const saveSession = async (session: ChatSession): Promise<void> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
        const tx = db.transaction('sessions', 'readwrite');
        const store = tx.objectStore('sessions');
        const request = store.put(session);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    } catch (e) {
        reject(e);
    }
  });
};

export const deleteSession = async (personaId: string): Promise<void> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sessions', 'readwrite');
    const store = tx.objectStore('sessions');
    // Session uses personaId as key
    const request = store.delete(personaId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};
