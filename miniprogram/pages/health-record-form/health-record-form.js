// health-record-form.js - 健康记录表单页面逻辑（JS版本）
const { createPageWithNavbar } = require('../../utils/navigation')

const pageConfig = {
  data: {
    // 表单数据
    formData: {
      batchNumber: '',
      recordDate: '',
      location: '',
      affectedCount: '',
      symptoms: '',
      severity: 'mild',
      treatment: '',
      treatmentDate: '',
      result: 'ongoing',
      deathCount: '',
      notes: ''
    },
    
    // 可选的批次列表
    availableBatches: [],
    
    // 日期选择器相关
    showRecordDate: false,
    showTreatmentDate: false,
    recordDateValue: '',
    treatmentDateValue: '',
    
    // 选择器数据
    severityOptions: [
      { label: '轻微', value: 'mild' },
      { label: '中等', value: 'moderate' },
      { label: '严重', value: 'severe' }
    ],
    
    resultOptions: [
      { label: '治疗中', value: 'ongoing' },
      { label: '已治愈', value: 'cured' },
      { label: '死亡', value: 'death' }
    ],
    
    severityIndex: 0,
    resultIndex: 0,
    
    // 常见症状标签
    commonSymptoms: [
      { id: 1, name: '食欲不振', selected: false },
      { id: 2, name: '精神萎靡', selected: false },
      { id: 3, name: '腹泻', selected: false },
      { id: 4, name: '发热', selected: false },
      { id: 5, name: '咳嗽', selected: false },
      { id: 6, name: '呼吸困难', selected: false },
      { id: 7, name: '跛行', selected: false },
      { id: 8, name: '羽毛松乱', selected: false }
    ],
    
    // 常见治疗方案
    commonTreatments: [
      '隔离观察',
      '抗生素治疗',
      '补液治疗',
      '营养支持',
      '环境消毒',
      '疫苗接种',
      '中药治疗',
      '对症治疗'
    ],
    
    // 提交状态
    submitting: false,
    
    // 加载状态
    loading: false
  },

  onLoad() {
    this.initializeForm()
    this.loadAvailableBatches()
  },

  // 初始化表单
  initializeForm() {
    const today = new Date()
    const dateString = this.formatDate(today)
    
    this.setData({
      'formData.recordDate': dateString,
      'formData.treatmentDate': dateString,
      recordDateValue: today.getTime(),
      treatmentDateValue: today.getTime()
    })
  },

  // 加载可用批次
  async loadAvailableBatches() {
    try {
      this.setData({ loading: true })
      
      // 获取所有活跃批次（有存栏的批次）
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_active_batches'
        }
      })
      
      if (result.result && result.result.success) {
        this.setData({
          availableBatches: result.result.data.batches || []
        })
      }
    } catch (error) {
      console.error('加载批次失败:', error)
      wx.showToast({
        title: '加载批次失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 格式化日期
  formatDate(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  // 批次选择
  onBatchChange(e) {
    const { value } = e.detail
    const batch = this.data.availableBatches[value]
    
    if (batch) {
      this.setData({
        'formData.batchNumber': batch.batchNumber,
        'formData.location': batch.location || `${batch.breed}鹅舍`
      })
    }
  },

  // 严重程度选择
  onSeverityChange(e) {
    const { value } = e.detail
    this.setData({
      severityIndex: value,
      'formData.severity': this.data.severityOptions[value].value
    })
  },

  // 治疗结果选择
  onResultChange(e) {
    const { value } = e.detail
    const resultValue = this.data.resultOptions[value].value
    
    this.setData({
      resultIndex: value,
      'formData.result': resultValue
    })

    // 如果选择死亡，清空死亡数量以便重新输入
    if (resultValue === 'death') {
      this.setData({
        'formData.deathCount': ''
      })
    }
  },

  // 症状标签切换
  toggleSymptom(e) {
    const { id } = e.currentTarget.dataset
    const symptoms = this.data.commonSymptoms.map(item => {
      if (item.id === id) {
        return { ...item, selected: !item.selected }
      }
      return item
    })
    
    // 更新症状描述
    const selectedSymptoms = symptoms.filter(item => item.selected)
    const symptomsText = selectedSymptoms.map(item => item.name).join('、')
    
    this.setData({
      commonSymptoms: symptoms,
      'formData.symptoms': symptomsText
    })
  },

  // 治疗方案快速选择
  selectTreatment(e) {
    const { treatment } = e.currentTarget.dataset
    const currentTreatment = this.data.formData.treatment
    const treatments = currentTreatment ? `${currentTreatment}、${treatment}` : treatment
    
    this.setData({
      'formData.treatment': treatments
    })
  },

  // 表单字段变化
  onFieldChange(e) {
    const { value } = e.detail
    const { field } = e.currentTarget.dataset
    
    this.setData({
      [`formData.${field}`]: value
    })
  },

  // 显示日期选择器
  showDatePicker(e) {
    const { type } = e.currentTarget.dataset
    this.setData({
      [type === 'record' ? 'showRecordDate' : 'showTreatmentDate']: true
    })
  },

  // 隐藏日期选择器
  hideDatePicker(e) {
    const { type } = e.currentTarget.dataset
    this.setData({
      [type === 'record' ? 'showRecordDate' : 'showTreatmentDate']: false
    })
  },

  // 日期选择确认
  onDateConfirm(e) {
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
  validateForm() {
    const { formData } = this.data
    const errors = []

    // 检查必填字段
    if (!formData.batchNumber) {
      errors.push('请选择批次')
    }
    if (!formData.recordDate) {
      errors.push('请选择记录日期')
    }
    if (!formData.location.trim()) {
      errors.push('请输入位置信息')
    }
    if (!formData.affectedCount.trim()) {
      errors.push('请输入受影响数量')
    }
    if (!formData.symptoms.trim()) {
      errors.push('请描述症状')
    }
    if (!formData.treatment.trim()) {
      errors.push('请输入治疗方案')
    }

    // 验证数值字段
    if (formData.affectedCount && (isNaN(Number(formData.affectedCount)) || Number(formData.affectedCount) <= 0)) {
      errors.push('受影响数量必须为正数')
    }

    // 如果结果是死亡，检查死亡数量
    if (formData.result === 'death') {
      if (!formData.deathCount.trim()) {
        errors.push('死亡结果需要填写死亡数量')
      } else if (isNaN(Number(formData.deathCount)) || Number(formData.deathCount) <= 0) {
        errors.push('死亡数量必须为正数')
      } else if (Number(formData.deathCount) > Number(formData.affectedCount)) {
        errors.push('死亡数量不能超过受影响数量')
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
      // 准备提交数据
      const submitData = {
        ...this.data.formData,
        affectedCount: Number(this.data.formData.affectedCount),
        deathCount: this.data.formData.deathCount ? Number(this.data.formData.deathCount) : 0,
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
              location: '',
              affectedCount: '',
              symptoms: '',
              severity: 'mild',
              treatment: '',
              treatmentDate: dateString,
              result: 'ongoing',
              deathCount: '',
              notes: ''
            },
            severityIndex: 0,
            resultIndex: 0,
            recordDateValue: today.getTime(),
            treatmentDateValue: today.getTime(),
            commonSymptoms: this.data.commonSymptoms.map(item => ({ ...item, selected: false }))
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
