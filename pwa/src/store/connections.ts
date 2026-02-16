import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { encryptForStorage, decryptFromStorage } from '../core/secure-storage';

export interface SavedConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: 'password' | 'key';
  keyId?: string;
  savePassword: boolean;
  password?: string;
  proxyUrl: string;
  lastConnected?: number;
}

export interface AppSettings {
  fontSize: number;
  defaultProxyUrl: string;
  colorScheme: 'dark' | 'green' | 'amber';
  bellBehavior: 'vibrate' | 'beep' | 'ignore';
  cursorStyle: 'block' | 'underline' | 'bar';
  cursorBlink: boolean;
  scrollbackRows: number;
  connectionTimeout: number;
}

interface ConnectionsState {
  connections: SavedConnection[];
  settings: AppSettings;

  addConnection: (conn: Omit<SavedConnection, 'id'>) => string;
  updateConnection: (id: string, updates: Partial<SavedConnection>) => void;
  deleteConnection: (id: string) => void;
  getConnection: (id: string) => SavedConnection | undefined;
  touchConnection: (id: string) => void;

  updateSettings: (updates: Partial<AppSettings>) => void;
}

/**
 * Custom storage that encrypts password fields before writing to localStorage
 * and decrypts them on read.
 */
const encryptedStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const raw = localStorage.getItem(name);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      if (parsed?.state?.connections) {
        const connections = parsed.state.connections;
        for (const conn of connections) {
          if (conn.password) {
            const decrypted = await decryptFromStorage(conn.password);
            // If decryption fails, it was likely plaintext (legacy) — clear it
            conn.password = decrypted || undefined;
          }
        }
      }
      return JSON.stringify(parsed);
    } catch {
      return raw;
    }
  },

  setItem: async (name: string, value: string): Promise<void> => {
    try {
      const parsed = JSON.parse(value);
      if (parsed?.state?.connections) {
        const connections = parsed.state.connections;
        for (const conn of connections) {
          if (conn.password) {
            conn.password = await encryptForStorage(conn.password);
          }
        }
      }
      localStorage.setItem(name, JSON.stringify(parsed));
    } catch {
      localStorage.setItem(name, value);
    }
  },

  removeItem: (name: string): void => {
    localStorage.removeItem(name);
  },
};

export const useConnectionsStore = create<ConnectionsState>()(
  persist(
    (set, get) => ({
      connections: [],
      settings: {
        fontSize: 14,
        defaultProxyUrl: 'ws://localhost:8888',
        colorScheme: 'dark' as const,
        bellBehavior: 'ignore' as const,
        cursorStyle: 'block' as const,
        cursorBlink: true,
        scrollbackRows: 1000,
        connectionTimeout: 10000,
      },

      addConnection: (conn) => {
        const id = crypto.randomUUID();
        set((state) => ({
          connections: [...state.connections, { ...conn, id }],
        }));
        return id;
      },

      updateConnection: (id, updates) => {
        set((state) => ({
          connections: state.connections.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        }));
      },

      deleteConnection: (id) => {
        set((state) => ({
          connections: state.connections.filter((c) => c.id !== id),
        }));
      },

      getConnection: (id) => {
        return get().connections.find((c) => c.id === id);
      },

      touchConnection: (id) => {
        set((state) => ({
          connections: state.connections.map((c) =>
            c.id === id ? { ...c, lastConnected: Date.now() } : c
          ),
        }));
      },

      updateSettings: (updates) => {
        set((state) => ({
          settings: { ...state.settings, ...updates },
        }));
      },
    }),
    {
      name: 'termux-pwa-connections',
      storage: createJSONStorage(() => encryptedStorage),
    }
  )
);
