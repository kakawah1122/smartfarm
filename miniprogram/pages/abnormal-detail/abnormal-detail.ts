// abnormal-detail.ts
import { createPageWithNavbar } from '../../utils/navigation'

interface DiseaseData {
  name: string
  count: number
  percentage: number
  mortality: number
  recovery: number
  color: string
}

interface ChartData {
  diseases: DiseaseData[]
  totalAbnormal: number
  overallMortality: number
  overallRecovery: number
}

interface MedicationData {
  name: string
  cureRate: number
  usageCount: number
  unitCost: number
  costEfficiency: number
  color: string
}

interface MedicationAnalysis {
  totalMedications: number
  averageEffectiveness: number
  totalCost: number
  avgTreatmentDays: number
  medications: MedicationData[]
  recommendations: {
    preferred: string[]
    reminders: string[]
    warnings: string[]
  }
}

const pageConfig: WechatMiniprogram.Page.Options<any, any> = {
  data: {
    loading: true,
    activeTab: 'overview',
    
    // 统计数据
    chartData: {
      diseases: [],
      totalAbnormal: 0,
      overallMortality: 0,
      overallRecovery: 0
    } as ChartData,
    
    // 时间范围数据
    timeRangeData: [
      { label: '今日', abnormal: 0, mortality: 0, recovery: 0 },
      { label: '本周', abnormal: 0, mortality: 0, recovery: 0 },
      { label: '本月', abnormal: 0, mortality: 0, recovery: 0 }
    ],
    
    // 趋势数据
    trendData: [],
    
    // 饼图数据（用于简单展示）
    pieChartData: [],
    
    // 用药数据
    medicationData: {
      totalMedications: 0,
      averageEffectiveness: 0,
      totalCost: 0,
      avgTreatmentDays: 0,
      medications: [],
      recommendations: {
        preferred: [],
        reminders: [],
        warnings: []
      }
    } as MedicationAnalysis
  },

  onLoad() {
    this.loadAbnormalData()
  },

  onShow() {
    // 页面显示时刷新数据
    this.loadAbnormalData()
  },

  onPullDownRefresh() {
    this.loadAbnormalData().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 加载异常个体数据
  async loadAbnormalData() {
    try {
      this.setData({ loading: true })
      
      // 获取异常个体详细统计
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_abnormal_statistics'
        }
      })
      
      if (result.result && result.result.success) {
        const data = result.result.data
        this.processChartData(data)
      } else {
        console.log('获取数据失败，使用模拟数据')
        this.loadMockData()
      }
    } catch (error) {
      console.error('加载异常个体数据失败:', error)
      this.loadMockData()
    } finally {
      this.setData({ loading: false })
    }
  },

  // 处理图表数据
  processChartData(rawData: any) {
    const diseases = rawData.diseases || []
    const totalAbnormal = rawData.totalAbnormal || 0
    
    // 计算每种病症的统计数据
    const processedDiseases: DiseaseData[] = diseases.map((disease: any, index: number) => {
      const colors = ['#0052d9', '#00a870', '#ed7b2f', '#e34d59', '#8b5cf6', '#06b6d4']
      return {
        name: disease.name || '未知疾病',
        count: disease.count || 0,
        percentage: totalAbnormal > 0 ? Math.round((disease.count / totalAbnormal) * 100) : 0,
        mortality: disease.mortality || 0,
        recovery: disease.recovery || 0,
        color: colors[index % colors.length]
      }
    })
    
    // 计算整体数据
    const overallMortality = diseases.reduce((sum: number, d: any) => sum + (d.mortality || 0), 0)
    const overallRecovery = diseases.reduce((sum: number, d: any) => sum + (d.recovery || 0), 0)
    
    const chartData: ChartData = {
      diseases: processedDiseases,
      totalAbnormal,
      overallMortality: totalAbnormal > 0 ? Math.round((overallMortality / totalAbnormal) * 100) : 0,
      overallRecovery: totalAbnormal > 0 ? Math.round((overallRecovery / totalAbnormal) * 100) : 0
    }
    
    // 生成饼图数据，计算起始角度
    let currentAngle = 0
    const pieChartData = processedDiseases.map(disease => {
      const data = {
        name: disease.name,
        value: disease.count,
        percentage: disease.percentage,
        color: disease.color,
        startAngle: currentAngle
      }
      currentAngle += (disease.percentage / 100) * 360
      return data
    })
    
    // 用药数据处理（真实数据时可扩展）
    const medicationData = rawData.medicationData || this.generateMockMedicationData()

    this.setData({
      chartData,
      pieChartData,
      timeRangeData: rawData.timeRangeData || this.data.timeRangeData,
      trendData: rawData.trendData || [],
      medicationData
    })
    
    // 数据已经准备完成，CSS图表会自动渲染
  },

  // 加载模拟数据
  loadMockData() {
    const mockDiseases: DiseaseData[] = [
      {
        name: '禽流感',
        count: 28,
        percentage: 55,
        mortality: 8,
        recovery: 15,
        color: '#e34d59'
      },
      {
        name: '肠道感染',
        count: 12,
        percentage: 24,
        mortality: 3,
        recovery: 8,
        color: '#ed7b2f'
      },
      {
        name: '呼吸道感染',
        count: 8,
        percentage: 16,
        mortality: 1,
        recovery: 6,
        color: '#0052d9'
      },
      {
        name: '营养不良',
        count: 3,
        percentage: 5,
        mortality: 0,
        recovery: 2,
        color: '#00a870'
      }
    ]
    
    const mockTimeRangeData = [
      { label: '今日', abnormal: 5, mortality: 1, recovery: 3 },
      { label: '本周', abnormal: 18, mortality: 4, recovery: 12 },
      { label: '本月', abnormal: 51, mortality: 12, recovery: 31 }
    ]
    
    const chartData: ChartData = {
      diseases: mockDiseases,
      totalAbnormal: 51,
      overallMortality: 24,
      overallRecovery: 61
    }
    
    // 生成饼图数据，计算起始角度
    let currentAngle = 0
    const pieChartData = mockDiseases.map(disease => {
      const data = {
        name: disease.name,
        value: disease.count,
        percentage: disease.percentage,
        color: disease.color,
        startAngle: currentAngle
      }
      currentAngle += (disease.percentage / 100) * 360
      return data
    })
    
    // 模拟用药数据
    const mockMedicationData: MedicationAnalysis = {
      totalMedications: 6,
      averageEffectiveness: 78,
      totalCost: 3240,
      avgTreatmentDays: 7,
      medications: [
        {
          name: '阿莫西林',
          cureRate: 85,
          usageCount: 24,
          unitCost: 12.5,
          costEfficiency: 85,
          color: '#00a870'
        },
        {
          name: '恩诺沙星',
          cureRate: 82,
          usageCount: 18,
          unitCost: 18.0,
          costEfficiency: 76,
          color: '#0052d9'
        },
        {
          name: '头孢噻呋',
          cureRate: 78,
          usageCount: 15,
          unitCost: 25.0,
          costEfficiency: 62,
          color: '#ed7b2f'
        },
        {
          name: '氟苯尼考',
          cureRate: 75,
          usageCount: 12,
          unitCost: 22.0,
          costEfficiency: 68,
          color: '#8b5cf6'
        },
        {
          name: '多西环素',
          cureRate: 70,
          usageCount: 10,
          unitCost: 15.5,
          costEfficiency: 72,
          color: '#06b6d4'
        },
        {
          name: '林可霉素',
          cureRate: 65,
          usageCount: 8,
          unitCost: 28.0,
          costEfficiency: 46,
          color: '#e34d59'
        }
      ].sort((a, b) => b.cureRate - a.cureRate), // 按治愈率排序
      recommendations: {
        preferred: [
          '对于禽流感，首选阿莫西林+维生素C组合',
          '肠道感染推荐使用恩诺沙星，疗效显著',
          '轻度感染可优先选择成本效益高的多西环素'
        ],
        reminders: [
          '用药期间需密切观察鹅只精神状态',
          '按照疗程足量使用，避免产生耐药性',
          '用药后3天内禁止宰杀，确保食品安全'
        ],
        warnings: [
          '林可霉素成本效益较低，建议谨慎使用',
          '头孢类药物对严重感染效果好，但成本较高',
          '避免同时使用多种抗生素，防止药物相互作用'
        ]
      }
    }

    this.setData({
      chartData,
      pieChartData,
      timeRangeData: mockTimeRangeData,
      medicationData: mockMedicationData
    })
    
    // 数据已经准备完成，CSS图表会自动渲染
    
    wx.showToast({
      title: '已加载模拟数据',
      icon: 'success'
    })
  },

  // 生成模拟用药数据
  generateMockMedicationData(): MedicationAnalysis {
    return {
      totalMedications: 6,
      averageEffectiveness: 78,
      totalCost: 3240,
      avgTreatmentDays: 7,
      medications: [
        {
          name: '阿莫西林',
          cureRate: 85,
          usageCount: 24,
          unitCost: 12.5,
          costEfficiency: 85,
          color: '#00a870'
        },
        {
          name: '恩诺沙星',
          cureRate: 82,
          usageCount: 18,
          unitCost: 18.0,
          costEfficiency: 76,
          color: '#0052d9'
        },
        {
          name: '头孢噻呋',
          cureRate: 78,
          usageCount: 15,
          unitCost: 25.0,
          costEfficiency: 62,
          color: '#ed7b2f'
        },
        {
          name: '氟苯尼考',
          cureRate: 75,
          usageCount: 12,
          unitCost: 22.0,
          costEfficiency: 68,
          color: '#8b5cf6'
        },
        {
          name: '多西环素',
          cureRate: 70,
          usageCount: 10,
          unitCost: 15.5,
          costEfficiency: 72,
          color: '#06b6d4'
        },
        {
          name: '林可霉素',
          cureRate: 65,
          usageCount: 8,
          unitCost: 28.0,
          costEfficiency: 46,
          color: '#e34d59'
        }
      ].sort((a, b) => b.cureRate - a.cureRate), // 按治愈率排序
      recommendations: {
        preferred: [
          '对于禽流感，首选阿莫西林+维生素C组合',
          '肠道感染推荐使用恩诺沙星，疗效显著',
          '轻度感染可优先选择成本效益高的多西环素'
        ],
        reminders: [
          '用药期间需密切观察鹅只精神状态',
          '按照疗程足量使用，避免产生耐药性',
          '用药后3天内禁止宰杀，确保食品安全'
        ],
        warnings: [
          '林可霉素成本效益较低，建议谨慎使用',
          '头孢类药物对严重感染效果好，但成本较高',
          '避免同时使用多种抗生素，防止药物相互作用'
        ]
      }
    }
  },

  // Tab切换
  onTabChange(e: any) {
    const { value } = e.detail
    this.setData({
      activeTab: value
    })
  },

  // 查看特定疾病详情
  viewDiseaseDetail(e: any) {
    const { disease } = e.currentTarget.dataset
    wx.showModal({
      title: `${disease.name} 详情`,
      content: `病例数量: ${disease.count}只\n死亡率: ${Math.round((disease.mortality / disease.count) * 100)}%\n治愈率: ${Math.round((disease.recovery / disease.count) * 100)}%`,
      showCancel: false
    })
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
