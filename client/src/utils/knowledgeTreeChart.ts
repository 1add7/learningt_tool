import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import type { KnowledgeNode } from '../types'

export interface TreeTheme {
  primaryColor: string
  borderColor: string
  hoverBorderColor: string
  chartLineColor: string
  textColor: string
  backgroundColor: string
  exportPathNodeIds?: string[]
  exportPathColor?: string
}

interface TreeNodeData {
  name: string
  value: string
  originalData?: KnowledgeNode
  children?: TreeNodeData[]
}

const getHoverBrief = (raw: string) => {
  const text = raw.trim()
  if (!text) return ''
  const firstChar = text.charAt(0)
  if (/[\u4e00-\u9fff]/.test(firstChar)) {
    return firstChar
  }
  const firstWord = text.match(/^[A-Za-z0-9_-]+/)?.[0]
  if (firstWord) return firstWord
  return firstChar
}

// Pure function to transform data
const transformData = (
  nodes: KnowledgeNode[],
  selectedNodeId: string | null,
  previewNodeId: string | null,
  theme: TreeTheme,
): TreeNodeData[] => {
  const exportPathIdSet = new Set(theme.exportPathNodeIds || [])
  const exportPathColor = theme.exportPathColor || ''
  return nodes.map((node) => {
    const isSelected = selectedNodeId && String(node._id) === String(selectedNodeId)
    const isPreview = previewNodeId && String(node._id) === String(previewNodeId)
    const isExportPath = exportPathIdSet.has(String(node._id))
    const isLeaf = !node.children || node.children.length === 0

    const itemStyle = {
      color: isSelected
        ? theme.primaryColor
        : isPreview
          ? '#ffd166'
          : isExportPath
            ? '#eef4ff'
            : '#fff',
      borderColor: isSelected
        ? theme.primaryColor
        : isPreview
          ? '#f59e0b'
          : isExportPath
            ? exportPathColor || '#3b82f6'
            : theme.borderColor,
      borderWidth: isSelected ? 3 : isPreview || isExportPath ? 3 : 1,
      shadowBlur: isSelected || isPreview || isExportPath ? 12 : 0,
      shadowColor: isSelected
        ? 'rgba(0,0,0,0.3)'
        : isPreview
          ? 'rgba(245, 158, 11, 0.35)'
          : isExportPath
            ? 'rgba(59, 130, 246, 0.3)'
            : undefined,
    }

    const name = node.question || 'Node'
    let displayName = name
    const level = node.level || 0

    if (level < 6) {
      displayName = name.length > 8 ? name.substring(0, 8) + '...' : name
    } else {
      displayName = name.length > 5 ? name.substring(0, 5) + '...' : name
    }

    return {
      name: displayName,
      value: node._id,
      originalData: node,

      itemStyle: itemStyle,
      symbol: 'circle',
      symbolSize: isSelected ? 16 : isPreview || isExportPath ? 15 : 10,

      emphasis: {
        focus: 'series',
        scale: 1.2,
        itemStyle: {
          color: isSelected ? theme.primaryColor : theme.hoverBorderColor,
          borderColor: isPreview
            ? '#f59e0b'
            : isExportPath
              ? exportPathColor || '#3b82f6'
              : theme.primaryColor,
          borderWidth: 2,
        },
        label: {
          show: true,
          fontWeight: 'bold',
          formatter: (params: unknown) => {
            const p = params as { data: TreeNodeData; name: string }
            return p.data.originalData?.question || p.name
          },
        },
      },

      label: {
        show: true,
        position: isLeaf ? 'right' : 'left',
        verticalAlign: 'middle',
        align: isLeaf ? 'left' : 'right',
        fontSize: isPreview || isExportPath ? 13 : 12,
        fontWeight: isPreview || isExportPath ? 'bold' : 'normal',
        color: theme.textColor,
        backgroundColor: 'transparent',
      },

      children: node.children
        ? transformData(node.children, selectedNodeId, previewNodeId, theme)
        : [],
    }
  })
}

export const getTreeOption = (
  data: KnowledgeNode[],
  selectedNodeId: string | null,
  previewNodeId: string | null,
  theme: TreeTheme,
): EChartsOption => {
  const transformedData = transformData(data, selectedNodeId, previewNodeId, theme)

  return {
    tooltip: {
      show: true,
      trigger: 'item',
      triggerOn: 'mousemove',
      enterable: false,
      backgroundColor:
        theme.backgroundColor === '#ffffff'
          ? 'rgba(255, 255, 255, 0.95)'
          : 'rgba(30, 31, 34, 0.94)',
      borderColor: theme.primaryColor,
      textStyle: { color: theme.textColor },
      formatter: (params: unknown) => {
        const p = params as { data?: TreeNodeData; name?: string }
        const node = p.data?.originalData
        const content = node?.question || p.name
        return content ? getHoverBrief(String(content)) : ''
      },
    },
    series: [
      {
        type: 'tree',
        data: transformedData,
        top: '5%',
        left: '10%',
        bottom: '5%',
        right: '20%',
        symbol: 'circle',
        symbolSize: 10,

        initialTreeDepth: -1, // Expand all

        itemStyle: {
          color: '#fff',
          borderColor: theme.borderColor,
          borderWidth: 1,
        },

        lineStyle: {
          color: theme.chartLineColor,
          width: 1.5,
          curveness: 0.5,
        },

        label: {
          position: 'left',
          verticalAlign: 'middle',
          align: 'right',
          fontSize: 12,
          color: theme.textColor,
        },

        leaves: {
          label: {
            position: 'right',
            verticalAlign: 'middle',
            align: 'left',
          },
        },

        expandAndCollapse: false, // Disable collapse as requested
        animationDuration: 300,
        animationDurationUpdate: 300,
      },
    ],
  }
}

export const initKnowledgeTree = (
  container: HTMLElement,
  data: KnowledgeNode[],
  selectedNodeId: string | null,
  previewNodeId: string | null,
  theme: TreeTheme,
): echarts.ECharts => {
  let chartInstance = echarts.getInstanceByDom(container)
  if (!chartInstance) {
    chartInstance = echarts.init(container)
  }

  const option = getTreeOption(data, selectedNodeId, previewNodeId, theme)
  chartInstance.setOption(option, { notMerge: true })

  return chartInstance
}
