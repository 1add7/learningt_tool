import type { KnowledgeNode } from '../types'

type TreeNode = {
  _id: string
  question: string
  answer: string
  createdAt: string
  children: TreeNode[]
}

type ZipEntry = {
  filePath: string
  data: string | Uint8Array
}

const encoder = new TextEncoder()

const toBytes = (data: string | Uint8Array) => {
  return typeof data === 'string' ? encoder.encode(data) : data
}

const concatBytes = (chunks: Uint8Array[]) => {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const merged = new Uint8Array(total)
  let offset = 0
  chunks.forEach((chunk) => {
    merged.set(chunk, offset)
    offset += chunk.length
  })
  return merged
}

const u16 = (value: number) => {
  const bytes = new Uint8Array(2)
  new DataView(bytes.buffer).setUint16(0, value, true)
  return bytes
}

const u32 = (value: number) => {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true)
  return bytes
}

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let c = i
    for (let j = 0; j < 8; j += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c >>> 0
  }
  return table
})()

const crc32 = (bytes: Uint8Array) => {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i += 1) {
    const index = (crc ^ bytes[i]!) & 0xff
    crc = crcTable[index]! ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

const getDosTimeDate = () => {
  const now = new Date()
  const year = Math.max(1980, now.getFullYear())
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)
  const date = ((year - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()
  return { time, date }
}

const createZipBlob = (entries: ZipEntry[]) => {
  const localChunks: Uint8Array[] = []
  const centralChunks: Uint8Array[] = []
  let offset = 0
  const { time, date } = getDosTimeDate()

  entries.forEach((entry) => {
    const fileNameBytes = encoder.encode(entry.filePath)
    const dataBytes = toBytes(entry.data)
    const checksum = crc32(dataBytes)
    const size = dataBytes.length

    const localHeader = concatBytes([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(time),
      u16(date),
      u32(checksum),
      u32(size),
      u32(size),
      u16(fileNameBytes.length),
      u16(0),
      fileNameBytes,
    ])

    localChunks.push(localHeader, dataBytes)

    const centralHeader = concatBytes([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(time),
      u16(date),
      u32(checksum),
      u32(size),
      u32(size),
      u16(fileNameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      fileNameBytes,
    ])
    centralChunks.push(centralHeader)

    offset += localHeader.length + dataBytes.length
  })

  const centralDirectory = concatBytes(centralChunks)
  const localPart = concatBytes(localChunks)
  const endRecord = concatBytes([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralDirectory.length),
    u32(localPart.length),
    u16(0),
  ])

  return new Blob([localPart, centralDirectory, endRecord], { type: 'application/zip' })
}

const normalizeName = (name: string) => {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
  return (cleaned || '未命名节点').slice(0, 60)
}

const toTree = (nodes: KnowledgeNode[]) => {
  const map = new Map<string, TreeNode>()
  nodes.forEach((node) => {
    map.set(node._id, {
      _id: node._id,
      question: node.question || '未命名问题',
      answer: node.answer || '',
      createdAt: node.createdAt || '',
      children: [],
    })
  })
  const roots: TreeNode[] = []
  nodes.forEach((node) => {
    const current = map.get(node._id)
    if (!current) return
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)?.children.push(current)
    } else {
      roots.push(current)
    }
  })
  const sortRecursively = (list: TreeNode[]) => {
    list.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    list.forEach((item) => sortRecursively(item.children))
  }
  sortRecursively(roots)
  return roots
}

const topicFromNode = (node: TreeNode): Record<string, unknown> => {
  const attached = node.children.map(topicFromNode)
  return {
    id: node._id,
    class: 'topic',
    title: node.question,
    notes: {
      plain: {
        content: node.answer,
      },
    },
    children: attached.length ? { attached } : undefined,
  }
}

export const exportKnowledgeAsXMind = (nodes: KnowledgeNode[]) => {
  const roots = toTree(nodes)
  const rootTopic =
    roots.length === 1 && roots[0]
      ? topicFromNode(roots[0])
      : {
          id: 'root-topic',
          class: 'topic',
          title: 'AI学习树',
          children: { attached: roots.map(topicFromNode) },
        }

  const content = [
    {
      id: 'sheet-1',
      class: 'sheet',
      title: '知识框架图',
      rootTopic,
    },
  ]

  const metadata = {
    creator: { name: 'AI学习树' },
    timestamp: Date.now(),
  }

  return createZipBlob([
    { filePath: 'content.json', data: JSON.stringify(content, null, 2) },
    { filePath: 'metadata.json', data: JSON.stringify(metadata, null, 2) },
  ])
}

export const exportKnowledgeAsMarkdownZip = (nodes: KnowledgeNode[]) => {
  const roots = toTree(nodes)
  const entries: ZipEntry[] = []

  const walk = (node: TreeNode, parentPath: string, index: number) => {
    const dir = `${parentPath}${index + 1}_${normalizeName(node.question)}/`
    const content = `# ${node.question}\n\n${node.answer || '（无回答内容）'}\n`
    entries.push({ filePath: `${dir}README.md`, data: content })
    node.children.forEach((child, childIndex) => walk(child, dir, childIndex))
  }

  roots.forEach((root, index) => walk(root, '', index))

  return createZipBlob(entries)
}

export const triggerDownload = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
