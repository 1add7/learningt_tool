import { describe, it, expect, vi } from 'vitest';
import { initKnowledgeTree } from '../../utils/knowledgeTreeChart';
import * as echarts from 'echarts';

interface MockChart {
  setOption: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  getZr: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
}

// Mock ECharts
vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    setOption: vi.fn(),
    on: vi.fn(),
    getZr: vi.fn(() => ({ on: vi.fn() })),
    resize: vi.fn(),
    dispose: vi.fn(),
  })),
  getInstanceByDom: vi.fn(),
}));

describe('knowledgeTreeChart.ts', () => {
  const mockContainer = document.createElement('div');
  const mockData = [
    {
      _id: '1',
      question: 'Root',
      answer: 'A',
      sessionId: 's1',
      createdAt: '',
      level: 0,
      children: [
        {
          _id: '2',
          question: 'Child',
          answer: 'A',
          sessionId: 's1',
          createdAt: '',
          level: 1,
          children: []
        }
      ]
    }
  ];
  
  const mockTheme = {
    primaryColor: '#1890ff',
    borderColor: '#d9d9d9',
    hoverBorderColor: '#40a9ff',
    chartLineColor: '#bae7ff',
    textColor: '#333333',
    backgroundColor: '#ffffff'
  };

  it('initializes chart correctly', () => {
    const chart = initKnowledgeTree(mockContainer, mockData, null, mockTheme) as unknown as MockChart;
    expect(echarts.init).toHaveBeenCalledWith(mockContainer);
    expect(chart.setOption).toHaveBeenCalled();
  });

  it('sets correct option structure', () => {
    const chart = initKnowledgeTree(mockContainer, mockData, null, mockTheme) as unknown as MockChart;
    const setOptionCalls = chart.setOption.mock.calls;
    const option = setOptionCalls[0][0] as { series: Array<{ type: string; data: unknown[]; itemStyle: unknown; lineStyle: unknown }> };

    expect(option.series).toBeDefined();
    expect(option.series[0].type).toBe('tree');
    expect(option.series[0].data).toHaveLength(1);
    
    expect(option.series[0].itemStyle).toBeDefined();
    expect(option.series[0].lineStyle).toBeDefined();
  });

  it('applies highlight style to selected node', () => {
    const chart = initKnowledgeTree(mockContainer, mockData, '1', mockTheme) as unknown as MockChart;
    const setOptionCalls = chart.setOption.mock.calls;
    const option = setOptionCalls[setOptionCalls.length - 1][0] as { 
      series: Array<{ 
        data: Array<{ 
          itemStyle: { color: string; borderColor: string }; 
          children: Array<{ itemStyle: { color: string } }> 
        }> 
      }> 
    };
    const rootNodeData = option.series[0].data[0];

    expect(rootNodeData.itemStyle.color).toBe(mockTheme.primaryColor);
    expect(rootNodeData.itemStyle.borderColor).toBe(mockTheme.primaryColor);
    
    const childNodeData = rootNodeData.children[0];
    expect(childNodeData.itemStyle.color).not.toBe(mockTheme.primaryColor);
  });

  it('applies hover emphasis correctly', () => {
    const chart = initKnowledgeTree(mockContainer, mockData, null, mockTheme) as unknown as MockChart;
    const option = chart.setOption.mock.calls[0][0] as { 
      series: Array<{ 
        data: Array<{ 
          emphasis: { scale: number; lineStyle: { color: string } } 
        }> 
      }> 
    };
    const rootNodeData = option.series[0].data[0];

    expect(rootNodeData.emphasis.scale).toBe(1.2);
    expect(rootNodeData.emphasis.lineStyle.color).toBe(mockTheme.chartLineColor);
  });

  it('transforms labels correctly for leaves', () => {
    const chart = initKnowledgeTree(mockContainer, mockData, null, mockTheme) as unknown as MockChart;
    const option = chart.setOption.mock.calls[0][0] as { 
      series: Array<{ 
        data: Array<{ 
          label: { position: string }; 
          children: Array<{ label: { position: string } }> 
        }> 
      }> 
    };
    
    const rootNode = option.series[0].data[0];
    const childNode = rootNode.children[0];

    expect(rootNode.label.position).toBe('left');
    expect(childNode.label.position).toBe('right');
  });
});
