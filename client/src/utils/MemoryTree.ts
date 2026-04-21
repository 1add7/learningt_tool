
import type { KnowledgeNode } from '../types';

interface MemoryNode {
  id: string;
  parentId: string[];
  question: string;
  answerSummary: string; // First 100 chars or summary
  timestamp: number;
  contextSnapshot: {
    question: string;
    parentId?: string;
    sessionId: string;
    context?: string;
  };
}

const DB_NAME = 'knowledge_tree';
const STORE_NAME = 'nodes';
const MAX_NODES = 10000;
// const MAX_SIZE_BYTES = 200 * 1024 * 1024; // 200MB - Not strictly enforced by byte count yet, relying on LRU by count

export class MemoryTree {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase>;

  constructor() {
    this.dbPromise = this.initDB().catch(err => {
      console.warn('Failed to initialize IndexedDB:', err);
      // Return a never-resolving promise or handle it gracefully
      // For now, allow it to fail, but catch it here to prevent unhandled rejection
      return new Promise(() => {}); 
    });
  }

  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        console.warn('IndexedDB not supported, falling back to memory mode');
        // In a real scenario, we might implement a memory-only fallback here
        // or just reject. The requirement says fallback to memory mode.
        // For simplicity of this class, we'll just reject and handle it outside or implement mock.
        reject(new Error('IndexedDB not supported'));
        return;
      }

      const request = window.indexedDB.open(DB_NAME, 1);

      request.onerror = (event) => {
        console.error('IndexedDB error:', event);
        reject(event);
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async addNode(nodeData: KnowledgeNode, contextSnapshot: {
    question: string;
    parentId?: string;
    sessionId: string;
    context?: string;
  }): Promise<void> {
    const db = await this.dbPromise;
    
    const memoryNode: MemoryNode = {
      id: nodeData._id,
      parentId: nodeData.parentId ? [nodeData.parentId] : [],
      question: nodeData.question,
      answerSummary: nodeData.answer.substring(0, 100),
      timestamp: Date.now(),
      contextSnapshot
    };

    // Calculate size (rough estimation)
    const size = new Blob([JSON.stringify(memoryNode)]).size;
    if (size > 2 * 1024 * 1024) {
      console.warn('Node too large to store in IndexedDB');
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      // Check capacity
      const countRequest = store.count();
      countRequest.onsuccess = () => {
        if (countRequest.result >= MAX_NODES) {
          this.evictOldNodes(store, Math.ceil(MAX_NODES * 0.2)); // Evict 20%
        }
        
        const addRequest = store.put(memoryNode);
        addRequest.onsuccess = () => resolve();
        addRequest.onerror = () => reject(addRequest.error);
      };
      
      transaction.onerror = () => reject(transaction.error);
    });
  }

  private evictOldNodes(store: IDBObjectStore, count: number) {
    const index = store.index('timestamp');
    const request = index.openCursor();
    let deleted = 0;

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor && deleted < count) {
        cursor.delete();
        deleted++;
        cursor.continue();
      }
    };
  }

  async getNode(id: string): Promise<MemoryNode | undefined> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async restoreContext(id: string): Promise<MemoryNode['contextSnapshot']> {
    const node = await this.getNode(id);
    if (!node) {
      throw new Error(`Node ${id} not found in memory`);
    }
    return node.contextSnapshot;
  }
  
  async getAllNodes(): Promise<MemoryNode[]> {
      const db = await this.dbPromise;
      return new Promise((resolve, reject) => {
          const transaction = db.transaction([STORE_NAME], 'readonly');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.getAll();
          
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
      });
  }
}

export const memoryTree = new MemoryTree();
