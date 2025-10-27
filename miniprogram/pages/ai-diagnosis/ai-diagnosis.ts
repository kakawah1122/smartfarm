// ai-diagnosis.ts - AI智能诊断页面
import { createPageWithNavbar } from '../../utils/navigation'

// 页面配置对象
const pageConfig = {
  data: {
    // 输入数据
    symptoms: '',
    affectedCount: '',  // 改为空字符串，使用占位符
    dayAge: 0,
    images: [] as string[],
    
    // 批次相关
    selectedBatchId: '',
    selectedBatchNumber: '',
    availableBatches: [] as any[],
    batchPickerRange: [] as string[],
    batchPickerIndex: 0,
    
    // 常见症状标签（快捷填充用）
    commonSymptoms: [
      { id: 'fever', name: '发热' },
      { id: 'cough', name: '咳嗽' },
      { id: 'diarrhea', name: '腹泻' },
      { id: 'appetite', name: '食欲不振' },
      { id: 'lethargy', name: '精神萎靡' },
      { id: 'respiratory', name: '呼吸困难' },
      { id: 'discharge', name: '鼻眼分泌物' },
      { id: 'lameness', name: '跛行' }
    ],
    
    // AI诊断结果
    diagnosisResult: null as any,
    
    // 页面状态
    loading: false,
    submitting: false,
    
    // 来源记录ID（从健康记录页面跳转时传入）
    sourceRecordId: '',
    
    // 表单验证
    formValid: false,

    // 诊断任务ID
    diagnosisId: '',
    diagnosisStatus: 'idle' as 'idle' | 'processing' | 'completed' | 'failed' | 'timeout',
    pollRetries: 0,
    showPolling: false
  },

  onLoad(options: any) {
    const { recordId } = options || {}
    if (recordId) {
      this.setData({ sourceRecordId: recordId })
    }
    
    // 加载批次列表
    this.loadBatchList()
    
    this.validateForm()
  },

  onShow() {
    // 页面显示时重新验证表单
    this.validateForm()
  },

  // 加载批次列表
  async loadBatchList() {
    try {
      wx.showLoading({ title: '加载批次...' })
      
      const result = await wx.cloud.callFunction({
        name: 'production-entry',
        data: {
          action: 'getActiveBatches'  // ✅ 使用正确的 action
        }
      })

      wx.hideLoading()

      if (result.result && result.result.success) {
        // ✅ getActiveBatches 直接返回批次数组在 data 中
        const activeBatches = result.result.data || []
        
        
        if (activeBatches.length > 0) {
          activeBatches.forEach((batch: any) => {
              _id: batch._id,
              日龄: batch.dayAge,
              数量: batch.currentCount || batch.quantity,
              入栏日期: batch.entryDate
            })
          })
        }
        

        if (activeBatches.length === 0) {
          wx.showModal({
            title: '提示',
            content: '暂无存栏批次，请先创建批次或检查批次状态',
            showCancel: false,
            success: () => {
              wx.navigateBack()
            }
          })
          return
        }

        // 构建picker显示数组（显示批次号和日龄）
        const pickerRange = activeBatches.map((batch: any) => 
          `${batch.batchNumber} (${batch.dayAge || 0}日龄)`
        )

        this.setData({
          availableBatches: activeBatches,
          batchPickerRange: pickerRange
        })

        // 自动选择批次
        let selectedIndex = 0
        
        // 优先选择缓存的当前批次
        const cachedBatchId = wx.getStorageSync('currentBatchId')
        if (cachedBatchId) {
          const index = activeBatches.findIndex((b: any) => b._id === cachedBatchId)
          if (index >= 0) {
            selectedIndex = index
          }
        }
        
        // 自动选择第一个批次
        this.setData({
          batchPickerIndex: selectedIndex
        })
        
        // 触发选择事件，填充批次信息
        this.onBatchPickerChange({ detail: { value: selectedIndex } })
        
          存栏批次数: activeBatches.length,
          已选择: activeBatches[selectedIndex]?.batchNumber
        })
      } else {
        throw new Error(result.result?.message || '加载批次失败')
      }
    } catch (error: any) {
      wx.hideLoading()
      console.error('加载批次列表失败:', error)
      wx.showModal({
        title: '加载失败',
        content: error.message || '无法加载批次列表，请重试',
        showCancel: true,
        confirmText: '重试',
        cancelText: '返回',
        success: (res) => {
          if (res.confirm) {
            this.loadBatchList()
          } else {
            wx.navigateBack()
          }
        }
      })
    }
  },

  // 批次选择器变化
  onBatchPickerChange(e: any) {
    const index = parseInt(e.detail.value)
    const selectedBatch = this.data.availableBatches[index]
    
    if (selectedBatch) {
        批次号: selectedBatch.batchNumber,
        日龄: selectedBatch.dayAge,
        批次ID: selectedBatch._id
      })
      
      this.setData({
        batchPickerIndex: index,
        selectedBatchId: selectedBatch._id,
        selectedBatchNumber: selectedBatch.batchNumber,
        dayAge: selectedBatch.dayAge || 0
      }, () => {
        this.validateForm()
      })
    }
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  },

  // 症状描述输入
  onSymptomsInput(e: any) {
    const symptomsText = e.detail.value || ''
    
    this.setData({ 
      symptoms: symptomsText 
    }, () => {
      this.validateForm()
    })
  },

  // 受影响数量输入
  onAffectedCountInput(e: any) {
    const value = e.detail.value
    // 保持原始输入值，空字符串时不转为0
    this.setData({ 
      affectedCount: value 
    }, () => {
      this.validateForm()
    })
  },

  // 点击症状标签填充到输入框
  onSymptomTagTap(e: any) {
    const { name } = e.currentTarget.dataset
    const currentSymptoms = this.data.symptoms.trim()
    
    // 检查是否已包含该症状，如果已包含则不重复添加
    if (currentSymptoms.includes(name)) {
      return
    }
    
    // 拼接症状（用中文顿号分隔）
    let newSymptoms = ''
    if (currentSymptoms) {
      newSymptoms = `${currentSymptoms}、${name}`
    } else {
      newSymptoms = name
    }
    
    
    this.setData({ 
      symptoms: newSymptoms 
    }, () => {
      this.validateForm()
    })
  },

  // 选择图片
  onChooseImage() {
    const remainingCount = 9 - this.data.images.length
    
    wx.chooseMedia({
      count: remainingCount,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        // ✨ 显示上传进度
        wx.showLoading({ title: '压缩并上传图片中...' })
        
        try {
          // ✨ 压缩并上传所有图片到云存储
          const uploadPromises = res.tempFiles.map(async (file) => {
            // ✅ 压缩图片（减小文件大小，加快上传和AI处理速度）
            let finalPath = file.tempFilePath
            try {
              const compressResult = await wx.compressImage({
                src: file.tempFilePath,
                quality: 70  // 压缩质量70%，平衡清晰度和文件大小
              })
              finalPath = compressResult.tempFilePath
            } catch (compressError) {
              console.warn('图片压缩失败，使用原图:', compressError)
              // 压缩失败则使用原图
            }
            
            const timestamp = Date.now()
            const random = Math.floor(Math.random() * 10000)
            const ext = file.tempFilePath.split('.').pop()
            const cloudPath = `ai-diagnosis/${timestamp}_${random}.${ext}`
            
            const uploadResult = await wx.cloud.uploadFile({
              cloudPath: cloudPath,
              filePath: finalPath  // ✅ 使用压缩后的图片
            })
            
            return uploadResult.fileID
          })
          
          const uploadedFileIDs = await Promise.all(uploadPromises)
          const allImages = [...this.data.images, ...uploadedFileIDs]
          
          wx.hideLoading()
          
          this.setData({
            images: allImages.slice(0, 9) // 最多9张图片
          }, () => {
            this.validateForm()
          })
          
          wx.showToast({
            title: `已上传${uploadedFileIDs.length}张图片`,
            icon: 'success',
            duration: 1500
          })
        } catch (error: any) {
          wx.hideLoading()
          console.error('图片上传失败:', error)
          wx.showToast({
            title: '图片上传失败，请重试',
            icon: 'none'
          })
        }
      },
      fail: (error) => {
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
    const { symptoms, selectedBatchId } = this.data
    const hasSymptoms = symptoms.trim().length > 0
    const hasBatch = selectedBatchId.length > 0
    
    const isValid = hasBatch && hasSymptoms
    
      批次已选择: hasBatch,
      症状描述: symptoms,
      症状描述有效: hasSymptoms,
      表单有效: isValid
    })
    
    this.setData({
      formValid: isValid
    })
  },

  // 开始AI诊断
  async startDiagnosis() {
    if (!this.data.selectedBatchId) {
      wx.showToast({ title: '请先选择批次', icon: 'none' })
      return
    }
    if (!this.data.formValid) {
      wx.showToast({ title: '请输入症状描述', icon: 'none' })
      return
    }

    this.setData({ submitting: true })

    try {
      const allSymptoms = this.data.symptoms.trim()
      const affectedCount = parseInt(this.data.affectedCount) || 0

      if (!allSymptoms || allSymptoms === '') {
        wx.showToast({ title: '症状不能为空', icon: 'none' })
        this.setData({ submitting: false })
        return
      }

      const symptomsList = allSymptoms
        .split(/[、，,；;]/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0)

      // ✨ 改为异步：提交诊断任务
      const result = await wx.cloud.callFunction({
        name: 'ai-diagnosis',
        data: {
          action: 'ai_diagnosis',
          selectedBatchId: this.data.selectedBatchId,
          symptoms: symptomsList,
          symptomsText: allSymptoms,
          affectedCount: affectedCount,
          dayAge: this.data.dayAge,
          images: this.data.images,
          batchId: this.data.selectedBatchId,
          healthRecordId: this.data.sourceRecordId || null
        }
      })


      if (result.result && result.result.success) {
        const { diagnosisId } = result.result.data
        
        // ✨ 保存诊断ID并开始轮询
        this.setData({
          diagnosisId: diagnosisId,
          diagnosisStatus: 'processing',
          pollRetries: 0,
          showPolling: true
        })

        wx.showToast({ title: '诊断已提交，处理中...', icon: 'success', duration: 1500 })
        
        // 开始轮询获取结果
        this.pollDiagnosisResult(diagnosisId)
      } else {
        throw new Error(result.result?.error || '诊断提交失败')
      }
    } catch (error: any) {
      wx.showToast({ title: error.message || '诊断失败，请重试', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },

  /**
   * ✨ 轮询获取诊断结果
   */
  pollDiagnosisResult(diagnosisId: string) {
    const maxRetries = 120  // 最多轮询120次 (2分钟)
    const pollInterval = 1000  // 每1秒查询一次

    const poll = async () => {
      const retries = (this.data.pollRetries || 0) + 1

      try {
        // 从数据库查询诊断状态
        const db = wx.cloud.database()
        const result = await db.collection('ai_diagnosis_tasks')
          .doc(diagnosisId)
          .get()

        const task = result.data


        if (task.status === 'completed') {
          // ✨ 诊断完成
          this.setData({
            diagnosisStatus: 'completed',
            diagnosisResult: task.result,
            showPolling: false
          })
          wx.showToast({ title: '诊断完成', icon: 'success' })
        } else if (task.status === 'failed') {
          // ✨ 诊断失败
          console.error('====== 诊断失败详情 ======')
          console.error('错误信息:', task.error)
          console.error('任务ID:', diagnosisId)
          console.error('完整任务:', task)
          
          this.setData({
            diagnosisStatus: 'failed',
            diagnosisError: task.error,
            showPolling: false
          })
          
          // 显示详细错误信息
          wx.showModal({
            title: '诊断失败',
            content: `错误详情: ${task.error || '未知错误'}\n\n请截图此信息并联系技术支持`,
            showCancel: false,
            confirmText: '我知道了'
          })
        } else {
          // 还在处理中，继续轮询
          this.setData({ pollRetries: retries })
          
          if (retries < maxRetries) {
            setTimeout(() => poll(), pollInterval)
          } else {
            // 超时
            this.setData({
              diagnosisStatus: 'timeout',
              showPolling: false
            })
            wx.showToast({ title: '诊断超时，请重试', icon: 'error' })
          }
        }
      } catch (error: any) {
        console.error(`轮询失败: ${error.message}`)
        
        // 继续轮询，直到超时
        if (retries < maxRetries) {
          this.setData({ pollRetries: retries })
          setTimeout(() => poll(), pollInterval)
        } else {
          wx.showToast({ title: '诊断超时，请重试', icon: 'error' })
        }
      }
    }

    // 开始轮询
    poll()
  },

  // 采纳AI建议
  async adoptAdvice() {
    if (!this.data.diagnosisResult) return

    try {
      const diagnosis = this.data.diagnosisResult
      const severity = diagnosis.severity || diagnosis.primaryDiagnosis?.severity || 'moderate'
      
      // 根据严重程度判断处理方式
      if (severity === 'fatal' || severity === 'critical') {
        // 病情严重，提示用户选择处理方式
        wx.showModal({
          title: '诊断结果',
          content: `诊断显示病情${severity === 'fatal' ? '极为严重' : '严重'}，建议立即处理`,
          confirmText: '开始治疗',
          cancelText: '记录死亡',
          success: (res) => {
            if (res.confirm) {
              this.startTreatment(diagnosis)
            } else if (res.cancel) {
              this.recordDeath(diagnosis)
            }
          }
        })
      } else {
        // 病情不严重，直接进入治疗流程
        this.startTreatment(diagnosis)
      }
    } catch (error) {
      console.error('采纳AI建议失败:', error)
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
    }
  },

  // 开始治疗
  async startTreatment(diagnosis: any) {
    try {
      wx.showLoading({ title: '创建治疗记录...' })
      
      // 转换受影响数量为数字
      const affectedCount = parseInt(this.data.affectedCount) || 0
      
      // 创建治疗记录
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'create_treatment_from_diagnosis',
          diagnosisId: diagnosis._id,
          batchId: this.data.selectedBatchId,
          affectedCount: affectedCount,
          diagnosis: diagnosis.primaryDiagnosis?.disease || '待确定',
          recommendations: diagnosis.recommendations
        }
      })
      
      wx.hideLoading()
      
      if (result.result && result.result.success) {
        wx.showToast({
          title: '治疗记录已创建',
          icon: 'success'
        })
        
        // 跳转到治疗记录页面
        setTimeout(() => {
          wx.navigateTo({
            url: `/pages/treatment-record/treatment-record?treatmentId=${result.result.data.treatmentId}`
          })
        }, 1500)
      } else {
        throw new Error(result.result?.message || '创建治疗记录失败')
      }
    } catch (error: any) {
      wx.hideLoading()
      wx.showToast({
        title: error.message || '创建治疗记录失败',
        icon: 'none'
      })
    }
  },

  // 记录死亡
  async recordDeath(diagnosis: any) {
    const affectedCount = parseInt(this.data.affectedCount) || 0
    
    wx.showModal({
      title: '确认记录死亡',
      content: `确认${affectedCount}只动物因${diagnosis.primaryDiagnosis?.disease || '疾病'}死亡？`,
      success: (res) => {
        if (res.confirm) {
          // 跳转到死亡记录页面，携带诊断信息
          wx.navigateTo({
            url: `/pages/death-record/death-record?diagnosisId=${diagnosis._id}&affectedCount=${affectedCount}`
          })
        }
      }
    })
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
      // 已移除调试日志
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
            affectedCount: '',  // 重置为空字符串
            images: []
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
