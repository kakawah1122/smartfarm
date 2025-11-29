// miniprogram/packageHealth/vaccine-records-list/vaccine-records-list.ts
import { buildNotDeletedCondition } from '../utils/db-query'
import { safeCloudCall } from '../../utils/safe-cloud-call'

// 定义CustomEvent类型
type CustomEvent = WechatMiniprogram.CustomEvent

interface CloudCallResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

interface VaccineRecord {
  _id: string
  batchId: string
  batchNumber?: string
  preventionType: string
  preventionDate: string
  vaccineInfo: {
    name: string
    manufacturer?: string
    batchNumber?: string
    dosage?: string
    route?: string
    count?: number
  }
  veterinarianInfo?: {
    name: string
    contact?: string
  }
  costInfo?: {
    vaccineCost?: number
    laborCost?: number
    otherCost?: number
    totalCost?: number
  }
  effectiveness?: string
  notes?: string
  operator?: string
  operatorName?: string
  relatedTaskId?: string
  createdAt?: Date | string
  // 格式化字段
  formattedTotalCost?: string
  formattedVaccineCost?: string
  formattedLaborCost?: string
  formattedOtherCost?: string
  // 存栏和防疫用药
  currentStock?: number
  vaccinationRate?: string
}

// 页面数据类型
interface PageData {
  loading: boolean
  records: VaccineRecord[]
  recordsByBatch: Array<{
    batchNumber: string
    batchId: string
    records: VaccineRecord[]
  }>
  stats: {
    totalCount: number
    totalCost: number
    totalCoverage: number
  }
  showDetailDialog: boolean
  selectedRecord: VaccineRecord | null
  showCountInputDialog: boolean
  countInputType: 'abnormal' | 'death'
  countInputValue: string
}

// 页面自定义方法类型
interface PageCustom {
  _timerIds: number[]
  _safeSetTimeout: (callback: () => void, delay: number) => number
  _clearAllTimers: () => void
  [key: string]: unknown
}

Page<PageData, PageCustom>({
  // ✅ 定时器管理
  _timerIds: [] as number[],
  
  _safeSetTimeout(callback: () => void, delay: number): number {
    const timerId = setTimeout(() => {
      const index = this._timerIds.indexOf(timerId as unknown as number)
      if (index > -1) {
        this._timerIds.splice(index, 1)
      }
      callback()
    }, delay) as unknown as number
    this._timerIds.push(timerId)
    return timerId
  },
  
  _clearAllTimers() {
    this._timerIds.forEach((id: number) => clearTimeout(id))
    this._timerIds = []
  },

  data: {
    loading: true,
    records: [] as VaccineRecord[],
    recordsByBatch: [] as Array<{
      batchNumber: string
      batchId: string
      records: VaccineRecord[]
    }>,
    
    // 统计数据
    stats: {
      totalCount: 0,
      totalCost: 0,
      totalCoverage: 0
    },
    
    // 详情弹窗
    showDetailDialog: false,
    selectedRecord: null as VaccineRecord | null,
    
    // 数量输入对话框
    showCountInputDialog: false,
    countInputType: 'abnormal' as 'abnormal' | 'death',
    countInputValue: ''
  },

  onLoad() {
    this.loadVaccineRecords()
  },

  onUnload() {
    this._clearAllTimers()
  },

  onShow() {
    this.loadVaccineRecords()
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadVaccineRecords().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  /**
   * 加载疫苗记录列表
   */
  async loadVaccineRecords() {
    this.setData({ loading: true })

    try {
      const result = await safeCloudCall({
        name: 'health-prevention',
        data: {
          action: 'list_prevention_records',
          preventionType: 'vaccine',
          page: 1,
          pageSize: 100  // 获取更多记录
        }
      }) as CloudCallResult<{ list: VaccineRecord[], total: number }>

      if (result && result.success) {
        const preventionRecords = result.data?.list || []
        
        // 过滤出疫苗记录
        const vaccineRecords = preventionRecords.filter((record: VaccineRecord) => 
          record.preventionType === 'vaccine' || record.preventionType === 'vaccination'
        )
        
        // 计算统计数据
        let totalCount = vaccineRecords.length
        let totalCost = 0
        let totalCoverage = 0
        
        // 预处理数据，格式化成本字段并查询批次编号
        const records = await Promise.all(vaccineRecords.map(async (record: VaccineRecord) => {
          // 计算总成本
          const cost = record.costInfo?.totalCost || 0
          totalCost += typeof cost === 'string' ? parseFloat(cost) || 0 : cost
          
          // 计算覆盖数
          const count = record.vaccineInfo?.count || 0
          totalCoverage += typeof count === 'string' ? parseFloat(count) || 0 : count
          
          // 查询批次编号
          let batchNumber = record.batchNumber
          let currentStock = 0
          let vaccinationRate = '0%'
          
          if (record.batchId) {
            try {
              const db = wx.cloud.database()
              const _ = db.command
              
              // 先尝试作为文档ID查询批次信息
              try {
                const batchResult = await db.collection('prod_batch_entries')
                  .doc(record.batchId)
                  .field({ batchNumber: true, quantity: true })
                  .get()
                
                if (batchResult.data) {
                  if (batchResult.data.batchNumber) {
                    batchNumber = batchResult.data.batchNumber
                  }
                  
                  // 计算存栏数（基于疫苗接种日期）
                  const initialQuantity = batchResult.data.quantity || 0
                  const preventionDate = record.preventionDate || new Date().toISOString().split('T')[0]
                  
                  // 查询截至疫苗接种日期的死亡数
                  const deathRecords = await db.collection('health_death_records')
                    .where({
                      batchId: record.batchId,
                      deathDate: _.lte(preventionDate),
                      ...buildNotDeletedCondition(db, true)
                    })
                    .get()
                  
                  const totalDeathCount = deathRecords.data.reduce((sum: number, r: any) => {
                    return sum + (r.deathCount || r.deadCount || r.totalDeathCount || 0)
                  }, 0)
                  
                  // 查询截至疫苗接种日期的出栏数
                  const exitRecords = await db.collection('prod_batch_exits')
                    .where({
                      batchNumber: batchNumber,  // ✅ 修正：使用 batchNumber 而不是 batchId
                      exitDate: _.lte(preventionDate),
                      ...buildNotDeletedCondition(db, true)
                    })
                    .get()
                  
                  const totalExitCount = exitRecords.data.reduce((sum: number, r: any) => {
                    return sum + (r.quantity || r.exitQuantity || 0)
                  }, 0)
                  
                  // 当前存栏 = 入栏 - 死亡 - 出栏
                  currentStock = Math.max(0, initialQuantity - totalDeathCount - totalExitCount)
                  
                  // 计算防疫用药
                  const vaccineCount = typeof record.vaccineInfo?.count === 'string' 
                    ? parseFloat(record.vaccineInfo.count) || 0 
                    : (record.vaccineInfo?.count || 0)
                  
                  if (currentStock > 0 && vaccineCount > 0) {
                    const rate = (vaccineCount / currentStock) * 100
                    vaccinationRate = rate.toFixed(1) + '%'
                  } else {
                    vaccinationRate = '0%'
                  }
                }
              } catch (docError) {
                // 如果文档查询失败，尝试通过批次号查询
                try {
                  const batchQueryResult = await db.collection('prod_batch_entries')
                    .where({
                      batchNumber: record.batchId,
                      ...buildNotDeletedCondition(db, true)
                    })
                    .field({ batchNumber: true, quantity: true })
                    .limit(1)
                    .get()
                  
                  if (batchQueryResult.data && batchQueryResult.data.length > 0) {
                    const batchData = batchQueryResult.data[0]
                    batchNumber = batchData.batchNumber
                    
                    // 计算存栏数（基于疫苗接种日期）
                    const initialQuantity = batchData.quantity || 0
                    const preventionDate = record.preventionDate || new Date().toISOString().split('T')[0]
                    
                    // 查询截至疫苗接种日期的死亡数
                    const deathRecords = await db.collection('health_death_records')
                      .where({
                        batchId: batchData._id,
                        deathDate: _.lte(preventionDate),
                        ...buildNotDeletedCondition(db, true)
                      })
                      .get()
                    
                    const totalDeathCount = deathRecords.data.reduce((sum: number, r: any) => {
                      return sum + (r.deathCount || r.deadCount || r.totalDeathCount || 0)
                    }, 0)
                    
                    // 查询截至疫苗接种日期的出栏数
                    const exitRecords = await db.collection('prod_batch_exits')
                      .where({
                        batchNumber: batchData.batchNumber,  // ✅ 修正：使用 batchNumber 而不是 batchId
                        exitDate: _.lte(preventionDate),
                        ...buildNotDeletedCondition(db, true)
                      })
                      .get()
                    
                    const totalExitCount = exitRecords.data.reduce((sum: number, r: any) => {
                      return sum + (r.quantity || r.exitQuantity || 0)
                    }, 0)
                    
                    // 当前存栏 = 入栏 - 死亡 - 出栏
                    currentStock = Math.max(0, initialQuantity - totalDeathCount - totalExitCount)
                    
                    // 计算防疫用药
                    const vaccineCount = typeof record.vaccineInfo?.count === 'string' 
                      ? parseFloat(record.vaccineInfo.count) || 0 
                      : (record.vaccineInfo?.count || 0)
                    
                    if (currentStock > 0 && vaccineCount > 0) {
                      const rate = (vaccineCount / currentStock) * 100
                      vaccinationRate = rate.toFixed(1) + '%'
                    } else {
                      vaccinationRate = '0%'
                    }
                  }
                } catch (queryError) {
                  // 查询失败，使用默认值
                  batchNumber = record.batchId
                }
              }
            } catch (batchError) {
              // 查询失败，使用batchId作为fallback
              batchNumber = record.batchId || ''
            }
          }
          
          return {
            ...record,
            batchNumber: batchNumber || record.batchId, // 使用查询到的批次编号，如果没有则使用batchId
            currentStock,
            vaccinationRate,
            formattedTotalCost: cost.toFixed(2),
            formattedVaccineCost: (record.costInfo?.vaccineCost || 0).toFixed(2),
            formattedLaborCost: (record.costInfo?.laborCost || 0).toFixed(2),
            formattedOtherCost: (record.costInfo?.otherCost || 0).toFixed(2)
          }
        }))
        
        // 按批次分组
        const batchMap = new Map<string, VaccineRecord[]>()
        records.forEach((record: VaccineRecord) => {
          const batchKey = record.batchNumber || record.batchId || '未知批次'
          if (!batchMap.has(batchKey)) {
            batchMap.set(batchKey, [])
          }
          batchMap.get(batchKey)!.push(record)
        })
        
        // 转换为数组格式，按批次编号排序
        const recordsByBatch = Array.from(batchMap.entries())
          .map(([batchNumber, records]) => ({
            batchNumber,
            batchId: records[0]?.batchId || batchNumber,
            records: records.sort((a, b) => {
              // 按接种日期倒序排列
              const dateA = new Date(a.preventionDate).getTime()
              const dateB = new Date(b.preventionDate).getTime()
              return dateB - dateA
            })
          }))
          .sort((a, b) => {
            // 按批次编号排序
            return a.batchNumber.localeCompare(b.batchNumber)
          })
        
        this.setData({
          records,
          recordsByBatch,
          stats: {
            totalCount,
            totalCost: parseFloat(totalCost.toFixed(2)),
            totalCoverage
          },
          loading: false
        })
      } else {
        throw new Error(result?.error || '加载失败')
      }
    } catch (error) {
      const errMsg = (error as Error)?.message || '加载失败'
      wx.showToast({
        title: errMsg,
        icon: 'none'
      })
      this.setData({ loading: false })
    }
  },

  /**
   * 点击记录卡片，显示详情弹窗
   */
  onRecordTap(e: CustomEvent) {
    const { id } = e.currentTarget.dataset
    // 从所有记录中查找
    let record = this.data.records.find(r => r._id === id)
    if (!record) {
      // 如果没找到，从分组记录中查找
      for (const batchGroup of this.data.recordsByBatch) {
        record = batchGroup.records.find(r => r._id === id)
        if (record) break
      }
    }
    if (record) {
      this.setData({
        selectedRecord: record,
        showDetailDialog: true
      })
    }
  },

  /**
   * 关闭详情弹窗
   */
  closeDetailDialog() {
    this.setData({
      showDetailDialog: false
    })
  },

  /**
   * 疫苗追踪 - 异常用药（跳转到诊疗管理用药表单）
   */
  onTrackAbnormal() {
    const { selectedRecord } = this.data
    if (!selectedRecord) return
    
    // 显示数量输入对话框
    this.setData({
      showCountInputDialog: true,
      countInputType: 'abnormal',
      countInputValue: ''
    })
  },

  /**
   * 疫苗追踪 - 记录死亡（跳转到诊疗管理记录死亡）
   */
  onTrackDeath() {
    const { selectedRecord } = this.data
    if (!selectedRecord) return
    
    // 显示数量输入对话框
    this.setData({
      showCountInputDialog: true,
      countInputType: 'death',
      countInputValue: ''
    })
  },

  /**
   * 数量输入处理
   */
  onCountInput(e: CustomEvent) {
    const value = e.detail.value
    this.setData({
      countInputValue: value
    })
  },

  /**
   * 取消数量输入
   */
  onCancelCountInput() {
    this.setData({
      showCountInputDialog: false,
      countInputValue: ''
    })
  },

  /**
   * 确认数量输入并跳转
   */
  async onConfirmCountInput() {
    const { selectedRecord, countInputType, countInputValue } = this.data
    if (!selectedRecord) return
    
    // 验证数量
    const count = parseInt(countInputValue)
    if (!count || count <= 0) {
      wx.showToast({
        title: '请输入有效的数量',
        icon: 'none'
      })
      return
    }
    
    // 验证数量不超过接种数量
    const vaccinatedCount = selectedRecord.vaccineInfo?.count || 0
    const vaccinatedCountNum = typeof vaccinatedCount === 'string' ? parseFloat(vaccinatedCount) || 0 : vaccinatedCount
    if (vaccinatedCountNum > 0 && count > vaccinatedCountNum) {
      wx.showToast({
        title: `数量不能超过接种数量（${vaccinatedCountNum}只）`,
        icon: 'none'
      })
      return
    }
    
    // 关闭对话框和详情弹窗
    this.setData({
      showCountInputDialog: false,
      showDetailDialog: false,
      countInputValue: ''
    })
    
    if (countInputType === 'abnormal') {
      // 异常用药：创建治疗记录
      await this.createTreatmentRecord(selectedRecord, count)
    } else {
      // 记录死亡：创建死亡记录
      await this.createDeathRecord(selectedRecord, count)
    }
  },

  /**
   * 创建治疗记录（异常用药追踪）
   */
  async createTreatmentRecord(vaccineRecord: VaccineRecord, affectedCount: number) {
    try {
      wx.showLoading({ title: '创建治疗记录...' })

      // 调用云函数创建治疗记录
      const result = await safeCloudCall({
        name: 'health-treatment',
        data: {
          action: 'create_treatment_from_vaccine',
          vaccineRecordId: vaccineRecord._id,
          batchId: vaccineRecord.batchId,
          batchNumber: vaccineRecord.batchNumber || vaccineRecord.batchId,  // ✅ 传递批次编号
          affectedCount,
          diagnosis: '疫苗接种后异常反应',
          vaccineName: vaccineRecord.vaccineInfo?.name || '',
          preventionDate: vaccineRecord.preventionDate
        }
      }) as CloudCallResult<{ treatmentId?: string }>

      wx.hideLoading()

      if (result && result.success) {
        
        wx.showToast({
          title: '治疗记录已创建',
          icon: 'success',
          duration: 2000
        })

        // 延迟跳转到健康管理中心，让用户看到成功提示
        this._safeSetTimeout(() => {
          wx.switchTab({
            url: '/pages/health/health',
            success: () => {
              // 通知健康页面切换到"治疗管理"标签
              const pages = getCurrentPages()
              const healthPage = pages.find((page) => (page as { route?: string }).route === 'pages/health/health')
              if (healthPage) {
                healthPage.setData({
                  activeCategory: 'treatment'
                })
              }
            }
          })
        }, 2000)
      } else {
        throw new Error(result?.error || result?.message || '创建失败')
      }
    } catch (error) {
      wx.hideLoading()
      wx.showModal({
        title: '创建失败',
        content: (error as Error)?.message || '创建治疗记录失败，请重试',
        showCancel: false
      })
    }
  },

  /**
   * 创建死亡记录（疫苗追踪）
   */
  async createDeathRecord(vaccineRecord: VaccineRecord, deathCount: number) {
    try {
      wx.showLoading({ title: '创建死亡记录...' })

      // 调用云函数创建死亡记录
      const result = await safeCloudCall({
        name: 'health-death',
        data: {
          action: 'create_death_from_vaccine',
          vaccineRecordId: vaccineRecord._id,
          batchId: vaccineRecord.batchId,
          batchNumber: vaccineRecord.batchNumber || vaccineRecord.batchId,
          deathCount,
          deathCause: '疫苗接种后死亡',
          vaccineName: vaccineRecord.vaccineInfo?.name || '',
          preventionDate: vaccineRecord.preventionDate
        }
      }) as CloudCallResult

      wx.hideLoading()

      if (result && result.success) {
        wx.showToast({
          title: '死亡记录已创建',
          icon: 'success',
          duration: 2000
        })

        // 延迟跳转到健康管理中心
        this._safeSetTimeout(() => {
          wx.switchTab({
            url: '/pages/health/health',
            success: () => {
              // 通知健康页面切换到"治疗管理"标签（查看死亡统计）
              const pages = getCurrentPages()
              const healthPage = pages.find((page) => (page as { route?: string }).route === 'pages/health/health')
              if (healthPage) {
                healthPage.setData({
                  activeCategory: 'treatment'
                })
              }
            }
          })
        }, 2000)
      } else {
        throw new Error(result?.error || result?.message || '创建失败')
      }
    } catch (error) {
      wx.hideLoading()
      wx.showModal({
        title: '创建失败',
        content: (error as Error)?.message || '创建死亡记录失败，请重试',
        showCancel: false
      })
    }
  },

  /**
   * 阻止遮罩层滚动穿透
   */
  preventTouchMove() {
    return false
  },

  /**
   * 返回
   */
  goBack() {
    // 优先使用 navigateBack，如果失败则跳转到健康页面
    wx.navigateBack({
      delta: 1,
      fail: () => {
        // 如果返回失败（比如是通过分享进入的），则跳转到健康页面
        wx.switchTab({
          url: '/pages/health/health'
        })
      }
    })
  }
})

