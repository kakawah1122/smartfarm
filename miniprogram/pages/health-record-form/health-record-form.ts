// health-record-form.ts - 健康记录表单页面逻辑
import { createPageWithNavbar } from '../../utils/navigation'
import { DynamicStorageManager } from '../../utils/dynamic-storage'

// 表单数据接口
interface HealthRecordFormData {
  batchNumber: string;          // 批次号码
  recordDate: string;           // 记录日期
  abnormalCount: string;        // 异常数量
  symptoms: string;             // 症状描述
  diagnosisDisease: string;     // 诊断病种
  treatment: string;            // 治疗方案
  treatmentDate: string;        // 治疗日期
  medicineQuantity: string;     // 药品/营养品使用数量
  notes: string;                // 备注
  
  // 动态存储图片字段
  symptomImages: string[];      // 症状图片文件ID数组
  treatmentImages: string[];    // 治疗过程图片文件ID数组
  recoveryImages: string[];     // 康复记录图片文件ID数组
}

const pageConfig = {
  data: {
    // 表单数据
    formData: {
      batchNumber: '',
      recordDate: '',
      abnormalCount: '',
      symptoms: '',
      diagnosisDisease: '',
      treatment: '',
      treatmentDate: '',
      medicineQuantity: '',
      notes: '',
      // 动态存储图片字段
      symptomImages: [],
      treatmentImages: [],
      recoveryImages: []
    } as HealthRecordFormData,
    
    // 日期选择器相关
    showRecordDate: false,
    showTreatmentDate: false,
    recordDateValue: '',
    treatmentDateValue: '',
    
    // 批次相关
    activeBatches: [] as any[],     // 活跃批次列表
    batchIndex: -1,                 // 选中的批次索引
    selectedBatch: null as any,     // 选中的批次
    
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
    loading: false,
    
    // AI诊断相关
    aiDiagnosis: {
      loading: false,
      result: null as any,
      error: null as string | null,
      history: [] as any[]
    },
    
    // 动态存储图片上传相关
    imageUpload: {
      loading: false,
      currentType: '', // 'symptom', 'treatment', 'recovery'
      uploadProgress: 0,
      previewUrls: {
        symptom: [] as string[],
        treatment: [] as string[],
        recovery: [] as string[]
      }
    }
  },

  onLoad() {
    console.log('健康记录表单页面加载')
    this.initializeForm()
    this.loadActiveBatches()
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
      batchIndex: -1,
      symptomIndex: -1,
      diseaseIndex: -1,
      treatmentIndex: -1,
      selectedBatch: null,
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

  // 加载活跃批次
  async loadActiveBatches() {
    try {
      console.log('开始加载活跃批次')
      
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_active_batches'
        }
      })
      
      console.log('活跃批次加载结果:', result)
      
      if (result.result && result.result.success) {
        const batches = result.result.data.batches || []
        
        this.setData({
          activeBatches: batches
        })
        
        console.log('活跃批次加载成功:', {
          数量: batches.length,
          批次列表: batches
        })
      } else {
        console.warn('加载活跃批次失败:', result.result?.error || '未知错误')
        this.setData({
          activeBatches: []
        })
      }
      
    } catch (error) {
      console.error('加载活跃批次异常:', error)
      this.setData({
        activeBatches: []
      })
    }
  },




  // 批次选择
  onBatchChange(e: any) {
    const { value } = e.detail
    const batchIndex = parseInt(value)
    const batch = this.data.activeBatches[batchIndex]
    
    console.log('批次选择事件触发:', {
      originalValue: value,
      parsedIndex: batchIndex,
      batchData: batch,
      activeBatches: this.data.activeBatches
    })
    
    if (batch) {
      const updateData = {
        batchIndex: batchIndex,
        selectedBatch: batch,
        'formData.batchNumber': batch.batchNumber
      }
      
      this.setData(updateData, () => {
        console.log('批次选择成功设置并完成界面更新:', {
          batchNumber: batch.batchNumber,
          batchIndex: batchIndex,
          selectedBatch: batch
        })
      })
    } else {
      console.error('批次数据不存在:', {
        value,
        batchIndex,
        activeBatchesLength: this.data.activeBatches.length,
        activeBatches: this.data.activeBatches
      })
    }
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
    if (!formData.batchNumber.trim()) {
      errors.push('请选择批次')
    }
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

  // ================ 动态存储图片上传功能 ================
  
  /**
   * 选择并上传症状图片
   */
  async onUploadSymptomImage() {
    await this.uploadImages('symptom');
  },
  
  /**
   * 选择并上传治疗过程图片
   */
  async onUploadTreatmentImage() {
    await this.uploadImages('treatment');
  },
  
  /**
   * 选择并上传康复记录图片
   */
  async onUploadRecoveryImage() {
    await this.uploadImages('recovery');
  },
  
  /**
   * 通用图片上传方法 - 基于动态存储
   * @param imageType 图片类型: 'symptom' | 'treatment' | 'recovery'
   */
  async uploadImages(imageType: 'symptom' | 'treatment' | 'recovery') {
    try {
      // 检查记录日期是否已选择
      if (!this.data.formData.recordDate) {
        wx.showToast({
          title: '请先选择记录日期',
          icon: 'none'
        });
        return;
      }
      
      // 设置上传状态
      this.setData({
        'imageUpload.loading': true,
        'imageUpload.currentType': imageType
      });
      
      // 选择图片
      const chooseResult = await wx.chooseImage({
        count: 9, // 最多选择9张图片
        sourceType: ['camera', 'album'],
        sizeType: ['compressed'] // 压缩图片以提升上传速度
      });
      
      if (chooseResult.tempFilePaths.length === 0) {
        this.setData({
          'imageUpload.loading': false
        });
        return;
      }
      
      wx.showLoading({ 
        title: `上传中 (0/${chooseResult.tempFilePaths.length})`,
        mask: true 
      });
      
      const uploadResults: string[] = [];
      const previewUrls: string[] = [...this.data.imageUpload.previewUrls[imageType]];
      
      // 批量上传图片
      for (let i = 0; i < chooseResult.tempFilePaths.length; i++) {
        const filePath = chooseResult.tempFilePaths[i];
        
        try {
          // 使用动态存储管理器上传
          const uploadResult = await DynamicStorageManager.uploadFile(filePath, {
            category: 'health',
            subCategory: this.getSubCategoryByImageType(imageType),
            recordDate: this.data.formData.recordDate, // 使用用户选择的记录日期！
            metadata: {
              batchId: this.data.formData.batchNumber,
              relatedRecordId: this.generateTempRecordId(),
              fileType: 'image/jpeg',
              originalName: `${imageType}_${Date.now()}.jpg`
            }
          });
          
          if (uploadResult.success && uploadResult.fileID) {
            uploadResults.push(uploadResult.fileID);
            previewUrls.push(filePath); // 添加预览URL
            
            // 显示上传进度和文件夹信息
            wx.showLoading({ 
              title: `上传中 (${i + 1}/${chooseResult.tempFilePaths.length})\n已保存至: ${uploadResult.timeDimension}`,
              mask: true 
            });
            
          } else {
            console.error('上传失败:', uploadResult.error);
            wx.showToast({
              title: `第${i + 1}张图片上传失败`,
              icon: 'none'
            });
          }
          
        } catch (error) {
          console.error('图片上传异常:', error);
          wx.showToast({
            title: `第${i + 1}张图片上传异常`,
            icon: 'none'
          });
        }
      }
      
      // 更新表单数据和预览
      if (uploadResults.length > 0) {
        const formDataKey = this.getFormDataKeyByImageType(imageType);
        const currentImages = [...this.data.formData[formDataKey]];
        const updatedImages = [...currentImages, ...uploadResults];
        
        this.setData({
          [`formData.${formDataKey}`]: updatedImages,
          [`imageUpload.previewUrls.${imageType}`]: previewUrls
        });
        
        wx.showToast({
          title: `成功上传 ${uploadResults.length} 张图片`,
          icon: 'success',
          duration: 2000
        });
        
        // 显示文件夹生成提示
        if (uploadResults.length > 0) {
          setTimeout(() => {
            wx.showModal({
              title: '动态文件夹已创建',
              content: `图片已按记录日期自动保存至对应的时间文件夹中，便于后续按时间查询和管理。`,
              showCancel: false,
              confirmText: '知道了'
            });
          }, 1500);
        }
      }
      
    } catch (error) {
      console.error('图片上传流程失败:', error);
      wx.showToast({
        title: '图片上传失败，请重试',
        icon: 'error'
      });
    } finally {
      wx.hideLoading();
      this.setData({
        'imageUpload.loading': false,
        'imageUpload.currentType': ''
      });
    }
  },
  
  /**
   * 根据图片类型获取子分类
   */
  getSubCategoryByImageType(imageType: string): string {
    const mapping = {
      'symptom': 'symptoms',
      'treatment': 'treatment', 
      'recovery': 'recovery'
    };
    return mapping[imageType] || 'symptoms';
  },
  
  /**
   * 根据图片类型获取表单数据字段名
   */
  getFormDataKeyByImageType(imageType: string): string {
    const mapping = {
      'symptom': 'symptomImages',
      'treatment': 'treatmentImages',
      'recovery': 'recoveryImages'
    };
    return mapping[imageType] || 'symptomImages';
  },
  
  /**
   * 生成临时记录ID
   */
  generateTempRecordId(): string {
    return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },
  
  /**
   * 预览图片
   */
  onPreviewImage(event: any) {
    const { type, index } = event.currentTarget.dataset;
    const previewUrls = this.data.imageUpload.previewUrls[type];
    
    if (previewUrls && previewUrls.length > 0) {
      wx.previewImage({
        urls: previewUrls,
        current: previewUrls[index]
      });
    }
  },
  
  /**
   * 删除图片
   */
  async onDeleteImage(event: any) {
    const { type, index } = event.currentTarget.dataset;
    
    try {
      const result = await wx.showModal({
        title: '确认删除',
        content: '确定要删除这张图片吗？此操作不可撤销。'
      });
      
      if (!result.confirm) return;
      
      // 获取要删除的文件ID
      const formDataKey = this.getFormDataKeyByImageType(type);
      const currentImages = [...this.data.formData[formDataKey]];
      const fileIDToDelete = currentImages[index];
      
      if (fileIDToDelete) {
        // 从云存储删除文件
        const deleteResult = await DynamicStorageManager.deleteFile(fileIDToDelete);
        if (!deleteResult.success) {
          console.warn('云存储删除失败:', deleteResult.error);
        }
      }
      
      // 更新本地数据
      currentImages.splice(index, 1);
      const previewUrls = [...this.data.imageUpload.previewUrls[type]];
      previewUrls.splice(index, 1);
      
      this.setData({
        [`formData.${formDataKey}`]: currentImages,
        [`imageUpload.previewUrls.${type}`]: previewUrls
      });
      
      wx.showToast({
        title: '图片已删除',
        icon: 'success'
      });
      
    } catch (error) {
      console.error('删除图片失败:', error);
      wx.showToast({
        title: '删除失败，请重试',
        icon: 'error'
      });
    }
  },
  
  // ================ 图片上传功能结束 ================

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
        affectedCount: Number(this.data.formData.abnormalCount), // 映射字段名
        medicineQuantity: this.data.formData.medicineQuantity ? Number(this.data.formData.medicineQuantity) : 0,
        // 添加缺失的字段
        location: this.data.selectedBatch?.location || '未指定位置',
        severity: this.inferSeverity(this.data.formData.abnormalCount, this.data.formData.symptoms),
        result: 'ongoing', // 新建记录默认为进行中
        createTime: new Date().toISOString()
      }
      
      // 移除前端字段名（避免混淆）
      delete submitData.abnormalCount

      // 调用云函数保存数据
      console.log('=== 提交到云函数的数据 ===', submitData)
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'create_health_record',
          recordData: submitData
        }
      })
      console.log('=== 云函数返回结果 ===', result)

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
              batchNumber: '',
              recordDate: dateString,
              abnormalCount: '',
              symptoms: '',
              diagnosisDisease: '',
              treatment: '',
              treatmentDate: dateString,
              medicineQuantity: '',
              notes: ''
            },
            batchIndex: -1,
            symptomIndex: -1,
            diseaseIndex: -1,
            treatmentIndex: -1,
            medicineRecordIndex: -1,
            selectedBatch: null,
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

  onBatchCellClick() {
    console.log('批次选择器被点击')
    wx.vibrateShort({
      type: 'light'
    });
  },

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

  // 推断严重程度
  inferSeverity(abnormalCount: string, symptoms: string): string {
    const count = Number(abnormalCount) || 0
    const symptomsLower = symptoms.toLowerCase()
    
    // 根据异常数量和症状关键词判断严重程度
    if (count >= 50 || symptomsLower.includes('死亡') || symptomsLower.includes('急性')) {
      return 'severe'
    } else if (count >= 10 || symptomsLower.includes('发热') || symptomsLower.includes('呼吸困难')) {
      return 'moderate'
    } else {
      return 'mild'
    }
  },

  // 页面分享
  onShareAppMessage() {
    return {
      title: '健康记录表单',
      path: '/pages/health-record-form/health-record-form'
    }
  },

  // ========== AI诊断功能 ==========
  
  // 开始AI智能诊断
  async startAIDiagnosis() {
    const { formData, selectedBatch } = this.data
    
    if (!formData.symptoms) {
      wx.showToast({
        title: '请先描述症状',
        icon: 'none'
      })
      return
    }
    
    console.log('开始AI诊断，症状:', formData.symptoms)
    
    // 显示加载状态
    this.setData({
      'aiDiagnosis.loading': true,
      'aiDiagnosis.error': null
    })
    
    try {
      // 收集环境数据（可以扩展获取实际环境数据）
      const environmentData = {
        temperature: 25, // 默认温度，实际可从传感器获取
        humidity: 65,    // 默认湿度
        ventilation: '良好',
        lighting: '自然光'
      }
      
      // 收集鹅群数据
      const flockData = {
        totalCount: selectedBatch?.initialCount || 500,
        affectedCount: parseInt(formData.abnormalCount) || 0,
        averageAge: selectedBatch ? this.calculateAverageAge(selectedBatch.hatchDate) : 30,
        breed: '狮头鹅'
      }
      
      // 构建症状数组
      const symptoms = [formData.symptoms]
      if (this.data.selectedSymptom && this.data.selectedSymptom !== '其他症状') {
        symptoms.push(`常见症状：${this.data.selectedSymptom}`)
      }
      
      console.log('调用AI诊断服务，参数:', { symptoms, environmentData, flockData })
      
      // 调用云函数进行AI诊断
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'ai_diagnosis',
          symptoms,
          environmentData,
          flockData,
          priority: 'balanced'
        }
      })
      
      console.log('AI诊断结果:', result)
      
      if (result.result.success) {
        // 诊断成功
        this.setData({
          'aiDiagnosis.loading': false,
          'aiDiagnosis.result': result.result.data.diagnosis,
          'aiDiagnosis.error': null
        })
        
        // 触觉反馈
        wx.vibrateShort({ type: 'medium' })
        
        wx.showToast({
          title: 'AI诊断完成',
          icon: 'success',
          duration: 1500
        })
        
      } else {
        // 诊断失败但有备用建议
        this.setData({
          'aiDiagnosis.loading': false,
          'aiDiagnosis.error': result.result.error,
          'aiDiagnosis.result': result.result.fallback
        })
        
        wx.showToast({
          title: result.result.error || 'AI诊断失败',
          icon: 'none',
          duration: 2000
        })
      }
      
    } catch (error) {
      console.error('AI诊断调用失败:', error)
      
      this.setData({
        'aiDiagnosis.loading': false,
        'aiDiagnosis.error': '网络错误',
        'aiDiagnosis.result': null
      })
      
      wx.showToast({
        title: '网络错误，请稍后重试',
        icon: 'none',
        duration: 2000
      })
    }
  },
  
  // 采用AI诊断结果
  adoptAIDiagnosis() {
    const { aiDiagnosis } = this.data
    if (!aiDiagnosis.result) return
    
    const diagnosis = aiDiagnosis.result.diagnosis
    const treatment = aiDiagnosis.result.treatment
    
    // 自动填充诊断病种
    if (diagnosis.primaryDisease) {
      // 查找匹配的病种
      const matchedDisease = this.data.commonDiseases.find(disease => 
        disease.name.includes(diagnosis.primaryDisease) || 
        diagnosis.primaryDisease.includes(disease.name)
      )
      
      if (matchedDisease) {
        const diseaseIndex = this.data.commonDiseases.indexOf(matchedDisease)
        this.setData({
          diseaseIndex,
          selectedDisease: matchedDisease.name,
          'formData.diagnosisDisease': matchedDisease.name
        })
      } else {
        // 如果没有完全匹配，设置为"其他病害"
        const otherDiseaseIndex = this.data.commonDiseases.findIndex(d => d.name === '其他病害')
        if (otherDiseaseIndex >= 0) {
          this.setData({
            diseaseIndex: otherDiseaseIndex,
            selectedDisease: '其他病害',
            'formData.diagnosisDisease': diagnosis.primaryDisease
          })
        }
      }
    }
    
    // 自动填充治疗方案
    if (treatment && treatment.medications && treatment.medications.length > 0) {
      const firstMed = treatment.medications[0]
      let treatmentText = `${firstMed.name}（${firstMed.dosage}）`
      
      if (treatment.procedures && treatment.procedures.length > 0) {
        treatmentText += `；${treatment.procedures.join('；')}`
      }
      
      this.setData({
        treatmentIndex: 1, // 设置为"药品治疗"
        selectedTreatment: '药品治疗',
        'formData.treatment': treatmentText
      })
    }
    
    wx.showToast({
      title: '已采用AI建议',
      icon: 'success',
      duration: 1500
    })
  },
  
  // 查看完整诊断详情
  viewFullDiagnosis() {
    const { aiDiagnosis } = this.data
    if (!aiDiagnosis.result) return
    
    // 跳转到AI诊断详情页面（需要创建）
    wx.navigateTo({
      url: `/pages/ai-diagnosis-detail/ai-diagnosis-detail?data=${encodeURIComponent(JSON.stringify(aiDiagnosis.result))}`
    })
  },
  
  // 清除AI诊断结果
  clearAIDiagnosis() {
    this.setData({
      'aiDiagnosis.result': null,
      'aiDiagnosis.error': null
    })
  },
  
  // 计算平均日龄
  calculateAverageAge(hatchDate: string): number {
    if (!hatchDate) return 30
    
    const hatch = new Date(hatchDate)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - hatch.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    return diffDays
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
