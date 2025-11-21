// cost-analysis.ts - 成本分析页面
import { createPageWithNavbar, type PageInstance } from '../../utils/navigation'
import { safeCloudCall } from '../../utils/safe-cloud-call'

interface CloudCallResult<T = any> {
  success: boolean
  data?: T
  error?: string
}

type CostOverview = {
  totalCost: number
  preventionCost: number
  treatmentCost: number
  monthlyChange: number
  trend: string
}

type CostComparison = {
  lastMonth: number
  lastYear: number
  industryAverage: number
  bestPractice: number
}

type PageData = {
  loading: boolean
  dateRange: 'week' | 'month' | 'quarter' | 'year'
  overview: CostOverview
  costBreakdown: any[]
  monthlyTrend: any[]
  comparison: CostComparison
  suggestions: any[]
}

const pageConfig: Partial<PageInstance<PageData>> & { data: PageData } = {
  data: {
    loading: false,
    dateRange: 'month', // week|month|quarter|year
    
    // 成本总览（默认空值，从服务器加载）
    overview: {
      totalCost: 0,
      preventionCost: 0,
      treatmentCost: 0,
      monthlyChange: 0,
      trend: 'stable'
    },

    // 成本构成（默认空数组，从服务器加载）
    costBreakdown: [],

    // 月度趋势（默认空数组，从服务器加载）
    monthlyTrend: [],


    // 对比分析（默认空值，从服务器加载）
    comparison: {
      lastMonth: 0,
      lastYear: 0,
      industryAverage: 0,
      bestPractice: 0
    },

    // 优化建议（默认空数组，从服务器加载）
    suggestions: []
  },

  onLoad(this: PageInstance<PageData>) {
    this.loadCostAnalysisData()
  },

  // 加载成本分析数据
  async loadCostAnalysisData(this: PageInstance<PageData>) {
    this.setData({ loading: true })
    
    try {
      const result = await safeCloudCall({
        name: 'health-management',
        data: {
          action: 'get_cost_analysis',
          dateRange: this.data.dateRange
        }
      }) as CloudCallResult<any>

      if (result?.success && result.data) {
        const data = result.data
        this.setData({
          overview: data.overview || {
            totalCost: 0,
            preventionCost: 0,
            treatmentCost: 0,
            monthlyChange: 0,
            trend: 'stable'
          },
          costBreakdown: data.costBreakdown || [],
          monthlyTrend: data.monthlyTrend || [],
          comparison: data.comparison || {
            lastMonth: 0,
            lastYear: 0,
            industryAverage: 0,
            bestPractice: 0
          },
          suggestions: data.suggestions || []
        })
      }
    } catch (error) {
      // 已移除调试日志
      wx.showToast({
        title: '加载数据失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 日期范围切换
  onDateRangeChange(this: PageInstance<PageData>, e: WechatMiniprogram.PickerChange) {
    const { value } = e.detail
    this.setData({ dateRange: value })
    this.loadCostAnalysisData()
  },

  // 查看成本分类详情
  onCategoryDetail(this: PageInstance<PageData>, e: WechatMiniprogram.BaseEvent & { currentTarget: { dataset: { category: { category: string; amount: number; percentage: number; items: Array<{ name: string; cost: number }> } } } }) {
    const { category } = e.currentTarget.dataset
    const items = category.items.map((item: any) => `${item.name}: ¥${item.cost}`).join('\n')
    
    wx.showModal({
      title: `${category.category}详细构成`,
      content: `总计: ¥${category.amount}\n占比: ${category.percentage}%\n\n构成明细:\n${items}`,
      showCancel: false
    })
  },

  // 查看优化建议详情
  onSuggestionDetail(this: PageInstance<PageData>, e: WechatMiniprogram.BaseEvent & { currentTarget: { dataset: { suggestion: { category: string; suggestion: string; potentialSaving: number } } } }) {
    const { suggestion } = e.currentTarget.dataset
    wx.showModal({
      title: '优化建议详情',
      content: `类别: ${suggestion.category}\n建议: ${suggestion.suggestion}\n预计节省: ¥${suggestion.potentialSaving}`,
      showCancel: false
    })
  },

  // 导出成本分析报告
  async exportReport(this: PageInstance<PageData>) {
    wx.showLoading({ title: '生成报告中...' })
    
    try {
      const result = await safeCloudCall({
        name: 'health-management',
        data: {
          action: 'export_cost_report',
          dateRange: this.data.dateRange,
          data: {
            overview: this.data.overview,
            costBreakdown: this.data.costBreakdown,
            monthlyTrend: this.data.monthlyTrend,
            suggestions: this.data.suggestions
          }
        }
      }) as CloudCallResult

      if (result?.success) {
        wx.hideLoading()
        wx.showToast({
          title: '报告已生成',
          icon: 'success'
        })
      }
    } catch (error) {
      wx.hideLoading()
      // 已移除调试日志
      wx.showToast({
        title: '导出失败',
        icon: 'none'
      })
    }
  }
}

Page(createPageWithNavbar(pageConfig))
