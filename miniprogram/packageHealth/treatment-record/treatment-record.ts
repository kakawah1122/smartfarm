// treatment-record.ts - 治疗记录页面
import { createPageWithNavbar } from '../../utils/navigation'
import { markHomepageNeedSync } from '../../utils/global-sync'
import { logger } from '../../utils/logger'

interface Medication {
  medicationId?: string
  materialId?: string
  name: string
  dosage: string
  route: string
  frequency: string
  startDate: string
  endDate: string
  status: 'ongoing' | 'completed' | 'discontinued'
}

const setHealthPageRefreshFlag = () => {
  wx.setStorageSync('health_page_need_refresh', true)
  markHomepageNeedSync()
}

const pageConfig: WechatMiniprogram.Page.Options<any, any> = {
  data: {
    // 表单数据
    formData: {
      treatmentNumber: '',  // ✅ 治疗记录编号
      batchId: '',
      batchNumber: '',  // ✅ 批次号用于显示
      animalIds: [] as string[],
      treatmentDate: '',
      treatmentType: 'medication', // medication
      diagnosis: '',
      diagnosisConfidence: 0,
      affectedCount: 0,  // ✅ 受影响的动物数量（用于健康率计算）
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
    
    // AI建议的用药信息（仅用于显示，不参与提交）
    aiMedicationSuggestions: [] as unknown[],
    
    // 用药记录
    medications: [] as Medication[],
    
    // 治疗类型选项
    treatmentTypeOptions: [
      { label: '药物治疗', value: 'medication', icon: 'service', desc: '使用药物进行治疗' }
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
    activeBatches: [] as unknown[],
    
    // 库存药品和营养品
    availableMaterials: [] as unknown[],
    filteredMaterials: [] as unknown[], // 根据治疗类型过滤后的物料
    
    // ⚡ 数据加载状态标记（性能优化）
    dataLoadStatus: {
      batchesLoaded: false,
      materialsLoaded: false
    },
    
    // 原生选择器（已废弃，保留兼容性）
    selectedMaterialIndex: -1,
    selectedMaterial: null as unknown,
    medicationQuantity: '',
    medicationDosage: '',
    
    // ✅ 首次创建治疗记录时的用药列表（支持多选联合用药）
    initialMedications: [] as unknown[],
    currentMedicationForm: {
      materialIndex: -1,
      materialId: '',
      materialName: '',
      materialCode: '',
      category: '',
      unit: '',
      currentStock: 0,
      specification: '',
      quantity: '',
      dosage: ''
    },
    
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
    isEditMode: false, // 是否为编辑模式
    viewMode: false, // ✅ 是否为查看模式（查看+跟进治疗进展）
    
    // ✅ 治疗进展数据（仅查看模式使用）
    treatmentProgress: {
      treatmentDays: 0,
      totalTreated: 0,
      curedCount: 0,
      improvedCount: 0,
      deathCount: 0,
      remainingCount: 0,
      cureRate: '0',
      mortalityRate: '0'
    },
    
    // ✅ 进展跟进对话框
    showProgressDialog: false,
    progressDialogType: '', // 'cured' | 'died'
    progressForm: {
      count: '',
      notes: '',
      deathCause: ''
    },
    
    // ✅ 继续治疗对话框
    showContinueTreatmentDialog: false,
    
    // ✅ 治疗笔记对话框
    showNoteDialog: false,
    noteForm: {
      content: ''
    },
    
    // ✅ 追加用药对话框
    showAddMedicationFormDialog: false,
    addMedicationForm: {
      materialIndex: -1,
      materialId: '',
      materialName: '',
      materialCode: '',
      category: '',
      unit: '',
      currentStock: 0,
      specification: '',
      quantity: '',
      dosage: ''
    },
    
    // ✅ 已选择的药品列表（支持联合用药）
    selectedMedications: [] as unknown[],
    
    // ✅ 调整治疗方案对话框
    showAdjustPlanFormDialog: false,
    adjustPlanForm: {
      treatmentPlan: '',
      reason: ''
    }
  },

  async onLoad(options: unknown) {
    const { sourceType, sourceId, diagnosisId, batchId, batchNumber: _batchNumber, treatmentId, id, abnormalRecordId, diagnosis, mode, affectedCount } = options || {}
    
    // ✅ 判断是否为查看模式
    const isViewMode = mode === 'view'
    
    this.setData({
      sourceType: sourceType || 'normal',
      sourceId: sourceId || '',
      diagnosisId: diagnosisId || '',
      treatmentId: treatmentId || id || '',
      abnormalRecordId: abnormalRecordId || '',
      viewMode: isViewMode  // ✅ 设置查看模式标记
    })
    
    // ✅ 查看模式：加载治疗详情+进展数据
    if (isViewMode && (treatmentId || id)) {
      this.loadTreatmentDetail(treatmentId || id)
      return
    }
    
    // ⚡ 性能优化：首次加载基础数据（批次和物料）
    await Promise.all([
      this.loadActiveBatches(),
      this.loadAvailableMaterials()
    ])
    
    // 如果来自异常记录，设置相关数据
    if (abnormalRecordId) {
      this.setData({
        'formData.batchId': batchId || '',  // ✅ 使用批次对象ID
        'formData.diagnosis': diagnosis ? decodeURIComponent(diagnosis) : ''
      })
      // 查找批次号用于显示
      if (batchId) {
        this.loadBatchNumberForDisplay(batchId)
      }
    } else if (sourceType === 'vaccine_tracking') {
      // 如果来自疫苗追踪，设置相关数据
      this.setData({
        'formData.batchId': batchId || '',  // ✅ 使用批次对象ID
        'formData.diagnosis': diagnosis ? decodeURIComponent(diagnosis) : '',
        'formData.affectedCount': affectedCount ? parseInt(affectedCount) : 0  // ✅ 设置受影响数量
      })
      // 查找批次号用于显示
      if (batchId) {
        this.loadBatchNumberForDisplay(batchId)
      }
    } else if (batchId) {
      this.setData({
        'formData.batchId': batchId,  // ✅ 使用批次对象ID
        'formData.affectedCount': affectedCount ? parseInt(affectedCount) : 0  // ✅ 设置受影响数量
      })
      // 查找批次号用于显示
      this.loadBatchNumberForDisplay(batchId)
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

  /**
   * ⚡ 性能优化：智能数据刷新
   * 只在以下情况才重新加载数据：
   * 1. 数据未加载过（首次进入）
   * 2. 其他页面设置了刷新标记
   */
  async onShow() {
    const { batchesLoaded, materialsLoaded } = this.data.dataLoadStatus
    
    // 检查是否需要刷新批次数据
    const needRefreshBatches = wx.getStorageSync('treatment_batches_changed')
    if (!batchesLoaded || needRefreshBatches) {
      await this.loadActiveBatches()
      if (needRefreshBatches) {
        wx.removeStorageSync('treatment_batches_changed')
      }
    } else {
    }
    
    // 检查是否需要刷新物料数据
    const needRefreshMaterials = wx.getStorageSync('treatment_materials_changed')
    if (!materialsLoaded || needRefreshMaterials) {
      await this.loadAvailableMaterials()
      if (needRefreshMaterials) {
        wx.removeStorageSync('treatment_materials_changed')
      }
    } else {
    }
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
          'formData.affectedCount': record.affectedCount || 0,  // ✅ 加载受影响数量
          'formData.notes': record.notes || '',
          'treatmentPlan.primary': record.treatmentPlan?.primary || '',
          'treatmentPlan.followUpSchedule': record.treatmentPlan?.followUpSchedule || [],
          medications: record.medications || []
        })
        
        // 加载批次号用于显示
        if (record.batchId) {
          this.loadBatchNumberForDisplay(record.batchId)
        }
      }
    } catch (error: unknown) {
      wx.hideLoading()
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      })
    }
  },

  // 加载AI诊断结果
  loadAIDiagnosisResult: async function(diagnosisId: string) {
    try {
      wx.showLoading({ title: '加载诊断信息...' })
      
      const result = await wx.cloud.callFunction({
        name: 'ai-diagnosis',
        data: {
          action: 'get_diagnosis_result',
          diagnosisId: diagnosisId
        }
      })
      
      wx.hideLoading()
      
      if (result.result && result.result.success) {
        const aiResult = result.result.data
        
        // ✅ 合并所有setData调用，提升性能
        const updateData: any = {
          'formData.diagnosis': aiResult.primaryDiagnosis || '',
          'formData.diagnosisConfidence': aiResult.confidence || 0,
          'formData.affectedCount': aiResult.affectedCount || 0,
          sourceType: 'from_ai_diagnosis'
        }
        
        // ✅ 如果有批次ID，自动选择批次
        if (aiResult.batchId) {
          updateData['formData.batchId'] = aiResult.batchId
        }
        
        // ✅ 预填充AI建议的治疗措施
        if (aiResult.treatmentRecommendation) {
          const recommendation = aiResult.treatmentRecommendation
          
          // 预填充立即措施
          if (recommendation.immediate && recommendation.immediate.length > 0) {
            updateData['treatmentPlan.primary'] = recommendation.immediate.join('；')
            updateData.treatmentPlanSource = 'ai'
          }
          
          // ✅ 保存AI建议的用药信息（仅供参考显示）
          if (recommendation.medication && recommendation.medication.length > 0) {
            updateData.aiMedicationSuggestions = recommendation.medication
          }
        }
        
        // ✅ 一次性更新所有数据
        this.setData(updateData)
        
        if (aiResult.treatmentRecommendation?.medication?.length > 0) {
            wx.showToast({
              title: '已加载AI用药建议',
              icon: 'success',
              duration: 2000
            })
        }
      } else {
        throw new Error(result.result?.message || '加载诊断信息失败')
      }
    } catch (error: unknown) {
      wx.hideLoading()
      logger.error('❌ 加载诊断信息失败:', error)
      wx.showToast({
        title: error.message || '加载诊断信息失败',
        icon: 'none',
        duration: 2000
      })
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
        
        // ✅ 保存受影响的数量（用于健康率计算）
        const affectedCount = record.affectedCount || 1
        
        // 优先使用修正后的诊断，否则使用AI诊断
        const finalDiagnosis = record.isCorrected && record.correctedDiagnosis 
          ? record.correctedDiagnosis 
          : record.diagnosis
        
        // 更新诊断结果和修正标记
        if (finalDiagnosis) {
          this.setData({
            'formData.diagnosis': finalDiagnosis,
            'formData.affectedCount': affectedCount,  // ✅ 保存受影响数量
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
          // 没有修正：预填充AI建议的措施和用药
          let aiRecommendation = record.aiRecommendation
          if (typeof aiRecommendation === 'string') {
            try {
              aiRecommendation = JSON.parse(aiRecommendation)
            } catch (e) {
              // AI建议解析失败，使用原始文本
            }
          }
          
          // ✅ 预填充立即处置措施到治疗方案（用户可修改）
          if (aiRecommendation && aiRecommendation.immediate && aiRecommendation.immediate.length > 0) {
            this.setData({
              'treatmentPlan.primary': aiRecommendation.immediate.join('；'),
              treatmentPlanSource: 'ai'
            })
          }
          
          // ✅ 提取 AI 建议的用药信息（仅显示）
          if (aiRecommendation && aiRecommendation.medication && aiRecommendation.medication.length > 0) {
            this.setData({
              aiMedicationSuggestions: aiRecommendation.medication
            })
          }
        }
        
        // 不再自动填充AI建议的药物，用户需要从库存中选择
      }
    } catch (error) {
      // 加载失败，静默处理
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
          activeBatches: result.result.data.batches || [],
          'dataLoadStatus.batchesLoaded': true // ⚡ 标记已加载
        })
      }
    } catch (error) {
      // 已移除调试日志
    }
  },

  // 根据批次ID查找批次号用于显示
  loadBatchNumberForDisplay: async function(batchId: string) {
    try {
      // 先从已加载的批次列表中查找
      const batch = this.data.activeBatches.find((b: unknown) => b._id === batchId)
      if (batch && batch.batchNumber) {
        this.setData({
          'formData.batchNumber': batch.batchNumber
        })
        return
      }
      
      // 如果没找到，从数据库查询
      const db = wx.cloud.database()
      const batchResult = await db.collection('prod_batch_entries')
        .doc(batchId)
        .field({ batchNumber: true })
        .get()
      
      if (batchResult.data && batchResult.data.batchNumber) {
        this.setData({
          'formData.batchNumber': batchResult.data.batchNumber
        })
      }
    } catch (error) {
      // 查询失败，保持使用 batchId
      logger.error('加载批次号失败:', error)
    }
  },

  // 加载可用的药品和营养品
  loadAvailableMaterials: async function() {
    try {
      
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
      
      
      const materials: unknown[] = []
      
      if (medicineResult.result && medicineResult.result.success) {
        const medicines = medicineResult.result.data.materials || []
        materials.push(...medicines.map((m: unknown) => ({
          ...m,
          categoryLabel: '药品'
        })))
      } else {
      }
      
      if (nutritionResult.result && nutritionResult.result.success) {
        const nutrition = nutritionResult.result.data.materials || []
        materials.push(...nutrition.map((m: unknown) => ({
          ...m,
          categoryLabel: '营养品'
        })))
      } else {
      }
      
      
      // 药物治疗：显示药品 + 营养品
      const filteredMaterials = materials.filter((m: unknown) => 
        m.category === '药品' || m.category === '营养品'
      )
      
      
      this.setData({
        availableMaterials: materials,
        filteredMaterials,
        'dataLoadStatus.materialsLoaded': true // ⚡ 标记已加载
      })
    } catch (error) {
      // 加载失败，静默处理
      wx.showToast({
        title: '加载库存失败',
        icon: 'none',
        duration: 2000
      })
    }
  },

  // 表单输入处理
  onFormInput(e: CustomEvent) {
    const { field } = e.currentTarget.dataset
    const { value } = e.detail
    
    this.setData({
      [`formData.${field}`]: value
    })
    
    this.validateField(field, value)
  },

  // 数字输入处理
  onNumberInput(e: CustomEvent) {
    const { field } = e.currentTarget.dataset
    const value = parseFloat(e.detail.value) || 0
    
    this.setData({
      [`formData.${field}`]: value
    })
    
    this.validateField(field, value)
  },

  // 治疗方案输入处理
  onTreatmentPlanInput(e: CustomEvent) {
    const { field } = e.currentTarget.dataset
    const { value } = e.detail
    
    this.setData({
      [`treatmentPlan.${field}`]: value
    })
  },

  // 药物日期选择
  onMedicationDateChange(e: CustomEvent) {
    const { field } = e.currentTarget.dataset
    this.setData({
      [`currentMedication.${field}`]: e.detail.value
    })
  },

  // 显示给药途径选择器
  showRouteSelector() {
    const itemList = this.data.routeOptions.map((item: { label: string; value: string }) => item.label)
    
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
    
    const itemList = this.data.activeBatches.map((batch: unknown) => batch.displayName)
    
    wx.showActionSheet({
      itemList,
      success: (res) => {
        const selectedBatch = this.data.activeBatches[res.tapIndex]
        this.setData({
          'formData.batchId': selectedBatch._id,  // ✅ 使用批次对象ID而不是批次号
          'formData.batchNumber': selectedBatch.batchNumber  // 保存批次号用于显示
        })
        this.validateField('batchId', selectedBatch._id)
      }
    })
  },

  // 选择治疗类型（直接切换）
  selectTreatmentType(e: CustomEvent) {
    const { type } = e.currentTarget.dataset
    
    // 药物治疗：显示药品 + 营养品
    const filteredMaterials = this.data.availableMaterials.filter((m: unknown) => 
      m.category === '药品' || m.category === '营养品'
    )
    
    this.setData({
      'formData.treatmentType': type,
      filteredMaterials,
      // 重置选择
      selectedMaterialIndex: -1,
      selectedMaterial: null,
      medicationQuantity: '',
      medicationDosage: ''
    })
    
    this.validateField('treatmentType', type)
  },

  // 日期选择器
  onDateChange(e: CustomEvent) {
    const { field } = e.currentTarget.dataset
    this.setData({
      [`formData.${field}`]: e.detail.value
    })
    
    // 如果是治疗开始日期变化，更新药物开始日期
    if (field === 'treatmentDate') {
      const updatedMedications = this.data.medications.map((med: Medication) => ({
        ...med,
        startDate: e.detail.value,
        endDate: this.calculateEndDate(e.detail.value, 7)
      }))
      this.setData({ medications: updatedMedications })
    }
    
    this.validateField(field, e.detail.value)
  },

  // 原生picker选择药品/营养品
  onMaterialPickerChange(e: CustomEvent) {
    const index = parseInt(e.detail.value)
    const material = this.data.filteredMaterials[index]
    
    
    this.setData({
      selectedMaterialIndex: index,
      selectedMaterial: material,
      medicationQuantity: '',
      medicationDosage: ''
    })
  },
  
  // 领取数量输入
  onMedicationQuantityInput(e: CustomEvent) {
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
  onMedicationDosageInput(e: CustomEvent) {
    this.setData({
      medicationDosage: e.detail.value
    })
  },

  // ========== ✅ 初始用药管理（多选联合用药） ==========
  
  /**
   * 初始用药 - 药品选择变化
   */
  onInitialMedicationChange: function(e: CustomEvent) {
    const index = e.detail.value
    const { filteredMaterials, initialMedications } = this.data
    
    
    if (index >= 0 && index < filteredMaterials.length) {
      const material = filteredMaterials[index]
      
      const materialId = material._id || material.id
      
      // 检查是否已经添加过该药品
      const existingIndex = initialMedications.findIndex(
        (med: unknown) => med.materialId === materialId
      )
      
      if (existingIndex >= 0) {
        return
      }
      
      // 直接添加到列表
      const newMedication = {
        materialId: materialId,
        materialName: material.name,
        materialCode: material.materialCode || material.code || '',
        category: material.category,
        unit: material.unit || '件',
        currentStock: material.currentStock || 0,
        specification: material.specification || '',
        quantity: '',
        dosage: ''
      }
      
      initialMedications.push(newMedication)
      
      
      this.setData({
        initialMedications
      })
    }
  },
  
  /**
   * 从初始用药列表中删除药品
   */
  removeInitialMedication: function(e: CustomEvent) {
    const index = e.currentTarget.dataset.index
    const { initialMedications } = this.data
    
    
    initialMedications.splice(index, 1)
    
    this.setData({
      initialMedications
    })
  },
  
  /**
   * 更新初始用药列表中药品的数量或用法
   */
  onInitialMedicationInput: function(e: CustomEvent) {
    const { index, field } = e.currentTarget.dataset
    const value = e.detail.value
    const { initialMedications } = this.data
    
    
    initialMedications[index][field] = value
    
    this.setData({
      initialMedications
    })
  },
  

  // 编辑药物
  editMedication(e: CustomEvent) {
    const { index } = e.currentTarget.dataset
    const medication = this.data.medications[index]
    
    this.setData({
      currentMedication: { ...medication, index },
      showMedicationDialog: true
    })
  },

  // 删除药物
  deleteMedication(e: CustomEvent) {
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
  onMedicationInput(e: CustomEvent) {
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
      const index = (currentMedication as unknown).index
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
  validateField(field: string, value: unknown) {
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
    // ✅ 防止重复提交
    if (this.data.submitting) {
      return
    }
    
    if (!this.validateForm()) {
      wx.showToast({
        title: '请检查表单信息',
        icon: 'none'
      })
      return
    }
    
    // ✅ 使用新的多选用药列表
    const { initialMedications } = this.data
    let finalMedications: unknown[] = []
    
    
    // 验证并转换initialMedications
    if (initialMedications.length > 0) {
      
      for (let i = 0; i < initialMedications.length; i++) {
        const med = initialMedications[i]
        
        // 验证数量
        if (!med.quantity || parseFloat(med.quantity) <= 0) {
          wx.showToast({
            title: `请输入${med.materialName}的数量`,
            icon: 'none'
          })
          return
        }
        
        const quantity = parseFloat(med.quantity)
        
        // 验证库存
        if (quantity > med.currentStock) {
          wx.showToast({
            title: `${med.materialName}库存不足，当前库存：${med.currentStock}${med.unit}`,
            icon: 'none',
            duration: 2000
          })
          return
        }
        
        // 添加到提交列表
        const medication = {
          materialId: med.materialId,
          name: med.materialName,
          specification: med.specification || '',
          quantity: quantity,
          unit: med.unit || '件',
          dosage: med.dosage || '',
          startDate: this.data.formData.treatmentDate,
          category: med.category
        }
        
        finalMedications.push(medication)
      }
    }
    
    
    // ✅ 同步更新 medications 到 data（仅用于页面显示）
    this.setData({ 
      medications: finalMedications,
      submitting: true 
    })
    
    try {
      const { isDraft, isEditMode, treatmentId } = this.data
      
      // 如果是草稿状态（从异常记录创建的治疗记录），需要调用 submit_treatment_plan
      if (isDraft && isEditMode && treatmentId) {
        await this.submitTreatmentPlan()
      } else {
        // ✅ 传递 finalMedications 给创建函数
        await this.createTreatmentRecord(finalMedications)
      }
    } catch (error: unknown) {
      // 提交失败，已显示错误提示
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
    const { treatmentId, abnormalRecordId, formData } = this.data
    
    // 1. 先更新治疗记录的详细信息
    await this.updateTreatmentRecord()
    
    // 2. 调用 submit_treatment_plan 接口，更新异常记录状态
    const result = await wx.cloud.callFunction({
      name: 'health-management',
      data: {
        action: 'submit_treatment_plan',
        treatmentId: treatmentId,
        abnormalRecordId: abnormalRecordId,
        treatmentType: formData.treatmentType  // medication
      }
    })
    
    if (result.result && result.result.success) {
      wx.showToast({
        title: '治疗方案提交成功',
        icon: 'success'
      })
      
      // 返回健康管理中心
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/health/health',
          success: () => {
            // ✅ 通知健康页面刷新数据
            this.notifyHealthPageRefresh()
          }
        })
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
  createTreatmentRecord: async function(finalMedications?: unknown[]) {
    const { formData, treatmentPlan, abnormalRecordId } = this.data
    // ✅ 优先使用传入的 medications，否则使用 this.data.medications
    const medications = finalMedications || this.data.medications
    
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
      ? 'create_treatment_from_abnormal'
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
        affectedCount: formData.affectedCount || 1,  // ✅ 传递受影响的动物数量
        treatmentPlan,
        medications,
        hasMedications: medications.length > 0,  // ✅ 使用 medications 长度判断
        notes: formData.notes,
        isDirectSubmit: true  // ✅ 添加缺失的参数
      } : {
        action,
        ...treatmentRecord,
        affectedCount: formData.affectedCount || 1,  // ✅ 传递受影响的动物数量
        sourceType: this.data.sourceType,
        sourceId: this.data.sourceId,
        diagnosisId: this.data.diagnosisId,
        isDirectSubmit: true  // ✅ 添加缺失的参数
      }
    })
    
    
    if (result.result && result.result.success) {
      // ✅ 保存治疗记录编号到页面数据
      if (result.result.data && result.result.data.treatmentNumber) {
        this.setData({
          'formData.treatmentNumber': result.result.data.treatmentNumber
        })
      }
      
      wx.showToast({
        title: '治疗记录创建成功',
        icon: 'success'
      })
      
      // 返回健康管理中心
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/health/health',
          success: () => {
            // ✅ 通知健康页面刷新数据
            this.notifyHealthPageRefresh()
          }
        })
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
              affectedCount: 0,  // ✅ 重置受影响数量
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
    // 防止重复触发
    if ((this as unknown).__isNavigatingBack) {
      return
    }
    
    (this as unknown).__isNavigatingBack = true
    
    wx.navigateBack({
      delta: 1,
      complete: () => {
        // 500ms后清除标志
        setTimeout(() => {
          (this as unknown).__isNavigatingBack = false
        }, 500)
      },
      fail: () => {
        // 返回失败，跳转到健康管理页
        wx.switchTab({
          url: '/pages/health/health'
        })
      }
    })
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
              // ✅ 设置刷新标志，通知健康页面刷新
              setHealthPageRefreshFlag()
              
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
    } catch (error: unknown) {
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
  },

  // ========== ✅ 查看模式相关方法 ==========
  
  /**
   * 加载治疗记录详情（查看模式）
   */
  loadTreatmentDetail: async function(treatmentId: string) {
    try {
      wx.showLoading({ title: '加载中...' })
      
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_treatment_detail',
          treatmentId: treatmentId
        }
      })
      
      wx.hideLoading()
      
      if (result.result && result.result.success) {
        const { treatment, progress } = result.result.data
        
        
        // 填充治疗基本信息（只读）
        this.setData({
          'formData.batchId': treatment.batchId,
          'formData.treatmentDate': treatment.treatmentDate,
          'formData.treatmentType': treatment.treatmentType,
          'formData.diagnosis': treatment.diagnosis?.confirmed || treatment.diagnosis?.preliminary || '',
          'formData.diagnosisConfidence': treatment.diagnosis?.confidence || 0,
          'formData.notes': treatment.notes || '',
          'treatmentPlan.primary': treatment.treatmentPlan?.primary || '',
          medications: treatment.medications || [],
          treatmentProgress: progress
        })
        
        // 加载批次号用于显示
        if (treatment.batchId) {
          this.loadBatchNumberForDisplay(treatment.batchId)
        }
      } else {
        throw new Error(result.result?.error || '加载失败')
      }
    } catch (error: unknown) {
      wx.hideLoading()
      // 加载失败，已显示错误提示
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      })
    }
  },

  /**
   * 显示进展对话框
   */
  showProgressDialog(e: CustomEvent) {
    const { type } = e.currentTarget.dataset
    
    // 检查剩余数量
    if (this.data.treatmentProgress.remainingCount <= 0) {
      wx.showToast({
        title: '治疗已完成，无需继续记录',
        icon: 'none'
      })
      return
    }
    
    this.setData({
      showProgressDialog: true,
      progressDialogType: type,
      'progressForm.count': '',
      'progressForm.notes': '',
      'progressForm.deathCause': ''
    })
  },

  /**
   * 关闭进展对话框
   */
  closeProgressDialog() {
    this.setData({
      showProgressDialog: false,
      progressDialogType: '',
      'progressForm.count': '',
      'progressForm.notes': '',
      'progressForm.deathCause': ''
    })
  },

  /**
   * 进展表单输入
   */
  onProgressFormInput(e: CustomEvent) {
    const { field } = e.currentTarget.dataset
    const value = e.detail.value
    this.setData({
      [`progressForm.${field}`]: value
    })
  },
  
  /**
   * ✅ 一键填入全部剩余数量
   */
  fillAllCount() {
    const { remainingCount } = this.data.treatmentProgress
    this.setData({
      'progressForm.count': String(remainingCount)
    })
  },
  
  /**
   * 阻止遮罩层滑动穿透
   */
  preventTouchMove() {
    return false
  },

  /**
   * 提交治疗进展
   */
  submitProgress: async function() {
    try {
      const { progressDialogType, progressForm, treatmentProgress, treatmentId } = this.data
      
      // 验证数量
      const count = parseInt(progressForm.count)
      if (!count || count <= 0) {
        wx.showToast({
          title: '请输入正确的数量',
          icon: 'none'
        })
        return
      }
      
      if (count > treatmentProgress.remainingCount) {
        wx.showToast({
          title: `数量不能超过${treatmentProgress.remainingCount}`,
          icon: 'none'
        })
        return
      }
      
      wx.showLoading({ title: '提交中...' })
      
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'update_treatment_progress',
          treatmentId: treatmentId,
          progressType: progressDialogType,
          count: count,
          notes: progressForm.notes,
          deathCause: progressForm.deathCause
        }
      })
      
      wx.hideLoading()
      
      if (result.result && result.result.success) {
        const { remainingCount, newStatus } = result.result.data || {}
        
        // ✅ 根据剩余数量显示不同的提示
        let successMessage = result.result.message || '记录成功'
        if (remainingCount > 0) {
          successMessage += `，剩余${remainingCount}只继续治疗`
        } else if (newStatus === 'cured') {
          successMessage = '🎉 全部治愈，治疗完成！'
        } else if (newStatus === 'died') {
          successMessage = '治疗记录已完成（全部死亡）'
        } else {
          successMessage = '治疗记录已完成'
        }
        
        // ✅ 设置刷新标志，通知健康页面刷新
        setHealthPageRefreshFlag()
        
        wx.showToast({
          title: successMessage,
          icon: remainingCount === 0 && newStatus === 'cured' ? 'success' : 'none',
          duration: 2000
        })
        
        // 关闭对话框
        this.closeProgressDialog()
        
        // ✅ 使用EventChannel通知上一页刷新数据（微信小程序最佳实践）
        try {
          const eventChannel = this.getOpenerEventChannel()
          if (eventChannel) {
            eventChannel.emit('treatmentProgressUpdated', {
              type: progressDialogType,
              count: count,
              newStatus: newStatus
            })
            // 已通过EventChannel通知上一页刷新数据
          }
        } catch (error) {
          // EventChannel通知失败，使用降级方案
          // 降级方案：使用Storage标记
          setHealthPageRefreshFlag()
        }
        
        // 重新加载治疗详情
        setTimeout(() => {
          this.loadTreatmentDetail(treatmentId)
        }, 1000)
      } else {
        throw new Error(result.result?.error || '提交失败')
      }
    } catch (error: unknown) {
      wx.hideLoading()
      // 提交失败，已显示错误提示
      wx.showToast({
        title: error.message || '提交失败',
        icon: 'none'
      })
    }
  },
  
  // ========== ✅ 继续治疗功能 ==========
  
  /**
   * 显示继续治疗选项
   */
  showContinueTreatmentOptions: async function() {
    
    // 如果还没有加载物料，先加载
    if (this.data.availableMaterials.length === 0) {
      await this.loadAvailableMaterials()
    }
    
    // 药物治疗：显示药品 + 营养品
    const { availableMaterials } = this.data
    const filteredMaterials = availableMaterials.filter((m: unknown) => 
      m.category === '药品' || m.category === '营养品'
    )
    
    this.setData({
      showContinueTreatmentDialog: true,
      filteredMaterials
    })
  },
  
  /**
   * 关闭继续治疗对话框
   */
  closeContinueTreatmentDialog: function() {
    this.setData({
      showContinueTreatmentDialog: false,
      // 重置表单
      'noteForm.content': '',
      selectedMedications: [],
      'addMedicationForm.materialId': '',
      'addMedicationForm.materialName': '',
      'addMedicationForm.quantity': '',
      'addMedicationForm.dosage': '',
      'addMedicationForm.materialIndex': -1,
      'addMedicationForm.currentStock': 0,
      'addMedicationForm.unit': '',
      'addMedicationForm.materialCode': '',
      'addMedicationForm.category': '',
      'addMedicationForm.specification': ''
    })
  },
  
  /**
   * 提交一体化表单
   */
  submitContinueTreatment: async function() {
    try {
      const { noteForm, selectedMedications, treatmentId } = this.data
      
      // 检查是否至少填写了一项
      const hasNote = noteForm.content && noteForm.content.trim()
      const hasMedications = selectedMedications.length > 0
      
      if (!hasNote && !hasMedications) {
        wx.showToast({
          title: '请至少填写一项内容',
          icon: 'none'
        })
        return
      }
      
      // 验证已选择的药品
      if (hasMedications) {
        for (let i = 0; i < selectedMedications.length; i++) {
          const med = selectedMedications[i]
          if (!med.quantity || parseFloat(med.quantity) <= 0) {
            wx.showToast({
              title: `请输入${med.materialName}的数量`,
              icon: 'none'
            })
            return
          }
          
          const quantity = parseFloat(med.quantity)
          if (quantity > med.currentStock) {
            wx.showToast({
              title: `${med.materialName}库存不足`,
              icon: 'none',
              duration: 2000
            })
            return
          }
        }
      }
      
      wx.showLoading({ title: '提交中...' })
      
      // 依次处理每项内容
      const results: unknown[] = []
      
      // 1. 提交治疗笔记
      if (hasNote) {
        const noteResult = await wx.cloud.callFunction({
          name: 'health-management',
          data: {
            action: 'add_treatment_note',
            treatmentId: treatmentId,
            note: {
              content: noteForm.content,
              recordDate: new Date().toISOString().split('T')[0]
            }
          }
        })
        results.push({ type: '治疗笔记', success: noteResult.result?.success })
      }
      
      // 2. 批量追加用药
      if (hasMedications) {
        
        for (let i = 0; i < selectedMedications.length; i++) {
          const med = selectedMedications[i]
          const quantity = parseFloat(med.quantity)
          
          const medResult = await wx.cloud.callFunction({
            name: 'health-management',
            data: {
              action: 'add_treatment_medication',
              treatmentId: treatmentId,
              medication: {
                materialId: med.materialId,
                name: med.materialName,
                materialCode: med.materialCode,
                category: med.category,
                unit: med.unit,
                quantity: quantity,
                dosage: med.dosage || ''
              }
            }
          })
          
          
          if (!medResult.result?.success) {
            // 追加用药失败，继续处理下一条
          }
          
          results.push({ 
            type: `追加用药-${med.materialName}`, 
            success: medResult.result?.success,
            message: medResult.result?.message || medResult.result?.error
          })
        }
      }
      
      wx.hideLoading()
      
      // 检查结果
      const allSuccess = results.every(r => r.success)
      const successCount = results.filter(r => r.success).length
      const failedItems = results.filter(r => !r.success)
      
      
      if (allSuccess) {
        wx.showToast({
          title: `成功提交${successCount}项`,
          icon: 'success'
        })
        
        this.closeContinueTreatmentDialog()
        
        // 重新加载治疗详情
        setTimeout(() => {
          this.loadTreatmentDetail(treatmentId)
        }, 1000)
      } else if (successCount > 0) {
        // 部分成功
        const failedNames = failedItems.map(item => item.type).join('、')
        wx.showModal({
          title: '部分提交成功',
          content: `${successCount}项成功，${failedItems.length}项失败（${failedNames}）\n\n失败原因：${failedItems[0].message || '未知错误'}`,
          showCancel: false,
          confirmText: '知道了',
          success: () => {
            if (successCount > 0) {
              this.closeContinueTreatmentDialog()
              this.loadTreatmentDetail(treatmentId)
            }
          }
        })
      } else {
        // 全部失败
        const failedNames = failedItems.map(item => item.type).join('、')
        wx.showModal({
          title: '提交失败',
          content: `${failedNames}提交失败\n\n失败原因：${failedItems[0].message || '未知错误'}`,
          showCancel: true,
          cancelText: '关闭',
          confirmText: '重试'
        })
      }
    } catch (error: unknown) {
      wx.hideLoading()
      // 提交失败，已显示错误提示
      wx.showToast({
        title: error.message || '提交失败',
        icon: 'none'
      })
    }
  },
  
  // ========== ✅ 治疗笔记功能 ==========
  
  /**
   * 显示添加笔记对话框
   */
  showAddNoteDialog: function() {
    this.setData({
      showContinueTreatmentDialog: false,
      showNoteDialog: true,
      noteForm: {
        content: ''
      }
    })
  },
  
  /**
   * 关闭笔记对话框
   */
  closeNoteDialog: function() {
    this.setData({
      showNoteDialog: false,
      noteForm: {
        content: ''
      }
    })
  },
  
  /**
   * 笔记表单输入
   */
  onNoteFormInput: function(e: CustomEvent) {
    const { field } = e.currentTarget.dataset
    const { value } = e.detail
    this.setData({
      [`noteForm.${field}`]: value
    })
  },
  
  /**
   * 提交治疗笔记
   */
  submitTreatmentNote: async function() {
    try {
      const { noteForm, treatmentId } = this.data
      
      if (!noteForm.content) {
        wx.showToast({
          title: '请填写治疗笔记',
          icon: 'none'
        })
        return
      }
      
      wx.showLoading({ title: '保存中...' })
      
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'add_treatment_note',
          treatmentId: treatmentId,
          note: noteForm.content
        }
      })
      
      wx.hideLoading()
      
      if (result.result && result.result.success) {
        wx.showToast({
          title: '笔记保存成功',
          icon: 'success'
        })
        
        this.closeNoteDialog()
        
        // 重新加载治疗详情
        setTimeout(() => {
          this.loadTreatmentDetail(treatmentId)
        }, 1000)
      } else {
        throw new Error(result.result?.error || '保存失败')
      }
    } catch (error: unknown) {
      wx.hideLoading()
      // 保存失败，已显示错误提示
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none'
      })
    }
  },
  
  // ========== ✅ 追加用药功能 ==========
  
  /**
   * 显示追加用药对话框
   */
  showAddMedicationDialog: async function() {
    
    // 如果还没有加载物料，先加载
    if (this.data.availableMaterials.length === 0) {
      await this.loadAvailableMaterials()
    }
    
    // 药物治疗：显示药品 + 营养品
    const { availableMaterials } = this.data
    const filteredMaterials = availableMaterials.filter((m: unknown) => 
      m.category === '药品' || m.category === '营养品'
    )
    
    this.setData({
      showContinueTreatmentDialog: false,
      showAddMedicationFormDialog: true,
      filteredMaterials,
      addMedicationForm: {
        materialIndex: -1,
        materialId: '',
        materialName: '',
        materialCode: '',
        category: '',
        unit: '',
        currentStock: 0,
        quantity: '',
        dosage: ''
      }
    })
  },
  
  /**
   * 关闭追加用药对话框
   */
  closeAddMedicationDialog: function() {
    this.setData({
      showAddMedicationFormDialog: false,
      addMedicationForm: {
        materialIndex: -1,
        materialId: '',
        materialName: '',
        materialCode: '',
        category: '',
        unit: '',
        currentStock: 0,
        quantity: '',
        dosage: ''
      }
    })
  },
  
  /**
   * 追加用药 - 药品选择变化（✅ 与首次用药逻辑保持一致）
   */
  onAddMedicationMaterialChange: function(e: CustomEvent) {
    const index = e.detail.value
    const { filteredMaterials, selectedMedications } = this.data
    
    
    if (index >= 0 && index < filteredMaterials.length) {
      const material = filteredMaterials[index]
      
      const materialId = material._id || material.id
      
      // ✅ 检查是否已经添加过该药品
      const existingIndex = selectedMedications.findIndex(
        (med: unknown) => med.materialId === materialId
      )
      
      if (existingIndex >= 0) {
        return
      }
      
      // ✅ 直接添加到列表（与首次用药逻辑一致）
      const newMedication = {
        materialId: materialId,
        materialName: material.name,
        materialCode: material.materialCode || material.code || '',
        category: material.category,
        unit: material.unit || '件',
        currentStock: material.currentStock || 0,
        specification: material.specification || '',
        quantity: '',
        dosage: ''
      }
      
      selectedMedications.push(newMedication)
      
      
      this.setData({
        selectedMedications
      })
    }
  },
  
  /**
   * 将选中的药品添加到列表
   */
  addMedicationToList: function() {
    const { addMedicationForm, selectedMedications } = this.data
    
    // 检查是否已经添加过该药品
    const existingIndex = selectedMedications.findIndex(
      (med: unknown) => med.materialId === addMedicationForm.materialId
    )
    
    if (existingIndex >= 0) {
      wx.showToast({
        title: '该药品已在列表中',
        icon: 'none'
      })
      return
    }
    
    // 添加到列表
    const newMedication = {
      materialId: addMedicationForm.materialId,
      materialName: addMedicationForm.materialName,
      materialCode: addMedicationForm.materialCode,
      category: addMedicationForm.category,
      unit: addMedicationForm.unit,
      currentStock: addMedicationForm.currentStock,
      specification: addMedicationForm.specification,
      quantity: '',
      dosage: ''
    }
    
    selectedMedications.push(newMedication)
    
    
    this.setData({
      selectedMedications,
      // 重置选择器
      'addMedicationForm.materialIndex': -1,
      'addMedicationForm.materialId': '',
      'addMedicationForm.materialName': '',
      'addMedicationForm.materialCode': '',
      'addMedicationForm.category': '',
      'addMedicationForm.unit': '',
      'addMedicationForm.currentStock': 0,
      'addMedicationForm.specification': ''
    })
    
    wx.showToast({
      title: '已添加',
      icon: 'success',
      duration: 1000
    })
  },
  
  /**
   * 从列表中删除药品
   */
  removeMedication: function(e: CustomEvent) {
    const index = e.currentTarget.dataset.index
    const { selectedMedications } = this.data
    
    
    selectedMedications.splice(index, 1)
    
    this.setData({
      selectedMedications
    })
    
    wx.showToast({
      title: '已删除',
      icon: 'success',
      duration: 1000
    })
  },
  
  /**
   * 更新已选药品的数量或用法
   */
  onSelectedMedicationInput: function(e: CustomEvent) {
    const { index, field } = e.currentTarget.dataset
    const value = e.detail.value
    const { selectedMedications } = this.data
    
    
    selectedMedications[index][field] = value
    
    this.setData({
      selectedMedications
    })
  },
  
  /**
   * 追加用药 - 表单输入
   */
  onAddMedicationFormInput: function(e: CustomEvent) {
    const { field } = e.currentTarget.dataset
    const { value } = e.detail
    this.setData({
      [`addMedicationForm.${field}`]: value
    })
  },
  
  /**
   * 提交追加用药
   */
  submitAddMedication: async function() {
    try {
      const { addMedicationForm, treatmentId } = this.data
      
      // 验证
      if (!addMedicationForm.materialId) {
        wx.showToast({
          title: '请选择药品',
          icon: 'none'
        })
        return
      }
      
      const quantity = parseInt(addMedicationForm.quantity)
      if (!quantity || quantity <= 0) {
        wx.showToast({
          title: '请输入正确的数量',
          icon: 'none'
        })
        return
      }
      
      if (quantity > addMedicationForm.currentStock) {
        wx.showToast({
          title: '库存不足',
          icon: 'none'
        })
        return
      }
      
      wx.showLoading({ title: '追加中...' })
      
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'add_treatment_medication',
          treatmentId: treatmentId,
          medication: {
            materialId: addMedicationForm.materialId,
            name: addMedicationForm.materialName,
            materialCode: addMedicationForm.materialCode,
            category: addMedicationForm.category,
            unit: addMedicationForm.unit,
            quantity: quantity,
            dosage: addMedicationForm.dosage || ''
          }
        }
      })
      
      wx.hideLoading()
      
      if (result.result && result.result.success) {
        wx.showToast({
          title: '用药追加成功',
          icon: 'success'
        })
        
        this.closeAddMedicationDialog()
        
        // ✅ 清除健康管理主页面缓存，确保返回时显示最新数据
        try {
          wx.removeStorageSync('health_cache_all_batches_snapshot_v1')
        } catch (error) {
          // 清除缓存失败不影响主流程
        }
        
        // 重新加载治疗详情
        setTimeout(() => {
          this.loadTreatmentDetail(treatmentId)
        }, 1000)
      } else {
        throw new Error(result.result?.error || '追加失败')
      }
    } catch (error: unknown) {
      wx.hideLoading()
      // 追加用药失败，已显示错误提示
      wx.showToast({
        title: error.message || '追加失败',
        icon: 'none'
      })
    }
  },
  
  // ========== ✅ 调整治疗方案功能 ==========
  
  /**
   * 显示调整方案对话框
   */
  showAdjustPlanDialog: function() {
    const { treatmentPlan } = this.data
    
    this.setData({
      showContinueTreatmentDialog: false,
      showAdjustPlanFormDialog: true,
      adjustPlanForm: {
        treatmentPlan: treatmentPlan.primary || '',
        reason: ''
      }
    })
  },
  
  /**
   * 关闭调整方案对话框
   */
  closeAdjustPlanDialog: function() {
    this.setData({
      showAdjustPlanFormDialog: false,
      adjustPlanForm: {
        treatmentPlan: '',
        reason: ''
      }
    })
  },
  
  /**
   * 调整方案 - 表单输入
   */
  onAdjustPlanFormInput: function(e: CustomEvent) {
    const { field } = e.currentTarget.dataset
    const { value } = e.detail
    this.setData({
      [`adjustPlanForm.${field}`]: value
    })
  },
  
  /**
   * 提交调整方案
   */
  submitAdjustPlan: async function() {
    try {
      const { adjustPlanForm, treatmentId } = this.data
      
      if (!adjustPlanForm.treatmentPlan) {
        wx.showToast({
          title: '请填写治疗方案',
          icon: 'none'
        })
        return
      }
      
      wx.showLoading({ title: '保存中...' })
      
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'update_treatment_plan',
          treatmentId: treatmentId,
          treatmentPlan: adjustPlanForm.treatmentPlan,
          adjustReason: adjustPlanForm.reason
        }
      })
      
      wx.hideLoading()
      
      if (result.result && result.result.success) {
        wx.showToast({
          title: '方案调整成功',
          icon: 'success'
        })
        
        this.closeAdjustPlanDialog()
        
        // 重新加载治疗详情
        setTimeout(() => {
          this.loadTreatmentDetail(treatmentId)
        }, 1000)
      } else {
        throw new Error(result.result?.error || '保存失败')
      }
    } catch (error: unknown) {
      wx.hideLoading()
      // 调整方案失败，已显示错误提示
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none'
      })
    }
  },
  
  /**
   * 通知健康页面刷新数据
   */
  notifyHealthPageRefresh: function() {
    try {
      // 通过页面栈获取健康页面实例
      const pages = getCurrentPages()
      const healthPage = pages.find((page: unknown) => page.route === 'pages/health/health')
      
      if (healthPage && typeof healthPage.loadHealthData === 'function') {
        // 延迟刷新，确保数据已保存
        setTimeout(() => {
          healthPage.loadHealthData()
        }, 500)
      } else {
        // 如果页面不在栈中，使用存储标记
        setHealthPageRefreshFlag()
      }
    } catch (error) {
      // 通知失败，静默处理
      // 降级方案：使用存储标记
      setHealthPageRefreshFlag()
    }
  }
}

Page(createPageWithNavbar(pageConfig))
