// health-record-form.ts - 健康记录表单页面逻辑
import { createPageWithNavbar } from '../../utils/navigation'

// 表单数据接口
interface HealthRecordFormData {
  recordDate: string;           // 记录日期
  abnormalCount: string;        // 异常数量
  symptoms: string;             // 症状描述
  diagnosisDisease: string;     // 诊断病种
  treatment: string;            // 治疗方案
  treatmentDate: string;        // 治疗日期
  medicineQuantity: string;     // 药品/营养品使用数量
  notes: string;                // 备注
}

const pageConfig = {
  data: {
    // 表单数据
    formData: {
      recordDate: '',
      abnormalCount: '',
      symptoms: '',
      diagnosisDisease: '',
      treatment: '',
      treatmentDate: '',
      medicineQuantity: '',
      notes: ''
    } as HealthRecordFormData,
    
    // 日期选择器相关
    showRecordDate: false,
    showTreatmentDate: false,
    recordDateValue: '',
    treatmentDateValue: '',
    
    symptomIndex: -1,
    diseaseIndex: -1,
    treatmentIndex: -1,
    selectedSymptom: '',
    selectedDisease: '',
    selectedTreatment: '',
    
    // 常见症状选项
    commonSymptoms: [
      { id: 1, name: '食欲不振' },
      { id: 2, name: '精神萎靡' },
      { id: 3, name: '腹泻' },
      { id: 4, name: '发热' },
      { id: 5, name: '咳嗽' },
      { id: 6, name: '呼吸困难' },
      { id: 7, name: '跛行' },
      { id: 8, name: '羽毛松乱' },
      { id: 9, name: '其他症状' }
    ],
    
    // 狮头鹅常见病害选项
    commonDiseases: [
      { id: 1, name: '小鹅瘟', code: 'GPV' },
      { id: 2, name: '鹅副粘病毒病', code: 'GPMV' },
      { id: 3, name: '禽流感', code: 'AI' },
      { id: 4, name: '大肠杆菌病', code: 'ECO' },
      { id: 5, name: '沙门氏菌病', code: 'SAL' },
      { id: 6, name: '球虫病', code: 'COC' },
      { id: 7, name: '曲霉菌病', code: 'ASP' },
      { id: 8, name: '禽霍乱', code: 'FC' },
      { id: 9, name: '鹅瘟', code: 'GP' },
      { id: 10, name: '肠炎', code: 'ENT' },
      { id: 11, name: '呼吸道感染', code: 'RTI' },
      { id: 12, name: '营养缺乏症', code: 'NUT' },
      { id: 13, name: '寄生虫病', code: 'PAR' },
      { id: 14, name: '中毒症', code: 'POI' },
      { id: 15, name: '其他病害', code: 'OTH' }
    ],
    
    // 治疗方案选项
    treatmentOptions: [
      { label: '隔离观察', value: 'isolation', needsMedicine: false },
      { label: '药品治疗', value: 'medicine', needsMedicine: true },
      { label: '环境消毒', value: 'disinfection', needsMedicine: false },
      { label: '营养支持', value: 'nutrition', needsMedicine: true }
    ],
    
    // 药品使用记录
    medicineRecords: [] as any[],
    medicineRecordIndex: -1,
    selectedMedicine: null as any,  // 当前选择的药品/营养品
    
    // 显示控制
    showMedicineSelector: false,  // 是否显示用药记录选择器
    selectedTreatmentType: '',    // 当前选择的治疗方案类型
    
    // 提交状态
    submitting: false,
    
    // 加载状态
    loading: false
  },

  onLoad() {
    console.log('健康记录表单页面加载')
    this.initializeForm()
    // 不再自动加载药品记录，只有选择需要药品的治疗方案时才加载
  },

  // 初始化表单
  initializeForm() {
    const today = new Date()
    const dateString = this.formatDate(today)
    
    this.setData({
      'formData.recordDate': dateString,
      'formData.treatmentDate': dateString,
      recordDateValue: today.getTime(),
      treatmentDateValue: today.getTime(),
      // 确保选择器索引正确初始化
      symptomIndex: -1,
      diseaseIndex: -1,
      treatmentIndex: -1,
      selectedSymptom: '',
      selectedDisease: '',
      selectedTreatment: ''
    })
    
    console.log('表单初始化完成:', {
      recordDate: dateString,
      treatmentDate: dateString
    })
  },


  // 格式化日期
  formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  },




  // 症状选择
  onSymptomChange(e: any) {
    const { value } = e.detail
    const symptomIndex = parseInt(value)
    const symptom = this.data.commonSymptoms[symptomIndex]
    
    console.log('症状选择事件触发:', {
      originalValue: value,
      parsedIndex: symptomIndex,
      symptomData: symptom,
      commonSymptoms: this.data.commonSymptoms
    })
    
    if (symptom) {
      // 如果选择的是"其他症状"，保留原有的症状描述，否则更新为选择的症状
      const newSymptoms = symptom.name === '其他症状' 
        ? this.data.formData.symptoms // 保留当前输入的症状描述
        : symptom.name // 使用选择的症状名称
        
      const updateData = {
        symptomIndex: symptomIndex,
        selectedSymptom: symptom.name,
        'formData.symptoms': newSymptoms
      }
      
      this.setData(updateData, () => {
        console.log('症状选择成功设置并完成界面更新:', {
          symptomName: symptom.name,
          symptomIndex: symptomIndex,
          selectedSymptom: symptom.name,
          formDataSymptoms: newSymptoms
        })
      })
    } else {
      console.error('症状数据不存在:', {
        value,
        symptomIndex,
        commonSymptomsLength: this.data.commonSymptoms.length,
        commonSymptoms: this.data.commonSymptoms
      })
    }
  },

  // 诊断病种选择
  onDiseaseChange(e: any) {
    const { value } = e.detail
    const diseaseIndex = parseInt(value)
    const disease = this.data.commonDiseases[diseaseIndex]
    
    console.log('诊断病种选择事件触发:', {
      originalValue: value,
      parsedIndex: diseaseIndex,
      diseaseData: disease,
      commonDiseases: this.data.commonDiseases
    })
    
    if (disease) {
      const updateData = {
        diseaseIndex: diseaseIndex,
        selectedDisease: disease.name,
        'formData.diagnosisDisease': disease.name
      }
      
      this.setData(updateData, () => {
        console.log('诊断病种选择成功设置并完成界面更新:', {
          diseaseName: disease.name,
          diseaseIndex: diseaseIndex,
          selectedDisease: disease.name,
          formDataDiagnosisDisease: disease.name
        })
      })
    } else {
      console.error('诊断病种数据不存在:', {
        value,
        diseaseIndex,
        commonDiseasesLength: this.data.commonDiseases.length,
        commonDiseases: this.data.commonDiseases
      })
    }
  },

  // 治疗方案选择
  onTreatmentChange(e: any) {
    const { value } = e.detail
    const treatmentIndex = parseInt(value)
    const treatmentOption = this.data.treatmentOptions[treatmentIndex]
    
    console.log('治疗方案选择事件触发:', {
      originalValue: value,
      parsedIndex: treatmentIndex,
      treatmentOption: treatmentOption,
      treatmentOptions: this.data.treatmentOptions
    })
    
    if (treatmentOption) {
      const needsMedicine = treatmentOption.needsMedicine
      
      const updateData = {
        treatmentIndex: treatmentIndex,
        selectedTreatment: treatmentOption.label,
        selectedTreatmentType: treatmentOption.value,
        showMedicineSelector: needsMedicine,
        'formData.treatment': treatmentOption.label
      }
      
      // 如果不需要药品，清空用药记录选择
      if (!needsMedicine) {
        updateData['medicineRecordIndex'] = -1
        updateData['selectedMedicine'] = null
        updateData['formData.medicineQuantity'] = ''
      } else {
        // 需要药品时，根据类型加载对应的药品或营养品记录
        this.loadMedicineRecords(treatmentOption.value)
      }
      
      this.setData(updateData, () => {
        console.log('治疗方案选择成功设置并完成界面更新:', {
          treatmentIndex: treatmentIndex,
          selectedTreatment: treatmentOption.label,
          selectedTreatmentType: treatmentOption.value,
          showMedicineSelector: needsMedicine
        })
      })
    } else {
      console.error('治疗方案数据不存在:', {
        value,
        treatmentIndex,
        treatmentOptionsLength: this.data.treatmentOptions.length,
        treatmentOptions: this.data.treatmentOptions
      })
    }
  },

  // 加载物料库存记录（药品或营养品）
  async loadMedicineRecords(treatmentType: string = 'medicine') {
    try {
      const categoryName = treatmentType === 'nutrition' ? '营养品' : '药品'
      
      console.log(`开始加载${categoryName}库存记录`, { treatmentType })
      
      // 获取所有物料，然后通过名称筛选
      const result = await wx.cloud.callFunction({
        name: 'production-material',
        data: {
          action: 'list_materials'  // 获取所有物料
        }
      })
      
      console.log(`物料库存加载结果:`, result)
      
      if (result.result && result.result.success) {
        const allMaterials = result.result.data.materials || []
        
        // 根据治疗类型进行精确筛选
        let filteredMaterials = []
        
        if (treatmentType === 'medicine') {
          // 药品：category为药品
          filteredMaterials = allMaterials.filter((material: any) => {
            return material.category === '药品'
          })
        } else if (treatmentType === 'nutrition') {
          // 营养品：category为营养品
          filteredMaterials = allMaterials.filter((material: any) => {
            return material.category === '营养品'
          })
        }
        
        // 转换物料格式用于显示，只显示有库存的物料
        const availableMaterials = filteredMaterials
          .filter((material: any) => (material.currentStock || 0) > 0)
          .map((material: any, index: number) => {
            const materialName = material.name || `未知${categoryName}`
            const currentStock = material.currentStock || 0
            const unit = material.unit || '单位'
            
            return {
              id: material._id || `material_${index}`,
              materialId: material._id,
              materialName: materialName,
              currentStock: currentStock,
              unit: unit,
              category: treatmentType === 'nutrition' ? '营养品' : '药品',
              displayName: `${materialName} (库存: ${currentStock}${unit})`,
              fullDescription: `${materialName}，当前库存：${currentStock}${unit}`
            }
          })
        
        this.setData({
          medicineRecords: availableMaterials
        })
        
        console.log(`${categoryName}筛选结果:`, {
          总物料数: allMaterials.length,
          筛选后数量: filteredMaterials.length,
          有库存数量: availableMaterials.length,
          物料列表: availableMaterials
        })
        
      } else {
        console.warn(`加载物料库存失败:`, result.result?.error || '未知错误')
        this.setData({
          medicineRecords: []
        })
      }
      
    } catch (error) {
      console.error(`加载${categoryName}库存异常:`, error)
      this.setData({
        medicineRecords: []
      })
    }
  },

  // 物料选择（药品或营养品）
  onMedicineRecordChange(e: any) {
    const { value } = e.detail
    const recordIndex = parseInt(value)
    const material = this.data.medicineRecords[recordIndex]
    
    console.log('物料选择事件触发:', {
      selectedIndex: recordIndex,
      selectedMaterial: material,
      availableMaterials: this.data.medicineRecords
    })
    
    // 检查索引是否有效
    if (recordIndex >= 0 && recordIndex < this.data.medicineRecords.length) {
      // 设置选中的药品，显示用量输入字段
      this.setData({
        medicineRecordIndex: recordIndex,
        selectedMedicine: material,
        'formData.medicineQuantity': '' // 重置数量输入
      })
      
      console.log('药品选择成功:', {
        selectedMedicine: material,
        medicineRecordIndex: recordIndex
      })
    } else {
      console.error('无效的物料索引:', recordIndex)
    }
  },


  // 表单字段变化
  onFieldChange(e: any) {
    const { value } = e.detail
    const { field } = e.currentTarget.dataset
    
    this.setData({
      [`formData.${field}`]: value
    })
  },

  // 显示日期选择器
  showDatePicker(e: any) {
    const { type } = e.currentTarget.dataset
    this.setData({
      [type === 'record' ? 'showRecordDate' : 'showTreatmentDate']: true
    })
  },

  // 隐藏日期选择器
  hideDatePicker(e: any) {
    const { type } = e.currentTarget.dataset
    this.setData({
      [type === 'record' ? 'showRecordDate' : 'showTreatmentDate']: false
    })
  },

  // 日期选择确认
  onDateConfirm(e: any) {
    const { value } = e.detail
    const { type } = e.currentTarget.dataset
    const date = new Date(value)
    const dateString = this.formatDate(date)
    
    if (type === 'record') {
      this.setData({
        'formData.recordDate': dateString,
        recordDateValue: value,
        showRecordDate: false
      })
    } else {
      this.setData({
        'formData.treatmentDate': dateString,
        treatmentDateValue: value,
        showTreatmentDate: false
      })
    }
  },

  // 表单验证
  validateForm(): { isValid: boolean; errors: string[] } {
    const { formData } = this.data
    const errors: string[] = []

    // 检查必填字段
    if (!formData.recordDate) {
      errors.push('请选择记录日期')
    }
    if (!formData.abnormalCount.trim()) {
      errors.push('请输入异常数量')
    }
    if (!formData.symptoms.trim()) {
      errors.push('请描述症状')
    }
    // 治疗方案现在不再是必填项，因为选择治疗方案类型就足够了
    // if (!formData.treatment.trim()) {
    //   errors.push('请输入治疗方案')
    // }

    // 验证数值字段
    if (formData.abnormalCount && (isNaN(Number(formData.abnormalCount)) || Number(formData.abnormalCount) <= 0)) {
      errors.push('异常数量必须为正数')
    }


    // 如果选择了药品/营养品，检查使用数量
    if (this.data.selectedMedicine && this.data.showMedicineSelector) {
      if (!formData.medicineQuantity.trim()) {
        errors.push('请输入药品使用数量')
      } else if (isNaN(Number(formData.medicineQuantity)) || Number(formData.medicineQuantity) <= 0) {
        errors.push('药品使用数量必须为正数')
      } else if (Number(formData.medicineQuantity) > this.data.selectedMedicine.currentStock) {
        errors.push('药品使用数量不能超过库存')
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  },

  // 提交表单
  async onSubmit() {
    // 验证表单
    const validation = this.validateForm()
    if (!validation.isValid) {
      wx.showToast({
        title: validation.errors[0],
        icon: 'none',
        duration: 2000
      })
      return
    }

    // 设置提交状态
    this.setData({
      submitting: true
    })

    try {
      // 先处理药品使用记录（如果有选择药品）
      if (this.data.selectedMedicine && this.data.formData.medicineQuantity) {
        await this.processMedicineUsage()
      }

      // 准备提交数据
      const submitData = {
        ...this.data.formData,
        abnormalCount: Number(this.data.formData.abnormalCount),
        medicineQuantity: this.data.formData.medicineQuantity ? Number(this.data.formData.medicineQuantity) : 0,
        createTime: new Date().toISOString()
      }

      // 调用云函数保存数据
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'create_health_record',
          recordData: submitData
        }
      })

      if (!result.result.success) {
        throw new Error(result.result.message || '提交失败')
      }

      // 提交成功
      wx.showToast({
        title: '健康记录提交成功',
        icon: 'success',
        duration: 2000
      })

      // 延迟返回上一页
      setTimeout(() => {
        wx.navigateBack({
          delta: 1
        })
      }, 2000)

    } catch (error) {
      console.error('提交健康记录失败:', error)
      wx.showToast({
        title: '提交失败，请重试',
        icon: 'none',
        duration: 2000
      })
    } finally {
      this.setData({
        submitting: false
      })
    }
  },

  // 处理药品使用记录
  async processMedicineUsage() {
    try {
      const material = this.data.selectedMedicine
      const quantity = Number(this.data.formData.medicineQuantity)
      const categoryName = material.category === '药品' ? '药品' : '营养品'
      
      console.log('开始处理药品使用记录:', { material, quantity })
      
      // 调用云函数创建使用记录（会自动扣减库存）
      const result = await wx.cloud.callFunction({
        name: 'production-material',
        data: {
          action: 'create_record',
          recordData: {
            materialId: material.materialId,
            type: 'use',
            quantity: quantity,
            targetLocation: '健康治疗',
            operator: '系统用户',
            status: '已完成',
            notes: `健康记录中${categoryName}使用 - ${material.materialName}`,
            recordDate: this.data.formData.treatmentDate || new Date().toISOString().split('T')[0]
          }
        }
      })
      
      if (!result.result || !result.result.success) {
        throw new Error(`${categoryName}使用记录创建失败: ${result.result?.error || '未知错误'}`)
      }
      
      console.log('药品使用记录创建成功:', {
        material: material.materialName,
        quantity: quantity
      })
      
    } catch (error) {
      console.error('处理药品使用记录异常:', error)
      throw error // 重新抛出异常，让调用方处理
    }
  },

  // 重置表单
  onReset() {
    wx.showModal({
      title: '确认重置',
      content: '确定要重置表单吗？所有已填写的数据将被清空。',
      success: (res) => {
        if (res.confirm) {
          // 重置表单数据
          const today = new Date()
          const dateString = this.formatDate(today)
          
          this.setData({
            formData: {
              recordDate: dateString,
              abnormalCount: '',
              symptoms: '',
              diagnosisDisease: '',
              treatment: '',
              treatmentDate: dateString,
              medicineQuantity: '',
              notes: ''
            },
            symptomIndex: -1,
            diseaseIndex: -1,
            treatmentIndex: -1,
            medicineRecordIndex: -1,
            selectedSymptom: '',
            selectedDisease: '',
            selectedTreatment: '',
            selectedMedicine: null,
            recordDateValue: today.getTime(),
            treatmentDateValue: today.getTime()
          })

          wx.showToast({
            title: '表单已重置',
            icon: 'success',
            duration: 1500
          })
        }
      }
    })
  },

  // 验证选择器数据有效性
  validatePickerData() {
    const validations = []
    
    // 检查症状数据
    if (!this.data.commonSymptoms || this.data.commonSymptoms.length === 0) {
      validations.push('症状选项未加载')
    }
    
    // 检查诊断病种数据
    if (!this.data.commonDiseases || this.data.commonDiseases.length === 0) {
      validations.push('诊断病种选项未加载')
    }
    
    if (validations.length > 0) {
      console.warn('选择器数据验证失败:', validations)
      return false
    }
    
    console.log('选择器数据验证通过')
    return true
  },


  // 检查界面数据状态（调试用）
  checkUIStatus() {
    console.log('=== 界面数据状态检查 ===')
    console.log('页面数据:', this.data)
    console.log('症状显示状态:', {
      symptomIndex: this.data.symptomIndex,
      selectedSymptom: this.data.selectedSymptom,
      formDataSymptoms: this.data.formData.symptoms
    })
    console.log('诊断病种显示状态:', {
      diseaseIndex: this.data.diseaseIndex,
      selectedDisease: this.data.selectedDisease,
      formDataDiagnosisDisease: this.data.formData.diagnosisDisease
    })
    console.log('治疗方案显示状态:', {
      treatmentIndex: this.data.treatmentIndex,
      selectedTreatment: this.data.selectedTreatment,
      formDataTreatment: this.data.formData.treatment
    })
  },

  // Cell点击事件处理函数 - 这些方法主要用于提供视觉反馈
  // picker组件会自动响应点击事件，无需手动触发

  onSymptomCellClick() {
    console.log('症状选择器被点击')
    wx.vibrateShort({
      type: 'light'
    });
  },

  onDiseaseCellClick() {
    console.log('诊断病种选择器被点击')
    wx.vibrateShort({
      type: 'light'
    });
  },

  onTreatmentCellClick() {
    console.log('治疗方案选择器被点击')
    wx.vibrateShort({
      type: 'light'
    });
  },

  // 页面分享
  onShareAppMessage() {
    return {
      title: '健康记录表单',
      path: '/pages/health-record-form/health-record-form'
    }
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
