import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useKnowledgeStore } from './knowledge'

// Mock dependencies
vi.mock('../api/knowledge', () => ({
  getNodes: vi.fn(),
  createNode: vi.fn(),
}))

vi.mock('../utils/MemoryTree', () => ({
  memoryTree: {
    addNode: vi.fn(),
    restoreContext: vi.fn(),
  },
}))

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
})

describe('Knowledge Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should restore session history correctly', async () => {
    const store = useKnowledgeStore()

    // Mock nodes
    const node1 = { _id: '1', question: 'Q1', answer: 'A1', children: [] }
    const node2 = { _id: '2', question: 'Q2', answer: 'A2', parentId: '1', children: [] }
    const node3 = { _id: '3', question: 'Q3', answer: 'A3', parentId: '2', children: [] }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    store.nodes = [node1, node2, node3] as any

    // Restore session for node 3
    await store.restoreSession('3')

    expect(store.currentChatHistory).toHaveLength(1)
    expect(store.currentChatHistory[0]?._id).toBe('3')
  })

  it('should clear history when asking a new root question', async () => {
    const store = useKnowledgeStore()

    // Setup initial history
    const node1 = { _id: '1', question: 'Q1', answer: 'A1', children: [] }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    store.currentChatHistory = [node1] as any

    // Mock createNode response
    const newNode = { _id: '2', question: 'New Root', answer: 'A2', children: [] }
    const { createNode } = await import('../api/knowledge')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(createNode).mockResolvedValue({ data: newNode } as any)

    // Ask new question (no parentId)
    await store.askQuestion('New Root')

    expect(store.currentChatHistory).toHaveLength(1)
    expect(store.currentChatHistory[0]?._id).toBe('2')
  })

  it('should append to history when asking a follow-up', async () => {
    const store = useKnowledgeStore()

    // Setup initial history
    const node1 = { _id: '1', question: 'Q1', answer: 'A1', children: [] }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    store.currentChatHistory = [node1] as any

    // Mock createNode response
    const newNode = { _id: '2', question: 'Follow-up', answer: 'A2', parentId: '1', children: [] }
    const { createNode } = await import('../api/knowledge')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(createNode).mockResolvedValue({ data: newNode } as any)

    // Ask follow-up
    await store.askQuestion('Follow-up', '1')

    expect(store.currentChatHistory).toHaveLength(1)
    expect(store.currentChatHistory[0]?._id).toBe('2')
  })
})
