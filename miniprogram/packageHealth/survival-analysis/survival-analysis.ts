// survival-analysis.ts - 存活率分析页面
import { createPageWithNavbar } from '../../utils/navigation'

const pageConfig: WechatMiniprogram.Page.Options<any, any> = {
  data: {
    loading: false,
    dateRange: 'month', // week|month|quarter|year
    
    // 存活率总览
    overview: {
      currentRate: 99.6,
      previousRate: 99.2,
      trend: 'improving',
      trendValue: 0.4,
      totalAnimals: 2340,
      survivedAnimals: 2330
    },

    // 分阶段存活率
    stageAnalysis: [
      { stage: '育雏期', rate: 97.2, total: 800, survived: 778, color: '#0052D9' },
      { stage: '成长期', rate: 98.8, total: 900, survived: 889, color: '#00A870' },
      { stage: '全周期', rate: 99.6, total: 2340, survived: 2330, color: '#E37318' }
    ],

    // 时间趋势数据
    trendData: [
      { date: '第1周', rate: 98.5 },
      { date: '第2周', rate: 98.8 },
      { date: '第3周', rate: 99.1 },
      { date: '第4周', rate: 99.4 },
      { date: '本周', rate: 99.6 }
    ],

    // 影响因素分析
    factors: [
      { name: '疫苗接种率', impact: 'high', value: 96.8, correlation: 0.85 },
      { name: '环境消毒频率', impact: 'medium', value: 12, correlation: 0.73 },
      { name: '饲料质量', impact: 'high', value: 95, correlation: 0.79 },
      { name: '密度控制', impact: 'medium', value: 88, correlation: 0.65 }
    ],

    // 对比数据
    comparison: {
      industryAverage: 97.5,
      lastYear: 98.8,
      target: 99.0,
      bestPractice: 99.8
    }
  },

  onLoad() {
    this.loadAnalysisData()
  },

  // 加载分析数据
  async loadAnalysisData() {
    this.setData({ loading: true })
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_survival_analysis',
          dateRange: this.data.dateRange
        }
      })

      if (result.result && result.result.success) {
        const data = result.result.data
        this.setData({
          overview: data.overview || this.data.overview,
          stageAnalysis: data.stageAnalysis || this.data.stageAnalysis,
          trendData: data.trendData || this.data.trendData,
          factors: data.factors || this.data.factors
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
    this.loadAnalysisData()
  },

  // 查看阶段详情
  onStageDetail(e: any) {
    const { stage } = e.currentTarget.dataset
    wx.showModal({
      title: `${stage}详细数据`,
      content: `存活率: ${stage.rate}%\n总数: ${stage.total}只\n存活: ${stage.survived}只\n死亡: ${stage.total - stage.survived}只`,
      showCancel: false
    })
  },

  // 导出分析报告
  async exportReport() {
    wx.showLoading({ title: '生成报告中...' })
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'export_survival_report',
          dateRange: this.data.dateRange,
          data: {
            overview: this.data.overview,
            stageAnalysis: this.data.stageAnalysis,
            trendData: this.data.trendData,
            factors: this.data.factors
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
