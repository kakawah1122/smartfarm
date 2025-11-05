// death-record.ts - 死亡记录页面
import { createPageWithNavbar } from '../../utils/navigation'

const pageConfig = {
  data: {
    // 表单数据
    formData: {
      batchId: '',
      batchNumber: '',
      deathDate: '',
      deathCount: 0,
      deathCause: '',
      deathCategory: 'disease', // disease|accident|old_age|other
      disposalMethod: 'burial', // burial|cremation|rendering|landfill
      description: '',
      operator: '',
      operatorName: ''
    },
    
    // 死亡原因选项
    deathCauseOptions: [
      '禽流感',
      '新城疫',
      '小鹅瘟',
      '鹅副粘病毒病',
      '大肠杆菌病',
      '沙门氏菌病',
      '中暑',
      '中毒',
      '外伤',
      '其他'
    ],
    
    // 死亡分类选项
    deathCategoryOptions: [
      { label: '疾病', value: 'disease' },
      { label: '事故', value: 'accident' },
      { label: '衰老', value: 'old_age' },
      { label: '其他', value: 'other' }
    ],
    currentDeathCategoryIndex: 0,
    currentDeathCategoryLabel: '疾病',
    
    // 处理方式选项
    disposalMethodOptions: [
      { label: '深埋', value: 'burial' },
      { label: '焚烧', value: 'cremation' },
      { label: '无害化处理', value: 'rendering' },
      { label: '填埋', value: 'landfill' }
    ],
    currentDisposalMethodIndex: 0,
    currentDisposalMethodLabel: '深埋',
    
    // 财务损失信息
    financialLoss: {
      costPerAnimal: 0,
      totalLoss: 0,
      treatmentCost: 0
    },
    
    // 来源信息
    diagnosisId: '', // 从AI诊断创建
    treatmentId: '', // 从治疗失败创建
    sourceType: 'manual', // manual|diagnosis|treatment|vaccine_tracking
    
    // 解剖分析
    autopsyImages: [] as string[], // 解剖照片
    aiAnalysisResult: null as any, // AI分析结果
    aiConfidencePercent: '0.0', // AI置信度百分比（格式化后）
    showAnalysisResult: false, // 显示分析结果
    
    // 页面状态
    loading: false,
    submitting: false,
    analyzing: false, // AI分析中
    
    // 表单验证
    formValid: false,
    formErrors: {} as Record<string, string>
  },

  onLoad(options: any) {
    const { diagnosisId, treatmentId, affectedCount, batchId, batchNumber, sourceType } = options || {}
    
    // 初始化日期为今天
    const today = new Date().toISOString().split('T')[0]
    
    this.setData({
      diagnosisId: diagnosisId || '',
      treatmentId: treatmentId || '',
      sourceType: sourceType || 'manual',  // ✅ 设置来源类型
      'formData.deathDate': today,
      'formData.deathCount': parseInt(affectedCount) || 0,
      'formData.batchId': batchId || wx.getStorageSync('currentBatchId') || '',
      'formData.batchNumber': batchNumber || ''  // ✅ 直接设置批次号（如果有）
    })
    
    // ✅ 如果来自疫苗追踪，自动设置死亡原因为"疫苗后反应"
    if (sourceType === 'vaccine_tracking') {
      this.setData({
        'formData.deathCause': '疫苗后反应'
      })
    }
    
    // 确定来源类型（如果已设置则不需要重新设置）
    if (!sourceType) {
      if (diagnosisId) {
        this.setData({ sourceType: 'diagnosis' })
        this.loadDiagnosisInfo(diagnosisId)
      } else if (treatmentId) {
        this.setData({ sourceType: 'treatment' })
        this.loadTreatmentInfo(treatmentId)
      }
    }
    
    // 如果没有批次号但有批次ID，则加载批次信息
    if (this.data.formData.batchId && !this.data.formData.batchNumber) {
      this.loadBatchInfo()
    }
    
    this.validateForm()
  },

  // 加载AI诊断信息
  async loadDiagnosisInfo(diagnosisId: string) {
    try {
      wx.showLoading({ title: '加载诊断信息...' })
      
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_ai_diagnosis',
          diagnosisId: diagnosisId
        }
      })
      
      wx.hideLoading()
      
      if (result.result && result.result.success) {
        const diagnosis = result.result.data
        this.setData({
          'formData.deathCause': diagnosis.primaryDiagnosis?.disease || '',
          'formData.batchId': diagnosis.batchId || this.data.formData.batchId
        })
      }
    } catch (error) {
      wx.hideLoading()
      // 加载失败，静默处理
    }
  },

  // 加载治疗信息
  async loadTreatmentInfo(treatmentId: string) {
    try {
      wx.showLoading({ title: '加载治疗信息...' })
      
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_treatment_record',
          treatmentId: treatmentId
        }
      })
      
      wx.hideLoading()
      
      if (result.result && result.result.success) {
        const treatment = result.result.data
        this.setData({
          'formData.deathCause': treatment.diagnosis || '',
          'formData.deathCount': treatment.initialCount || this.data.formData.deathCount,
          'formData.batchId': treatment.batchId || this.data.formData.batchId,
          'financialLoss.treatmentCost': treatment.totalCost || 0
        })
        
        // 如果还没有批次号，加载批次号
        if (!this.data.formData.batchNumber && treatment.batchId) {
          await this.loadBatchInfo()
        } else {
          // 如果有批次信息，计算财务损失
          await this.calculateFinancialLossWithBatch({})
        }
      }
    } catch (error) {
      wx.hideLoading()
      // 加载失败，静默处理
    }
  },

  // 加载批次信息
  async loadBatchInfo() {
    try {
      const batchId = this.data.formData.batchId
      if (!batchId) return
      
      // 直接使用数据库查询批次号
      const db = wx.cloud.database()
      const batchResult = await db.collection('prod_batch_entries')
        .doc(batchId)
        .field({ batchNumber: true, quantity: true })
        .get()
      
      if (batchResult.data && batchResult.data.batchNumber) {
        this.setData({
          'formData.batchNumber': batchResult.data.batchNumber
        })
        
        // 计算财务损失
        if (batchResult.data.quantity) {
          // 使用批次信息计算财务损失
          await this.calculateFinancialLossWithBatch(batchResult.data)
        }
      }
    } catch (error) {
      // 查询失败，静默处理
      console.error('加载批次信息失败:', error)
    }
  },

  // 使用批次信息计算财务损失
  async calculateFinancialLossWithBatch(batch: any) {
    try {
      // ✅ 直接使用批次的入栏单价（unitPrice），不分摊饲养成本
      const costPerAnimal = parseFloat(batch.unitPrice) || 0
      const deathCount = this.data.formData.deathCount
      const treatmentCost = this.data.financialLoss.treatmentCost || 0
      
      // 总损失 = 入栏单价 × 死亡数量 + 治疗成本
      const totalLoss = (costPerAnimal * deathCount) + treatmentCost
      
      this.setData({
        'financialLoss.costPerAnimal': costPerAnimal,
        'financialLoss.totalLoss': totalLoss
      })
    } catch (error) {
      // 计算失败，静默处理
      console.error('计算财务损失失败:', error)
    }
  },

  // 死亡日期选择
  onDeathDateChange(e: any) {
    this.setData({
      'formData.deathDate': e.detail.value
    }, () => {
      this.validateField('deathDate', e.detail.value)
    })
  },

  // 死亡数量输入
  onDeathCountInput(e: any) {
    const count = parseInt(e.detail.value) || 0
    this.setData({
      'formData.deathCount': count
    }, () => {
      this.validateField('deathCount', count)
      // 重新计算财务损失
      const costPerAnimal = this.data.financialLoss.costPerAnimal
      const treatmentCost = this.data.financialLoss.treatmentCost
      this.setData({
        'financialLoss.totalLoss': (costPerAnimal * count) + treatmentCost
      })
    })
  },

  // 死亡原因输入
  onDeathCauseInput(e: any) {
    this.setData({
      'formData.deathCause': e.detail.value
    }, () => {
      this.validateField('deathCause', e.detail.value)
    })
  },

  // 死亡原因选择
  selectDeathCause(e: any) {
    const { cause } = e.currentTarget.dataset
    this.setData({
      'formData.deathCause': cause
    }, () => {
      this.validateField('deathCause', cause)
    })
  },

  // 死亡分类选择
  onDeathCategoryChange(e: any) {
    const index = parseInt(e.detail.value)
    const selected = this.data.deathCategoryOptions[index]
    this.setData({
      'formData.deathCategory': selected.value,
      currentDeathCategoryIndex: index,
      currentDeathCategoryLabel: selected.label
    })
  },

  // 处理方式选择
  onDisposalMethodChange(e: any) {
    const index = parseInt(e.detail.value)
    const selected = this.data.disposalMethodOptions[index]
    this.setData({
      'formData.disposalMethod': selected.value,
      currentDisposalMethodIndex: index,
      currentDisposalMethodLabel: selected.label
    })
  },

  // 描述输入
  onDescriptionInput(e: any) {
    this.setData({
      'formData.description': e.detail.value
    })
  },

  // 表单验证
  validateForm() {
    const { formData } = this.data
    const errors: Record<string, string> = {}
    
    if (!formData.deathDate) {
      errors.deathDate = '请选择死亡日期'
    }
    
    if (!formData.deathCount || formData.deathCount <= 0) {
      errors.deathCount = '死亡数量必须大于0'
    }
    
    if (!formData.deathCause || formData.deathCause.trim() === '') {
      errors.deathCause = '请输入死亡原因'
    }
    
    this.setData({
      formErrors: errors,
      formValid: Object.keys(errors).length === 0
    })
  },

  // 验证单个字段
  validateField(field: string, value: any) {
    const errors = { ...this.data.formErrors }
    
    switch (field) {
      case 'deathDate':
        if (!value) {
          errors.deathDate = '请选择死亡日期'
        } else {
          delete errors.deathDate
        }
        break
      case 'deathCount':
        if (!value || value <= 0) {
          errors.deathCount = '死亡数量必须大于0'
        } else {
          delete errors.deathCount
        }
        break
      case 'deathCause':
        if (!value || value.trim() === '') {
          errors.deathCause = '请输入死亡原因'
        } else {
          delete errors.deathCause
        }
        break
    }
    
    this.setData({
      formErrors: errors,
      formValid: Object.keys(errors).length === 0
    })
  },

  // 提交死亡记录
  async submitDeathRecord() {
    this.validateForm()
    
    if (!this.data.formValid) {
      wx.showToast({
        title: '请完善表单信息',
        icon: 'none'
      })
      return
    }
    
    if (this.data.submitting) return
    
    this.setData({ submitting: true })
    
    try {
      wx.showLoading({ title: '提交中...' })
      
      const { formData, financialLoss, diagnosisId, treatmentId } = this.data
      
      // 如果是从治疗失败创建，调用completeTreatmentAsDied
      if (treatmentId) {
        const result = await wx.cloud.callFunction({
          name: 'health-management',
          data: {
            action: 'complete_treatment_as_died',
            treatmentId: treatmentId,
            diedCount: formData.deathCount,
            deathDetails: {
              description: formData.description,
              disposalMethod: formData.disposalMethod,
              operatorName: formData.operatorName || '系统'
            }
          }
        })
        
        wx.hideLoading()
        
        if (result.result && result.result.success) {
          wx.showToast({
            title: '死亡记录已提交',
            icon: 'success'
          })
          
          // 返回健康管理页面
          setTimeout(() => {
            wx.navigateBack({ delta: 2 })
          }, 1500)
        } else {
          throw new Error(result.result?.message || '提交失败')
        }
      } else {
        // 直接创建死亡记录
        const result = await wx.cloud.callFunction({
          name: 'health-management',
          data: {
            action: 'createDeathRecord',
            ...formData,
            diagnosisId: diagnosisId || null,
            financialLoss: financialLoss
          }
        })
        
        wx.hideLoading()
        
        if (result.result && result.result.success) {
          // ✅ 设置刷新标志，通知健康页面刷新
          wx.setStorageSync('health_page_need_refresh', true)
          
          wx.showToast({
            title: '死亡记录已提交',
            icon: 'success'
          })
          
          // 返回上一页
          setTimeout(() => {
            wx.navigateBack()
          }, 1500)
        } else {
          throw new Error(result.result?.message || '提交失败')
        }
      }
    } catch (error: any) {
      wx.hideLoading()
      wx.showToast({
        title: error.message || '提交失败，请重试',
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false })
    }
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  },

  // ============ 解剖分析功能 ============

  // 选择解剖照片
  onChooseAutopsyImage() {
    const remainingCount = 9 - this.data.autopsyImages.length
    
    if (remainingCount <= 0) {
      wx.showToast({
        title: '最多上传9张照片',
        icon: 'none'
      })
      return
    }
    
    wx.chooseMedia({
      count: remainingCount,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newImages = res.tempFiles.map(file => file.tempFilePath)
        const allImages = [...this.data.autopsyImages, ...newImages]
        
        this.setData({
          autopsyImages: allImages.slice(0, 9)
        })
      },
      fail: (error) => {
        wx.showToast({
          title: '图片选择失败',
          icon: 'none'
        })
      }
    })
  },

  // 预览解剖照片
  onPreviewAutopsyImage(e: any) {
    const { src } = e.currentTarget.dataset
    wx.previewImage({
      urls: this.data.autopsyImages,
      current: src
    })
  },

  // 删除解剖照片
  onDeleteAutopsyImage(e: any) {
    const { index } = e.currentTarget.dataset
    const images = [...this.data.autopsyImages]
    images.splice(index, 1)
    
    this.setData({
      autopsyImages: images
    })
  },

  // AI分析死因
  async analyzeDeathCause() {
    // 验证是否有照片
    if (this.data.autopsyImages.length === 0) {
      wx.showModal({
        title: '提示',
        content: '请先上传解剖照片，以便AI分析死因',
        showCancel: false
      })
      return
    }

    // 验证基本信息
    if (!this.data.formData.deathCount || this.data.formData.deathCount <= 0) {
      wx.showToast({
        title: '请先填写死亡数量',
        icon: 'none'
      })
      return
    }

    if (this.data.analyzing) return

    this.setData({ analyzing: true })

    try {
      wx.showLoading({ title: 'AI分析中...' })

      // 构建症状描述
      const symptoms = [
        '突然死亡',
        this.data.formData.description || '未提供详细描述'
      ].join('；')

      // 调用AI诊断云函数
      const result = await wx.cloud.callFunction({
        name: 'ai-diagnosis',
        data: {
          action: 'ai_diagnosis',  // ✅ 修正为云函数中定义的action名称
          symptoms: symptoms,
          affectedCount: this.data.formData.deathCount,
          dayAge: 0, // 死亡解剖不需要日龄
          images: this.data.autopsyImages,
          analysisType: 'autopsy' // 标识为解剖分析
        }
      })

      wx.hideLoading()

      if (result.result && result.result.success) {
        const analysisData = result.result.data

        // 计算置信度百分比
        const confidence = analysisData.primaryDiagnosis?.confidence || 0
        const confidencePercent = (confidence * 100).toFixed(1)

        // 显示分析结果
        this.setData({
          aiAnalysisResult: analysisData,
          aiConfidencePercent: confidencePercent,
          showAnalysisResult: true
        })

        // 如果AI给出了诊断结果，询问是否采纳
        if (analysisData.primaryDiagnosis && analysisData.primaryDiagnosis.disease) {
          wx.showModal({
            title: 'AI分析结果',
            content: `疑似死因：${analysisData.primaryDiagnosis.disease}\n\n置信度：${confidencePercent}%\n\n是否采纳此分析结果？`,
            confirmText: '采纳',
            cancelText: '取消',
            success: (res) => {
              if (res.confirm) {
                // 自动填充死亡原因
                this.setData({
                  'formData.deathCause': analysisData.primaryDiagnosis.disease
                }, () => {
                  this.validateField('deathCause', analysisData.primaryDiagnosis.disease)
                  wx.showToast({
                    title: '已填充死因',
                    icon: 'success'
                  })
                })
              }
            }
          })
        } else {
          wx.showToast({
            title: 'AI分析完成',
            icon: 'success'
          })
        }
      } else {
        throw new Error(result.result?.message || 'AI分析失败')
      }
    } catch (error: any) {
      wx.hideLoading()
      wx.showToast({
        title: error.message || 'AI分析失败，请重试',
        icon: 'none',
        duration: 3000
      })
    } finally {
      this.setData({ analyzing: false })
    }
  },

  // 查看完整分析结果
  viewAnalysisDetail() {
    const result = this.data.aiAnalysisResult
    if (!result) return

    const primary = result.primaryDiagnosis || {}
    const alternatives = result.alternativeDiagnoses || []
    
    let content = `主要疑似死因：\n${primary.disease || '未知'}\n置信度：${((primary.confidence || 0) * 100).toFixed(1)}%\n`
    
    if (alternatives.length > 0) {
      content += `\n其他可能原因：\n`
      alternatives.forEach((alt: any, index: number) => {
        content += `${index + 1}. ${alt.disease} (${(alt.confidence * 100).toFixed(1)}%)\n`
      })
    }

    wx.showModal({
      title: 'AI分析详情',
      content: content,
      showCancel: false
    })
  }
}

Page(createPageWithNavbar(pageConfig))

