// health/health.ts - 健康管理页面（模块化优化版）
import CloudApi from '../../utils/cloud-api'
import * as HealthUtils from './modules/health-utils'
import * as HealthStatsCalculator from './modules/health-stats-calculator'
import * as HealthWatchers from './modules/health-watchers'
import * as HealthDataLoader from './modules/health-data-loader'

interface HealthStats {
  totalChecks: number
  healthyCount: number
  sickCount: number
  deadCount: number
  healthyRate: string
  mortalityRate: string
}

interface PreventionStats {
  totalPreventions: number
  vaccineCount: number
  vaccineCoverage: number          // 接种覆盖数（基于第一针）
  vaccineStats: { [key: string]: number }  // 按疫苗名称分类的统计
  disinfectionCount: number
  totalCost: number
}

interface TreatmentStats {
  totalTreatments: number
  totalCost: number
  recoveredCount: number
  ongoingCount: number
  recoveryRate: string
}

interface PreventionRecord {
  _id: string
  batchId: string
  preventionType: string
  preventionDate: string
  vaccineInfo?: any
  veterinarianInfo?: any
  costInfo?: any
  effectiveness: string
  notes: string
}

interface HealthAlert {
  _id: string
  batchId: string
  alertType: string
  severity: string
  title: string
  description: string
  status: string
  createdAt: string
}

// Page 实例属性（不在 data 中）
interface PageInstance {
  data: PageData
  healthRecordsWatcher: any
  deathRecordsWatcher: any
  refreshTimer: any
}

interface PageData {
  // 选项卡状态
  activeTab: string
  
  // 健康数据
  healthStats: HealthStats
  preventionStats: PreventionStats
  treatmentStats: TreatmentStats
  
  // 记录数据
  recentPreventionRecords: PreventionRecord[]
  activeHealthAlerts: HealthAlert[]
  
  // 页面状态
  loading: boolean
  refreshing: boolean
  currentBatchId: string
  currentBatchNumber: string
  
  // 批次数据
  showBatchDropdown: boolean
  availableBatches: any[]
  
  // 弹窗相关
  showDetailPopup: boolean
  selectedRecord: any
  
  // 各Tab页面数据
  healthOverview: any
  preventionData: any
  monitoringData: any
  treatmentData: any
  analysisData: any
  activeAlerts: any[]
  
  // 时间范围
  dateRange: {
    start: string
    end: string
  }
}

Page<PageData>({
  data: {
    // 选项卡
    activeTab: 'treatment', // prevention|monitoring|treatment|analysis
    
    // 健康统计数据
    healthStats: {
      totalChecks: 0,
      healthyCount: 0,
      sickCount: 0,
      deadCount: 0,
      healthyRate: '0%',
      mortalityRate: '0%',
      abnormalCount: 0,
      treatingCount: 0,
      isolatedCount: 0
    },
    
    // 预防统计数据
    preventionStats: {
      totalPreventions: 0,
      vaccineCount: 0,
      vaccineCoverage: 0,
      vaccineStats: {},
      disinfectionCount: 0,
      totalCost: 0
    },
    
    // 各批次预防统计列表（全部批次模式使用）
    batchPreventionList: [],
    
    // 治疗统计数据
    treatmentStats: {
      totalTreatments: 0,
      totalCost: 0,
      recoveredCount: 0,
      ongoingCount: 0,
      recoveryRate: '0%'
    },
    
    // 记录数据
    recentPreventionRecords: [],
    activeHealthAlerts: [],
    
    // 页面状态
    loading: false,
    refreshing: false,
    currentBatchId: 'all', // 默认显示全部批次
    currentBatchNumber: '全部批次',
    
    // 批次数据
    showBatchDropdown: false,
    availableBatches: [],
    
    // 弹窗相关
    showDetailPopup: false,
    selectedRecord: null,
    
    // 各Tab页面数据
    healthOverview: {
      survivalRate: 0,
      abnormalCount: 0,
      preventionScore: 0
    },
    preventionData: {
      stats: {
        vaccinationRate: 0,
        preventionCost: 0
      },
      recentRecords: []
    },
    monitoringData: {
      realTimeStatus: {
        healthyCount: 0,
        abnormalCount: 0,
        isolatedCount: 0
      },
      abnormalList: [],
      diseaseDistribution: []
    },
    treatmentData: {
      stats: {
        pendingDiagnosis: 0,
        ongoingTreatment: 0,
        totalTreatmentCost: 0,
        cureRate: 0
      },
      treatmentHistory: [] as any[]
    },
    analysisData: {
      survivalAnalysis: {
        rate: 0,
        trend: 'stable',
        byStage: []
      },
      costAnalysis: {
        preventionCost: 0,
        treatmentCost: 0,
        totalCost: 0,
        roi: 0
      },
      performanceMetrics: []
    },
    activeAlerts: [],
    
    // 默认显示最近30天的数据
    dateRange: {
      start: '',
      end: ''
    }
  },
  
  // Page 实例属性（不在 data 中）
  healthRecordsWatcher: null as any,
  deathRecordsWatcher: null as any,
  refreshTimer: null as any,

  /**
   * 页面加载
   */
  async onLoad(options: any) {
    const batchId = options.batchId
    
    this.initDateRange()
    
    // 如果传入了批次ID，使用传入的；否则默认显示全部批次
    if (batchId) {
      this.setData({
        currentBatchId: batchId
      })
    }
    
    // 先加载批次列表，然后加载数据
    await this.loadAvailableBatches()
    await this.loadHealthData()
    
    // 默认加载第一个Tab的数据（预防管理Tab需要同时加载监控数据）
    this.loadTabData(this.data.activeTab)
  },

  /**
   * 页面显示时刷新数据并启动实时监听
   */
  onShow() {
    // 启动实时数据监听（只在页面可见时监听，节省资源）
    this.startDataWatcher()
    
    // ✅ 检查是否需要刷新数据（从其他页面返回时）
    const needRefresh = wx.getStorageSync('health_page_need_refresh')
    if (needRefresh) {
      wx.removeStorageSync('health_page_need_refresh')
      // 强制刷新
      if (this.data.currentBatchId) {
        this.loadHealthData()
      }
    } else {
      // 正常刷新数据
      if (this.data.currentBatchId) {
        this.loadHealthData()
      }
    }
  },
  
  /**
   * 页面隐藏时停止监听
   */
  onHide() {
    this.stopDataWatcher()
  },
  
  /**
   * 页面卸载时停止监听
   */
  onUnload() {
    this.stopDataWatcher()
  },
  
  /**
   * 启动数据监听
   */
  startDataWatcher() {
    // 先停止旧的监听器，确保状态清理干净
    this.stopDataWatcher()
    
    const db = wx.cloud.database()
    
    
    // 延迟启动，给连接状态重置留出时间
    setTimeout(() => {
      // 监听健康记录变化
      try {
        this.healthRecordsWatcher = db.collection('health_records')
          .where({
            isDeleted: false
          })
          .watch({
            onChange: (snapshot) => {
              // 延迟刷新，避免频繁更新
              if (this.refreshTimer) {
                clearTimeout(this.refreshTimer)
              }
              this.refreshTimer = setTimeout(() => {
                this.loadHealthData()
              }, 1000)
            },
            onError: (err) => {
              console.error('❌ 健康记录监听错误:', err)
              // 错误时自动重置监听器
              this.healthRecordsWatcher = null
            }
          })
      } catch (error) {
        console.error('❌ 启动健康记录监听器失败:', error)
        this.healthRecordsWatcher = null
      }
      
      // 监听死亡记录变化
      try {
        this.deathRecordsWatcher = db.collection('health_death_records')
          .where({
            isDeleted: false
          })
          .watch({
            onChange: (snapshot) => {
              // 延迟刷新，避免频繁更新
              if (this.refreshTimer) {
                clearTimeout(this.refreshTimer)
              }
              this.refreshTimer = setTimeout(() => {
                this.loadHealthData()
              }, 1000)
            },
            onError: (err) => {
              console.error('❌ 死亡记录监听错误:', err)
              // 错误时自动重置监听器
              this.deathRecordsWatcher = null
            }
          })
      } catch (error) {
        console.error('❌ 启动死亡记录监听器失败:', error)
        this.deathRecordsWatcher = null
      }
    }, 100) // 延迟100ms启动
  },
  
  /**
   * 停止数据监听
   */
  stopDataWatcher() {
    
    if (this.healthRecordsWatcher) {
      try {
        this.healthRecordsWatcher.close()
      } catch (error: any) {
        // 忽略 WebSocket 连接已断开的非致命错误
        if (!error.message || !error.message.includes('websocket not connected')) {
          console.error('❌ 停止健康记录监听器时出错:', error)
        }
      } finally {
        this.healthRecordsWatcher = null
      }
    }
    
    if (this.deathRecordsWatcher) {
      try {
        this.deathRecordsWatcher.close()
      } catch (error: any) {
        // 忽略 WebSocket 连接已断开的非致命错误
        if (!error.message || !error.message.includes('websocket not connected')) {
          console.error('❌ 停止死亡记录监听器时出错:', error)
        }
      } finally {
        this.deathRecordsWatcher = null
      }
    }
    
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.setData({ refreshing: true })
    
    this.loadHealthData().finally(() => {
      this.setData({ refreshing: false })
      wx.stopPullDownRefresh()
    })
  },

  /**
   * 初始化时间范围（最近30天）
   */
  initDateRange() {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)

    this.setData({
      dateRange: {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      }
    })
  },

  /**
   * 获取当前批次ID（从缓存或全局状态）
   */
  getCurrentBatchId(): string {
    // 从本地存储或全局状态获取当前批次ID
    return wx.getStorageSync('currentBatchId') || ''
  },

  /**
   * 切换选项卡
   */
  switchTab(e: any) {
    const { tab } = e.currentTarget.dataset
    // 已移除调试日志
    this.setData({ activeTab: tab })
    
    // 根据选项卡加载对应数据
    this.loadTabData(tab)
  },

  /**
   * Tab组件变化事件处理
   */
  onTabChange(e: any) {
    const { value } = e.detail
    // 已移除调试日志
    this.setData({ activeTab: value })
    
    // 根据选项卡加载对应数据
    this.loadTabData(value)
  },

  /**
   * 加载选项卡数据
   */
  async loadTabData(tab: string) {
    switch (tab) {
      case 'overview':
        await this.loadHealthOverview()
        break
      case 'prevention':
        // 合并了健康监控，需要同时加载预防和监控数据
        await Promise.all([
          this.loadPreventionData(),
          this.loadMonitoringData()
        ])
        break
      case 'treatment':
        await this.loadTreatmentData()
        break
      case 'analysis':
        await this.loadAnalysisData()
        break
    }
  },

  /**
   * 加载健康数据（主入口）
   */
  async loadHealthData() {
    this.setData({ loading: true })

    try {
      // 如果是全部批次模式，加载汇总数据
      if (this.data.currentBatchId === 'all') {
        await this.loadAllBatchesData()
      } else {
        // 单个批次模式，加载详细数据
        await Promise.all([
          this.loadHealthOverview(),
          this.loadPreventionData(),
          this.loadTreatmentData()
        ])
      }
    } catch (error: any) {
      // 已移除调试日志
      wx.showToast({
        title: '加载数据失败',
        icon: 'error'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 加载所有批次的汇总数据
   */
  async loadAllBatchesData() {
    try {
      // 1. 查询批次健康汇总
      const healthResult = await wx.cloud.callFunction({
        name: 'health-management',
        data: { action: 'get_all_batches_health_summary' }
      })

      // 处理健康统计数据
      if (healthResult.result && healthResult.result.success) {
        const data = healthResult.result.data
        const batches = data.batches || []
        
        // 云函数版本号日志（用于确认更新）
        if (data._version) {
        }
        
        // 为每个批次并行查询预防记录
        const batchPreventionPromises = batches.map(async (batch: any) => {
          try {
            // 使用 batch._id 而不是 batch.batchId
            const result = await CloudApi.listPreventionRecords({
              batchId: batch._id || batch.batchId,
              pageSize: 100
            })
            
            
            if (result.success && result.data) {
              const records = result.data.records || []
              
              const stats = this.calculatePreventionStats(records)
              const formattedRecords = records.slice(0, 3).map((r: any) => this.formatPreventionRecord(r))
              
              
              return {
                ...batch,
                preventionStats: stats,
                vaccinationRate: batch.totalCount > 0 
                  ? ((stats.vaccineCoverage / batch.totalCount) * 100).toFixed(1)
                  : '0',
                recentRecords: formattedRecords
              }
            }
            return { 
              ...batch, 
              preventionStats: { 
                totalPreventions: 0, 
                vaccineCount: 0, 
                vaccineCoverage: 0,
                vaccineStats: {},
                disinfectionCount: 0, 
                totalCost: 0 
              }, 
              vaccinationRate: '0',
              recentRecords: []
            }
          } catch (error) {
            return { 
              ...batch, 
              preventionStats: { 
                totalPreventions: 0, 
                vaccineCount: 0, 
                vaccineCoverage: 0,
                vaccineStats: {},
                disinfectionCount: 0, 
                totalCost: 0 
              }, 
              vaccinationRate: '0',
              recentRecords: []
            }
          }
        })
        
        const batchesWithPrevention = await Promise.all(batchPreventionPromises)
        
        // 计算汇总统计
        const totalAnimals = batches.reduce((sum: number, b: any) => sum + (b.totalCount || 0), 0)
        const healthyCount = batches.reduce((sum: number, b: any) => sum + (b.healthyCount || 0), 0)
        const sickCount = batches.reduce((sum: number, b: any) => sum + (b.sickCount || 0), 0)
        const deadCount = batches.reduce((sum: number, b: any) => sum + (b.deadCount || 0), 0)
        
        // ✅ 添加详细日志，追踪每个批次的死亡数
        batches.forEach((b: any, index: number) => {
        })
        
        // 汇总所有批次的预防统计
        const totalVaccineCoverage = batchesWithPrevention.reduce((sum: number, b: any) => 
          sum + (b.preventionStats?.vaccineCoverage || 0), 0)
        const totalVaccineCount = batchesWithPrevention.reduce((sum: number, b: any) => 
          sum + (b.preventionStats?.vaccineCount || 0), 0)
        const totalPreventions = batchesWithPrevention.reduce((sum: number, b: any) => 
          sum + (b.preventionStats?.totalPreventions || 0), 0)
        const totalCost = batchesWithPrevention.reduce((sum: number, b: any) => 
          sum + (b.preventionStats?.totalCost || 0), 0)
        
        // 合并所有批次的疫苗统计
        const allVaccineStats: { [key: string]: number } = {}
        batchesWithPrevention.forEach((b: any) => {
          if (b.preventionStats?.vaccineStats) {
            Object.entries(b.preventionStats.vaccineStats).forEach(([name, count]) => {
              if (!allVaccineStats[name]) {
                allVaccineStats[name] = 0
              }
              allVaccineStats[name] += count as number
            })
          }
        })
        
        // 获取最近的预防记录（从各批次的记录中选取）
        const allRecentRecords = batchesWithPrevention.flatMap((b: any) => b.recentRecords || [])
        const recentPreventionRecords = allRecentRecords.slice(0, 10)
        
        
        // 计算总体疫苗接种率
        const vaccinationRate = totalAnimals > 0 
          ? ((totalVaccineCoverage / totalAnimals) * 100).toFixed(1)
          : 0
        
        const preventionStats = {
          totalPreventions,
          vaccineCount: totalVaccineCount,
          vaccineCoverage: totalVaccineCoverage,
          vaccineStats: allVaccineStats,
          disinfectionCount: 0,
          totalCost
        }
        
        // ✅ 处理治疗统计数据 - 汇总所有批次
        let totalOngoing = 0  // 治疗中的动物总数
        let totalOngoingRecords = 0  // 治疗中的记录条数
        let totalTreatmentCost = 0  // 重命名避免与预防统计的 totalCost 冲突
        let totalTreated = 0
        let totalCured = 0
        
        // 并行查询所有批次的治疗统计
        const treatmentPromises = batches.map(async (batch: any) => {
          try {
            const result = await wx.cloud.callFunction({
              name: 'health-management',
              data: {
                action: 'calculate_treatment_cost',
                batchId: batch._id
              }
            })
            
            if (result.result?.success) {
              const data = result.result.data
              return {
                ongoingCount: data.ongoingCount || 0,  // 记录条数
                ongoingAnimalsCount: data.ongoingAnimalsCount || 0,  // ✅ 动物总数
                totalCost: parseFloat(data.totalCost || '0'),
                totalTreated: data.totalTreated || 0,
                totalCuredAnimals: data.totalCuredAnimals || 0
              }
            }
          } catch (error) {
          }
          return { ongoingCount: 0, ongoingAnimalsCount: 0, totalCost: 0, totalTreated: 0, totalCuredAnimals: 0 }
        })
        
        const treatmentResults = await Promise.all(treatmentPromises)
        
        // 汇总所有批次的治疗数据
        treatmentResults.forEach(result => {
          totalOngoing += result.ongoingAnimalsCount  // ✅ 累加治疗中的动物数
          totalOngoingRecords += result.ongoingCount  // 累加治疗中的记录条数
          totalTreatmentCost += result.totalCost  // 使用重命名后的变量
          totalTreated += result.totalTreated
          totalCured += result.totalCuredAnimals
        })
        
        // 计算总体治愈率
        const cureRate = totalTreated > 0 
          ? ((totalCured / totalTreated) * 100).toFixed(1)
          : '0'
        
        const treatmentStats = {
          totalTreatments: totalTreated,
          totalCost: totalTreatmentCost,  // 使用重命名后的变量
          recoveredCount: totalCured,
          ongoingCount: totalOngoingRecords,  // 治疗中记录条数（用于卡片显示）
          recoveryRate: cureRate + '%'
        }
        
        // ✅ 查询所有批次的待处理记录
        const abnormalResult = await wx.cloud.callFunction({
          name: 'health-management',
          data: {
            action: 'get_health_records_by_status',
            batchId: 'all',
            status: 'abnormal'
          }
        })
        
        // ✅ 使用受影响的动物只数，而不是记录条数
        const abnormalCount = abnormalResult.result?.success 
          ? (abnormalResult.result.data?.totalCount || 0)
          : 0
        const abnormalRecordCount = abnormalResult.result?.success 
          ? (abnormalResult.result.data?.recordCount || 0)
          : 0
        
        // ✅ 查询所有批次的隔离记录
        const isolatedResult = await wx.cloud.callFunction({
          name: 'health-management',
          data: {
            action: 'get_health_records_by_status',
            batchId: 'all',
            status: 'isolated'
          }
        })
        
        // ✅ 使用受影响的动物只数，而不是记录条数
        const isolatedCount = isolatedResult.result?.success 
          ? (isolatedResult.result.data?.totalCount || 0)
          : 0
        const isolatedRecordCount = isolatedResult.result?.success 
          ? (isolatedResult.result.data?.recordCount || 0)
          : 0
        
        // ✅ 重新计算健康率和死亡率（扣除治疗中、待处理、隔离的动物）
        // 真正健康的动物 = 总数 - 死亡 - 治疗中 - 待处理 - 隔离
        const actualHealthyCount = totalAnimals - deadCount - totalOngoing - abnormalCount - isolatedCount
        const healthyRate = totalAnimals > 0 ? ((actualHealthyCount / totalAnimals) * 100).toFixed(1) : '100'
        const mortalityRate = totalAnimals > 0 ? ((deadCount / totalAnimals) * 100).toFixed(1) : '0'
        
        // 设置监控数据（实时健康状态）
        const monitoringData = {
          realTimeStatus: {
            healthyCount: actualHealthyCount,  // ✅ 使用重新计算的健康数
            abnormalCount: abnormalCount,  // ✅ 待处理记录条数
            isolatedCount: isolatedCount  // ✅ 隔离记录条数
          },
          abnormalList: [],
          diseaseDistribution: []
        }
        
        this.setData({
          healthStats: {
            totalChecks: totalAnimals,
            healthyCount: actualHealthyCount,  // ✅ 使用重新计算的健康数
            sickCount: sickCount,
            deadCount: deadCount,
            healthyRate: healthyRate + '%',
            mortalityRate: mortalityRate + '%',
            abnormalCount: abnormalRecordCount,  // ✅ 待处理记录条数（卡片显示）
            treatingCount: totalOngoingRecords,  // ✅ 治疗中记录条数（卡片显示）
            isolatedCount: isolatedRecordCount  // ✅ 隔离记录条数（卡片显示）
          },
          preventionStats,
          'preventionData.stats': {
            vaccinationRate,
            preventionCost: preventionStats.totalCost
          },
          'preventionData.recentRecords': recentPreventionRecords,
          treatmentStats,
          'treatmentData.stats': {
            pendingDiagnosis: 0,
            ongoingTreatment: totalOngoingRecords,  // ✅ 使用记录条数（卡片显示）
            totalTreatmentCost: totalTreatmentCost,  // 使用重命名后的变量
            cureRate: parseFloat(cureRate)  // ✅ 设置治愈率
          },
          recentPreventionRecords,
          batchPreventionList: batchesWithPrevention,
          activeHealthAlerts: [],
          monitoringData: monitoringData
        }, () => {
        })
      }
    } catch (error: any) {
      console.error('loadAllBatchesData 错误:', error)
    }
  },

  /**
   * 加载健康概览数据
   */
  async loadHealthOverview() {
    try {
      const result = await CloudApi.getHealthOverview(
        this.data.currentBatchId,
        this.data.dateRange
      )

      if (result.success && result.data) {
        const { healthStats, recentPrevention, activeAlerts, treatmentStats } = result.data
        
        this.setData({
          healthStats: {
            ...healthStats,
            healthyRate: healthStats.healthyRate + '%',
            mortalityRate: healthStats.mortalityRate + '%',
            abnormalCount: healthStats.abnormalCount || 0,
            treatingCount: healthStats.treatingCount || 0,
            isolatedCount: healthStats.isolatedCount || 0
          },
          recentPreventionRecords: recentPrevention || [],
          activeHealthAlerts: activeAlerts || [],
          treatmentStats: {
            ...treatmentStats,
            recoveryRate: treatmentStats.recoveryRate + '%'
          }
        })
      }
    } catch (error: any) {
      // 已移除调试日志
    }
  },

  /**
   * 加载预防管理数据
   */
  async loadPreventionData() {
    try {
      
      const result = await CloudApi.listPreventionRecords({
        batchId: this.data.currentBatchId,
        pageSize: 20,
        dateRange: this.data.dateRange
      })


      if (result.success && result.data) {
        const records = result.data.records || []
        
        // 格式化记录，映射字段
        const formattedRecords = records.map((record: any) => this.formatPreventionRecord(record))
        
        // 计算预防统计
        const preventionStats = this.calculatePreventionStats(records)
        
        // 🔥 修复：从批次列表中获取当前批次的总动物数
        let totalAnimals = 1
        if (this.data.currentBatchId && this.data.currentBatchId !== 'all') {
          const currentBatch = this.data.availableBatches.find((b: any) => 
            b._id === this.data.currentBatchId || b.batchId === this.data.currentBatchId
          )
          totalAnimals = currentBatch?.totalCount || currentBatch?.currentCount || this.data.healthStats.totalChecks || 1
        } else {
          totalAnimals = this.data.healthStats.totalChecks || 1
        }
        
        // 计算接种率（基于第一针覆盖数），添加上限约束
        let vaccinationRate = totalAnimals > 0 
          ? ((preventionStats.vaccineCoverage / totalAnimals) * 100)
          : 0
        
        // 🔥 添加约束：接种率不应超过合理范围
        if (vaccinationRate > 100) {
          // 限制在 100% 以内
          vaccinationRate = 100
        }
        
        vaccinationRate = vaccinationRate.toFixed(1)
        
        this.setData({
          vaccineCoverage: preventionStats.vaccineCoverage,
          totalAnimals: totalAnimals,
          vaccinationRate: vaccinationRate,
          batchId: this.data.currentBatchId,
          recordsCount: formattedRecords.length,
          preventionCost: preventionStats.totalCost
        })
        
        // 设置到 preventionData 对象中
        this.setData({
          preventionStats,
          recentPreventionRecords: formattedRecords.slice(0, 10), // 只显示最近10条
          'preventionData.stats': {
            vaccinationRate,
            preventionCost: preventionStats.totalCost
          },
          'preventionData.recentRecords': formattedRecords.slice(0, 10)
        }, () => {
        })
      } else {
      }
    } catch (error: any) {
      console.error('单批次模式 - loadPreventionData 错误:', error)
    }
  },

  /**
   * 加载监控数据（实时健康状态已整合到顶部）
   */
  async loadMonitoringData() {
    try {
      // 如果没有实时状态数据，使用健康统计数据填充
      const currentData = this.data.monitoringData?.realTimeStatus || {}
      
      // 如果当前批次不是全部批次，且监控数据为空，使用健康统计数据填充
      if (this.data.currentBatchId !== 'all' && 
          (!currentData.healthyCount && !currentData.abnormalCount && !currentData.isolatedCount)) {
        this.setData({
          'monitoringData.realTimeStatus': {
            healthyCount: this.data.healthStats.healthyCount || 0,
            abnormalCount: this.data.healthStats.abnormalCount || 0,
            isolatedCount: this.data.healthStats.isolatedCount || 0
          },
          'monitoringData.abnormalList': [],
          'monitoringData.diseaseDistribution': []
        })
      }
    } catch (error: any) {
      console.error('loadMonitoringData 错误:', error)
    }
  },

  /**
   * 加载治疗数据
   */
  async loadTreatmentData() {
    try {
      // ✅ 启用云函数调用，获取真实治疗统计数据
      
      // 1. 获取异常记录（待处理和治疗中的）
      const abnormalResult = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_abnormal_records',
          batchId: this.data.currentBatchId
        }
      })
      
      // 2. 计算治疗总成本和治愈率
      const costResult = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'calculate_treatment_cost',
          batchId: this.data.currentBatchId,
          dateRange: this.data.dateRange
        }
      })
      
      // 处理异常记录数据
      const abnormalRecords = abnormalResult.result?.success 
        ? (abnormalResult.result.data || [])
        : []
      
      // ✅ 待处理记录条数
      const abnormalCount = abnormalRecords.length
      
      // 处理成本和统计数据
      const costData = costResult.result?.success 
        ? costResult.result.data 
        : {}
      
      // 3. 获取历史治疗记录（包括所有状态）
      const historyResult = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_treatment_history',
          batchId: this.data.currentBatchId,
          limit: 5  // 只显示前5条
        }
      })
      
      // 处理历史治疗记录
      const treatmentHistory = historyResult.result?.success 
        ? (historyResult.result.data?.records || []).map((record: any) => ({
            ...record,
            statusText: this.getTreatmentStatusText(record.outcome?.status),
            startDate: record.startDate || record.createdAt?.substring(0, 10) || ''
          }))
        : []
      
      // 更新治疗数据和异常数据
      this.setData({
        'treatmentData.stats': {
          pendingDiagnosis: 0, // 需要从AI诊断记录获取
          ongoingTreatment: costData.ongoingCount || 0,
          totalTreatmentCost: parseFloat(costData.totalCost || '0'),
          cureRate: parseFloat(costData.cureRate || '0')  // ✅ 显示真实治愈率
        },
        'treatmentData.treatmentHistory': treatmentHistory,
        // ✅ 更新待处理记录数
        'monitoringData.realTimeStatus.abnormalCount': abnormalCount,
        'monitoringData.abnormalList': abnormalRecords
      })
      
    } catch (error: any) {
      console.error('❌ 加载治疗数据失败:', error)
      // 出错时设置默认值
      this.setData({
        'treatmentData.stats': {
          pendingDiagnosis: 0,
          ongoingTreatment: 0,
          totalTreatmentCost: 0,
          cureRate: 0
        },
        'treatmentData.treatmentHistory': [],
        'monitoringData.realTimeStatus.abnormalCount': 0,
        'monitoringData.abnormalList': []
      })
    }
  },

  /**
   * 获取治疗状态文本
   */
  getTreatmentStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      'ongoing': '治疗中',
      'cured': '已治愈',
      'died': '已死亡',
      'completed': '已完成',
      'pending': '待处理'
    }
    return statusMap[status] || '未知'
  },

  /**
   * 点击治疗记录，跳转到详情页
   */
  onTreatmentRecordTap(e: any) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/packageHealth/treatment-record/treatment-record?id=${id}&mode=view`
    })
  },

  /**
   * 查看全部治疗记录
   */
  onViewAllTreatments() {
    wx.navigateTo({
      url: '/packageHealth/treatment-records-list/treatment-records-list'
    })
  },

  /**
   * 加载分析数据
   */
  async loadAnalysisData() {
    // 实现健康分析数据加载
    // 已移除调试日志
  },

  /**
   * 格式化预防记录，映射数据库字段到显示字段
   */
  formatPreventionRecord(record: any) {
    // 预防类型中文名称映射
    const preventionTypeNames: { [key: string]: string } = {
      'vaccine': '疫苗接种',
      'disinfection': '消毒防疫',
      'deworming': '驱虫',
      'quarantine': '隔离检疫'
    }
    
    // 提取疫苗信息
    const vaccineInfo = record.vaccineInfo || {}
    const costInfo = record.costInfo || {}
    
    // 构建显示标题
    let title = preventionTypeNames[record.preventionType] || record.preventionType
    if (vaccineInfo.name) {
      title = `${title} - ${vaccineInfo.name}`
    }
    
    // 构建描述信息
    let desc = ''
    if (vaccineInfo.route) {
      desc += vaccineInfo.route
    }
    if (vaccineInfo.count) {
      desc += ` · ${vaccineInfo.count}只`
    }
    
    // 格式化日期时间
    let createTime = record.preventionDate || ''
    if (record.createdAt) {
      const date = new Date(record.createdAt)
      createTime = `${date.getMonth() + 1}月${date.getDate()}日`
    }
    
    return {
      ...record,
      // 显示字段
      preventionType: title,
      location: vaccineInfo.route || '-',
      targetAnimals: vaccineInfo.count || 0,
      createTime: createTime,
      // 关联任务标识
      hasRelatedTask: !!record.relatedTaskId,
      isFromTask: record.creationSource === 'task',
      // 成本信息
      cost: costInfo.totalCost || 0
    }
  },

  /**
   * 计算预防统计数据
   */
  calculatePreventionStats(records: PreventionRecord[]): PreventionStats {
    const totalPreventions = records.length
    
    // 按疫苗名称分类统计
    const vaccineStats: { [key: string]: number } = {}
    let totalVaccinatedCount = 0
    
    records.forEach(r => {
      if (r.preventionType === 'vaccine' && r.vaccineInfo) {
        const vaccineName = r.vaccineInfo.name || '未知疫苗'
        const count = r.vaccineInfo.count || 0
        
        if (!vaccineStats[vaccineName]) {
          vaccineStats[vaccineName] = 0
        }
        vaccineStats[vaccineName] += count
        
        // 累加总接种数（用于统计）
        totalVaccinatedCount += count
      }
    })
    
    // 计算接种覆盖数（使用第一针的接种数作为基数）
    const firstVaccineNames = ['小鹅瘟疫苗第一针', '小鹅瘟高免血清', '小鹅瘟高免血清或高免蛋黄抗体注射', '第一针']
    let vaccineCoverage = 0
    for (const name of firstVaccineNames) {
      if (vaccineStats[name]) {
        vaccineCoverage = Math.max(vaccineCoverage, vaccineStats[name])
      }
    }
    // 如果没有找到第一针，使用所有疫苗中的最大值作为覆盖基数
    if (vaccineCoverage === 0 && Object.keys(vaccineStats).length > 0) {
      vaccineCoverage = Math.max(...Object.values(vaccineStats))
    }
    
    const disinfectionCount = records.filter(r => r.preventionType === 'disinfection').length
    const totalCost = records.reduce((sum, r) => sum + (r.costInfo?.totalCost || 0), 0)

    return {
      totalPreventions,
      vaccineCount: totalVaccinatedCount,
      vaccineCoverage,
      vaccineStats,
      disinfectionCount,
      totalCost
    }
  },

  /**
   * 查看预防记录详情
   */
  viewPreventionRecord(e: any) {
    const { recordId } = e.currentTarget.dataset
    // 已移除调试日志
    wx.navigateTo({
      url: `/packageHealth/vaccine-record/vaccine-record?id=${recordId}`
    })
  },

  /**
   * 查看健康警报详情
   */
  viewHealthAlert(e: any) {
    const { alertId } = e.currentTarget.dataset
    // 已移除调试日志
    wx.navigateTo({
      url: `/packageHealth/health-care/health-care?alertId=${alertId}`
    })
  },

  /**
   * 创建新的健康记录
   */
  createHealthRecord() {
    wx.navigateTo({
      url: `/packageHealth/health-inspection/health-inspection?batchId=${this.data.currentBatchId}`
    })
  },

  /**
   * 创建新的预防记录
   */
  createPreventionRecord() {
    wx.navigateTo({
      url: `/packageHealth/vaccine-record/vaccine-record?batchId=${this.data.currentBatchId}&mode=create`
    })
  },

  /**
   * 创建新的治疗记录
   */
  createTreatmentRecord() {
    wx.navigateTo({
      url: `/packageHealth/treatment-record/treatment-record?batchId=${this.data.currentBatchId}&mode=create`
    })
  },

  /**
   * AI健康诊断
   */
  openAiDiagnosis() {
    wx.navigateTo({
      url: `/packageAI/ai-diagnosis/ai-diagnosis?batchId=${this.data.currentBatchId}`
    })
  },

  /**
   * 更改时间范围
   */
  changeDateRange() {
    wx.showActionSheet({
      itemList: ['最近7天', '最近30天', '最近90天', '自定义时间'],
      success: (res) => {
        switch (res.tapIndex) {
          case 0:
            this.setDateRange(7)
            break
          case 1:
            this.setDateRange(30)
            break
          case 2:
            this.setDateRange(90)
            break
          case 3:
            this.showCustomDatePicker()
            break
        }
      }
    })
  },

  /**
   * 设置时间范围
   */
  setDateRange(days: number) {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)

    this.setData({
      dateRange: {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      }
    })

    this.loadHealthData()
  },

  /**
   * 显示自定义时间选择器
   */
  showCustomDatePicker() {
    // 实现自定义时间选择器
    // 已移除调试日志
  },

  /**
   * 获取预防类型显示文本
   */
  getPreventionTypeText(type: string): string {
    const typeMap: { [key: string]: string } = {
      'vaccine': '疫苗接种',
      'disinfection': '消毒防疫',
      'nutrition': '营养补充',
      'inspection': '健康检查'
    }
    return typeMap[type] || type
  },

  /**
   * 获取严重程度颜色
   */
  getSeverityColor(severity: string): string {
    const colorMap: { [key: string]: string } = {
      'low': '#52c41a',
      'medium': '#faad14',
      'high': '#ff4d4f',
      'critical': '#a8071a'
    }
    return colorMap[severity] || '#d9d9d9'
  },

  /**
   * 获取健康状态图标
   */
  getHealthStatusIcon(healthyRate: string): string {
    const rate = parseFloat(healthyRate)
    if (rate >= 95) return '🟢'
    if (rate >= 90) return '🟡'
    if (rate >= 80) return '🟠'
    return '🔴'
  },

  /**
   * 格式化数字显示
   */
  formatNumber(num: number): string {
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + '万'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
  },

  /**
   * 格式化金额显示
   */
  formatAmount(amount: number): string {
    return '¥' + amount.toFixed(2)
  },

  /**
   * 菜单点击事件
   */
  onMenuTap() {
    wx.showActionSheet({
      itemList: ['导出报告', '数据统计', '设置提醒'],
      success: (res) => {
        // 已移除调试日志
      }
    })
  },

  /**
   * 待诊断卡片点击 - 跳转到AI诊断页面
   */
  onPendingDiagnosisClick() {
    wx.navigateTo({
      url: '/packageAI/ai-diagnosis/ai-diagnosis'
    })
  },

  /**
   * 治疗中卡片点击 - 跳转到治疗记录列表
   */
  onOngoingTreatmentClick() {
    wx.navigateTo({
      url: '/packageHealth/treatment-records-list/treatment-records-list'
    })
  },

  /**
   * 治疗成本卡片点击 - 显示成本详情
   */
  onTreatmentCostClick() {
    wx.showModal({
      title: '治疗成本详情',
      content: `当前批次治疗总成本：¥${this.data.treatmentData.stats.totalTreatmentCost || 0}\n\n包含所有进行中治疗的用药和操作成本。`,
      showCancel: false
    })
  },

  /**
   * 预警操作事件
   */
  onAlertAction(e: any) {
    const { alertId, action } = e.currentTarget.dataset
    // 已移除调试日志
  },

  /**
   * 预防管理操作事件
   */
  onPreventionAction(e: any) {
    const { action } = e.currentTarget.dataset
    // 已移除调试日志
    switch (action) {
      case 'add_vaccine':
        this.createPreventionRecord()
        break
      case 'add_disinfection':
        wx.navigateTo({
          url: `/packageHealth/disinfection-record/disinfection-record?batchId=${this.data.currentBatchId}`
        })
        break
      case 'health_inspection':
        this.createHealthRecord()
        break
      case 'add_healthcare':
        wx.navigateTo({
          url: `/packageHealth/health-care/health-care?batchId=${this.data.currentBatchId}`
        })
        break
    }
  },

  /**
   * 监控操作事件
   */
  onMonitoringAction(e: any) {
    const { action } = e.currentTarget.dataset
    // 已移除调试日志
    switch (action) {
      case 'batch_check':
        this.createHealthRecord()
        break
      case 'isolation_manage':
        wx.navigateTo({
          url: `/packageHealth/health-care/health-care?mode=isolation&batchId=${this.data.currentBatchId}`
        })
        break
      case 'view_abnormal':
        const data = e.currentTarget.dataset.data
        this.showDetailPopup(data)
        break
    }
  },

  /**
   * 治疗操作事件
   */
  onTreatmentAction(e: any) {
    const { action } = e.currentTarget.dataset
    // 已移除调试日志
    switch (action) {
      case 'start_diagnosis':
        this.openAiDiagnosis()
        break
      case 'add_treatment':
        this.createTreatmentRecord()
        break
      case 'recovery_manage':
        wx.navigateTo({
          url: `/packageHealth/recovery-management/recovery-management?batchId=${this.data.currentBatchId}`
        })
        break
      case 'view_treatment':
        const data = e.currentTarget.dataset.data
        this.showDetailPopup(data)
        break
    }
  },

  /**
   * 分析操作事件
   */
  onAnalysisAction(e: any) {
    const { action } = e.currentTarget.dataset
    // 已移除调试日志
    switch (action) {
      case 'export_report':
        this.exportHealthReport()
        break
    }
  },

  /**
   * 关闭详情弹窗
   */
  onCloseDetail() {
    this.setData({
      showDetailPopup: false,
      selectedRecord: null
    })
  },

  /**
   * 详情弹窗显示状态变化
   */
  onHealthDetailPopupChange(e: any) {
    const { visible } = e.detail
    if (!visible) {
      this.setData({
        showDetailPopup: false,
        selectedRecord: null
      })
    }
  },

  /**
   * 显示详情弹窗
   */
  showDetailPopup(data: any) {
    this.setData({
      showDetailPopup: true,
      selectedRecord: data
    })
  },

  /**
   * 导出健康报告
   */
  exportHealthReport() {
    wx.showLoading({ title: '生成报告中...' })
    
    setTimeout(() => {
      wx.hideLoading()
      wx.showToast({
        title: '报告已生成',
        icon: 'success'
      })
    }, 2000)
  },

  /**
   * 分享页面
   */
  onShareAppMessage() {
    return {
      title: '养殖管理 - 健康监控',
      path: '/pages/health/health',
      imageUrl: '/assets/share-health.png'
    }
  },

  // ========== 批次筛选相关方法 ==========

  /**
   * 加载可用批次列表
   */
  async loadAvailableBatches() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'production-entry',
        data: {
          action: 'getActiveBatches'
        }
      })

      if (result.result && result.result.success) {
        const batches = result.result.data || []
        
        // 计算日龄
        const batchesWithDayAge = batches.map((batch: any) => {
          const entryDate = new Date(batch.entryDate)
          const today = new Date()
          const dayAge = Math.floor((today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
          
          return {
            ...batch,
            dayAge
          }
        })
        
        this.setData({
          availableBatches: batchesWithDayAge
        })
        
        // 设置当前批次号
        if (this.data.currentBatchId === 'all') {
          // 保持全部批次模式
          this.setData({
            currentBatchNumber: '全部批次'
          })
        } else if (this.data.currentBatchId) {
          // 查找当前批次
          const currentBatch = batchesWithDayAge.find((b: any) => b._id === this.data.currentBatchId)
          if (currentBatch) {
            this.setData({
              currentBatchNumber: currentBatch.batchNumber
            })
          }
        }
      }
    } catch (error: any) {
      // 加载批次列表失败，静默处理
    }
  },

  /**
   * 切换下拉菜单显示状态
   */
  toggleBatchDropdown() {
    this.setData({
      showBatchDropdown: !this.data.showBatchDropdown
    })
  },

  /**
   * 关闭下拉菜单
   */
  closeBatchDropdown() {
    this.setData({
      showBatchDropdown: false
    })
  },

  /**
   * 选择全部批次
   */
  selectAllBatches() {
    this.setData({
      currentBatchId: 'all',
      currentBatchNumber: '全部批次',
      showBatchDropdown: false
    })

    // 重新加载健康数据
    this.loadHealthData()
  },

  /**
   * 从下拉菜单选择批次（在详情视图下切换批次）
   */
  selectBatchFromDropdown(e: any) {
    const index = e.currentTarget.dataset.index
    const batches = this.data.availableBatches
    
    if (index >= 0 && index < batches.length) {
      const selectedBatch = batches[index]
      
      this.setData({
        currentBatchId: selectedBatch._id,
        currentBatchNumber: selectedBatch.batchNumber,
        showBatchDropdown: false
      })

      // 重新加载健康数据
      this.loadHealthData()
    }
  },

  /**
   * 点击治愈率卡片，跳转到治愈记录列表
   */
  navigateToCuredRecords() {
    wx.navigateTo({
      url: '/packageHealth/cured-records-list/cured-records-list'
    })
  },

  /**
   * 点击死亡率卡片，跳转到死亡记录列表
   */
  navigateToDeathRecords() {
    wx.navigateTo({
      url: '/packageHealth/death-records-list/death-records-list'
    })
  },

  /**
   * 点击死亡数卡片，跳转到死亡记录列表
   */
  onDeathCountTap() {
    wx.navigateTo({
      url: '/packageHealth/death-records-list/death-records-list'
    })
  },

  /**
   * 异常数量卡片点击 - 跳转到异常记录列表
   */
  onAbnormalCountTap() {
    wx.navigateTo({
      url: '/packageHealth/abnormal-records-list/abnormal-records-list'
    })
  },

  /**
   * 阻止触摸移动事件冒泡
   */
  preventTouchMove() {
    return false
  }
})
