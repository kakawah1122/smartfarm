// performance-analysis.ts - 性能分析页面
import { createPageWithNavbar } from '../../utils/navigation'

const pageConfig: WechatMiniprogram.Page.Options<any, any> = {
  data: {
    loading: false,
    dateRange: 'month', // week|month|quarter|year
    
    // 关键性能指标
    kpis: [
      {
        name: '存活率',
        current: 99.6,
        target: 99.0,
        previous: 99.2,
        trend: 'up',
        unit: '%',
        status: 'excellent',
        weight: 30
      },
      {
        name: '治愈率',
        current: 92.3,
        target: 90.0,
        previous: 91.8,
        trend: 'up',
        unit: '%',
        status: 'good',
        weight: 25
      },
      {
        name: '预防覆盖率',
        current: 96.8,
        target: 95.0,
        previous: 96.2,
        trend: 'up',
        unit: '%',
        status: 'excellent',
        weight: 20
      },
      {
        name: '异常检出率',
        current: 2.1,
        target: 5.0,
        previous: 2.8,
        trend: 'down',
        unit: '%',
        status: 'excellent',
        weight: 15
      },
      {
        name: '成本效率',
        current: 8.9,
        target: 12.0,
        previous: 9.5,
        trend: 'down',
        unit: '元/只',
        status: 'excellent',
        weight: 10
      }
    ],

    // 综合评分
    overallScore: {
      score: 94.2,
      level: 'A+',
      improvement: 2.1,
      maxScore: 100
    },

    // 各项指标历史趋势
    trends: {
      survivalRate: [
        { date: '1月', value: 98.8 },
        { date: '2月', value: 99.1 },
        { date: '3月', value: 99.0 },
        { date: '4月', value: 99.3 },
        { date: '5月', value: 99.6 }
      ],
      cureRate: [
        { date: '1月', value: 90.5 },
        { date: '2月', value: 91.2 },
        { date: '3月', value: 91.8 },
        { date: '4月', value: 92.0 },
        { date: '5月', value: 92.3 }
      ]
    },

    // 性能对比
    benchmarks: {
      industryAverage: 85.2,
      topPerformer: 96.8,
      companyTarget: 92.0,
      lastYear: 88.5
    },

    // 改进机会
    improvements: [
      {
        area: '疫苗接种时效性',
        currentPerformance: 85,
        potentialGain: 8,
        difficulty: 'medium',
        impact: 'high',
        recommendation: '优化疫苗接种计划，提升时效性管理'
      },
      {
        area: '异常早期发现',
        currentPerformance: 78,
        potentialGain: 12,
        difficulty: 'high',
        impact: 'high',
        recommendation: '引入AI辅助诊断，提升早期识别能力'
      },
      {
        area: '治疗方案标准化',
        currentPerformance: 88,
        potentialGain: 5,
        difficulty: 'low',
        impact: 'medium',
        recommendation: '建立标准化治疗流程和用药指南'
      }
    ],

    // 部门/区域对比
    areaComparison: [
      { area: '1号鹅舍', score: 96.5, rank: 1 },
      { area: '2号鹅舍', score: 94.8, rank: 2 },
      { area: '3号鹅舍', score: 93.2, rank: 3 },
      { area: '4号鹅舍', score: 91.8, rank: 4 },
      { area: '隔离区', score: 88.5, rank: 5 }
    ]
  },

  onLoad() {
    this.loadPerformanceData()
  },

  // 加载性能分析数据
  async loadPerformanceData() {
    this.setData({ loading: true })
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_performance_analysis',
          dateRange: this.data.dateRange
        }
      })

      if (result.result && result.result.success) {
        const data = result.result.data
        this.setData({
          kpis: data.kpis || this.data.kpis,
          overallScore: data.overallScore || this.data.overallScore,
          trends: data.trends || this.data.trends,
          benchmarks: data.benchmarks || this.data.benchmarks,
          improvements: data.improvements || this.data.improvements,
          areaComparison: data.areaComparison || this.data.areaComparison
        })
      }
    } catch (error) {
      console.error('加载性能分析数据失败:', error)
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
    this.loadPerformanceData()
  },

  // 查看指标详情
  onKpiDetail(e: any) {
    const { kpi } = e.currentTarget.dataset
    const trendText = kpi.trend === 'up' ? '上升' : kpi.trend === 'down' ? '下降' : '稳定'
    const statusText = kpi.status === 'excellent' ? '优秀' : kpi.status === 'good' ? '良好' : '需改进'
    
    wx.showModal({
      title: `${kpi.name}详细信息`,
      content: `当前值: ${kpi.current}${kpi.unit}\n目标值: ${kpi.target}${kpi.unit}\n上期值: ${kpi.previous}${kpi.unit}\n趋势: ${trendText}\n状态: ${statusText}\n权重: ${kpi.weight}%`,
      showCancel: false
    })
  },

  // 查看改进建议详情
  onImprovementDetail(e: any) {
    const { improvement } = e.currentTarget.dataset
    const difficultyText = improvement.difficulty === 'high' ? '高' : improvement.difficulty === 'medium' ? '中' : '低'
    const impactText = improvement.impact === 'high' ? '高' : improvement.impact === 'medium' ? '中' : '低'
    
    wx.showModal({
      title: `${improvement.area}改进建议`,
      content: `当前表现: ${improvement.currentPerformance}分\n潜在提升: ${improvement.potentialGain}分\n实施难度: ${difficultyText}\n影响程度: ${impactText}\n\n建议措施:\n${improvement.recommendation}`,
      showCancel: false
    })
  },

  // 查看区域对比详情
  onAreaDetail(e: any) {
    const { area } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/area-performance/area-performance?area=${area.area}&score=${area.score}`
    })
  },

  // 导出性能分析报告
  async exportReport() {
    wx.showLoading({ title: '生成报告中...' })
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'export_performance_report',
          dateRange: this.data.dateRange,
          data: {
            kpis: this.data.kpis,
            overallScore: this.data.overallScore,
            trends: this.data.trends,
            benchmarks: this.data.benchmarks,
            improvements: this.data.improvements,
            areaComparison: this.data.areaComparison
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
      console.error('导出报告失败:', error)
      wx.showToast({
        title: '导出失败',
        icon: 'none'
      })
    }
  },

  // 设定目标值
  onSetTarget(e: any) {
    const { kpi } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/target-setting/target-setting?kpi=${kpi.name}&current=${kpi.current}&target=${kpi.target}`
    })
  }
}

Page(createPageWithNavbar(pageConfig))
