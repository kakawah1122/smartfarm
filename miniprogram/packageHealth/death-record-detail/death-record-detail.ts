// miniprogram/packageHealth/death-record-detail/death-record-detail.ts

interface DeathRecord {
  _id: string
  batchId: string
  batchNumber: string
  deathDate: string
  deathCount: number
  deathCause: string
  financeLoss: number
  unitCost: number
  source?: string  // ✅ 来源标识：'treatment' 治疗记录 | 'ai_diagnosis' AI死因剖析
  aiDiagnosisId: string
  diagnosisResult: any
  autopsyImages?: string[]
  autopsyFindings?: {
    abnormalities: string[]
    description: string
  }
  isCorrected: boolean
  correctedCause?: string
  correctionReason?: string
  correctionType?: string
  aiAccuracyRating?: number
  veterinarianNote?: string
  correctedBy?: string
  correctedByName?: string
  correctedAt?: string
}

Page({
  data: {
    loading: true,
    recordId: '',
    record: {} as DeathRecord,
    diagnosisResult: {} as any,
    
    // 修正弹窗
    showCorrectionDialog: false,
    originalCause: '', // 原死因，用于占位符
    correctionForm: {
      correctedCause: '',
      veterinarianDiagnosis: '', // 兽医诊断（必填）
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
          action: 'get_death_record_detail',
          recordId: recordId
        }
      })

      if (result.result && result.result.success) {
        const record = result.result.data
        
        // 解析诊断结果
        let diagnosisResult = record.diagnosisResult
        if (typeof diagnosisResult === 'string') {
          try {
            diagnosisResult = JSON.parse(diagnosisResult)
          } catch (e) {
            console.error('解析诊断结果失败:', e)
            diagnosisResult = {}
          }
        }

        this.setData({
          record: record,
          diagnosisResult: diagnosisResult || {},
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
      this.setData({ loading: false })
    }
  },

  /**
   * 预览剖检图片
   */
  onPreviewImage(e: any) {
    const { index } = e.currentTarget.dataset
    const images = this.data.record.autopsyImages || []
    
    wx.previewImage({
      current: images[index],
      urls: images
    })
  },

  /**
   * 修正诊断
   */
  onCorrectDiagnosis() {
    // 保存原死因用于占位符显示
    const currentCause = this.data.record.deathCause || ''
    
    this.setData({
      showCorrectionDialog: true,
      originalCause: currentCause, // 保存原死因
      correctionForm: {
        correctedCause: '', // 默认为空，使用占位符提示
        veterinarianDiagnosis: '', // 兽医诊断（必填）
        aiAccuracyRating: 3 // 默认3星（基本准确）
      }
    })
  },

  /**
   * 确认AI诊断无误
   */
  async onConfirmDiagnosis() {
    wx.showModal({
      title: '确认诊断',
      content: '确认AI诊断结果准确无误？此操作将标记为"已确认"。',
      success: async (res) => {
        if (res.confirm) {
          await this.submitCorrection({
            correctedCause: this.data.record.deathCause,
            veterinarianDiagnosis: '确认AI诊断准确',
            aiAccuracyRating: 5,
            isConfirmed: true // 标记为确认而非修正
          })
        }
      }
    })
  },

  /**
   * 重新修正
   */
  onReCorrect() {
    const currentCause = this.data.record.deathCause || ''
    this.setData({
      showCorrectionDialog: true,
      originalCause: currentCause,
      correctionForm: {
        correctedCause: this.data.record.correctedCause || '',
        veterinarianDiagnosis: this.data.record.correctionReason || '', // 兼容旧数据
        aiAccuracyRating: this.data.record.aiAccuracyRating || 3
      }
    })
  },

  /**
   * 提交修正
   */
  async onSubmitCorrection() {
    const form = this.data.correctionForm

    // 验证表单
    if (!form.correctedCause) {
      wx.showToast({ title: '请输入修正后的死因', icon: 'none' })
      return
    }
    if (!form.veterinarianDiagnosis) {
      wx.showToast({ title: '请输入兽医诊断', icon: 'none' })
      return
    }
    if (form.aiAccuracyRating === 0) {
      wx.showToast({ title: '请对AI准确性进行评分', icon: 'none' })
      return
    }

    await this.submitCorrection(form)
  },

  /**
   * 提交修正数据
   */
  async submitCorrection(data: any) {
    wx.showLoading({ title: '提交中...', mask: true })

    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'correct_death_diagnosis',
          recordId: this.data.recordId,
          correctedCause: data.correctedCause,
          correctionReason: data.veterinarianDiagnosis, // 兽医诊断作为修正依据
          aiAccuracyRating: data.aiAccuracyRating,
          isConfirmed: data.isConfirmed || false
        }
      })

      if (result.result && result.result.success) {
        wx.hideLoading()
        wx.showToast({ title: '提交成功', icon: 'success' })
        
        // 关闭弹窗
        this.setData({ showCorrectionDialog: false })
        
        // 重新加载详情
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
   * 取消修正
   */
  onCancelCorrection() {
    this.setData({ showCorrectionDialog: false })
  },

  /**
   * 表单输入处理
   */
  onCorrectedCauseChange(e: any) {
    this.setData({
      'correctionForm.correctedCause': e.detail.value
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
  }
})

