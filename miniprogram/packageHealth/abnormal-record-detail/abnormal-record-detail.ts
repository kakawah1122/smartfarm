import { logger } from '../../utils/logger'
// miniprogram/packageHealth/abnormal-record-detail/abnormal-record-detail.ts

interface AbnormalRecord {
  _id: string
  batchId: string
  batchNumber: string
  checkDate: string
  affectedCount: number
  symptoms: string
  diagnosisType?: 'live_diagnosis' | 'autopsy_analysis'
  diagnosis: string
  diagnosisConfidence: number
  diagnosisDetails?: {
    disease: string
    confidence: number
    reasoning?: string
    pathogen?: string
    transmission?: string
    symptoms?: string[]
  }
  severity: string
  urgency: string
  status: string
  aiRecommendation: any
  images: string[]
  diagnosisId: string
  autopsyDescription?: string
  deathCount?: number
  totalDeathCount?: number
  createdAt: string
  isCorrected?: boolean
  correctedDiagnosis?: string
  correctionReason?: string
  aiAccuracyRating?: number
  correctedBy?: string
  correctedByName?: string
  correctedAt?: string
}

type ConfirmDeathOptions = {
  returnBehavior?: 'detail' | 'back'
}

Page({
  data: {
    loading: true,
    recordId: '',
    record: null as AbnormalRecord | null,
    isAutopsyRecord: false,
    
    // 修正弹窗
    showCorrectionDialog: false,
    originalDiagnosis: '',
    correctionForm: {
      correctedDiagnosis: '',
      veterinarianDiagnosis: '',
      aiAccuracyRating: 0
    },
    
    // 评分提示
    ratingHints: ['很不准确', '不太准确', '基本准确', '比较准确', '非常准确']
  },

  onLoad(options: any) {
    if (options.id) {
      this.setData({ recordId: options.id })
      this.loadRecordDetail(options.id)
    } else {
      wx.showToast({ title: '记录ID缺失', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
    }
  },

  /**
   * 加载记录详情
   */
  async loadRecordDetail(recordId: string) {
    this.setData({ loading: true })

    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_abnormal_record_detail',
          recordId: recordId
        }
      })

      if (result.result && result.result.success) {
        const record = result.result.data

        // 预处理 aiRecommendation
        let aiRecommendation = record.aiRecommendation
        if (typeof aiRecommendation === 'string') {
          try {
            aiRecommendation = JSON.parse(aiRecommendation)
          } catch (e) {
            // AI建议解析失败，使用原始文本
          }
        }

        // 转换图片为临时URL
        let processedImages = record.images || []
        
        // ✅ 首先过滤掉原始数据中的无效值
        processedImages = processedImages.filter((url: any) => url && typeof url === 'string')
        
        if (processedImages.length > 0) {
          try {
            const tempUrlResult = await wx.cloud.getTempFileURL({
              fileList: processedImages
            })
            
            if (tempUrlResult.fileList && tempUrlResult.fileList.length > 0) {
              processedImages = tempUrlResult.fileList
                .map((item: any) => item.tempFileURL || item.fileID)
                .filter((url: any) => url && typeof url === 'string') // 过滤掉无效的URL
            }
          } catch (urlError) {
            // 图片URL转换失败，静默处理
            // 继续使用已过滤的原始图片URL（不影响显示）
            logger.warn('图片URL转换失败，使用原始URL:', urlError)
          }
        }

        const derivedDiagnosisType = record.diagnosisType
          || (record.autopsyDescription || record.totalDeathCount || record.deathCount ? 'autopsy_analysis' : 'live_diagnosis')

        this.setData({
          record: { ...record, aiRecommendation, images: processedImages, diagnosisType: derivedDiagnosisType },
          isAutopsyRecord: derivedDiagnosisType === 'autopsy_analysis',
          loading: false
        })
      } else {
        throw new Error(result.result?.error || '加载失败')
      }
    } catch (error: any) {
      // 加载失败，已显示错误提示
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      })
      setTimeout(() => wx.navigateBack(), 1500)
    }
  },

  /**
   * 阻止事件冒泡
   */
  preventMove() {
    // 空方法，用于阻止事件冒泡
  },

  /**
   * 预览图片
   */
  previewImage(e: any) {
    const { url } = e.currentTarget.dataset
    const images = this.data.record?.images || []
    wx.previewImage({
      current: url,
      urls: images
    })
  },

  /**
   * 修正诊断结果 - 显示修正弹窗
   */
  correctDiagnosis() {
    if (!this.data.record) return
    
    const currentDiagnosis = this.data.record.diagnosis || '待诊断'
    
    // 如果已经修正过，预填充原来的修正数据
    if (this.data.record.isCorrected) {
      this.setData({
        showCorrectionDialog: true,
        originalDiagnosis: currentDiagnosis,
        correctionForm: {
          correctedDiagnosis: this.data.record.correctedDiagnosis || '',
          veterinarianDiagnosis: this.data.record.correctionReason || '',
          aiAccuracyRating: this.data.record.aiAccuracyRating || 3
        }
      })
    } else {
      // 首次修正，表单为空
      this.setData({
        showCorrectionDialog: true,
        originalDiagnosis: currentDiagnosis,
        correctionForm: {
          correctedDiagnosis: '',
          veterinarianDiagnosis: '',
          aiAccuracyRating: 3
        }
      })
    }
  },

  /**
   * 取消修正
   */
  onCancelCorrection() {
    this.setData({ showCorrectionDialog: false })
  },

  /**
   * 提交修正
   */
  async onSubmitCorrection() {
    const form = this.data.correctionForm

    // 验证表单
    if (!form.correctedDiagnosis) {
      wx.showToast({ title: '请输入修正后的诊断', icon: 'none' })
      return
    }
    if (!form.veterinarianDiagnosis) {
      wx.showToast({ title: '请输入兽医诊断依据', icon: 'none' })
      return
    }
    if (form.aiAccuracyRating === 0) {
      wx.showToast({ title: '请对AI准确性进行评分', icon: 'none' })
      return
    }

    try {
      wx.showLoading({ title: '提交中...' })

      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'correct_abnormal_diagnosis',
          recordId: this.data.record!._id,
          correctedDiagnosis: form.correctedDiagnosis,
          veterinarianDiagnosis: form.veterinarianDiagnosis,
          aiAccuracyRating: form.aiAccuracyRating
        }
      })

      wx.hideLoading()

      if (result.result && result.result.success) {
        wx.showToast({
          title: '修正成功',
          icon: 'success',
          duration: 1500
        })
        
        this.setData({ showCorrectionDialog: false })
        
        if (this.data.isAutopsyRecord) {
          setTimeout(() => {
            this.confirmDeath({ returnBehavior: 'back' })
          }, 800)
        } else {
          // 刷新详情
          setTimeout(() => {
            this.loadRecordDetail(this.data.recordId)
          }, 1000)
        }
      } else {
        throw new Error(result.result?.error || '提交失败')
      }
    } catch (error: any) {
      wx.hideLoading()
      // 提交失败，已显示错误提示
      wx.showToast({
        title: error.message || '提交失败',
        icon: 'none'
      })
    }
  },

  /**
   * 表单输入处理
   */
  onCorrectedDiagnosisChange(e: any) {
    this.setData({
      'correctionForm.correctedDiagnosis': e.detail.value
    })
  },

  onVeterinarianDiagnosisChange(e: any) {
    this.setData({
      'correctionForm.veterinarianDiagnosis': e.detail.value
    })
  },

  onRatingChange(e: any) {
    const rating = e.currentTarget.dataset.rating
    this.setData({
      'correctionForm.aiAccuracyRating': rating
    })
  },

  /**
   * 创建治疗方案 - 直接跳转到治疗记录页面
   */
  createTreatmentPlan() {
    const { record } = this.data
    
    if (!record) return
    if (this.data.isAutopsyRecord) {
      wx.showToast({ title: '死因剖析记录无需制定治疗方案', icon: 'none' })
      return
    }

    // 优先使用修正后的诊断，否则使用AI诊断
    const finalDiagnosis = record.isCorrected && record.correctedDiagnosis 
      ? record.correctedDiagnosis 
      : record.diagnosis

    // 直接跳转到治疗记录页面，传递异常记录信息
    wx.navigateTo({
      url: `/packageHealth/treatment-record/treatment-record?abnormalRecordId=${record._id}&batchId=${record.batchId}&diagnosis=${encodeURIComponent(finalDiagnosis)}`
    })
  },

  /**
   * 死因剖析：确认死亡并归档
   */
  async confirmDeath(options?: ConfirmDeathOptions) {
    const { record, isAutopsyRecord } = this.data

    const returnBehavior = options?.returnBehavior || 'detail'

    if (!record) return

    if (!isAutopsyRecord) {
      // 病鹅诊断不支持直接归档
      wx.showToast({ title: '请通过治疗流程处理该记录', icon: 'none' })
      return
    }

    const deathCount = record.totalDeathCount || record.deathCount || record.affectedCount || 0

    if (deathCount <= 0) {
      wx.showToast({ title: '请先在诊断中填写死亡数量', icon: 'none' })
      return
    }

    wx.showLoading({ title: '归档中...' })

    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'create_death_record_with_finance',
          diagnosisId: record.diagnosisId,
          batchId: record.batchId,
          deathCount,
          deathCause: record.diagnosis || '待确定',
          deathCategory: 'disease',
          autopsyFindings: record.autopsyDescription || record.symptoms || '',
          diagnosisResult: record.diagnosisDetails || null,
          images: record.images || []
        }
      })

      wx.hideLoading()

      if (result.result && result.result.success) {
        const deathRecordId = result.result.data?.deathRecordId

        wx.showToast({
          title: '已归档至死亡记录',
          icon: 'success',
          duration: 1500
        })

        setTimeout(() => {
          if (returnBehavior === 'back') {
            const pages = getCurrentPages()
            if (pages.length > 1) {
              wx.navigateBack({
                delta: 1,
                fail: () => {
                  wx.redirectTo({
                    url: '/packageHealth/death-records-list/death-records-list',
                    fail: () => {
                      wx.switchTab({ url: '/pages/index/index' })
                    }
                  })
                }
              })
            } else {
              wx.redirectTo({
                url: '/packageHealth/death-records-list/death-records-list',
                fail: () => {
                  wx.switchTab({ url: '/pages/index/index' })
                }
              })
            }
          } else if (deathRecordId) {
            wx.redirectTo({
              url: `/packageHealth/death-records-list/death-records-list?recordId=${encodeURIComponent(deathRecordId)}`
            })
          } else {
            wx.redirectTo({
              url: '/packageHealth/death-records-list/death-records-list'
            })
          }
        }, 1500)
      } else {
        throw new Error(result.result?.error || result.result?.message || '归档失败')
      }
    } catch (error: any) {
      wx.hideLoading()
      console.error('确认死亡归档失败:', error)
      wx.showToast({
        title: error.message || '归档失败，请重试',
        icon: 'none'
      })
    }
  }
})
