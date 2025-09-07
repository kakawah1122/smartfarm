// treatment-followup.ts - 治疗跟进页面逻辑
import { createPageWithNavbar } from '../../utils/navigation'

// 跟进表单数据接口
interface FollowupFormData {
  recordId: string;           // 原始记录ID
  followupDate: string;       // 跟进日期
  curedCount: string;         // 治愈数量
  deathCount: string;         // 死亡数量
  notes: string;              // 跟进备注
}

const pageConfig = {
  data: {
    // 原始记录信息
    originalRecord: {
      _id: '',
      batchNumber: '',
      recordDate: '',
      affectedCount: 0,
      currentAffectedCount: 0,  // 剩余需处理数量
      curedCount: 0,           // 已治愈数量
      deathCount: 0,           // 已死亡数量
      symptoms: '',
      treatment: '',
      severity: 'mild',
      severityText: ''
    },
    
    // 跟进表单数据
    formData: {
      recordId: '',
      followupDate: '',
      curedCount: '',
      deathCount: '',
      notes: ''
    } as FollowupFormData,
    
    // 日期选择器相关
    showDate: false,
    dateValue: '',
    
    // 提交状态
    submitting: false
  },

  onLoad(options: any) {
    const { recordId, batchNumber } = options
    if (!recordId) {
      wx.showToast({
        title: '缺少记录ID',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }
    
    this.setData({
      'formData.recordId': recordId
    })
    
    this.initializeForm()
    this.loadOriginalRecord(recordId)
  },

  // 初始化表单
  initializeForm() {
    const today = new Date()
    const dateString = this.formatDate(today)
    
    this.setData({
      'formData.followupDate': dateString,
      dateValue: today.getTime()
    })
  },

  // 加载原始记录信息
  async loadOriginalRecord(recordId: string) {
    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_health_record',
          recordId: recordId
        }
      })
      
      if (result.result && result.result.success) {
        const record = result.result.data.record
        const severityTexts = {
          'mild': '轻微',
          'moderate': '中等',
          'severe': '严重'
        }
        
        const severityThemes = {
          'mild': 'success',
          'moderate': 'warning',
          'severe': 'danger'
        }
        
        // 计算剩余可处理数量
        const curedCount = record.curedCount || 0
        const deathCount = record.deathCount || 0
        const currentAffectedCount = record.currentAffectedCount !== undefined 
          ? record.currentAffectedCount 
          : Math.max(0, record.affectedCount - curedCount - deathCount)
        
        this.setData({
          originalRecord: {
            _id: record._id,
            batchNumber: record.batchNumber,
            recordDate: record.recordDate,
            affectedCount: record.affectedCount,
            currentAffectedCount: currentAffectedCount,
            curedCount: curedCount,
            deathCount: deathCount,
            symptoms: record.symptoms,
            treatment: record.treatment,
            diagnosisDisease: record.diagnosisDisease || '未确诊', // 添加诊断病种
            severity: severityThemes[record.severity] || 'primary',
            severityText: severityTexts[record.severity] || '未知'
          }
        })
      } else {
        throw new Error(result.result?.message || '获取记录失败')
      }
    } catch (error) {
      console.error('加载原始记录失败:', error)
      wx.showToast({
        title: '加载记录失败',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    }
  },

  // 格式化日期
  formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
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
  showDatePicker() {
    this.setData({
      showDate: true
    })
  },

  // 隐藏日期选择器
  hideDatePicker() {
    this.setData({
      showDate: false
    })
  },

  // 日期选择确认
  onDateConfirm(e: any) {
    const { value } = e.detail
    const date = new Date(value)
    const dateString = this.formatDate(date)
    
    this.setData({
      'formData.followupDate': dateString,
      dateValue: value,
      showDate: false
    })
  },

  // 表单验证
  validateForm(): { isValid: boolean; errors: string[] } {
    const { formData, originalRecord } = this.data
    const errors: string[] = []

    // 检查必填字段
    if (!formData.followupDate) {
      errors.push('请选择跟进日期')
    }

    // 解析治愈和死亡数量
    const curedCount = formData.curedCount.trim() ? Number(formData.curedCount) : 0
    const deathCount = formData.deathCount.trim() ? Number(formData.deathCount) : 0

    // 至少需要填写一个数量
    if (curedCount === 0 && deathCount === 0) {
      errors.push('请至少填写治愈数量或死亡数量')
    }

    // 检查治愈数量
    if (formData.curedCount.trim()) {
      if (isNaN(curedCount) || curedCount <= 0) {
        errors.push('治愈数量必须为正数')
      }
    }

    // 检查死亡数量
    if (formData.deathCount.trim()) {
      if (isNaN(deathCount) || deathCount <= 0) {
        errors.push('死亡数量必须为正数')
      }
    }

    // 检查总数量不能超过剩余可处理数量
    const totalCount = curedCount + deathCount
    if (totalCount > originalRecord.currentAffectedCount) {
      errors.push(`处理总数量（${totalCount}只）不能超过剩余待处理数量（${originalRecord.currentAffectedCount}只）`)
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
        curedCount: this.data.formData.curedCount ? Number(this.data.formData.curedCount) : 0,
        deathCount: this.data.formData.deathCount ? Number(this.data.formData.deathCount) : 0,
        createTime: new Date().toISOString(),
        operator: '系统用户',
        // 从原始记录继承的重要信息
        originalRecordId: this.data.originalRecord._id,
        batchNumber: this.data.originalRecord.batchNumber,
        diagnosisDisease: this.data.originalRecord.diagnosisDisease,
        symptoms: this.data.originalRecord.symptoms,
        treatment: this.data.originalRecord.treatment
      }

      console.log('准备提交跟进数据:', submitData)
      
      // 调用云函数保存跟进记录
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'create_followup_record',
          followupData: submitData
        }
      })
      
      console.log('云函数调用结果:', result)

      if (!result.result.success) {
        throw new Error(result.result.message || '提交失败')
      }

      // 提交成功
      wx.showToast({
        title: '跟进记录提交成功',
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
      console.error('提交跟进记录失败:', error)
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

  // 页面分享
  onShareAppMessage() {
    return {
      title: '治疗跟进记录',
      path: '/pages/treatment-followup/treatment-followup'
    }
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
