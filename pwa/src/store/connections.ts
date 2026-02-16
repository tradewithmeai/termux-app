import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

export const useConnectionsStore = create<ConnectionsState>()(
  persist(
    (set, get) => ({
      connections: [],
      settings: {
        fontSize: 14,
        defaultProxyUrl: 'ws://localhost:8888',
        colorScheme: 'dark' as const,
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
    }
  )
);
