// cost-analysis.ts - 成本分析页面
import { createPageWithNavbar } from '../../utils/navigation'

const pageConfig: WechatMiniprogram.Page.Options<any, any> = {
  data: {
    loading: false,
    dateRange: 'month', // week|month|quarter|year
    
    // 成本总览
    overview: {
      totalCost: 20800,
      preventionCost: 12500,
      treatmentCost: 8300,
      monthlyChange: -5.2,
      trend: 'decreasing'
    },

    // 成本构成
    costBreakdown: [
      { 
        category: '疫苗接种', 
        amount: 6800, 
        percentage: 32.7,
        color: '#0052D9',
        items: [
          { name: '禽流感疫苗', cost: 3200 },
          { name: '新城疫疫苗', cost: 2400 },
          { name: '其他疫苗', cost: 1200 }
        ]
      },
      { 
        category: '环境消毒', 
        amount: 3200, 
        percentage: 15.4,
        color: '#00A870',
        items: [
          { name: '消毒剂', cost: 2000 },
          { name: '设备维护', cost: 800 },
          { name: '人工费用', cost: 400 }
        ]
      },
      { 
        category: '保健用品', 
        amount: 2500, 
        percentage: 12.0,
        color: '#E37318',
        items: [
          { name: '营养补充剂', cost: 1500 },
          { name: '益生菌', cost: 600 },
          { name: '维生素', cost: 400 }
        ]
      },
      { 
        category: '治疗用药', 
        amount: 5800, 
        percentage: 27.9,
        color: '#ED49B4',
        items: [
          { name: '抗生素类', cost: 3200 },
          { name: '中草药', cost: 1800 },
          { name: '其他药品', cost: 800 }
        ]
      },
      { 
        category: '检测费用', 
        amount: 2500, 
        percentage: 12.0,
        color: '#8B5A2B',
        items: [
          { name: '实验室检测', cost: 1500 },
          { name: '现场快检', cost: 600 },
          { name: '第三方检测', cost: 400 }
        ]
      }
    ],

    // 月度趋势
    monthlyTrend: [
      { month: '1月', prevention: 11200, treatment: 6800, total: 18000 },
      { month: '2月', prevention: 10800, treatment: 7200, total: 18000 },
      { month: '3月', prevention: 12100, treatment: 8900, total: 21000 },
      { month: '4月', prevention: 12800, treatment: 7200, total: 20000 },
      { month: '5月', prevention: 12500, treatment: 8300, total: 20800 }
    ],

    // 成本效益分析
    roi: {
      totalInvestment: 20800,
      preventedLoss: 52000,
      actualLoss: 8600,
      netBenefit: 43400,
      roiRatio: 2.09
    },

    // 对比分析
    comparison: {
      lastMonth: 21850,
      lastYear: 198600,
      industryAverage: 22400,
      bestPractice: 18200
    },

    // 优化建议
    suggestions: [
      {
        category: '疫苗采购',
        suggestion: '考虑批量采购以降低单价',
        potentialSaving: 800
      },
      {
        category: '治疗成本',
        suggestion: '加强预防减少治疗需求',
        potentialSaving: 1200
      },
      {
        category: '检测优化',
        suggestion: '定期检测与快速检测结合',
        potentialSaving: 400
      }
    ]
  },

  onLoad() {
    this.loadCostAnalysisData()
  },

  // 加载成本分析数据
  async loadCostAnalysisData() {
    this.setData({ loading: true })
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_cost_analysis',
          dateRange: this.data.dateRange
        }
      })

      if (result.result && result.result.success) {
        const data = result.result.data
        this.setData({
          overview: data.overview || this.data.overview,
          costBreakdown: data.costBreakdown || this.data.costBreakdown,
          monthlyTrend: data.monthlyTrend || this.data.monthlyTrend,
          roi: data.roi || this.data.roi,
          suggestions: data.suggestions || this.data.suggestions
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
  onDateRangeChange(e: any) {
    const { value } = e.detail
    this.setData({ dateRange: value })
    this.loadCostAnalysisData()
  },

  // 查看成本分类详情
  onCategoryDetail(e: any) {
    const { category } = e.currentTarget.dataset
    const items = category.items.map((item: any) => `${item.name}: ¥${item.cost}`).join('\n')
    
    wx.showModal({
      title: `${category.category}详细构成`,
      content: `总计: ¥${category.amount}\n占比: ${category.percentage}%\n\n构成明细:\n${items}`,
      showCancel: false
    })
  },

  // 查看优化建议详情
  onSuggestionDetail(e: any) {
    const { suggestion } = e.currentTarget.dataset
    wx.showModal({
      title: '优化建议详情',
      content: `类别: ${suggestion.category}\n建议: ${suggestion.suggestion}\n预计节省: ¥${suggestion.potentialSaving}`,
      showCancel: false
    })
  },

  // 导出成本分析报告
  async exportReport() {
    wx.showLoading({ title: '生成报告中...' })
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'export_cost_report',
          dateRange: this.data.dateRange,
          data: {
            overview: this.data.overview,
            costBreakdown: this.data.costBreakdown,
            monthlyTrend: this.data.monthlyTrend,
            roi: this.data.roi,
            suggestions: this.data.suggestions
          }
        }
      })

      if (result.result && result.result.success) {
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
