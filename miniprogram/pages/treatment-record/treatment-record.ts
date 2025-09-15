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
      healthRecordId: '', // 关联的健康记录ID
      batchId: '',
      animalIds: [] as string[],
      treatmentDate: '',
      treatmentType: 'medication', // medication|surgery|isolation|supportive
      diagnosis: '',
      diagnosisConfidence: 0,
      veterinarianId: '',
      veterinarianName: '',
      treatmentDuration: 7,
      expectedRecoveryTime: '',
      notes: ''
    },
    
    // 治疗方案
    treatmentPlan: {
      primary: '',
      secondary: [] as string[],
      followUpSchedule: [] as string[]
    },
    
    // 用药记录
    medications: [] as Medication[],
    
    // 治疗进展记录
    progressRecords: [] as Array<{
      id: string
      date: string
      day: number
      symptoms: string
      temperature: number
      appetite: 'poor' | 'fair' | 'good' | 'excellent'
      notes: string
      operator: string
    }>,
    
    // 治疗类型选项
    treatmentTypeOptions: [
      { label: '药物治疗', value: 'medication', icon: 'service', desc: '使用药物进行治疗' },
      { label: '手术治疗', value: 'surgery', icon: 'precise-monitor', desc: '外科手术治疗' },
      { label: '隔离观察', value: 'isolation', icon: 'location', desc: '隔离观察治疗' },
      { label: '支持疗法', value: 'supportive', icon: 'heart', desc: '营养支持等辅助治疗' }
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
    
    // 食欲评分选项
    appetiteOptions: [
      { label: '差', value: 'poor', color: '#e34d59' },
      { label: '一般', value: 'fair', color: '#ed7b2f' },
      { label: '良好', value: 'good', color: '#0052d9' },
      { label: '优秀', value: 'excellent', color: '#00a870' }
    ],
    
    // 活跃批次和健康记录
    activeBatches: [] as any[],
    healthRecords: [] as any[],
    
    // 页面状态
    loading: false,
    submitting: false,
    showTreatmentTypePicker: false,
    showMedicationDialog: false,
    showProgressDialog: false,
    currentMedication: null as Medication | null,
    currentProgress: null as any,
    
    // 表单验证
    formErrors: {} as Record<string, string>,
    
    // 来源数据
    sourceType: 'normal', // normal|from_ai_diagnosis|from_health_record
    sourceId: '',
    diagnosisId: '' // AI诊断ID
  },

  onLoad(options: any) {
    const { sourceType, sourceId, diagnosisId, healthRecordId, batchId } = options || {}
    
    this.setData({
      sourceType: sourceType || 'normal',
      sourceId: sourceId || '',
      diagnosisId: diagnosisId || ''
    })
    
    if (healthRecordId) {
      this.setData({
        'formData.healthRecordId': healthRecordId
      })
    }
    
    if (batchId) {
      this.setData({
        'formData.batchId': batchId
      })
    }
    
    this.initializeForm()
    
    // 如果来自AI诊断，加载诊断结果
    if (diagnosisId) {
      this.loadAIDiagnosisResult(diagnosisId)
    }
  },

  async onShow() {
    await Promise.all([
      this.loadActiveBatches(),
      this.loadHealthRecords()
    ])
  },

  // 初始化表单
  initializeForm() {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    
    // 计算预期康复时间（默认7天后）
    const expectedDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const expectedRecoveryTime = expectedDate.toISOString().split('T')[0]
    
    this.setData({
      'formData.treatmentDate': today,
      'formData.expectedRecoveryTime': expectedRecoveryTime,
      'formData.veterinarianName': '当前兽医'
    })
  },

  // 加载AI诊断结果
  async loadAIDiagnosisResult(diagnosisId: string) {
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
          'formData.diagnosisConfidence': aiResult.confidence || 0,
          'formData.healthRecordId': aiResult.healthRecordId || ''
        })
        
        // 如果有治疗建议，填充治疗方案
        if (aiResult.treatmentRecommendation) {
          const recommendation = aiResult.treatmentRecommendation
          this.setData({
            'treatmentPlan.primary': recommendation.primary || '',
            'treatmentPlan.secondary': recommendation.secondary || [],
            'treatmentPlan.followUpSchedule': recommendation.followUp ? [recommendation.followUp] : []
          })
          
          // 填充推荐药物
          if (recommendation.medications && recommendation.medications.length > 0) {
            const medications = recommendation.medications.map((med: any) => ({
              name: med.name,
              dosage: med.dosage,
              route: med.route,
              frequency: med.frequency,
              startDate: this.data.formData.treatmentDate,
              endDate: this.calculateEndDate(this.data.formData.treatmentDate, 7),
              status: 'ongoing'
            }))
            this.setData({ medications })
          }
        }
      }
    } catch (error) {
      // 已移除调试日志
    }
  },

  // 计算结束日期
  calculateEndDate(startDate: string, duration: number): string {
    const start = new Date(startDate)
    const end = new Date(start.getTime() + duration * 24 * 60 * 60 * 1000)
    return end.toISOString().split('T')[0]
  },

  // 加载活跃批次
  async loadActiveBatches() {
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

  // 加载健康记录
  async loadHealthRecords() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: { 
          action: 'list_health_records',
          result: 'ongoing',
          pageSize: 50
        }
      })
      
      if (result.result && result.result.success) {
        this.setData({
          healthRecords: result.result.data.records || []
        })
      }
    } catch (error) {
      // 已移除调试日志
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
    
    if (field === 'secondary') {
      // 分号分隔的辅助方案
      const secondaryArray = value.split('；').filter((item: string) => item.trim())
      this.setData({
        'treatmentPlan.secondary': secondaryArray
      })
    } else {
      this.setData({
        [`treatmentPlan.${field}`]: value
      })
    }
  },

  // 药物日期选择
  onMedicationDateChange(e: any) {
    const { field } = e.currentTarget.dataset
    this.setData({
      [`currentMedication.${field}`]: e.detail.value
    })
  },

  // 进展日期选择
  onProgressDateChange(e: any) {
    this.setData({
      'currentProgress.date': e.detail.value
    })
  },

  // 食欲评估选择
  onAppetiteChange(e: any) {
    const { appetite } = e.currentTarget.dataset
    this.setData({
      'currentProgress.appetite': appetite
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

  // 显示健康记录选择器
  showHealthRecordSelector() {
    if (this.data.healthRecords.length === 0) {
      wx.showToast({
        title: '暂无待治疗记录',
        icon: 'none'
      })
      return
    }
    
    const itemList = this.data.healthRecords.map(record => 
      `${record.batchNumber} - ${record.symptoms} (${record.affectedCount}只)`
    )
    
    wx.showActionSheet({
      itemList,
      success: (res) => {
        const selectedRecord = this.data.healthRecords[res.tapIndex]
        this.setData({
          'formData.healthRecordId': selectedRecord._id,
          'formData.batchId': selectedRecord.batchNumber,
          'formData.diagnosis': selectedRecord.diagnosisDisease || ''
        })
        this.validateField('healthRecordId', selectedRecord._id)
      }
    })
  },

  // 治疗类型选择器
  showTreatmentTypeSelector() {
    this.setData({ showTreatmentTypePicker: true })
  },

  onTreatmentTypePickerChange(e: any) {
    const index = e.detail.value
    const selectedType = this.data.treatmentTypeOptions[index]
    
    this.setData({
      'formData.treatmentType': selectedType.value,
      showTreatmentTypePicker: false
    })
  },

  onTreatmentTypePickerCancel() {
    this.setData({ showTreatmentTypePicker: false })
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
        endDate: this.calculateEndDate(e.detail.value, this.data.formData.treatmentDuration)
      }))
      this.setData({ medications: updatedMedications })
    }
    
    this.validateField(field, e.detail.value)
  },

  // 添加药物
  showAddMedicationDialog() {
    this.setData({
      currentMedication: {
        name: '',
        dosage: '',
        route: 'oral',
        frequency: '',
        startDate: this.data.formData.treatmentDate,
        endDate: this.calculateEndDate(this.data.formData.treatmentDate, this.data.formData.treatmentDuration),
        status: 'ongoing'
      },
      showMedicationDialog: true
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

  // 添加治疗进展记录
  showAddProgressDialog() {
    const progressCount = this.data.progressRecords.length
    
    this.setData({
      currentProgress: {
        id: `progress_${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        day: progressCount + 1,
        symptoms: '',
        temperature: 0,
        appetite: 'fair',
        notes: '',
        operator: '当前操作员'
      },
      showProgressDialog: true
    })
  },

  // 治疗进展表单输入处理
  onProgressInput(e: any) {
    const { field } = e.currentTarget.dataset
    const { value } = e.detail
    
    this.setData({
      [`currentProgress.${field}`]: field === 'temperature' ? (parseFloat(value) || 0) : value
    })
  },

  // 保存治疗进展
  saveProgress() {
    const { currentProgress } = this.data
    
    if (!currentProgress || !currentProgress.symptoms) {
      wx.showToast({
        title: '请填写症状观察',
        icon: 'none'
      })
      return
    }
    
    const progressRecords = [...this.data.progressRecords, currentProgress]
    
    this.setData({
      progressRecords,
      showProgressDialog: false,
      currentProgress: null
    })
  },

  // 取消进展记录
  cancelProgressEdit() {
    this.setData({
      showProgressDialog: false,
      currentProgress: null
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
      case 'veterinarianName':
        if (!value || value.trim().length === 0) {
          errors[field] = '请输入主治兽医'
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
    if (!formData.veterinarianName) errors.veterinarianName = '请输入主治兽医'
    
    // 至少需要一个治疗方案
    if (!this.data.treatmentPlan.primary && this.data.medications.length === 0) {
      errors.treatmentPlan = '请制定治疗方案或添加药物'
    }
    
    this.setData({ formErrors: errors })
    return Object.keys(errors).length === 0
  },

  // 提交表单
  async submitForm() {
    if (!this.validateForm()) {
      wx.showToast({
        title: '请检查表单信息',
        icon: 'none'
      })
      return
    }
    
    this.setData({ submitting: true })
    
    try {
      const { formData, treatmentPlan, medications, progressRecords } = this.data
      
      // 构建治疗记录数据
      const treatmentRecord = {
        healthRecordId: formData.healthRecordId,
        batchId: formData.batchId,
        animalIds: formData.animalIds,
        treatmentDate: formData.treatmentDate,
        treatmentType: formData.treatmentType,
        diagnosis: {
          preliminary: formData.diagnosis,
          confirmed: formData.diagnosis,
          confidence: formData.diagnosisConfidence,
          diagnosisMethod: this.data.sourceType === 'from_ai_diagnosis' ? 'ai' : 'manual',
          veterinarianId: formData.veterinarianId
        },
        veterinarianId: formData.veterinarianId,
        veterinarianName: formData.veterinarianName,
        treatmentPlan: {
          primary: treatmentPlan.primary,
          secondary: treatmentPlan.secondary,
          duration: formData.treatmentDuration,
          followUpSchedule: treatmentPlan.followUpSchedule
        },
        medications,
        progress: progressRecords,
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
        expectedRecoveryTime: formData.expectedRecoveryTime,
        notes: formData.notes
      }
      
      // 调用云函数创建治疗记录
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'create_treatment_record',
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
        
        // 如果关联了健康记录，更新其状态
        if (formData.healthRecordId) {
          await this.updateHealthRecordStatus(formData.healthRecordId)
        }
        
        // 返回上一页
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        throw new Error(result.result?.message || '保存失败')
      }
    } catch (error: any) {
      // 已移除调试日志
      wx.showToast({
        title: error.message || '保存失败，请重试',
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false })
    }
  },

  // 更新健康记录状态
  async updateHealthRecordStatus(healthRecordId: string) {
    try {
      await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'update_health_record',
          recordId: healthRecordId,
          updateData: {
            status: 'treating',
            diagnosisDisease: this.data.formData.diagnosis,
            treatment: this.data.treatmentPlan.primary
          }
        }
      })
    } catch (error) {
      // 已移除调试日志
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
              healthRecordId: '',
              batchId: '',
              animalIds: [],
              treatmentType: 'medication',
              diagnosis: '',
              diagnosisConfidence: 0,
              veterinarianId: '',
              treatmentDuration: 7,
              notes: ''
            },
            treatmentPlan: {
              primary: '',
              secondary: [],
              followUpSchedule: []
            },
            medications: [],
            progressRecords: [],
            formErrors: {}
          })
        }
      }
    })
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  }
}

Page(createPageWithNavbar(pageConfig))
