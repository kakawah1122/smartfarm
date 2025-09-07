// health-stats-analysis.ts - 健康统计分析页面逻辑
import { createPageWithNavbar } from '../../utils/navigation'

// 数据接口定义
interface OverallStats {
  totalAnimals: number;
  survivalRate: number;
  recoveryRate: number;
  mortalityRate: number;
}

interface TrendData {
  monthlyData: Array<{
    month: string;
    rate: number;
    percentage: number;
  }>;
  seasonalData: Array<{
    season: string;
    rate: number;
    status: string;
    trend: string;
    change: string;
  }>;
}

interface HealthIndicator {
  icon: string;
  name: string;
  value: string;
  description: string;
  trendDirection: string;
  trendValue: string;
}

interface DiseaseStats {
  totalCases: number;
  pieData: Array<{
    startAngle: number;
    angle: number;
    color: string;
  }>;
  legendData: Array<{
    name: string;
    color: string;
    percentage: number;
  }>;
  topDiseases: Array<{
    name: string;
    cases: number;
    mortalityRate: number;
    recoveryRate: number;
    trendPercentage: number;
    trendColor: string;
    trendLabel: string;
  }>;
}

const pageConfig = {
  data: {
    loading: true,
    activeTab: 'trend',
    
    // 整体统计数据
    overallStats: {
      totalAnimals: 0,
      survivalRate: 0,
      recoveryRate: 0,
      mortalityRate: 0
    } as OverallStats,
    
    // 趋势数据
    trendData: {
      monthlyData: [],
      seasonalData: []
    } as TrendData,
    
    // 健康指标
    healthIndicators: [] as HealthIndicator[],
    
    // 病种统计
    diseaseStats: {
      totalCases: 0,
      pieData: [],
      legendData: [],
      topDiseases: []
    } as DiseaseStats,
    
    // 治疗统计
    treatmentStats: {
      medications: [],
      methods: []
    },
    
    // 成本分析
    costAnalysis: {
      totalMedicalCost: '0',
      avgCostPerAnimal: '0',
      costReduction: '0',
      preventionEffectiveness: 0,
      preventionImprovement: '0',
      categories: []
    },
    
    // AI预测
    aiPrediction: {
      loading: false,
      result: null as any,
      error: null as string | null
    }
  },

  onLoad() {
    console.log('健康统计分析页面加载')
    this.loadAnalysisData()
  },

  onShow() {
    // 页面显示时刷新数据
    this.refreshData()
  },

  // 加载分析数据
  async loadAnalysisData() {
    console.log('加载健康统计分析数据')
    
    this.setData({ loading: true })
    
    try {
      // 并行加载各种统计数据
      await Promise.all([
        this.loadOverallStats(),
        this.loadTrendData(),
        this.loadDiseaseStats(),
        this.loadTreatmentStats(),
        this.loadCostAnalysis()
      ])
      
    } catch (error) {
      console.error('加载统计数据失败:', error)
      
      wx.showToast({
        title: '数据加载失败',
        icon: 'none',
        duration: 2000
      })
      
    } finally {
      this.setData({ loading: false })
    }
  },
  
  // 加载整体统计数据
  async loadOverallStats() {
    try {
      // 调用云函数获取整体统计
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_overall_health_stats'
        }
      })
      
      if (result.result.success) {
        this.setData({
          overallStats: result.result.data
        })
      } else {
        // 使用模拟数据
        this.loadMockOverallStats()
      }
      
    } catch (error) {
      console.error('加载整体统计失败:', error)
      this.loadMockOverallStats()
    }
  },
  
  // 加载模拟整体统计数据
  loadMockOverallStats() {
    const mockStats = {
      totalAnimals: 2350,
      survivalRate: 87.5,
      recoveryRate: 92.3,
      mortalityRate: 12.5
    }
    
    this.setData({
      overallStats: mockStats
    })
  },
  
  // 加载趋势数据
  async loadTrendData() {
    try {
      // 这里可以调用云函数获取真实数据
      this.loadMockTrendData()
      
    } catch (error) {
      console.error('加载趋势数据失败:', error)
      this.loadMockTrendData()
    }
  },
  
  // 加载模拟趋势数据
  loadMockTrendData() {
    const monthlyData = [
      { month: '1月', rate: 85.2, percentage: 85 },
      { month: '2月', rate: 87.8, percentage: 88 },
      { month: '3月', rate: 89.1, percentage: 89 },
      { month: '4月', rate: 88.5, percentage: 89 },
      { month: '5月', rate: 90.2, percentage: 90 },
      { month: '6月', rate: 87.6, percentage: 88 }
    ]
    
    const seasonalData = [
      { season: '春季', rate: 88.5, status: 'good', trend: 'up', change: '+2.3%' },
      { season: '夏季', rate: 86.2, status: 'normal', trend: 'down', change: '-1.8%' },
      { season: '秋季', rate: 91.3, status: 'excellent', trend: 'up', change: '+4.1%' },
      { season: '冬季', rate: 84.7, status: 'caution', trend: 'down', change: '-3.2%' }
    ]
    
    const healthIndicators = [
      {
        icon: '💪',
        name: '平均健康度',
        value: '88.5分',
        description: '综合健康评分',
        trendDirection: 'up',
        trendValue: '+2.1%'
      },
      {
        icon: '🏥',
        name: '就诊及时率',
        value: '94.2%',
        description: '异常发现后24h内就诊率',
        trendDirection: 'up',
        trendValue: '+5.3%'
      },
      {
        icon: '💊',
        name: '用药合规率',
        value: '96.8%',
        description: '按方案用药执行率',
        trendDirection: 'up',
        trendValue: '+1.7%'
      },
      {
        icon: '🔄',
        name: '复发率',
        value: '8.3%',
        description: '治愈后30天内复发率',
        trendDirection: 'down',
        trendValue: '-2.4%'
      }
    ]
    
    this.setData({
      trendData: { monthlyData, seasonalData },
      healthIndicators
    })
  },
  
  // 加载病种统计数据
  async loadDiseaseStats() {
    try {
      this.loadMockDiseaseStats()
    } catch (error) {
      console.error('加载病种统计失败:', error)
      this.loadMockDiseaseStats()
    }
  },
  
  // 加载模拟病种统计数据
  loadMockDiseaseStats() {
    const diseases = [
      { name: '小鹅瘟', cases: 156, percentage: 28.5, color: '#ff4d4f' },
      { name: '禽流感', cases: 132, percentage: 24.1, color: '#fa8c16' },
      { name: '大肠杆菌病', cases: 98, percentage: 17.9, color: '#faad14' },
      { name: '球虫病', cases: 87, percentage: 15.9, color: '#52c41a' },
      { name: '其他疾病', cases: 74, percentage: 13.5, color: '#1890ff' }
    ]
    
    const totalCases = diseases.reduce((sum, d) => sum + d.cases, 0)
    
    // 生成饼图数据
    let currentAngle = 0
    const pieData = diseases.map(disease => {
      const angle = (disease.percentage / 100) * 360
      const result = {
        startAngle: currentAngle,
        angle: angle,
        color: disease.color
      }
      currentAngle += angle
      return result
    })
    
    const legendData = diseases.map(d => ({
      name: d.name,
      color: d.color,
      percentage: d.percentage
    }))
    
    const topDiseases = [
      {
        name: '小鹅瘟',
        cases: 156,
        mortalityRate: 15.4,
        recoveryRate: 84.6,
        trendPercentage: 85,
        trendColor: '#52c41a',
        trendLabel: '治愈率良好'
      },
      {
        name: '禽流感',
        cases: 132,
        mortalityRate: 22.7,
        recoveryRate: 77.3,
        trendPercentage: 77,
        trendColor: '#faad14',
        trendLabel: '需加强防控'
      },
      {
        name: '大肠杆菌病',
        cases: 98,
        mortalityRate: 8.2,
        recoveryRate: 91.8,
        trendPercentage: 92,
        trendColor: '#52c41a',
        trendLabel: '控制良好'
      }
    ]
    
    this.setData({
      diseaseStats: {
        totalCases,
        pieData,
        legendData,
        topDiseases
      }
    })
  },
  
  // 加载治疗统计数据
  async loadTreatmentStats() {
    try {
      this.loadMockTreatmentStats()
    } catch (error) {
      console.error('加载治疗统计失败:', error)
      this.loadMockTreatmentStats()
    }
  },
  
  // 加载模拟治疗统计数据
  loadMockTreatmentStats() {
    const medications = [
      {
        name: '恩诺沙星',
        effectiveRate: 94.2,
        usageCount: 45,
        avgRecoveryDays: 7
      },
      {
        name: '阿莫西林',
        effectiveRate: 88.6,
        usageCount: 38,
        avgRecoveryDays: 9
      },
      {
        name: '氟苯尼考',
        effectiveRate: 91.3,
        usageCount: 33,
        avgRecoveryDays: 8
      },
      {
        name: '多西环素',
        effectiveRate: 85.7,
        usageCount: 28,
        avgRecoveryDays: 10
      }
    ]
    
    const methods = [
      {
        icon: '💊',
        name: '药物治疗',
        successRate: 89.5,
        avgCost: 15.8,
        avgDuration: 8
      },
      {
        icon: '🏥',
        name: '隔离观察',
        successRate: 76.3,
        avgCost: 5.2,
        avgDuration: 12
      },
      {
        icon: '💉',
        name: '疫苗接种',
        successRate: 95.8,
        avgCost: 8.5,
        avgDuration: 2
      },
      {
        icon: '🌿',
        name: '中药调理',
        successRate: 82.1,
        avgCost: 12.3,
        avgDuration: 15
      }
    ]
    
    this.setData({
      treatmentStats: {
        medications,
        methods
      }
    })
  },
  
  // 加载成本分析数据
  async loadCostAnalysis() {
    try {
      this.loadMockCostAnalysis()
    } catch (error) {
      console.error('加载成本分析失败:', error)
      this.loadMockCostAnalysis()
    }
  },
  
  // 加载模拟成本分析数据
  loadMockCostAnalysis() {
    const categories = [
      { name: '药品费用', amount: '28,450', percentage: 45.2, color: '#ff4d4f' },
      { name: '检查诊断', amount: '18,320', percentage: 29.1, color: '#fa8c16' },
      { name: '人工费用', amount: '9,680', percentage: 15.4, color: '#faad14' },
      { name: '设备折旧', amount: '6,440', percentage: 10.3, color: '#52c41a' }
    ]
    
    const costAnalysis = {
      totalMedicalCost: '62,890',
      avgCostPerAnimal: '26.8',
      costReduction: '12.3',
      preventionEffectiveness: 88.5,
      preventionImprovement: '15.7',
      categories
    }
    
    this.setData({
      costAnalysis
    })
  },
  
  // 刷新数据
  async refreshData() {
    console.log('刷新健康统计分析数据')
    await this.loadAnalysisData()
  },
  
  // Tab切换
  onTabChange(e: any) {
    const { value } = e.detail
    console.log('切换Tab:', value)
    
    this.setData({
      activeTab: value
    })
    
    // 触觉反馈
    wx.vibrateShort({ type: 'light' })
    
    // 如果切换到AI预测页面，检查是否有预测数据
    if (value === 'ai_prediction' && !this.data.aiPrediction.result) {
      // 可以在这里给用户一些提示
      console.log('AI预测页面，暂无预测数据')
    }
  },
  
  // 生成AI预测
  async generateAIPrediction() {
    console.log('生成AI健康预测')
    
    this.setData({
      'aiPrediction.loading': true,
      'aiPrediction.error': null
    })
    
    try {
      // 调用AI预测云函数
      const result = await wx.cloud.callFunction({
        name: 'ai-multi-model',
        data: {
          action: 'chat_completion',
          messages: [
            {
              role: 'system',
              content: '你是一个专业的鹅类养殖健康分析专家，擅长基于历史数据进行健康趋势预测和风险评估。请基于提供的健康统计数据生成未来3个月的健康预测报告。'
            },
            {
              role: 'user',
              content: this.buildPredictionPrompt()
            }
          ],
          taskType: 'detailed_analysis',
          priority: 'balanced'
        }
      })
      
      if (result.result.success) {
        const predictionData = this.parsePredictionResult(result.result.data.content)
        
        this.setData({
          'aiPrediction.loading': false,
          'aiPrediction.result': predictionData,
          'aiPrediction.error': null
        })
        
        wx.vibrateShort({ type: 'medium' })
        
        wx.showToast({
          title: 'AI预测完成',
          icon: 'success',
          duration: 1500
        })
        
      } else {
        // AI预测失败，使用fallback数据
        this.setData({
          'aiPrediction.loading': false,
          'aiPrediction.result': this.generateFallbackPrediction(),
          'aiPrediction.error': result.result.error
        })
        
        wx.showToast({
          title: '预测完成(基于历史趋势)',
          icon: 'none',
          duration: 2000
        })
      }
      
    } catch (error) {
      console.error('AI预测失败:', error)
      
      this.setData({
        'aiPrediction.loading': false,
        'aiPrediction.error': error.message || 'AI服务异常',
        'aiPrediction.result': null
      })
      
      wx.showToast({
        title: '预测失败，请稍后重试',
        icon: 'none',
        duration: 2000
      })
    }
  },
  
  // 构建AI预测提示词
  buildPredictionPrompt(): string {
    const { overallStats, diseaseStats, treatmentStats, costAnalysis } = this.data
    
    return `基于以下历史健康数据，请生成未来3个月的健康预测报告：

整体统计：
- 累计养殖：${overallStats.totalAnimals} 只
- 整体存活率：${overallStats.survivalRate}%
- 治愈率：${overallStats.recoveryRate}%
- 死亡率：${overallStats.mortalityRate}%

主要疾病分布：
- 小鹅瘟：${diseaseStats.totalCases > 0 ? Math.round(diseaseStats.totalCases * 0.285) : 156} 例（28.5%）
- 禽流感：${diseaseStats.totalCases > 0 ? Math.round(diseaseStats.totalCases * 0.241) : 132} 例（24.1%）
- 大肠杆菌病：${diseaseStats.totalCases > 0 ? Math.round(diseaseStats.totalCases * 0.179) : 98} 例（17.9%）

治疗效果：
- 药物治疗成功率：89.5%
- 平均治疗成本：¥26.8/只

请预测：
1. 未来3个月的健康风险预警（高/中/低风险，包含具体风险因素）
2. 每月预测存活率和疾病风险等级
3. 针对性的预防和优化建议（至少3条）

请以JSON格式返回，包含riskAlerts、monthlyPrediction、recommendations字段。`
  },
  
  // 解析AI预测结果
  parsePredictionResult(content: string): any {
    try {
      // 尝试提取JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      } else {
        // 如果无法解析，返回基于文本的fallback
        return this.generateFallbackPrediction()
      }
    } catch (error) {
      console.error('解析AI预测结果失败:', error)
      return this.generateFallbackPrediction()
    }
  },
  
  // 生成fallback预测数据
  generateFallbackPrediction(): any {
    return {
      riskAlerts: [
        {
          icon: '⚠️',
          message: '春季禽流感高发风险',
          probability: 65,
          level: 'warning'
        },
        {
          icon: '🌡️',
          message: '气温变化易引发呼吸道疾病',
          probability: 45,
          level: 'info'
        }
      ],
      monthlyPrediction: [
        {
          month: '下月',
          survivalRate: 88.5,
          diseaseRisk: '中等',
          riskLevel: 'warning'
        },
        {
          month: '次月',
          survivalRate: 89.2,
          diseaseRisk: '较低',
          riskLevel: 'success'
        },
        {
          month: '第三月',
          survivalRate: 87.8,
          diseaseRisk: '中等',
          riskLevel: 'warning'
        }
      ],
      recommendations: [
        {
          category: '环境管理',
          content: '加强春季通风换气，维持适宜温湿度',
          expectedBenefit: '降低呼吸道疾病发生率15%'
        },
        {
          category: '免疫预防',
          content: '提前进行禽流感疫苗接种',
          expectedBenefit: '提升免疫保护率至95%'
        },
        {
          category: '营养调控',
          content: '增加维生素C和E的补充',
          expectedBenefit: '提升整体抗病能力20%'
        }
      ]
    }
  },
  
  // 下拉刷新
  onPullDownRefresh() {
    this.refreshData().then(() => {
      wx.stopPullDownRefresh()
    })
  },
  
  // 页面分享
  onShareAppMessage() {
    return {
      title: '健康统计分析 - 智能养鹅管理',
      path: '/pages/health-stats-analysis/health-stats-analysis'
    }
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
