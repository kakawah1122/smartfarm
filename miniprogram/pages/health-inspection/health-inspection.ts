// health-inspection.ts - 健康巡检页面
import { createPageWithNavbar } from '../../utils/navigation'

interface InspectionItem {
  id: string
  name: string
  category: string
  checked: boolean
  result: 'normal' | 'abnormal' | 'not_checked'
  notes?: string
}

const pageConfig: WechatMiniprogram.Page.Options<any, any> = {
  data: {
    // 表单数据
    formData: {
      batchId: '',
      locationId: '',
      inspector: '',
      inspectionDate: '',
      inspectionTime: '',
      totalInspected: 0,
      abnormalCount: 0,
      notes: ''
    },

    // 计算属性
    calculatedStats: {
      abnormalDiscoveryRate: '0.0', // 异常发现率 (已格式化)
      normalCount: 0, // 正常个体数量
      completionRate: '0.0' // 巡检完成率
    },
    
    // 巡检项目
    inspectionItems: [
      // 精神状态
      { id: 'spirit_active', name: '精神活跃', category: 'spirit', checked: true, result: 'not_checked' },
      { id: 'spirit_alert', name: '反应敏捷', category: 'spirit', checked: true, result: 'not_checked' },
      { id: 'spirit_group', name: '群体活动', category: 'spirit', checked: true, result: 'not_checked' },
      
      // 食欲状况
      { id: 'appetite_eating', name: '正常采食', category: 'appetite', checked: true, result: 'not_checked' },
      { id: 'appetite_drinking', name: '正常饮水', category: 'appetite', checked: true, result: 'not_checked' },
      { id: 'appetite_compete', name: '争食表现', category: 'appetite', checked: true, result: 'not_checked' },
      
      // 呼吸状态
      { id: 'respiratory_normal', name: '呼吸平稳', category: 'respiratory', checked: true, result: 'not_checked' },
      { id: 'respiratory_no_cough', name: '无咳嗽', category: 'respiratory', checked: true, result: 'not_checked' },
      { id: 'respiratory_no_discharge', name: '无鼻涕', category: 'respiratory', checked: true, result: 'not_checked' },
      
      // 排泄状况
      { id: 'excretion_normal', name: '粪便正常', category: 'excretion', checked: true, result: 'not_checked' },
      { id: 'excretion_color', name: '颜色正常', category: 'excretion', checked: true, result: 'not_checked' },
      { id: 'excretion_frequency', name: '频次正常', category: 'excretion', checked: true, result: 'not_checked' },
      
      // 外观体态
      { id: 'appearance_posture', name: '体态正常', category: 'appearance', checked: true, result: 'not_checked' },
      { id: 'appearance_feather', name: '羽毛整洁', category: 'appearance', checked: true, result: 'not_checked' },
      { id: 'appearance_eyes', name: '眼部清亮', category: 'appearance', checked: true, result: 'not_checked' },
      
      // 行为表现
      { id: 'behavior_walking', name: '行走正常', category: 'behavior', checked: true, result: 'not_checked' },
      { id: 'behavior_social', name: '群体互动', category: 'behavior', checked: true, result: 'not_checked' },
      { id: 'behavior_rest', name: '休息状态', category: 'behavior', checked: true, result: 'not_checked' }
    ] as InspectionItem[],
    
    // 巡检类别
    inspectionCategories: [
      { id: 'spirit', name: '精神状态', icon: 'mood', color: '#0052d9' },
      { id: 'appetite', name: '食欲状况', icon: 'food', color: '#00a870' },
      { id: 'respiratory', name: '呼吸状态', icon: 'gesture-breath', color: '#ed7b2f' },
      { id: 'excretion', name: '排泄状况', icon: 'undertake-delivery', color: '#7356f1' },
      { id: 'appearance', name: '外观体态', icon: 'user-visible', color: '#f59a23' },
      { id: 'behavior', name: '行为表现', icon: 'gesture-wipe', color: '#e34d59' }
    ],
    
    // 异常发现记录
    abnormalFindings: [] as Array<{
      id: string
      itemId: string
      itemName: string
      description: string
      affectedCount: number
      severity: 'mild' | 'moderate' | 'severe'
    }>,
    
    // 活跃批次列表
    activeBatches: [] as any[],
    
    // 页面状态
    loading: false,
    submitting: false,
    showAbnormalDialog: false,
    currentAbnormalItem: null as InspectionItem | null,
    activeCategory: 'spirit',
    showBatchPicker: false,
    
    // 表单验证
    formErrors: {} as Record<string, string>,
    
    // 临时异常记录表单
    abnormalForm: {
      description: '',
      affectedCount: 1,
      severity: 'mild'
    }
  },

  onLoad(options: any) {
    const { batchId, locationId } = options || {}
    
    if (batchId) {
      this.setData({
        'formData.batchId': batchId
      })
    }
    
    if (locationId) {
      this.setData({
        'formData.locationId': locationId
      })
    }
    
    this.initializeForm()
  },

  async onShow() {
    await this.loadActiveBatches()
  },

  // 初始化表单
  initializeForm() {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const timeNow = now.toTimeString().split(' ')[0].substring(0, 5)
    
    this.setData({
      'formData.inspectionDate': today,
      'formData.inspectionTime': timeNow,
      'formData.inspector': '当前检查员'
    })
    
    this.calculateStats()
  },

  // 计算统计数据
  calculateStats() {
    const { formData } = this.data
    const totalInspected = formData.totalInspected || 0
    const abnormalCount = formData.abnormalCount || 0
    const normalCount = Math.max(0, totalInspected - abnormalCount)
    
    // 计算异常发现率
    const abnormalDiscoveryRate = totalInspected > 0 
      ? (abnormalCount / totalInspected * 100).toFixed(1)
      : '0.0'
    
    // 计算巡检完成率（基于已检查的项目）
    const checkedItems = this.data.inspectionItems.filter(item => item.result !== 'not_checked')
    const completionRate = this.data.inspectionItems.length > 0
      ? (checkedItems.length / this.data.inspectionItems.length * 100).toFixed(1)
      : '0.0'
    
    this.setData({
      calculatedStats: {
        abnormalDiscoveryRate,
        normalCount,
        completionRate
      }
    })
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
    const value = parseInt(e.detail.value) || 0
    
    this.setData({
      [`formData.${field}`]: value
    })
    
    // 如果是影响统计的字段，重新计算统计数据
    if (field === 'totalInspected' || field === 'abnormalCount') {
      this.calculateStats()
    }
    
    this.validateField(field, value)
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
          'formData.batchId': selectedBatch.batchNumber,
          'formData.locationId': selectedBatch.location
        })
        this.validateField('batchId', selectedBatch.batchNumber)
      }
    })
  },

  // 切换巡检类别
  onCategoryChange(e: any) {
    const { category } = e.currentTarget.dataset
    this.setData({ activeCategory: category })
  },

  // 切换巡检项目选择状态
  onItemToggle(e: any) {
    const { itemId } = e.currentTarget.dataset
    const items = this.data.inspectionItems.map(item => {
      if (item.id === itemId) {
        return { ...item, checked: !item.checked, result: !item.checked ? 'not_checked' : item.result }
      }
      return item
    })
    
    this.setData({ inspectionItems: items })
  },

  // 设置巡检项目结果
  onItemResultChange(e: any) {
    const { itemId, result } = e.currentTarget.dataset
    const items = this.data.inspectionItems.map(item => {
      if (item.id === itemId) {
        return { ...item, result }
      }
      return item
    })
    
    this.setData({ inspectionItems: items })
    
    // 如果标记为异常，显示异常记录对话框
    if (result === 'abnormal') {
      const abnormalItem = items.find(item => item.id === itemId)
      this.setData({
        currentAbnormalItem: abnormalItem,
        showAbnormalDialog: true,
        abnormalForm: {
          description: '',
          affectedCount: 1,
          severity: 'mild'
        }
      })
    }
  },

  // 异常记录对话框处理
  onAbnormalFormInput(e: any) {
    const { field } = e.currentTarget.dataset
    const { value } = e.detail
    
    this.setData({
      [`abnormalForm.${field}`]: field === 'affectedCount' ? (parseInt(value) || 1) : value
    })
  },

  onAbnormalSeverityChange(e: any) {
    const { severity } = e.currentTarget.dataset
    this.setData({
      'abnormalForm.severity': severity
    })
  },

  // 保存异常记录
  saveAbnormalFinding() {
    const { currentAbnormalItem, abnormalForm, abnormalFindings } = this.data
    
    if (!currentAbnormalItem) return
    
    if (!abnormalForm.description.trim()) {
      wx.showToast({
        title: '请描述异常情况',
        icon: 'none'
      })
      return
    }
    
    // 检查是否已存在该项目的异常记录
    const existingIndex = abnormalFindings.findIndex(finding => finding.itemId === currentAbnormalItem.id)
    
    const newFinding = {
      id: `abnormal_${currentAbnormalItem.id}_${Date.now()}`,
      itemId: currentAbnormalItem.id,
      itemName: currentAbnormalItem.name,
      description: abnormalForm.description,
      affectedCount: abnormalForm.affectedCount,
      severity: abnormalForm.severity as 'mild' | 'moderate' | 'severe'
    }
    
    let updatedFindings
    if (existingIndex >= 0) {
      // 更新现有记录
      updatedFindings = [...abnormalFindings]
      updatedFindings[existingIndex] = newFinding
    } else {
      // 添加新记录
      updatedFindings = [...abnormalFindings, newFinding]
    }
    
    this.setData({
      abnormalFindings: updatedFindings,
      showAbnormalDialog: false,
      currentAbnormalItem: null
    })
    
    // 重新计算异常总数
    this.updateAbnormalCount()
  },

  // 取消异常记录
  cancelAbnormalFinding() {
    // 将对应项目的结果重置为未检查
    const { currentAbnormalItem } = this.data
    if (currentAbnormalItem) {
      const items = this.data.inspectionItems.map(item => {
        if (item.id === currentAbnormalItem.id) {
          return { ...item, result: 'not_checked' }
        }
        return item
      })
      
      this.setData({ inspectionItems: items })
    }
    
    this.setData({
      showAbnormalDialog: false,
      currentAbnormalItem: null
    })
  },

  // 删除异常记录
  deleteAbnormalFinding(e: any) {
    const { findingId } = e.currentTarget.dataset
    
    wx.showModal({
      title: '确认删除',
      content: '是否删除这条异常记录？',
      success: (res) => {
        if (res.confirm) {
          const updatedFindings = this.data.abnormalFindings.filter(finding => finding.id !== findingId)
          this.setData({ abnormalFindings: updatedFindings })
          
          // 将对应巡检项目结果重置
          const finding = this.data.abnormalFindings.find(f => f.id === findingId)
          if (finding) {
            const items = this.data.inspectionItems.map(item => {
              if (item.id === finding.itemId) {
                return { ...item, result: 'not_checked' }
              }
              return item
            })
            this.setData({ inspectionItems: items })
          }
          
          this.updateAbnormalCount()
        }
      }
    })
  },

  // 更新异常个体总数
  updateAbnormalCount() {
    const totalAbnormal = this.data.abnormalFindings.reduce((sum, finding) => sum + finding.affectedCount, 0)
    this.setData({
      'formData.abnormalCount': totalAbnormal
    })
  },

  // 日期时间选择器
  onDateChange(e: any) {
    const { field } = e.currentTarget.dataset
    this.setData({
      [`formData.${field}`]: e.detail.value
    })
    this.validateField(field, e.detail.value)
  },

  onTimeChange(e: any) {
    const { field } = e.currentTarget.dataset
    this.setData({
      [`formData.${field}`]: e.detail.value
    })
    this.validateField(field, e.detail.value)
  },

  // 字段验证
  validateField(field: string, value: any) {
    const errors = { ...this.data.formErrors }
    
    switch (field) {
      case 'batchId':
        if (!value) {
          errors[field] = '请选择巡检批次'
        } else {
          delete errors[field]
        }
        break
      case 'locationId':
        if (!value || value.trim().length === 0) {
          errors[field] = '请输入巡检位置'
        } else {
          delete errors[field]
        }
        break
      case 'inspector':
        if (!value || value.trim().length === 0) {
          errors[field] = '请输入检查员姓名'
        } else {
          delete errors[field]
        }
        break
      case 'totalInspected':
        if (!value || value <= 0) {
          errors[field] = '巡检数量必须大于0'
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
    if (!formData.batchId) errors.batchId = '请选择巡检批次'
    if (!formData.locationId) errors.locationId = '请输入巡检位置'
    if (!formData.inspector) errors.inspector = '请输入检查员姓名'
    if (!formData.totalInspected || formData.totalInspected <= 0) errors.totalInspected = '巡检数量必须大于0'
    if (!formData.inspectionDate) errors.inspectionDate = '请选择巡检日期'
    
    // 检查是否至少选择了一些巡检项目
    const checkedItems = this.data.inspectionItems.filter(item => item.checked)
    if (checkedItems.length === 0) {
      errors.inspectionItems = '请至少选择一个巡检项目'
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
      const { formData, inspectionItems, abnormalFindings } = this.data
      
      // 构建巡检记录数据
      const inspectionRecord = {
        inspector: formData.inspector,
        inspectionItems: inspectionItems.filter(item => item.checked).map(item => item.name),
        abnormalFindings: abnormalFindings.map(finding => finding.description),
        totalInspected: formData.totalInspected,
        abnormalCount: formData.abnormalCount,
        notes: formData.notes,
        itemResults: inspectionItems.filter(item => item.checked).map(item => ({
          itemId: item.id,
          itemName: item.name,
          result: item.result
        }))
      }
      
      // 调用云函数创建预防记录
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'create_prevention_record',
          preventionType: 'inspection',
          batchId: formData.batchId,
          locationId: formData.locationId,
          inspectionRecord,
          executionDate: formData.inspectionDate,
          executionTime: formData.inspectionTime,
          operator: formData.inspector,
          effectiveness: abnormalFindings.length === 0 ? 'excellent' : (abnormalFindings.length > 3 ? 'poor' : 'good')
        }
      })
      
      if (result.result && result.result.success) {
        wx.showToast({
          title: '健康巡检记录保存成功',
          icon: 'success'
        })
        
        // 如果有异常发现，提示是否进行AI诊断
        if (abnormalFindings.length > 0) {
          this.handleAbnormalFindings(result.result.data.recordId)
        } else {
          // 返回上一页
          setTimeout(() => {
            wx.navigateBack()
          }, 1500)
        }
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

  // 处理异常发现
  handleAbnormalFindings(preventionRecordId: string) {
    const { abnormalFindings } = this.data
    const totalAbnormal = abnormalFindings.reduce((sum, finding) => sum + finding.affectedCount, 0)
    
    wx.showModal({
      title: '发现健康异常',
      content: `巡检发现${abnormalFindings.length}项异常，涉及${totalAbnormal}只个体。是否立即进行AI诊断？`,
      confirmText: '立即诊断',
      cancelText: '稍后处理',
      success: (res) => {
        if (res.confirm) {
          // 跳转到AI诊断页面
          const symptoms = abnormalFindings.map(finding => `${finding.itemName}：${finding.description}`).join('；')
          wx.navigateTo({
            url: `/pages/ai-diagnosis/ai-diagnosis?sourceType=inspection&sourceRecordId=${preventionRecordId}&symptoms=${encodeURIComponent(symptoms)}&affectedCount=${totalAbnormal}`
          })
        } else {
          // 返回上一页
          wx.navigateBack()
        }
      }
    })
  },

  // 快速标记所有项目为正常
  markAllNormal() {
    wx.showModal({
      title: '快速标记',
      content: '是否将所有已选择的巡检项目标记为正常？',
      success: (res) => {
        if (res.confirm) {
          const items = this.data.inspectionItems.map(item => {
            if (item.checked) {
              return { ...item, result: 'normal' }
            }
            return item
          })
          
          this.setData({ 
            inspectionItems: items,
            abnormalFindings: []
          })
          this.updateAbnormalCount()
        }
      }
    })
  },

  // 重置表单
  resetForm() {
    wx.showModal({
      title: '确认重置',
      content: '是否清空所有已填写的信息？',
      success: (res) => {
        if (res.confirm) {
          this.initializeForm()
          
          // 重置巡检项目
          const resetItems = this.data.inspectionItems.map(item => ({
            ...item,
            checked: true,
            result: 'not_checked'
          }))
          
          this.setData({
            formData: {
              ...this.data.formData,
              batchId: '',
              locationId: '',
              totalInspected: 0,
              abnormalCount: 0,
              notes: ''
            },
            inspectionItems: resetItems,
            abnormalFindings: [],
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
