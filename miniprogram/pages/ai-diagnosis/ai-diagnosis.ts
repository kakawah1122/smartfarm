// ai-diagnosis.ts - AI智能诊断页面
import { createPageWithNavbar } from '../../utils/navigation'

// 页面配置对象
const pageConfig = {
  data: {
    // 输入数据
    symptoms: '',
    affectedCount: 0,
    dayAge: 0,
    temperature: 0,
    images: [] as string[],
    
    // 常见症状标签
    commonSymptoms: [
      { id: 'fever', name: '发热', selected: false },
      { id: 'cough', name: '咳嗽', selected: false },
      { id: 'diarrhea', name: '腹泻', selected: false },
      { id: 'appetite', name: '食欲不振', selected: false },
      { id: 'lethargy', name: '精神萎靡', selected: false },
      { id: 'respiratory', name: '呼吸困难', selected: false },
      { id: 'discharge', name: '鼻眼分泌物', selected: false },
      { id: 'lameness', name: '跛行', selected: false }
    ],
    
    // AI诊断结果
    diagnosisResult: null as any,
    
    // 页面状态
    loading: false,
    submitting: false,
    
    // 来源记录ID（从健康记录页面跳转时传入）
    sourceRecordId: '',
    
    // 表单验证
    formValid: false
  },

  onLoad(options: any) {
    const { recordId } = options || {}
    if (recordId) {
      this.setData({ sourceRecordId: recordId })
    }
    
    this.validateForm()
  },

  onShow() {
    // 页面显示时重新验证表单
    this.validateForm()
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  },

  // 症状描述输入
  onSymptomsInput(e: any) {
    this.setData({ 
      symptoms: e.detail.value 
    }, () => {
      this.validateForm()
    })
  },

  // 受影响数量输入
  onAffectedCountInput(e: any) {
    const count = parseInt(e.detail.value) || 0
    this.setData({ 
      affectedCount: count 
    }, () => {
      this.validateForm()
    })
  },

  // 日龄输入
  onDayAgeInput(e: any) {
    const age = parseInt(e.detail.value) || 0
    this.setData({ 
      dayAge: age 
    }, () => {
      this.validateForm()
    })
  },

  // 环境温度输入
  onTemperatureInput(e: any) {
    const temp = parseFloat(e.detail.value) || 0
    this.setData({ 
      temperature: temp 
    }, () => {
      this.validateForm()
    })
  },

  // 切换症状标签
  onSymptomTagTap(e: any) {
    const { id } = e.currentTarget.dataset
    const symptoms = this.data.commonSymptoms.map(item => {
      if (item.id === id) {
        return { ...item, selected: !item.selected }
      }
      return item
    })
    
    this.setData({ 
      commonSymptoms: symptoms 
    }, () => {
      this.validateForm()
    })
  },

  // 选择图片
  onChooseImage() {
    const remainingCount = 3 - this.data.images.length
    
    wx.chooseMedia({
      count: remainingCount,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newImages = res.tempFiles.map(file => file.tempFilePath)
        const allImages = [...this.data.images, ...newImages]
        
        this.setData({
          images: allImages.slice(0, 3) // 最多3张图片
        }, () => {
          this.validateForm()
        })
      },
      fail: (error) => {
        console.error('选择图片失败:', error)
        wx.showToast({
          title: '图片选择失败',
          icon: 'none'
        })
      }
    })
  },

  // 删除图片
  onDeleteImage(e: any) {
    const { index } = e.currentTarget.dataset
    const images = [...this.data.images]
    images.splice(index, 1)
    
    this.setData({ 
      images 
    }, () => {
      this.validateForm()
    })
  },

  // 预览图片
  onPreviewImage(e: any) {
    const { src } = e.currentTarget.dataset
    wx.previewImage({
      current: src,
      urls: this.data.images
    })
  },

  // 表单验证
  validateForm() {
    const { symptoms, commonSymptoms } = this.data
    const hasSymptoms = symptoms.trim().length > 0
    const hasSelectedTags = commonSymptoms.some(item => item.selected)
    
    this.setData({
      formValid: hasSymptoms || hasSelectedTags
    })
  },

  // 获取选中的症状标签
  getSelectedSymptoms(): string[] {
    return this.data.commonSymptoms
      .filter(item => item.selected)
      .map(item => item.name)
  },

  // 开始AI诊断
  async startDiagnosis() {
    if (!this.data.formValid) {
      wx.showToast({
        title: '请输入症状描述或选择症状标签',
        icon: 'none'
      })
      return
    }

    this.setData({ submitting: true })

    try {
      // 收集所有症状信息
      const selectedSymptoms = this.getSelectedSymptoms()
      const allSymptoms = [
        this.data.symptoms.trim(),
        ...selectedSymptoms
      ].filter(Boolean).join('；')

      // 调用AI诊断云函数
      const result = await wx.cloud.callFunction({
        name: 'ai-diagnosis',
        data: {
          action: 'start_diagnosis',
          symptoms: allSymptoms,
          affectedCount: this.data.affectedCount,
          dayAge: this.data.dayAge,
          temperature: this.data.temperature,
          images: this.data.images,
          healthRecordId: this.data.sourceRecordId || null
        }
      })

      if (result.result && result.result.success) {
        this.setData({
          diagnosisResult: result.result.data
        })
        
        wx.showToast({
          title: 'AI诊断完成',
          icon: 'success'
        })
      } else {
        throw new Error(result.result?.message || 'AI诊断失败')
      }
    } catch (error: any) {
      console.error('AI诊断失败:', error)
      wx.showToast({
        title: error.message || 'AI诊断失败，请重试',
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false })
    }
  },

  // 采纳AI建议
  async adoptAdvice() {
    if (!this.data.diagnosisResult) return

    try {
      // 更新诊断记录状态为已采纳
      await wx.cloud.callFunction({
        name: 'ai-diagnosis',
        data: {
          action: 'update_diagnosis_status',
          diagnosisId: this.data.diagnosisResult._id,
          status: 'adopted',
          updateData: {
            adoptedAt: new Date().toISOString()
          }
        }
      })

      wx.showToast({
        title: '建议已采纳',
        icon: 'success'
      })

      // 跳转到治疗记录页面
      setTimeout(() => {
        wx.navigateTo({
          url: `/pages/treatment-record/treatment-record?diagnosisId=${this.data.diagnosisResult._id}`
        })
      }, 1500)
    } catch (error) {
      console.error('采纳建议失败:', error)
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
    }
  },

  // 保存为记录
  async saveRecord() {
    if (!this.data.diagnosisResult) return

    try {
      wx.showToast({
        title: '记录已保存',
        icon: 'success'
      })
      
      // 返回健康管理页面
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    } catch (error) {
      console.error('保存记录失败:', error)
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      })
    }
  },

  // 重新诊断
  resetDiagnosis() {
    wx.showModal({
      title: '确认重新诊断',
      content: '是否清除当前诊断结果，重新进行诊断？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            diagnosisResult: null,
            symptoms: '',
            affectedCount: 0,
            dayAge: 0,
            temperature: 0,
            images: [],
            commonSymptoms: this.data.commonSymptoms.map(item => ({ ...item, selected: false }))
          })
          this.validateForm()
        }
      }
    })
  },

  // 查看诊断历史
  viewDiagnosisHistory() {
    wx.navigateTo({
      url: '/pages/diagnosis-history/diagnosis-history'
    })
  },

  // 联系兽医（模拟功能）
  contactVet() {
    wx.showModal({
      title: '联系专业兽医',
      content: '是否拨打兽医服务热线：400-xxx-xxxx？',
      confirmText: '拨打',
      success: (res) => {
        if (res.confirm) {
          wx.makePhoneCall({
            phoneNumber: '400-xxx-xxxx',
            fail: () => {
              wx.showToast({
                title: '拨打电话失败',
                icon: 'none'
              })
            }
          })
        }
      }
    })
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
