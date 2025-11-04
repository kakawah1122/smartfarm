// miniprogram/packageHealth/medication-records-list/medication-records-list.ts
import { buildNotDeletedCondition } from '../utils/db-query'

interface MedicationRecord {
  _id: string
  batchId: string
  batchNumber?: string
  preventionType: string
  preventionDate: string
  medicationInfo?: {
    name?: string
    dosage?: string
    method?: string
    duration?: number
  }
  costInfo?: {
    totalCost?: number
  }
  effectiveness?: string
  notes?: string
  operator?: string
  operatorName?: string
  createdAt?: any
  // 格式化字段
  formattedTotalCost?: string
  preventionTypeName?: string
}

// 预防类型映射
const PREVENTION_TYPE_MAP: { [key: string]: string } = {
  'medication': '防疫用药'
}

Page({
  data: {
    loading: true,
    records: [] as MedicationRecord[],
    recordsByBatch: [] as Array<{
      batchNumber: string
      batchId: string
      records: MedicationRecord[]
    }>,
    
    // 统计数据
    stats: {
      totalCount: 0,
      totalCost: 0
    },
    
    // 详情弹窗
    showDetailDialog: false,
    selectedRecord: null as MedicationRecord | null,
    
    // 效果评估表单
    showEvaluationDialog: false,
    effectivenessOptions: [
      { value: 'excellent', label: '优秀' },
      { value: 'good', label: '良好' },
      { value: 'fair', label: '一般' },
      { value: 'poor', label: '较差' }
    ],
    evaluationFormData: {
      effectivenessIndex: 1, // 默认选择"良好"
      note: ''
    }
  },

  onLoad() {
    this.loadMedicationRecords()
  },

  onShow() {
    this.loadMedicationRecords()
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadMedicationRecords().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  /**
   * 加载用药记录列表
   */
  async loadMedicationRecords() {
    this.setData({ loading: true })

    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'list_prevention_records',
          page: 1,
          pageSize: 100
        }
      })

      if (result.result && result.result.success) {
        const preventionRecords = result.result.data?.records || []
        
        // 过滤出用药类型的记录
        const medicationRecords = preventionRecords.filter((record: MedicationRecord) => 
          record.preventionType === 'medication'
        )
        
        // 计算统计数据
        let totalCount = medicationRecords.length
        let totalCost = 0
        
        // 预处理数据
        const records = await Promise.all(medicationRecords.map(async (record: MedicationRecord) => {
          // 计算总成本
          const cost = record.costInfo?.totalCost || 0
          totalCost += typeof cost === 'string' ? parseFloat(cost) || 0 : cost
          
          // 查询批次编号
          let batchNumber = record.batchNumber
          if (record.batchId && !batchNumber) {
            try {
              const db = wx.cloud.database()
              const batchResult = await db.collection('prod_batch_entries')
                .doc(record.batchId)
                .field({ batchNumber: true })
                .get()
              
              if (batchResult.data?.batchNumber) {
                batchNumber = batchResult.data.batchNumber
              }
            } catch (error) {
              batchNumber = record.batchId
            }
          }
          
          return {
            ...record,
            batchNumber: batchNumber || record.batchId,
            formattedTotalCost: cost.toFixed(2),
            preventionTypeName: PREVENTION_TYPE_MAP[record.preventionType] || record.preventionType,
            effectiveness: record.effectiveness || 'pending' // 确保有默认值
          }
        }))
        
        // 按批次分组
        const batchMap = new Map<string, MedicationRecord[]>()
        records.forEach(record => {
          const batchKey = record.batchNumber || record.batchId || '未知批次'
          if (!batchMap.has(batchKey)) {
            batchMap.set(batchKey, [])
          }
          batchMap.get(batchKey)!.push(record)
        })
        
        // 转换为数组格式
        const recordsByBatch = Array.from(batchMap.entries())
          .map(([batchNumber, records]) => ({
            batchNumber,
            batchId: records[0]?.batchId || batchNumber,
            records: records.sort((a, b) => {
              const dateA = new Date(a.preventionDate).getTime()
              const dateB = new Date(b.preventionDate).getTime()
              return dateB - dateA
            })
          }))
          .sort((a, b) => a.batchNumber.localeCompare(b.batchNumber))
        
        this.setData({
          records,
          recordsByBatch,
          stats: {
            totalCount,
            totalCost: parseFloat(totalCost.toFixed(2))
          },
          loading: false
        })
      } else {
        throw new Error(result.result?.error || '加载失败')
      }
    } catch (error: any) {
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      })
      this.setData({ loading: false })
    }
  },

  /**
   * 点击记录卡片，显示详情弹窗
   */
  onRecordTap(e: any) {
    const { id } = e.currentTarget.dataset
    const record = this.data.records.find(r => r._id === id)
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
   * 阻止遮罩层滚动穿透
   */
  preventTouchMove() {
    return false
  },

  /**
   * 返回
   */
  goBack() {
    wx.navigateBack({
      delta: 1
    })
  },

  /**
   * 显示效果评估表单
   */
  showEvaluationForm() {
    this.setData({
      showEvaluationDialog: true,
      evaluationFormData: {
        effectivenessIndex: 1,
        note: ''
      }
    })
  },

  /**
   * 关闭效果评估表单
   */
  closeEvaluationForm() {
    this.setData({
      showEvaluationDialog: false
    })
  },

  /**
   * 选择评估结果
   */
  onEffectivenessChange(e: any) {
    this.setData({
      'evaluationFormData.effectivenessIndex': e.detail.value
    })
  },

  /**
   * 输入评估说明
   */
  onEvaluationNoteInput(e: any) {
    this.setData({
      'evaluationFormData.note': e.detail.value
    })
  },

  /**
   * 提交效果评估
   */
  async submitEvaluation() {
    const { selectedRecord, evaluationFormData, effectivenessOptions } = this.data

    if (!selectedRecord) {
      wx.showToast({
        title: '记录信息丢失',
        icon: 'none'
      })
      return
    }

    const effectiveness = effectivenessOptions[evaluationFormData.effectivenessIndex].value

    try {
      wx.showLoading({ title: '提交中...' })

      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'update_prevention_effectiveness',
          recordId: selectedRecord._id,
          effectiveness: effectiveness,
          effectivenessNote: evaluationFormData.note,
          evaluationDate: new Date().toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          })
        }
      })

      wx.hideLoading()

      if (result.result && result.result.success) {
        wx.showToast({
          title: '评估提交成功',
          icon: 'success'
        })

        // 关闭评估表单
        this.closeEvaluationForm()
        // 关闭详情弹窗
        this.closeDetailDialog()
        // 重新加载记录列表
        this.loadMedicationRecords()
      } else {
        throw new Error(result.result?.message || '提交失败')
      }
    } catch (error: any) {
      wx.hideLoading()
      wx.showToast({
        title: error.message || '提交失败，请重试',
        icon: 'none'
      })
    }
  }
})

