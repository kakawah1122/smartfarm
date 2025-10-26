// miniprogram/packageHealth/abnormal-record-detail/abnormal-record-detail.ts

interface AbnormalRecord {
  _id: string
  batchId: string
  batchNumber: string
  checkDate: string
  affectedCount: number
  symptoms: string
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
  createdAt: string
  isCorrected?: boolean
  correctedDiagnosis?: string
  correctionReason?: string
  aiAccuracyRating?: number
  correctedBy?: string
  correctedByName?: string
  correctedAt?: string
}

Page({
  data: {
    loading: true,
    recordId: '',
    record: null as AbnormalRecord | null,
    
    // 修正弹窗
    showCorrectionDialog: false,
    originalDiagnosis: '',
    correctionForm: {
      correctedDiagnosis: '',
      veterinarianDiagnosis: '',
      aiAccuracyRating: 0
    },
    
    // 治疗方案选择弹窗
    showTreatmentDialog: false,
    selectedTreatmentType: 'medication' as 'medication' | 'isolation',
    
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
        console.log('📄 加载异常记录详情:', record._id)

        // 预处理 aiRecommendation
        let aiRecommendation = record.aiRecommendation
        if (typeof aiRecommendation === 'string') {
          try {
            aiRecommendation = JSON.parse(aiRecommendation)
          } catch (e) {
            console.error('解析AI建议失败:', e)
          }
        }

        this.setData({
          record: { ...record, aiRecommendation },
          loading: false
        })
      } else {
        throw new Error(result.result?.error || '加载失败')
      }
    } catch (error: any) {
      console.error('加载记录详情失败:', error)
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
          duration: 2000
        })
        
        this.setData({ showCorrectionDialog: false })
        
        // 刷新详情
        setTimeout(() => {
          this.loadRecordDetail(this.data.recordId)
        }, 1000)
      } else {
        throw new Error(result.result?.error || '提交失败')
      }
    } catch (error: any) {
      wx.hideLoading()
      console.error('提交修正失败:', error)
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
   * 显示治疗方案选择弹窗
   */
  showTreatmentPlanDialog() {
    this.setData({ showTreatmentDialog: true })
  },

  /**
   * 取消治疗方案选择
   */
  cancelTreatmentPlan() {
    this.setData({ showTreatmentDialog: false })
  },

  /**
   * 选择治疗方式
   */
  selectTreatmentType(e: any) {
    const { type } = e.currentTarget.dataset
    this.setData({ selectedTreatmentType: type })
  },

  /**
   * 确认治疗方案
   */
  async confirmTreatmentPlan() {
    const { selectedTreatmentType, record } = this.data
    
    if (!record) return

    this.setData({ showTreatmentDialog: false })

    try {
      wx.showLoading({ title: '创建中...' })

      if (selectedTreatmentType === 'medication') {
        // 创建药物治疗记录
        const result = await wx.cloud.callFunction({
          name: 'health-management',
          data: {
            action: 'create_treatment_from_abnormal',
            abnormalRecordId: record._id,
            batchId: record.batchId,
            diagnosis: record.diagnosis,
            aiRecommendation: record.aiRecommendation
          }
        })

        wx.hideLoading()

        if (result.result && result.result.success) {
          wx.showToast({ title: '创建成功', icon: 'success' })
          setTimeout(() => {
            wx.navigateTo({
              url: `/packageHealth/treatment-record/treatment-record?id=${result.result.data.treatmentId}`
            })
          }, 1000)
        } else {
          throw new Error(result.result?.error || '创建失败')
        }
      } else {
        // 创建隔离记录
        const result = await wx.cloud.callFunction({
          name: 'health-management',
          data: {
            action: 'create_isolation_from_abnormal',
            abnormalRecordId: record._id,
            batchId: record.batchId,
            diagnosis: record.diagnosis
          }
        })

        wx.hideLoading()

        if (result.result && result.result.success) {
          wx.showToast({ title: '创建成功', icon: 'success' })
          setTimeout(() => {
            wx.navigateTo({
              url: `/packageHealth/isolation-record/isolation-record?id=${result.result.data.isolationId}`
            })
          }, 1000)
        } else {
          throw new Error(result.result?.error || '创建失败')
        }
      }
    } catch (error: any) {
      wx.hideLoading()
      console.error('创建治疗方案失败:', error)
      wx.showToast({
        title: error.message || '创建失败',
        icon: 'none'
      })
    }
  }
})
