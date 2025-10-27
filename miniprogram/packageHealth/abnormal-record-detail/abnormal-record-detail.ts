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
      veterinarianTreatmentPlan: '',
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

        // 转换图片为临时URL
        let processedImages = record.images || []
        if (processedImages.length > 0) {
          try {
            const tempUrlResult = await wx.cloud.getTempFileURL({
              fileList: processedImages
            })
            
            if (tempUrlResult.fileList && tempUrlResult.fileList.length > 0) {
              processedImages = tempUrlResult.fileList.map((item: any) => 
                item.tempFileURL || item.fileID
              )
              console.log('✅ 图片URL转换成功，共', processedImages.length, '张')
            }
          } catch (urlError) {
            console.error('图片URL转换失败:', urlError)
            // 转换失败也不影响其他数据显示
          }
        }

        this.setData({
          record: { ...record, aiRecommendation, images: processedImages },
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
          veterinarianTreatmentPlan: this.data.record.veterinarianTreatmentPlan || '',
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
          veterinarianTreatmentPlan: '',
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
          veterinarianTreatmentPlan: form.veterinarianTreatmentPlan,
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

  onVeterinarianTreatmentPlanChange(e: any) {
    this.setData({
      'correctionForm.veterinarianTreatmentPlan': e.detail.value
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

    // 优先使用修正后的诊断，否则使用AI诊断
    const finalDiagnosis = record.isCorrected && record.correctedDiagnosis 
      ? record.correctedDiagnosis 
      : record.diagnosis

    // 直接跳转到治疗记录页面，传递异常记录信息（传递批次编号而非ID）
    wx.navigateTo({
      url: `/packageHealth/treatment-record/treatment-record?abnormalRecordId=${record._id}&batchNumber=${record.batchNumber}&diagnosis=${encodeURIComponent(finalDiagnosis)}`
    })
  }
})
