import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import type { KnowledgeNode } from '../types'

export interface TreeTheme {
  primaryColor: string
  accentColor: string
  shadowColor: string
  borderColor: string
  hoverBorderColor: string
  chartLineColor: string
  textColor: string
  backgroundColor: string
  isDark?: boolean
  exportPathNodeIds?: string[]
  exportPathColor?: string
}

interface TreeNodeData {
  name: string
  value: string
  originalData?: KnowledgeNode
  children?: TreeNodeData[]
  itemStyle?: Record<string, unknown>
  lineStyle?: Record<string, unknown>
  label?: Record<string, unknown>
  emphasis?: Record<string, unknown>
  symbol?: string
  symbolSize?: number
}

const withAlpha = (color: string, alpha: number) => {
  if (!color.startsWith('#')) {
    return color
  }

  let hex = color.slice(1)
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((char) => char + char)
      .join('')
  }

  if (hex.length !== 6) {
    return color
  }

  const red = Number.parseInt(hex.slice(0, 2), 16)
  const green = Number.parseInt(hex.slice(2, 4), 16)
  const blue = Number.parseInt(hex.slice(4, 6), 16)

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

const escapeHtml = (value: string) => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const getTooltipHtml = (node?: KnowledgeNode, fallbackName?: string) => {
  const title = escapeHtml(node?.question || fallbackName || '')
  const answer = (node?.answer || '').replace(/\s+/g, ' ').trim()
  const answerPreview = answer ? escapeHtml(answer.slice(0, 120)) : ''
  const metaBits = [
    typeof node?.level === 'number' ? `层级 ${node.level}` : '',
    node?.children?.length ? `${node.children.length} 个子节点` : '叶子节点',
  ].filter(Boolean)

  return `
    <div style="max-width: 280px; padding: 2px 0;">
      <div style="font-size: 13px; font-weight: 700; line-height: 1.5; margin-bottom: 6px; color: inherit;">${title}</div>
      ${answerPreview ? `<div style="font-size: 12px; line-height: 1.6; opacity: 0.82;">${answerPreview}${answer.length > 120 ? '…' : ''}</div>` : ''}
      ${metaBits.length ? `<div style="margin-top: 8px; font-size: 11px; opacity: 0.6; border-top: 1px solid rgba(128,128,128,0.18); padding-top: 6px;">${metaBits.join(' · ')}</div>` : ''}
    </div>
  `
}

/** Ghost child node shown where the next question will be inserted */
const makeGhostChild = (modeLabel: string): TreeNodeData => ({
  name: '__ghost__',
  value: '__ghost_preview__',
  originalData: undefined,
  symbol: 'circle',
  // A larger transparent hit area, visually open amber ring
  symbolSize: 14,
  itemStyle: {
    color: 'rgba(245, 158, 11, 0.12)',
    borderColor: '#f59e0b',
    borderWidth: 2.5,
    shadowBlur: 10,
    shadowColor: 'rgba(245, 158, 11, 0.4)',
  },
  lineStyle: {
    color: 'rgba(245, 158, 11, 0.55)',
    width: 1.5,
    opacity: 0.8,
    curveness: 0.25,
    type: 'dashed',
  } as Record<string, unknown>,
  label: {
    show: true,
    formatter: modeLabel || '…',
    position: 'right',
    fontSize: 11,
    color: '#f59e0b',
    fontStyle: 'italic',
    opacity: 0.85,
  },
  emphasis: {
    scale: false,
    itemStyle: {
      color: 'rgba(245, 158, 11, 0.25)',
      borderColor: '#f59e0b',
      borderWidth: 3,
    },
    label: { show: true },
  },
  children: [],
})

const transformData = (
  nodes: KnowledgeNode[],
  selectedNodeId: string | null,
  ghostParentId: string | null,
  ghostModeLabel: string,
  theme: TreeTheme,
): TreeNodeData[] => {
  const exportPathIdSet = new Set(theme.exportPathNodeIds || [])
  const exportPathColor = theme.exportPathColor || ''

  return nodes.map((node) => {
    const isSelected = selectedNodeId && String(node._id) === String(selectedNodeId)
    const isExportPath = exportPathIdSet.has(String(node._id))
    const isRoot = !node.parentId
    const level = node.level || 0

    // ── Node dot sizes — larger for easier interaction ──────────────────
    const symbolSize = isSelected ? 20 : isRoot ? 18 : 14

    // ── Fill & border colors ─────────────────────────────────────────────
    const dotFill = isSelected
      ? theme.primaryColor
      : isExportPath
        ? exportPathColor || theme.accentColor
        : isRoot
          ? theme.accentColor
          : theme.isDark
            ? '#3a4a6a'
            : '#c8d8f0'

    const dotBorder = isSelected
      ? '#ffffff'
      : isExportPath
        ? exportPathColor || theme.accentColor
        : isRoot
          ? theme.primaryColor
          : theme.isDark
            ? '#5a7aaa'
            : '#8ab0d8'

    const itemStyle = {
      color: dotFill,
      borderColor: dotBorder,
      borderWidth: isSelected ? 3 : isRoot ? 2 : 1.5,
      shadowBlur: isSelected ? 20 : isRoot ? 10 : 0,
      shadowColor: isSelected
        ? withAlpha(theme.primaryColor, 0.55)
        : isRoot
          ? withAlpha(theme.primaryColor, 0.3)
          : 'transparent',
    }

    const lineStyle = {
      color: isSelected
        ? withAlpha(theme.primaryColor, 0.7)
        : isExportPath
          ? exportPathColor || theme.accentColor
          : withAlpha(theme.chartLineColor, theme.isDark ? 0.85 : 0.75),
      width: isSelected ? 2.5 : isRoot ? 2 : 1.5,
      opacity: 0.85,
      curveness: level <= 1 ? 0.22 : 0.28,
    }

    // Process children first, then optionally append ghost child
    const processedChildren: TreeNodeData[] = node.children
      ? transformData(node.children, selectedNodeId, ghostParentId, ghostModeLabel, theme)
      : []

    if (ghostParentId && String(node._id) === String(ghostParentId)) {
      processedChildren.push(makeGhostChild(ghostModeLabel))
    }

    return {
      name: node.question || 'Node',
      value: node._id,
      originalData: node,
      itemStyle,
      lineStyle,
      symbol: isRoot ? 'diamond' : 'circle',
      symbolSize,

      // No label shown by default – tooltip handles info display
      label: { show: false },

      emphasis: {
        // Hover: vivid ring + scale up, clearly different from selected
        scale: true,
        itemStyle: {
          color: isSelected ? theme.primaryColor : theme.isDark ? '#6aa0ff' : '#4080ff',
          borderColor: '#ffffff',
          borderWidth: 3,
          shadowBlur: 28,
          shadowColor: isSelected ? withAlpha(theme.primaryColor, 0.6) : 'rgba(64, 128, 255, 0.55)',
        },
        label: { show: false },
      },

      children: processedChildren,
    }
  })
}

export const getTreeOption = (
  data: KnowledgeNode[],
  selectedNodeId: string | null,
  ghostParentId: string | null,
  ghostModeLabel: string,
  theme: TreeTheme,
): EChartsOption => {
  const transformedData = transformData(data, selectedNodeId, ghostParentId, ghostModeLabel, theme)

  return {
    tooltip: {
      show: true,
      trigger: 'item',
      triggerOn: 'mousemove',
      enterable: false,
      padding: [10, 12],
      backgroundColor:
        theme.backgroundColor === '#ffffff'
          ? 'rgba(255, 255, 255, 0.95)'
          : 'rgba(30, 31, 34, 0.94)',
      borderColor: theme.primaryColor,
      borderWidth: 1,
      extraCssText: `box-shadow: 0 14px 36px ${withAlpha(theme.primaryColor, 0.16)}; border-radius: 14px;`,
      textStyle: { color: theme.textColor },
      formatter: (params: unknown) => {
        const p = params as { data?: TreeNodeData; name?: string }
        return getTooltipHtml(p.data?.originalData, p.name)
      },
    },
    series: [
      {
        type: 'tree',
        data: transformedData,
        top: 80,
        left: 30,
        bottom: 30,
        right: 30,
        layout: 'orthogonal',
        orient: 'LR',
        edgeShape: 'curve',
        symbol: 'circle',
        symbolSize: 8,
        roam: true,
        scaleLimit: {
          min: 0.4,
          max: 3,
        },
        initialTreeDepth: -1,
        itemStyle: {
          color: theme.isDark ? '#3a4a6a' : '#c8d8f0',
          borderColor: theme.isDark ? '#5a7aaa' : '#8ab0d8',
          borderWidth: 1.5,
        },
        lineStyle: {
          color: withAlpha(theme.chartLineColor, theme.isDark ? 0.8 : 0.65),
          width: 1.5,
          curveness: 0.25,
          opacity: 0.8,
        },
        label: { show: false },
        leaves: { label: { show: false } },
        emphasis: {
          focus: 'none',
          scale: true,
        },
        expandAndCollapse: false,
        animationDuration: 400,
        animationDurationUpdate: 500,
        animationEasingUpdate: 'cubicOut',
      },
    ],
  }
}

export const initKnowledgeTree = (
  container: HTMLElement,
  data: KnowledgeNode[],
  selectedNodeId: string | null,
  ghostParentId: string | null,
  ghostModeLabel: string,
  theme: TreeTheme,
): echarts.ECharts => {
  let chartInstance = echarts.getInstanceByDom(container)
  if (!chartInstance) {
    chartInstance = echarts.init(container)
  }

  const option = getTreeOption(data, selectedNodeId, ghostParentId, ghostModeLabel, theme)
  chartInstance.setOption(option, { notMerge: true })

  return chartInstance
}
