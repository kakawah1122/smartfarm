// treatment-record.ts - 治疗记录页面
import { createPageWithNavbar } from '../../utils/navigation'

interface Medication {
  medicationId?: string
  name: string
  dosage: string
  route: string
  frequency: string
  startDate: string
  endDate: string
  status: 'ongoing' | 'completed' | 'discontinued'
}

const pageConfig: WechatMiniprogram.Page.Options<any, any> = {
  data: {
    // 表单数据
    formData: {
      batchId: '',
      animalIds: [] as string[],
      treatmentDate: '',
      treatmentType: 'medication', // medication|isolation|supportive
      diagnosis: '',
      diagnosisConfidence: 0,
      notes: ''
    },
    
    // 诊断信息标记
    isDiagnosisCorrected: false, // 标记诊断是否为修正后的结果
    treatmentPlanSource: '', // 治疗方案来源：'veterinarian' | 'ai' | ''
    
    // 治疗方案
    treatmentPlan: {
      primary: '',
      followUpSchedule: [] as string[]
    },
    
    // 用药记录
    medications: [] as Medication[],
    
    // 治疗类型选项
    treatmentTypeOptions: [
      { label: '药物治疗', value: 'medication', icon: 'service', desc: '使用药物进行治疗' },
      { label: '隔离观察', value: 'isolation', icon: 'location', desc: '隔离观察治疗' }
    ],
    
    // 给药途径选项
    routeOptions: [
      { label: '口服', value: 'oral' },
      { label: '肌肉注射', value: 'intramuscular' },
      { label: '皮下注射', value: 'subcutaneous' },
      { label: '静脉注射', value: 'intravenous' },
      { label: '外用', value: 'topical' },
      { label: '喷雾', value: 'spray' }
    ],
    
    // 活跃批次
    activeBatches: [] as any[],
    
    // 库存药品和营养品
    availableMaterials: [] as any[],
    filteredMaterials: [] as any[], // 根据治疗类型过滤后的物料
    
    // 原生选择器
    selectedMaterialIndex: -1,
    selectedMaterial: null as any,
    medicationQuantity: '',
    medicationDosage: '',
    
    // 页面状态
    loading: false,
    submitting: false,
    showMedicationDialog: false,
    currentMedication: null as Medication | null,
    
    // 表单验证
    formErrors: {} as Record<string, string>,
    
    // 来源数据
    sourceType: 'normal', // normal|from_ai_diagnosis|from_health_record
    sourceId: '',
    diagnosisId: '', // AI诊断ID
    treatmentId: '', // 治疗记录ID（用于完成治疗或从异常记录创建）
    abnormalRecordId: '', // 关联的异常记录ID
    isDraft: false, // 是否为草稿状态（从异常记录创建的治疗记录）
    isEditMode: false // 是否为编辑模式
  },

  onLoad(options: any) {
    const { sourceType, sourceId, diagnosisId, batchId, batchNumber, treatmentId, id, abnormalRecordId, diagnosis } = options || {}
    
    this.setData({
      sourceType: sourceType || 'normal',
      sourceId: sourceId || '',
      diagnosisId: diagnosisId || '',
      treatmentId: treatmentId || id || '',
      abnormalRecordId: abnormalRecordId || ''
    })
    
    // 如果来自异常记录，设置相关数据（优先使用批次编号）
    if (abnormalRecordId) {
      this.setData({
        'formData.batchId': batchNumber || batchId || '',
        'formData.diagnosis': diagnosis ? decodeURIComponent(diagnosis) : ''
      })
    } else if (batchNumber || batchId) {
      this.setData({
        'formData.batchId': batchNumber || batchId
      })
    }
    
    // 如果有治疗记录ID，说明是编辑模式，需要加载治疗记录详情
    if (treatmentId || id) {
      this.loadTreatmentRecord(treatmentId || id)
    } else {
      this.initializeForm()
      
      // 如果来自AI诊断，加载诊断结果
      if (diagnosisId) {
        this.loadAIDiagnosisResult(diagnosisId)
      }
      
      // 如果来自异常记录，加载异常记录的AI建议
      if (abnormalRecordId) {
        this.loadAbnormalRecordAIRecommendation(abnormalRecordId)
      }
    }
  },

  onShow: async function() {
    await this.loadActiveBatches()
    await this.loadAvailableMaterials()
  },

  // 初始化表单
  initializeForm() {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    
    this.setData({
      'formData.treatmentDate': today
    })
  },

  // 加载治疗记录详情（用于编辑草稿）
  loadTreatmentRecord: async function(treatmentId: string) {
    try {
      wx.showLoading({ title: '加载中...' })
      
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_treatment_record_detail',
          treatmentId: treatmentId
        }
      })
      
      wx.hideLoading()
      
      if (result.result && result.result.success) {
        const record = result.result.data
        
        console.log('📝 加载治疗记录:', record)
        
        // 填充表单数据
        this.setData({
          isEditMode: true,
          isDraft: record.isDraft || false,
          abnormalRecordId: record.abnormalRecordId || '',
          'formData.batchId': record.batchId,
          'formData.treatmentDate': record.treatmentDate,
          'formData.treatmentType': record.treatmentType,
          'formData.diagnosis': record.diagnosis?.confirmed || record.diagnosis?.preliminary || '',
          'formData.diagnosisConfidence': record.diagnosis?.confidence || 0,
          'formData.notes': record.notes || '',
          'treatmentPlan.primary': record.treatmentPlan?.primary || '',
          'treatmentPlan.followUpSchedule': record.treatmentPlan?.followUpSchedule || [],
          medications: record.medications || []
        })
      }
    } catch (error: any) {
      wx.hideLoading()
      console.error('加载治疗记录失败:', error)
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      })
    }
  },

  // 加载AI诊断结果
  loadAIDiagnosisResult: async function(diagnosisId: string) {
    try {
      const result = await wx.cloud.callFunction({
        name: 'ai-diagnosis',
        data: {
          action: 'get_diagnosis_result',
          diagnosisId: diagnosisId
        }
      })
      
      if (result.result && result.result.success) {
        const aiResult = result.result.data
        
        // 填充诊断信息
        this.setData({
          'formData.diagnosis': aiResult.primaryDiagnosis || '',
          'formData.diagnosisConfidence': aiResult.confidence || 0
        })
        
        // 不再自动填充AI建议的药物，用户需要从库存中选择
      }
    } catch (error) {
      // 已移除调试日志
    }
  },

  // 加载异常记录的AI建议
  loadAbnormalRecordAIRecommendation: async function(abnormalRecordId: string) {
    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_abnormal_record_detail',
          recordId: abnormalRecordId
        }
      })
      
      if (result.result && result.result.success) {
        const record = result.result.data
        
        // 优先使用修正后的诊断，否则使用AI诊断
        const finalDiagnosis = record.isCorrected && record.correctedDiagnosis 
          ? record.correctedDiagnosis 
          : record.diagnosis
        
        // 更新诊断结果和修正标记
        if (finalDiagnosis) {
          this.setData({
            'formData.diagnosis': finalDiagnosis,
            isDiagnosisCorrected: !!(record.isCorrected && record.correctedDiagnosis)
          })
        }
        
        // 根据是否有修正，填充治疗方案
        if (record.isCorrected) {
          // 有修正：优先使用兽医建议的治疗方案（可能为空）
          this.setData({
            'treatmentPlan.primary': record.veterinarianTreatmentPlan || '',
            treatmentPlanSource: 'veterinarian'
          })
        } else {
          // 没有修正：尝试填充AI建议的治疗方案
          let aiRecommendation = record.aiRecommendation
          if (typeof aiRecommendation === 'string') {
            try {
              aiRecommendation = JSON.parse(aiRecommendation)
            } catch (e) {
              console.error('解析AI建议失败:', e)
            }
          }
          
          if (aiRecommendation && aiRecommendation.immediate && aiRecommendation.immediate.length > 0) {
            this.setData({
              'treatmentPlan.primary': aiRecommendation.immediate.join('；'),
              treatmentPlanSource: 'ai'
            })
          }
        }
        
        // 不再自动填充AI建议的药物，用户需要从库存中选择
      }
    } catch (error) {
      console.error('加载异常记录AI建议失败:', error)
    }
  },

  // 计算结束日期
  calculateEndDate(startDate: string, duration: number): string {
    const start = new Date(startDate)
    const end = new Date(start.getTime() + duration * 24 * 60 * 60 * 1000)
    return end.toISOString().split('T')[0]
  },

  // 加载活跃批次
  loadActiveBatches: async function() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: { action: 'get_active_batches' }
      })
      
      if (result.result && result.result.success) {
        this.setData({
          activeBatches: result.result.data.batches || []
        })
      }
    } catch (error) {
      // 已移除调试日志
    }
  },

  // 加载可用的药品和营养品
  loadAvailableMaterials: async function() {
    try {
      console.log('🔄 开始加载可用物料...')
      
      // 并行获取药品和营养品
      const [medicineResult, nutritionResult] = await Promise.all([
        wx.cloud.callFunction({
          name: 'production-material',
          data: { 
            action: 'list_materials',
            category: '药品',
            isActive: true,
            pageSize: 100
          }
        }),
        wx.cloud.callFunction({
          name: 'production-material',
          data: { 
            action: 'list_materials',
            category: '营养品',
            isActive: true,
            pageSize: 100
          }
        })
      ])
      
      console.log('📦 药品查询结果:', medicineResult.result)
      console.log('📦 营养品查询结果:', nutritionResult.result)
      
      const materials: any[] = []
      
      if (medicineResult.result && medicineResult.result.success) {
        const medicines = medicineResult.result.data.materials || []
        console.log('✅ 药品数量:', medicines.length)
        materials.push(...medicines.map((m: any) => ({
          ...m,
          categoryLabel: '药品'
        })))
      } else {
        console.log('❌ 药品查询失败或无数据')
      }
      
      if (nutritionResult.result && nutritionResult.result.success) {
        const nutrition = nutritionResult.result.data.materials || []
        console.log('✅ 营养品数量:', nutrition.length)
        materials.push(...nutrition.map((m: any) => ({
          ...m,
          categoryLabel: '营养品'
        })))
      } else {
        console.log('❌ 营养品查询失败或无数据')
      }
      
      console.log('📊 合计物料数量:', materials.length)
      console.log('📊 物料列表:', materials)
      
      // 根据当前治疗类型过滤物料
      let filteredMaterials = []
      const treatmentType = this.data.formData.treatmentType
      
      if (treatmentType === 'medication') {
        // 药物治疗：显示药品 + 营养品
        filteredMaterials = materials.filter((m: any) => 
          m.category === '药品' || m.category === '营养品'
        )
      } else if (treatmentType === 'isolation') {
        // 隔离观察：只显示营养品
        filteredMaterials = materials.filter((m: any) => 
          m.category === '营养品'
        )
      } else {
        // 默认显示全部
        filteredMaterials = materials
      }
      
      console.log(`📊 根据治疗类型 ${treatmentType} 过滤后物料数量:`, filteredMaterials.length)
      
      this.setData({
        availableMaterials: materials,
        filteredMaterials
      })
    } catch (error) {
      console.error('❌ 加载药品营养品失败:', error)
      wx.showToast({
        title: '加载库存失败',
        icon: 'none',
        duration: 2000
      })
    }
  },

  // 表单输入处理
  onFormInput(e: any) {
    const { field } = e.currentTarget.dataset
    const { value } = e.detail
    
    this.setData({
      [`formData.${field}`]: value
    })
    
    this.validateField(field, value)
  },

  // 数字输入处理
  onNumberInput(e: any) {
    const { field } = e.currentTarget.dataset
    const value = parseFloat(e.detail.value) || 0
    
    this.setData({
      [`formData.${field}`]: value
    })
    
    this.validateField(field, value)
  },

  // 治疗方案输入处理
  onTreatmentPlanInput(e: any) {
    const { field } = e.currentTarget.dataset
    const { value } = e.detail
    
    this.setData({
      [`treatmentPlan.${field}`]: value
    })
  },

  // 药物日期选择
  onMedicationDateChange(e: any) {
    const { field } = e.currentTarget.dataset
    this.setData({
      [`currentMedication.${field}`]: e.detail.value
    })
  },

  // 显示给药途径选择器
  showRouteSelector() {
    const itemList = this.data.routeOptions.map(item => item.label)
    
    wx.showActionSheet({
      itemList,
      success: (res) => {
        const selectedRoute = this.data.routeOptions[res.tapIndex]
        this.setData({
          'currentMedication.route': selectedRoute.value
        })
      }
    })
  },

  // 显示批次选择器
  showBatchSelector() {
    if (this.data.activeBatches.length === 0) {
      wx.showToast({
        title: '暂无可用批次',
        icon: 'none'
      })
      return
    }
    
    const itemList = this.data.activeBatches.map(batch => batch.displayName)
    
    wx.showActionSheet({
      itemList,
      success: (res) => {
        const selectedBatch = this.data.activeBatches[res.tapIndex]
        this.setData({
          'formData.batchId': selectedBatch.batchNumber
        })
        this.validateField('batchId', selectedBatch.batchNumber)
      }
    })
  },

  // 选择治疗类型（直接切换）
  selectTreatmentType(e: any) {
    const { type } = e.currentTarget.dataset
    
    // 根据治疗类型过滤物料
    let filteredMaterials = []
    if (type === 'medication') {
      // 药物治疗：显示药品 + 营养品
      filteredMaterials = this.data.availableMaterials.filter((m: any) => 
        m.category === '药品' || m.category === '营养品'
      )
    } else if (type === 'isolation') {
      // 隔离观察：只显示营养品
      filteredMaterials = this.data.availableMaterials.filter((m: any) => 
        m.category === '营养品'
      )
    } else {
      filteredMaterials = this.data.availableMaterials
    }
    
    this.setData({
      'formData.treatmentType': type,
      filteredMaterials,
      // 重置选择
      selectedMaterialIndex: -1,
      selectedMaterial: null,
      medicationQuantity: '',
      medicationDosage: ''
    })
    
    console.log(`✅ 治疗类型切换为: ${type}, 可选物料数量: ${filteredMaterials.length}`)
    
    this.validateField('treatmentType', type)
  },

  // 日期选择器
  onDateChange(e: any) {
    const { field } = e.currentTarget.dataset
    this.setData({
      [`formData.${field}`]: e.detail.value
    })
    
    // 如果是治疗开始日期变化，更新药物开始日期
    if (field === 'treatmentDate') {
      const updatedMedications = this.data.medications.map(med => ({
        ...med,
        startDate: e.detail.value,
        endDate: this.calculateEndDate(e.detail.value, 7)
      }))
      this.setData({ medications: updatedMedications })
    }
    
    this.validateField(field, e.detail.value)
  },

  // 原生picker选择药品/营养品
  onMaterialPickerChange(e: any) {
    const index = parseInt(e.detail.value)
    const material = this.data.filteredMaterials[index]
    
    console.log('✅ 选择物料:', material)
    
    this.setData({
      selectedMaterialIndex: index,
      selectedMaterial: material,
      medicationQuantity: '',
      medicationDosage: ''
    })
  },
  
  // 领取数量输入
  onMedicationQuantityInput(e: any) {
    const quantity = parseFloat(e.detail.value) || 0
    const currentStock = this.data.selectedMaterial?.currentStock || 0
    
    // 验证库存
    if (quantity > currentStock) {
      wx.showToast({
        title: `库存不足，当前库存：${currentStock}`,
        icon: 'none',
        duration: 2000
      })
    }
    
    this.setData({
      medicationQuantity: e.detail.value
    })
  },
  
  // 用法用量输入
  onMedicationDosageInput(e: any) {
    this.setData({
      medicationDosage: e.detail.value
    })
  },

  // 编辑药物
  editMedication(e: any) {
    const { index } = e.currentTarget.dataset
    const medication = this.data.medications[index]
    
    this.setData({
      currentMedication: { ...medication, index },
      showMedicationDialog: true
    })
  },

  // 删除药物
  deleteMedication(e: any) {
    const { index } = e.currentTarget.dataset
    
    wx.showModal({
      title: '确认删除',
      content: '是否删除这个药物记录？',
      success: (res) => {
        if (res.confirm) {
          const medications = [...this.data.medications]
          medications.splice(index, 1)
          this.setData({ medications })
        }
      }
    })
  },

  // 药物表单输入处理
  onMedicationInput(e: any) {
    const { field } = e.currentTarget.dataset
    const { value } = e.detail
    
    this.setData({
      [`currentMedication.${field}`]: value
    })
  },

  // 保存药物
  saveMedication() {
    const { currentMedication } = this.data
    
    if (!currentMedication || !currentMedication.name || !currentMedication.dosage) {
      wx.showToast({
        title: '请填写药物名称和用量',
        icon: 'none'
      })
      return
    }
    
    let medications = [...this.data.medications]
    
    if (currentMedication.hasOwnProperty('index')) {
      // 编辑模式
      const index = (currentMedication as any).index
      medications[index] = { ...currentMedication }
      delete medications[index].index
    } else {
      // 新增模式
      medications.push(currentMedication)
    }
    
    this.setData({
      medications,
      showMedicationDialog: false,
      currentMedication: null
    })
  },

  // 取消药物编辑
  cancelMedicationEdit() {
    this.setData({
      showMedicationDialog: false,
      currentMedication: null
    })
  },

  // 字段验证
  validateField(field: string, value: any) {
    const errors = { ...this.data.formErrors }
    
    switch (field) {
      case 'batchId':
        if (!value) {
          errors[field] = '请选择治疗批次'
        } else {
          delete errors[field]
        }
        break
      case 'diagnosis':
        if (!value || value.trim().length === 0) {
          errors[field] = '请输入诊断结果'
        } else {
          delete errors[field]
        }
        break
      case 'treatmentDate':
        if (!value) {
          errors[field] = '请选择治疗日期'
        } else {
          delete errors[field]
        }
        break
    }
    
    this.setData({ formErrors: errors })
  },

  // 表单验证
  validateForm(): boolean {
    const { formData } = this.data
    const errors: Record<string, string> = {}
    
    // 必填字段验证
    if (!formData.batchId) errors.batchId = '请选择治疗批次'
    if (!formData.diagnosis) errors.diagnosis = '请输入诊断结果'
    if (!formData.treatmentDate) errors.treatmentDate = '请选择治疗日期'
    
    // ✅ 移除治疗方案和药物的必填验证 - 允许为空
    // if (!this.data.treatmentPlan.primary && this.data.medications.length === 0) {
    //   errors.treatmentPlan = '请制定治疗方案或添加药物'
    // }
    
    this.setData({ formErrors: errors })
    return Object.keys(errors).length === 0
  },

  // 提交表单
  submitForm: async function() {
    if (!this.validateForm()) {
      wx.showToast({
        title: '请检查表单信息',
        icon: 'none'
      })
      return
    }
    
    this.setData({ submitting: true })
    
    try {
      const { isDraft, isEditMode, treatmentId, abnormalRecordId } = this.data
      
      // 如果是草稿状态（从异常记录创建的治疗记录），需要调用 submit_treatment_plan
      if (isDraft && isEditMode && treatmentId) {
        await this.submitTreatmentPlan()
      } else {
        // 否则按照原有逻辑创建新的治疗记录
        await this.createTreatmentRecord()
      }
    } catch (error: any) {
      console.error('提交失败:', error)
      wx.showToast({
        title: error.message || '保存失败，请重试',
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false })
    }
  },

  // 提交治疗计划（草稿变正式）
  submitTreatmentPlan: async function() {
    const { treatmentId, abnormalRecordId, formData, treatmentPlan, medications } = this.data
    
    // 1. 先更新治疗记录的详细信息
    await this.updateTreatmentRecord()
    
    // 2. 调用 submit_treatment_plan 接口，更新异常记录状态
    const result = await wx.cloud.callFunction({
      name: 'health-management',
      data: {
        action: 'submit_treatment_plan',
        treatmentId: treatmentId,
        abnormalRecordId: abnormalRecordId,
        treatmentType: formData.treatmentType  // medication | isolation | supportive
      }
    })
    
    if (result.result && result.result.success) {
      wx.showToast({
        title: '治疗方案提交成功',
        icon: 'success'
      })
      
      // 根据治疗类型跳转到不同页面
      setTimeout(() => {
        if (formData.treatmentType === 'isolation') {
          // 隔离观察：跳转到隔离管理页面
          wx.redirectTo({
            url: `/packageHealth/health-care/health-care?mode=isolation&batchId=${formData.batchId}`,
            fail: () => {
              // 如果跳转失败，返回健康管理中心
              wx.switchTab({
                url: '/pages/health/health'
              })
            }
          })
        } else {
          // 药物治疗：返回健康管理中心（治疗中）
          wx.switchTab({
            url: '/pages/health/health'
          })
        }
      }, 1500)
    } else {
      throw new Error(result.result?.message || '提交失败')
    }
  },

  // 更新治疗记录详情
  updateTreatmentRecord: async function() {
    const { treatmentId, formData, treatmentPlan, medications } = this.data
    
    const result = await wx.cloud.callFunction({
      name: 'health-management',
      data: {
        action: 'update_treatment_record',
        treatmentId: treatmentId,
        updateData: {
          batchId: formData.batchId,
          treatmentDate: formData.treatmentDate,
          treatmentType: formData.treatmentType,
          diagnosis: {
            preliminary: formData.diagnosis,
            confirmed: formData.diagnosis,
            confidence: formData.diagnosisConfidence
          },
          treatmentPlan: {
            primary: treatmentPlan.primary,
            followUpSchedule: treatmentPlan.followUpSchedule
          },
          medications: medications,
          notes: formData.notes,
          updatedAt: new Date()
        }
      }
    })
    
    if (!result.result || !result.result.success) {
      throw new Error(result.result?.message || '更新治疗记录失败')
    }
  },

  // 创建新的治疗记录
  createTreatmentRecord: async function() {
    const { formData, treatmentPlan, medications, abnormalRecordId } = this.data
    
    // 构建治疗记录数据
    const treatmentRecord = {
      batchId: formData.batchId,
      animalIds: formData.animalIds,
      treatmentDate: formData.treatmentDate,
      treatmentType: formData.treatmentType,
      diagnosis: {
        preliminary: formData.diagnosis,
        confirmed: formData.diagnosis,
        confidence: formData.diagnosisConfidence,
        diagnosisMethod: this.data.sourceType === 'from_ai_diagnosis' ? 'ai' : 'manual'
      },
      treatmentPlan: {
        primary: treatmentPlan.primary,
        followUpSchedule: treatmentPlan.followUpSchedule
      },
      medications,
      outcome: {
        status: 'ongoing',
        curedCount: 0,
        improvedCount: 0,
        deathCount: 0,
        totalTreated: formData.animalIds.length || 1
      },
      cost: {
        medication: 0,
        veterinary: 0,
        supportive: 0,
        total: 0
      },
      notes: formData.notes,
      abnormalRecordId: abnormalRecordId || undefined  // 关联异常记录ID
    }
    
    // 如果是从异常记录创建，使用专门的云函数
    const action = abnormalRecordId 
      ? (formData.treatmentType === 'isolation' 
          ? 'create_isolation_from_abnormal' 
          : 'create_treatment_from_abnormal')
      : 'create_treatment_record'
    
    // 调用云函数创建治疗记录
    const result = await wx.cloud.callFunction({
      name: 'health-management',
      data: abnormalRecordId ? {
        action,
        abnormalRecordId,
        batchId: formData.batchId,
        diagnosis: formData.diagnosis,
        treatmentType: formData.treatmentType,
        treatmentPlan,
        medications,
        notes: formData.notes
      } : {
        action,
        ...treatmentRecord,
        sourceType: this.data.sourceType,
        sourceId: this.data.sourceId,
        diagnosisId: this.data.diagnosisId
      }
    })
    
    if (result.result && result.result.success) {
      wx.showToast({
        title: '治疗记录创建成功',
        icon: 'success'
      })
      
      // 根据治疗类型跳转到不同页面
      setTimeout(() => {
        if (formData.treatmentType === 'isolation') {
          // 隔离观察：跳转到隔离管理页面
          wx.redirectTo({
            url: `/packageHealth/health-care/health-care?mode=isolation&batchId=${formData.batchId}`,
            fail: () => {
              // 如果跳转失败，返回健康管理中心
              wx.switchTab({
                url: '/pages/health/health'
              })
            }
          })
        } else {
          // 药物治疗：返回健康管理中心（治疗中）
          wx.switchTab({
            url: '/pages/health/health'
          })
        }
      }, 1500)
    } else {
      throw new Error(result.result?.message || '保存失败')
    }
  },

  // 重置表单
  resetForm() {
    wx.showModal({
      title: '确认重置',
      content: '是否清空所有已填写的信息？',
      success: (res) => {
        if (res.confirm) {
          this.initializeForm()
          this.setData({
            formData: {
              ...this.data.formData,
              batchId: '',
              animalIds: [],
              treatmentType: 'medication',
              diagnosis: '',
              diagnosisConfidence: 0,
              notes: ''
            },
            treatmentPlan: {
              primary: '',
              followUpSchedule: []
            },
            medications: [],
            formErrors: {}
          })
        }
      }
    })
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  },

  // 完成治疗
  completeTreatment: async function() {
    const options = ['治愈', '死亡']
    
    wx.showActionSheet({
      itemList: options,
      success: async (res) => {
        if (res.tapIndex === 0) {
          // 治愈
          await this.markAsCured()
        } else if (res.tapIndex === 1) {
          // 死亡
          await this.markAsDied()
        }
      }
    })
  },

  // 标记为治愈
  markAsCured: async function() {
    try {
      // 确认治愈数量
      wx.showModal({
        title: '确认治愈',
        content: `确认治愈${this.data.formData.initialCount || 0}只动物？`,
        success: async (res) => {
          if (res.confirm) {
            wx.showLoading({ title: '处理中...' })
            
            const result = await wx.cloud.callFunction({
              name: 'health-management',
              data: {
                action: 'complete_treatment_as_cured',
                treatmentId: this.data.treatmentId,
                curedCount: this.data.formData.initialCount || 0
              }
            })
            
            wx.hideLoading()
            
            if (result.result && result.result.success) {
              wx.showToast({
                title: '已标记为治愈',
                icon: 'success'
              })
              
              // 返回健康管理页面
              setTimeout(() => {
                wx.navigateBack()
              }, 1500)
            } else {
              throw new Error(result.result?.message || '操作失败')
            }
          }
        }
      })
    } catch (error: any) {
      wx.hideLoading()
      wx.showToast({
        title: error.message || '标记治愈失败',
        icon: 'none'
      })
    }
  },

  // 标记为死亡
  markAsDied: async function() {
    wx.showModal({
      title: '确认死亡',
      content: `确认因治疗无效导致${this.data.formData.initialCount || 0}只动物死亡？`,
      success: (res) => {
        if (res.confirm) {
          // 跳转到死亡记录页面
          wx.navigateTo({
            url: `/packageHealth/death-record/death-record?treatmentId=${this.data.treatmentId}&affectedCount=${this.data.formData.initialCount || 0}`
          })
        }
      }
    })
  }
}

Page(createPageWithNavbar(pageConfig))
