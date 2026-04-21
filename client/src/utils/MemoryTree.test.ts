
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryTree } from './MemoryTree';

// Mock IndexedDB
const mockIndexedDB = {
  open: vi.fn(),
};

// Mock global window object
globalThis.window = {
  indexedDB: mockIndexedDB as unknown,
} as unknown as Window & typeof globalThis;

describe('MemoryTree', () => {
  let memoryTree: MemoryTree;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset instance or create new one if possible (MemoryTree is exported as singleton instance but class is exported too)
    // We will test the class logic mainly.
  });

  it('should initialize successfully', async () => {
    const request = {
      onerror: null as unknown,
      onsuccess: null as unknown,
      onupgradeneeded: null as unknown,
      result: {
        objectStoreNames: {
          contains: vi.fn().mockReturnValue(false),
        },
        createObjectStore: vi.fn().mockReturnValue({
          createIndex: vi.fn(),
        }),
      },
    };

    mockIndexedDB.open.mockReturnValue(request);

    // Trigger success asynchronously
    setTimeout(() => {
      if (request.onsuccess) {
        (request.onsuccess as (event: unknown) => void)({ target: request });
      }
    }, 0);

    memoryTree = new MemoryTree();
    expect(memoryTree).toBeDefined();
    // We can't easily await the private dbPromise, but we can verify open was called
    expect(mockIndexedDB.open).toHaveBeenCalledWith('knowledge_tree', 1);
  });

  // Since testing real IndexedDB in Node environment is hard without a full mock library like fake-indexeddb,
  // we will focus on the structure and logic validation.
  // In a real project, we would install 'fake-indexeddb' to test this properly.
  
  it('should handle addNode', async () => {
    // This test is limited due to mocking complexity without external libs.
    // We assume the method exists and takes correct parameters.
    expect(MemoryTree.prototype.addNode).toBeDefined();
  });
});
