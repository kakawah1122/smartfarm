// abnormal-detail.ts - 当前异常管理页面
import { createPageWithNavbar } from '../../utils/navigation'

// 异常个体接口
interface AbnormalAnimal {
  id: string
  animalId: string
  disease: string
  priority: 'urgent' | 'moderate' | 'mild'
  location: string
  discoveredTime: string
  symptoms?: string
  treatmentStatus: 'pending' | 'treating'
}

// 治疗记录接口
interface TreatmentRecord {
  id: string
  animalId: string
  disease: string
  medication: string
  dosage: string
  operator: string
  currentDay: number
  totalDays: number
  progressPercentage: number
  status: 'treating' | 'recovering' | 'completed'
  statusText: string
}

// 当前病种数据
interface CurrentDisease {
  name: string
  count: number
  percentage: number
  color: string
  startAngle: number
  angle: number
}

// 位置分布数据
interface LocationDistribution {
  location: string
  totalCount: number
  abnormalCount: number
  rate: number
  diseases: Array<{
    name: string
    count: number
    color: string
  }>
}

const pageConfig: WechatMiniprogram.Page.Options<any, any> = {
  data: {
    loading: true,
    activeTab: 'distribution',
    updateTime: '',
    
    // 当前异常状态统计
    currentStats: {
      urgent: 0,      // 紧急
      moderate: 0,    // 中等
      mild: 0,        // 轻微
      treating: 0,    // 治疗中
      total: 0
    },
    
    // 当前病种分布 (仅当前异常个体)
    currentDiseases: [] as CurrentDisease[],
    
    // 位置分布
    locationDistribution: [] as LocationDistribution[],
    
    // 优先级筛选
    priorityLevels: [
      { level: 'all', label: '全部', count: 0 },
      { level: 'urgent', label: '紧急', count: 0 },
      { level: 'moderate', label: '中等', count: 0 },
      { level: 'mild', label: '轻微', count: 0 }
    ],
    activePriority: 'all',
    
    // 异常个体列表
    abnormalAnimals: [] as AbnormalAnimal[],
    filteredAbnormalAnimals: [] as AbnormalAnimal[],
    
    // 治疗统计
    treatmentStats: {
      treating: 0,
      recovering: 0,
      completed: 0
    },
    
    // 治疗记录
    treatmentRecords: [] as TreatmentRecord[],
    
    // AI建议
    aiAdvice: {
      loading: false,
      result: null as any,
      error: null as string | null
    },
    
    // AI建议历史
    aiAdviceHistory: [] as any[]
  },

  onLoad() {
    this.loadCurrentAbnormalData()
  },

  onShow() {
    // 页面显示时刷新数据
    this.refreshData()
  },

  onPullDownRefresh() {
    this.loadCurrentAbnormalData().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 刷新所有数据
  async refreshData() {
    await this.loadCurrentAbnormalData()
  },

  // 加载当前异常个体数据
  async loadCurrentAbnormalData() {
    try {
      this.setData({ loading: true })
      
      // 获取当前异常个体数据
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_current_abnormal_animals'
        }
      })
      
      if (result.result && result.result.success) {
        const data = result.result.data
        this.processCurrentData(data)
      } else {
        console.log('获取当前异常数据失败，使用模拟数据')
        this.loadMockCurrentData()
      }
    } catch (error) {
      console.error('加载当前异常数据失败:', error)
      this.loadMockCurrentData()
    } finally {
      this.setData({ 
        loading: false,
        updateTime: new Date().toLocaleString()
      })
    }
  },

  // 处理当前异常数据
  processCurrentData(rawData: any) {
    const animals = rawData.animals || []
    const diseases = rawData.diseases || []
    const locations = rawData.locations || []
    
    // 统计当前状态
    const stats = animals.reduce((acc: any, animal: any) => {
      acc.total++
      acc[animal.priority]++
      if (animal.treatmentStatus === 'treating') {
        acc.treating++
      }
      return acc
    }, { urgent: 0, moderate: 0, mild: 0, treating: 0, total: 0 })
    
    // 处理病种分布
    const currentDiseases = this.processCurrentDiseases(diseases)
    
    // 处理位置分布
    const locationDistribution = this.processLocationDistribution(locations)
    
    // 更新优先级筛选计数
    const priorityLevels = [
      { level: 'all', label: '全部', count: stats.total },
      { level: 'urgent', label: '紧急', count: stats.urgent },
      { level: 'moderate', label: '中等', count: stats.moderate },
      { level: 'mild', label: '轻微', count: stats.mild }
    ]
    
    this.setData({
      currentStats: stats,
      currentDiseases,
      locationDistribution,
      priorityLevels,
      abnormalAnimals: animals,
      filteredAbnormalAnimals: animals // 初始显示所有
    })
    
    // 同时加载治疗数据
    this.loadTreatmentData()
  },
  
  // 处理当前病种数据
  processCurrentDiseases(diseases: any[]): CurrentDisease[] {
    const colors = ['#e34d59', '#ed7b2f', '#0052d9', '#00a870', '#8b5cf6', '#06b6d4']
    const total = diseases.reduce((sum, d) => sum + d.count, 0)
    
    let currentAngle = 0
    return diseases.map((disease, index) => {
      const percentage = total > 0 ? Math.round((disease.count / total) * 100) : 0
      const angle = (percentage / 100) * 360
      
      const result: CurrentDisease = {
        name: disease.name,
        count: disease.count,
        percentage,
        color: colors[index % colors.length],
        startAngle: currentAngle,
        angle
      }
      
      currentAngle += angle
      return result
    })
  },
  
  // 处理位置分布数据
  processLocationDistribution(locations: any[]): LocationDistribution[] {
    return locations.map((location: any) => ({
      location: location.name,
      totalCount: location.totalCount,
      abnormalCount: location.abnormalCount,
      rate: location.totalCount > 0 ? Math.round((location.abnormalCount / location.totalCount) * 100) : 0,
      diseases: location.diseases || []
    }))
  },
  
  // 加载治疗数据
  async loadTreatmentData() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_treatment_records'
        }
      })
      
      if (result.result && result.result.success) {
        const data = result.result.data
        this.setData({
          treatmentStats: data.stats,
          treatmentRecords: data.records
        })
      } else {
        this.loadMockTreatmentData()
      }
    } catch (error) {
      console.error('加载治疗数据失败:', error)
      this.loadMockTreatmentData()
    }
  },
  
  // 加载模拟当前数据
  loadMockCurrentData() {
    const mockAnimals: AbnormalAnimal[] = [
      {
        id: '1',
        animalId: 'G001',
        disease: '禽流感',
        priority: 'urgent',
        location: '1号鹅舍',
        discoveredTime: '2小时前',
        symptoms: '发热、食欲不振、呼吸困难',
        treatmentStatus: 'pending'
      },
      {
        id: '2',
        animalId: 'G045',
        disease: '肠道感染',
        priority: 'moderate',
        location: '2号鹅舍',
        discoveredTime: '1天前',
        symptoms: '腹泻、精神萎靡',
        treatmentStatus: 'treating'
      },
      {
        id: '3',
        animalId: 'G078',
        disease: '呼吸道感染',
        priority: 'mild',
        location: '1号鹅舍',
        discoveredTime: '3天前',
        symptoms: '轻微咳嗽',
        treatmentStatus: 'treating'
      },
      {
        id: '4',
        animalId: 'G089',
        disease: '禽流感',
        priority: 'urgent',
        location: '3号鹅舍',
        discoveredTime: '6小时前',
        symptoms: '高热、拒食',
        treatmentStatus: 'pending'
      },
      {
        id: '5',
        animalId: 'G156',
        disease: '营养不良',
        priority: 'mild',
        location: '2号鹅舍',
        discoveredTime: '1周前',
        symptoms: '体重下降、羽毛蓬乱',
        treatmentStatus: 'treating'
      }
    ]
    
    const mockDiseases = [
      { name: '禽流感', count: 8, color: '#e34d59' },
      { name: '肠道感染', count: 5, color: '#ed7b2f' },
      { name: '呼吸道感染', count: 3, color: '#0052d9' },
      { name: '营养不良', count: 2, color: '#00a870' }
    ]
    
    const mockLocations = [
      {
        name: '1号鹅舍',
        totalCount: 150,
        abnormalCount: 8,
        diseases: [
          { name: '禽流感', count: 4, color: '#e34d59' },
          { name: '呼吸道感染', count: 3, color: '#0052d9' },
          { name: '营养不良', count: 1, color: '#00a870' }
        ]
      },
      {
        name: '2号鹅舍',
        totalCount: 120,
        abnormalCount: 6,
        diseases: [
          { name: '肠道感染', count: 4, color: '#ed7b2f' },
          { name: '营养不良', count: 1, color: '#00a870' },
          { name: '禽流感', count: 1, color: '#e34d59' }
        ]
      },
      {
        name: '3号鹅舍',
        totalCount: 180,
        abnormalCount: 4,
        diseases: [
          { name: '禽流感', count: 3, color: '#e34d59' },
          { name: '肠道感染', count: 1, color: '#ed7b2f' }
        ]
      }
    ]
    
    const mockData = {
      animals: mockAnimals,
      diseases: mockDiseases,
      locations: mockLocations
    }
    
    this.processCurrentData(mockData)
    
    wx.showToast({
      title: '已加载模拟数据',
      icon: 'success',
      duration: 1500
    })
  },
  
  // 加载模拟治疗数据
  loadMockTreatmentData() {
    const mockTreatmentStats = {
      treating: 8,
      recovering: 5,
      completed: 12
    }
    
    const mockTreatmentRecords: TreatmentRecord[] = [
      {
        id: '1',
        animalId: 'G045',
        disease: '肠道感染',
        medication: '恩诺沙星',
        dosage: '10mg/kg',
        operator: '张三',
        currentDay: 3,
        totalDays: 7,
        progressPercentage: 43,
        status: 'treating',
        statusText: '治疗中'
      },
      {
        id: '2',
        animalId: 'G078',
        disease: '呼吸道感染',
        medication: '阿莫西林',
        dosage: '15mg/kg',
        operator: '李四',
        currentDay: 5,
        totalDays: 7,
        progressPercentage: 71,
        status: 'recovering',
        statusText: '恢复中'
      },
      {
        id: '3',
        animalId: 'G156',
        disease: '营养不良',
        medication: '复合维生素',
        dosage: '1粒/天',
        operator: '王五',
        currentDay: 7,
        totalDays: 10,
        progressPercentage: 70,
        status: 'treating',
        statusText: '治疗中'
      }
    ]
    
    this.setData({
      treatmentStats: mockTreatmentStats,
      treatmentRecords: mockTreatmentRecords
    })
  },

  // Tab切换
  onTabChange(e: any) {
    const { value } = e.detail
    this.setData({
      activeTab: value
    })
    
    // 触觉反馈
    wx.vibrateShort({ type: 'light' })
  },

  // ========== 优先级筛选功能 ==========
  
  // 优先级筛选
  onPriorityFilter(e: any) {
    const { level } = e.currentTarget.dataset
    let filteredAnimals = this.data.abnormalAnimals
    
    if (level !== 'all') {
      filteredAnimals = this.data.abnormalAnimals.filter(animal => animal.priority === level)
    }
    
    this.setData({
      activePriority: level,
      filteredAbnormalAnimals: filteredAnimals
    })
    
    wx.vibrateShort({ type: 'light' })
  },

  // ========== 治疗管理功能 ==========
  
  // 开始治疗
  startTreatment(e: any) {
    const { animal } = e.currentTarget.dataset
    
    wx.showModal({
      title: '开始治疗',
      content: `确定开始治疗 ${animal.animalId} (${animal.disease})？`,
      success: (res) => {
        if (res.confirm) {
          // 这里可以调用云函数开始治疗
          wx.showToast({
            title: '已开始治疗',
            icon: 'success'
          })
          
          // 更新本地状态
          const updatedAnimals = this.data.abnormalAnimals.map(a => 
            a.id === animal.id 
              ? { ...a, treatmentStatus: 'treating' as const }
              : a
          )
          
          this.setData({
            abnormalAnimals: updatedAnimals,
            filteredAbnormalAnimals: this.data.activePriority === 'all' 
              ? updatedAnimals 
              : updatedAnimals.filter(a => a.priority === this.data.activePriority)
          })
        }
      }
    })
  },
  
  // 查看个体详情
  viewAnimalDetail(e: any) {
    const { animal } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/health-record-detail/health-record-detail?animalId=${animal.animalId}`
    })
  },
  
  // 更新治疗记录
  updateTreatment(e: any) {
    const { record } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/health-record-form/health-record-form?type=update&recordId=${record.id}`
    })
  },
  
  // 标记治愈
  markRecovered(e: any) {
    const { record } = e.currentTarget.dataset
    
    wx.showModal({
      title: '确认治愈',
      content: `确定标记 ${record.animalId} 已治愈？`,
      success: (res) => {
        if (res.confirm) {
          // 这里可以调用云函数标记治愈
          wx.showToast({
            title: '已标记治愈',
            icon: 'success'
          })
          
          // 刷新数据
          this.refreshData()
        }
      }
    })
  },

  // ========== AI建议功能 ==========
  
  // 生成AI建议
  async generateAIAdvice() {
    console.log('生成AI异常管理建议')
    
    this.setData({
      'aiAdvice.loading': true,
      'aiAdvice.error': null
    })
    
    try {
      // 构建AI分析提示词
      const prompt = this.buildAbnormalAnalysisPrompt()
      
      // 调用AI分析云函数
      const result = await wx.cloud.callFunction({
        name: 'ai-multi-model',
        data: {
          action: 'chat_completion',
          messages: [
            {
              role: 'system',
              content: '你是一个专业的鹅类养殖健康管理专家，擅长分析当前异常情况并提供紧急处理建议和治疗方案。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          taskType: 'urgent_diagnosis',
          priority: 'fast'
        }
      })
      
      if (result.result.success) {
        const adviceData = this.parseAIAdviceResult(result.result.data.content)
        
        this.setData({
          'aiAdvice.loading': false,
          'aiAdvice.result': adviceData,
          'aiAdvice.error': null
        })
        
        wx.vibrateShort({ type: 'medium' })
        
        wx.showToast({
          title: 'AI分析完成',
          icon: 'success',
          duration: 1500
        })
        
      } else {
        // AI分析失败，使用fallback建议
        this.setData({
          'aiAdvice.loading': false,
          'aiAdvice.result': this.generateFallbackAdvice(),
          'aiAdvice.error': result.result.error
        })
        
        wx.showToast({
          title: '分析完成(基于规则)',
          icon: 'none',
          duration: 2000
        })
      }
      
    } catch (error) {
      console.error('AI建议生成失败:', error)
      
      this.setData({
        'aiAdvice.loading': false,
        'aiAdvice.error': error.message || 'AI服务异常',
        'aiAdvice.result': null
      })
      
      wx.showToast({
        title: '分析失败，请稍后重试',
        icon: 'none',
        duration: 2000
      })
    }
  },
  
  // 构建AI分析提示词
  buildAbnormalAnalysisPrompt(): string {
    const { currentStats, currentDiseases, locationDistribution, abnormalAnimals } = this.data
    
    // 筛选紧急和中等优先级的个体
    const urgentAnimals = abnormalAnimals.filter(a => a.priority === 'urgent')
    const moderateAnimals = abnormalAnimals.filter(a => a.priority === 'moderate')
    
    return `请基于以下当前异常情况，提供紧急处理建议和治疗方案：

当前异常统计：
- 紧急：${currentStats.urgent} 只
- 中等：${currentStats.moderate} 只
- 轻微：${currentStats.mild} 只
- 治疗中：${currentStats.treating} 只

病种分布：
${currentDiseases.map(d => `- ${d.name}：${d.count}只 (${d.percentage}%)`).join('\n')}

鹅舍分布：
${locationDistribution.map(l => `- ${l.location}：${l.abnormalCount}/${l.totalCount}只异常 (异常率${l.rate}%)`).join('\n')}

紧急个体：
${urgentAnimals.map(a => `- ${a.animalId} (${a.disease}, ${a.location}, ${a.discoveredTime})`).join('\n')}

请提供以下格式的JSON分析结果：
{
  "riskLevel": "high|medium|low",
  "riskLevelText": "风险等级描述",
  "riskFactors": ["风险因素1", "风险因素2"],
  "urgentActions": [
    {
      "priority": "立即",
      "title": "紧急措施标题",
      "description": "具体操作描述"
    }
  ],
  "treatmentPlan": [
    {
      "disease": "疾病名称",
      "affectedCount": "影响数量",
      "medications": [
        {
          "name": "药物名称",
          "dosage": "剂量",
          "priority": "high|medium|low",
          "priorityText": "优先级描述"
        }
      ],
      "notes": ["注意事项1", "注意事项2"]
    }
  ],
  "preventionMeasures": [
    {
      "category": "环境管理",
      "measures": ["具体措施1", "具体措施2"]
    }
  ]
}`
  },
  
  // 解析AI建议结果
  parseAIAdviceResult(content: string): any {
    try {
      // 尝试提取JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      } else {
        // 如果无法解析，返回fallback
        return this.generateFallbackAdvice()
      }
    } catch (error) {
      console.error('解析AI建议结果失败:', error)
      return this.generateFallbackAdvice()
    }
  },
  
  // 生成fallback建议
  generateFallbackAdvice(): any {
    const { currentStats, currentDiseases } = this.data
    const hasUrgent = currentStats.urgent > 0
    const mainDisease = currentDiseases.length > 0 ? currentDiseases[0].name : '未知疾病'
    
    return {
      riskLevel: hasUrgent ? 'high' : currentStats.moderate > 5 ? 'medium' : 'low',
      riskLevelText: hasUrgent ? '高风险 - 需立即处理' : currentStats.moderate > 5 ? '中等风险 - 需密切关注' : '低风险 - 常规处理',
      riskFactors: [
        hasUrgent ? '存在紧急异常个体' : '异常个体数量较多',
        `${mainDisease}传播风险`,
        '鹅群密度较高'
      ],
      urgentActions: [
        {
          priority: '立即',
          title: '隔离异常个体',
          description: `立即隔离所有${hasUrgent ? '紧急' : '异常'}个体，防止疾病传播`
        },
        {
          priority: '1小时内',
          title: '环境消毒',
          description: '对相关鹅舍进行全面消毒，特别是饮水和饲料区域'
        }
      ],
      treatmentPlan: [
        {
          disease: mainDisease,
          affectedCount: currentDiseases.length > 0 ? currentDiseases[0].count : 0,
          medications: [
            {
              name: '广谱抗生素',
              dosage: '按体重计算',
              priority: 'high',
              priorityText: '首选药物'
            }
          ],
          notes: ['密切观察治疗反应', '记录用药情况']
        }
      ],
      preventionMeasures: [
        {
          category: '环境管理',
          measures: ['加强通风', '保持干燥', '定期消毒']
        },
        {
          category: '饲养管理',
          measures: ['调整饲养密度', '强化营养', '监测健康状况']
        }
      ]
    }
  },
  
  // 查看历史AI建议详情
  viewHistoryDetail(e: any) {
    const { item } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/ai-diagnosis-detail/ai-diagnosis-detail?id=${item.id}`
    })
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
