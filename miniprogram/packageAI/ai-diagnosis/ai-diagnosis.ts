// ai-diagnosis.ts - AI智能诊断页面
import { createPageWithNavbar } from '../../utils/navigation'
import { logger } from '../../utils/logger'

type AnyObject = Record<string, unknown>
type SymptomOption = { id: string; name: string; checked: boolean }
type AutopsyAbnormality = { id: string; name: string; checked: boolean }

type CloudResponseSuccess<T> = {
  success: true
  data?: T
  message?: string
  error?: string
}

type CloudResponseFailure = {
  success: false
  data?: never
  message?: string
  error?: string
}

type CloudResponse<T> = CloudResponseSuccess<T> | CloudResponseFailure

function normalizeCloudResult<T = AnyObject>(
  result: unknown): CloudResponse<T> | null {
  const payload = result?.result

  if (!payload) {
    return null
  }

  if (typeof payload === 'string') {
    const trimmed = payload.trim()

    if (!trimmed) {
      return null
    }

    try {
      return JSON.parse(trimmed) as CloudResponse<T>
    } catch (e) {
      logger.error('云函数返回的字符串结果无法解析为JSON', e)
      return null
    }
  }

  if (typeof payload === 'object') {
    return payload as CloudResponse<T>
  }

  return null
}

// 页面配置对象
const pageConfig: AnyObject = {
  data: {
    // 诊断类型
    diagnosisType: 'live_diagnosis' as 'live_diagnosis' | 'autopsy_analysis',
    diagnosisTypeOptions: [
      { label: '病鹅诊断', value: 'live_diagnosis' },
      { label: '死因剖析', value: 'autopsy_analysis' }
    ],
    
    // 输入数据
    symptoms: '',
    affectedCount: '',  // 病鹅诊断使用
    deathCount: '',     // 死因剖析使用
    dayAge: 0,
    images: [] as string[],
    validImagesCount: 0,  // 有效图片数量
    
    // 批次相关
    selectedBatchId: '',
    selectedBatchNumber: '',
    availableBatches: [] as unknown[],
    batchPickerRange: [] as string[],
    batchPickerIndex: 0,
    
    // 常见症状标签（快捷填充用）
    commonSymptoms: [
      { id: 'fever', name: '发热', checked: false },
      { id: 'cough', name: '咳嗽', checked: false },
      { id: 'diarrhea', name: '腹泻', checked: false },
      { id: 'appetite', name: '食欲不振', checked: false },
      { id: 'lethargy', name: '精神萎靡', checked: false },
      { id: 'respiratory', name: '呼吸困难', checked: false },
      { id: 'discharge', name: '鼻眼分泌物', checked: false },
      { id: 'lameness', name: '跛行', checked: false }
    ] as SymptomOption[],
    
    // 死因剖析专用：常见异常快捷选择
    autopsyAbnormalities: [
      { id: 'liver_black', name: '肝脏颜色发黑', checked: false },
      { id: 'liver_yellow', name: '肝脏颜色发黄', checked: false },
      { id: 'liver_spots', name: '肝脏有白点', checked: false },
      { id: 'intestine_red', name: '肠道发红', checked: false },
      { id: 'intestine_blood', name: '肠道有血', checked: false },
      { id: 'intestine_smell', name: '肠道很臭', checked: false },
      { id: 'lung_water', name: '肺部有水', checked: false },
      { id: 'lung_black', name: '肺部发黑', checked: false },
      { id: 'heart_spots', name: '心脏有白点', checked: false },
      { id: 'heart_fluid', name: '心脏积液', checked: false }
    ] as AutopsyAbnormality[],
    autopsyDescription: '', // 自由描述剖检所见
    
    // AI诊断结果
    diagnosisResult: null as AnyObject | null,
    
    // 页面状态
    loading: false,
    submitting: false,
    isSaving: false,  // ✅ 防止重复保存
    
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

  onLoad(options: unknown) {
    const { recordId } = options || {}
    
    // 重置诊断状态（修复真机缓存问题）
    this.setData({
      diagnosisStatus: 'idle',
      diagnosisResult: null,
      diagnosisError: '',
      diagnosisId: '',
      showPolling: false,
      pollRetries: 0,
      sourceRecordId: recordId || '',
      // 🔧 确保基础字段有默认值（修复真机显示问题）
      selectedBatchId: '',
      selectedBatchNumber: '',
      dayAge: 0,
      affectedCount: '',
      deathCount: '',
      symptoms: '',
      autopsyFindings: '',
      diagnosisType: 'live_diagnosis'
    })
    
    // 延迟加载批次列表，确保页面渲染完成
    wx.nextTick(() => {
      this.loadBatchList()
    })
    
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
      
      const rawResult = await wx.cloud.callFunction({
        name: 'production-entry',
        data: {
          action: 'getActiveBatches'  // ✅ 使用正确的 action
        }
      })

      wx.hideLoading()

      const result = normalizeCloudResult<{ _id: string; batchNumber: string; dayAge?: number }[]>(rawResult)

      if (result?.success) {
        // ✅ getActiveBatches 直接返回批次数组在 data 中
        const activeBatches = result.data || []

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
        const pickerRange = activeBatches.map((batch: unknown) => 
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
          const index = activeBatches.findIndex((b: unknown) => b._id === cachedBatchId)
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
      } else {
        throw new Error(result?.message || result?.error || '加载批次失败')
      }
    } catch (error: unknown) {
      wx.hideLoading()
      logger.error('加载批次列表失败:', error)
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

  // 诊断类型选择器变化
  onDiagnosisTypeChange(e: WechatMiniprogram.RadioGroupChange) {
    const selectedValue = e.detail.value
    const selectedType = this.data.diagnosisTypeOptions.find((item: { label: string; value: string }) => item.value === selectedValue)
    
    if (!selectedType) {
      return
    }

    this.setData({
      diagnosisType: selectedType.value as 'live_diagnosis' | 'autopsy_analysis',
      // 切换类型时清空相关字段
      affectedCount: '',
      deathCount: '',
      symptoms: '',
      images: [],
      validImagesCount: 0,
      autopsyDescription: '',
      commonSymptoms: this.data.commonSymptoms.map((item: SymptomOption) => ({ ...item, checked: false })),
      autopsyAbnormalities: this.data.autopsyAbnormalities.map((item: AutopsyAbnormality) => ({ ...item, checked: false }))
    }, () => {
      this.validateForm()
    })
  },

  // 兼容旧事件名
  onDeleteImage(e: WechatMiniprogram.TouchEvent) {
    this.onRemoveImage(e)
  },

  // 批次选择器变化
  onBatchPickerChange(e: WechatMiniprogram.PickerChange) {
    const rawValue = Array.isArray(e.detail.value) ? e.detail.value[0] : e.detail.value
    const index = parseInt(String(rawValue), 10)
    const selectedBatch = this.data.availableBatches[index] as AnyObject
    
    if (selectedBatch) {
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
  onSymptomsInput(e: CustomEvent) {
    const symptomsText = e.detail.value || ''
    
    this.setData({ 
      symptoms: symptomsText 
    }, () => {
      this.validateForm()
    })
  },

  // 受影响数量输入
  onAffectedCountInput(e: CustomEvent) {
    const value = e.detail.value
    // 保持原始输入值，空字符串时不转为0
    this.setData({ 
      affectedCount: value 
    }, () => {
      this.validateForm()
    })
  },

  // 死亡数量输入（死因剖析专用）
  onDeathCountInput(e: CustomEvent) {
    const value = e.detail.value
    this.setData({ 
      deathCount: value 
    }, () => {
      this.validateForm()
    })
  },

  // 异常勾选（死因剖析专用）
  onAbnormalityChange(e: CustomEvent) {
    const { index } = e.currentTarget.dataset
    const abnormalities = [...this.data.autopsyAbnormalities]
    abnormalities[index].checked = !abnormalities[index].checked
    
    // 收集所有选中的异常名称
    const selectedAbnormalities = abnormalities
      .filter(item => item.checked)
      .map(item => item.name)
    
    // 拼接成文本（用顿号分隔）
    const abnormalitiesText = selectedAbnormalities.join('、')
    
    this.setData({ 
      autopsyAbnormalities: abnormalities,
      autopsyDescription: abnormalitiesText // 填充到文本框
    })
  },

  // 剖检描述输入（死因剖析专用）
  onAutopsyDescriptionInput(e: CustomEvent) {
    const value = e.detail.value
    this.setData({ 
      autopsyDescription: value 
    })
  },

  // 点击症状标签填充到输入框（支持切换）
  onSymptomTagTap(e: WechatMiniprogram.TouchEvent) {
    const { index } = e.currentTarget.dataset as { index: number }
    const symptoms = [...this.data.commonSymptoms] as SymptomOption[]
    
    // 切换选中状态
    symptoms[index].checked = !symptoms[index].checked
    
    // 收集所有选中的症状名称
    const selectedSymptoms = symptoms
      .filter((item: SymptomOption) => item.checked)
      .map((item: SymptomOption) => item.name)
    
    // 拼接成文本（用顿号分隔）
    const symptomsText = selectedSymptoms.join('、')
    
    this.setData({ 
      commonSymptoms: symptoms,
      symptoms: symptomsText // 填充到文本框
    }, () => {
      this.validateForm()
    })
  },

  // 选择图片
  onChooseImage() {
    // ✨ 根据诊断类型限制图片数量
    const diagnosisType = this.data.diagnosisType
    const maxImages = diagnosisType === 'autopsy_analysis' ? 4 : 2
    const currentCount = this.data.images.length
    
    if (currentCount >= maxImages) {
      wx.showToast({
        title: `${diagnosisType === 'autopsy_analysis' ? '剖检照片' : 'AI诊断'}最多支持${maxImages}张图片`,
        icon: 'none',
        duration: 2000
      })
      return
    }
    
    const remainingCount = Math.min(maxImages - currentCount, maxImages)
    
    wx.chooseMedia({
      count: remainingCount,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        // ✨ 显示上传进度
        wx.showLoading({ title: '压缩并上传图片中...' })
        
        try {
          // ✨ 压缩并上传所有图片到云存储
          const uploadPromises = res.tempFiles.map(async (file: WechatMiniprogram.MediaFile) => {
            // ✅ 更激进的压缩（减小文件大小，避免API限制）
            let finalPath = file.tempFilePath
            try {
              const compressResult = await wx.compressImage({
                src: file.tempFilePath,
                quality: 50,  // ✨ 降低到50%质量（AI识别足够）
                compressedWidth: 1024,  // ✨ 限制最大宽度1024px
                compressedHeight: 1024   // ✨ 限制最大高度1024px
              })
              finalPath = compressResult.tempFilePath
            } catch (_compressError) {
              // 压缩失败则使用原图
            }
            
            const timestamp = Date.now()
            const random = Math.floor(Math.random() * 10000)
            const ext = file.tempFilePath.split('.').pop() || 'jpg'
            const cloudPath = `ai-diagnosis/${timestamp}_${random}.${ext}`
            
            const uploadResult = await wx.cloud.uploadFile({
              cloudPath: cloudPath,
              filePath: finalPath  // ✅ 使用压缩后的图片
            })
            
            return uploadResult.fileID
          })
          
          const uploadedFileIDs = await Promise.all(uploadPromises)
          const allImages: string[] = [...this.data.images, ...uploadedFileIDs]
          const maxImages = this.data.diagnosisType === 'autopsy_analysis' ? 4 : 2
          
          wx.hideLoading()
          
          this.setData({
            images: allImages.slice(0, maxImages)
          }, () => {
            this.validateForm()
          })
          
          wx.showToast({
            title: `已上传${uploadedFileIDs.length}张图片`,
            icon: 'success',
            duration: 1500
          })
        } catch (error: unknown) {
          wx.hideLoading()
          logger.error('图片上传失败:', error)
          wx.showToast({
            title: '图片上传失败，请重试',
            icon: 'none'
          })
        }
      },
      fail: (_error) => {
        wx.showToast({
          title: '图片选择失败',
          icon: 'none'
        })
      }
    })
  },

  // 删除图片
  onRemoveImage(e: WechatMiniprogram.TouchEvent) {
    const { index } = e.currentTarget.dataset as { index: number }
    const images = [...this.data.images] as string[]
    images.splice(index, 1)
    
    const validCount = images.filter((img: string) => Boolean(img)).length
    
    this.setData({ 
      images,
      validImagesCount: validCount
    }, () => {
      this.validateForm()
    })
  },

  // 选择单张图片上传到指定位置
  onChooseSingleImage(e: WechatMiniprogram.TouchEvent) {
    const { index } = e.currentTarget.dataset as { index: number | string }
    const targetIndex = typeof index === 'number' ? index : parseInt(index, 10)
    
    // 检查该位置是否已有图片
    if (this.data.images[targetIndex]) {
      wx.showToast({
        title: '该位置已有图片，请先删除',
        icon: 'none',
        duration: 2000
      })
      return
    }
    
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        wx.showLoading({ title: '压缩并上传图片中...' })
        
        try {
          const file = res.tempFiles[0]
          
          // 压缩图片
          let finalPath = file.tempFilePath
          try {
            const compressResult = await wx.compressImage({
              src: file.tempFilePath,
              quality: 50,
              compressedWidth: 1024,
              compressedHeight: 1024
            })
            finalPath = compressResult.tempFilePath
          } catch (_compressError) {
            // 压缩失败则使用原图
          }
          
          // 上传到云存储
          const timestamp = Date.now()
          const random = Math.floor(Math.random() * 10000)
          const ext = file.tempFilePath.split('.').pop() || 'jpg'
          const cloudPath = `ai-diagnosis/${timestamp}_${random}.${ext}`
          
          const uploadResult = await wx.cloud.uploadFile({
            cloudPath: cloudPath,
            filePath: finalPath
          })
          
          wx.hideLoading()
          
          // 更新images数组，在指定位置插入图片
          const newImages = [...this.data.images]
          newImages[targetIndex] = uploadResult.fileID
          const validCount = newImages.filter((img) => Boolean(img)).length
          
          this.setData({
            images: newImages,
            validImagesCount: validCount
          }, () => {
            this.validateForm()
          })
          
          wx.showToast({
            title: '上传成功',
            icon: 'success',
            duration: 1500
          })
        } catch (error: unknown) {
          wx.hideLoading()
          logger.error('图片上传失败:', error)
          wx.showToast({
            title: '图片上传失败，请重试',
            icon: 'none'
          })
        }
      },
      fail: (_error) => {
        wx.showToast({
          title: '图片选择失败',
          icon: 'none'
        })
      }
    })
  },

  // 表单验证
  validateForm() {
    const { diagnosisType, symptoms, selectedBatchId, affectedCount, deathCount } = this.data
    const hasBatch = selectedBatchId.length > 0
    
    let isValid = false
    
    if (diagnosisType === 'live_diagnosis') {
      // 病鹅诊断：必须有批次、症状、受影响数量
      const hasSymptoms = symptoms.trim().length > 0
      const hasValidCount = affectedCount !== '' && parseInt(affectedCount) > 0
      isValid = hasBatch && hasSymptoms && hasValidCount
    } else {
      // 死因剖析：必须有批次、死亡数量即可（症状和剖检信息可选）
      const hasValidDeathCount = deathCount !== '' && parseInt(deathCount) > 0
      isValid = hasBatch && hasValidDeathCount
    }
    
    this.setData({
      formValid: isValid
    })
  },

  // 开始AI诊断
  async startDiagnosis() {
    // ✅ 统一的必填项验证，提供清晰的提示
    if (!this.data.selectedBatchId) {
      wx.showModal({
        title: '请选择批次',
        content: '请先选择要诊断的批次',
        showCancel: false,
        confirmText: '知道了'
      })
      return
    }
    
    const diagnosisType = this.data.diagnosisType
    
    // 根据诊断类型验证必填项
    if (diagnosisType === 'live_diagnosis') {
      // 病鹅诊断验证
      const affectedCount = parseInt(this.data.affectedCount) || 0
      const symptomsText = this.data.symptoms.trim()
      
      if (affectedCount <= 0 && !symptomsText) {
        wx.showModal({
          title: '请完善必填信息',
          content: '病鹅诊断需要填写：\n\n1. 受影响数量（必填）\n2. 症状描述（必填）\n\n请填写完整后再开始诊断',
          showCancel: false,
          confirmText: '知道了'
        })
        return
      }
      
      if (affectedCount <= 0) {
        wx.showModal({
          title: '请输入受影响数量',
          content: '请输入有多少只鹅出现症状',
          showCancel: false,
          confirmText: '知道了'
        })
        return
      }
      
      if (!symptomsText) {
        wx.showModal({
          title: '请输入症状描述',
          content: '请详细描述鹅群症状，或点击下方常见症状标签快速填写',
          showCancel: false,
          confirmText: '知道了'
        })
        return
      }
    } else {
      // 死因剖析验证
      const deathCount = parseInt(this.data.deathCount) || 0
      
      if (deathCount <= 0) {
        wx.showModal({
          title: '请输入死亡数量',
          content: '死因剖析需要填写死亡数量',
          showCancel: false,
          confirmText: '知道了'
        })
        return
      }
    }
    
    // 通用表单验证（兜底检查）
    if (!this.data.formValid) {
      wx.showModal({
        title: '请完善必填信息',
        content: '请检查并填写所有必填项后再开始诊断',
        showCancel: false,
        confirmText: '知道了'
      })
      return
    }

    this.setData({ submitting: true })

    try {
      // 准备诊断数据
      const diagnosisData: unknown = {
        action: 'ai_diagnosis',
        diagnosisType: diagnosisType,
        selectedBatchId: this.data.selectedBatchId,
        batchId: this.data.selectedBatchId,
        dayAge: this.data.dayAge,
        images: this.data.images,
        healthRecordId: this.data.sourceRecordId || null
      }

      if (diagnosisType === 'live_diagnosis') {
        // 病鹅诊断数据
        const allSymptoms = this.data.symptoms.trim()
        const affectedCount = parseInt(this.data.affectedCount) || 0
        
        const symptomsList = allSymptoms
          .split(/[、，,；;]/)
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0)
        
        diagnosisData.symptoms = symptomsList
        diagnosisData.symptomsText = allSymptoms
        diagnosisData.affectedCount = affectedCount
      } else {
        // 死因剖析数据
        const deathCount = parseInt(this.data.deathCount) || 0
        const symptoms = this.data.symptoms.trim()
        
        // 收集勾选的异常
        const selectedAbnormalities = this.data.autopsyAbnormalities
          .filter((item: AutopsyAbnormality) => item.checked)
          .map((item: AutopsyAbnormality) => item.name)
        
        // ✅ 修复：合并症状和剖检描述，不再默认设置"无明显生前症状"
        const autopsyDesc = this.data.autopsyDescription.trim()
        let combinedDescription = ''
        
        if (symptoms && autopsyDesc && symptoms !== autopsyDesc) {
          combinedDescription = `生前症状：${symptoms}；剖检发现：${autopsyDesc}`
        } else if (symptoms) {
          combinedDescription = symptoms
        } else if (autopsyDesc) {
          combinedDescription = autopsyDesc
        } else {
          combinedDescription = '无明显生前症状'
        }
        
        diagnosisData.deathCount = deathCount
        diagnosisData.symptoms = combinedDescription ? combinedDescription.split(/[、，,；;]/).map((s: string) => s.trim()).filter((s: string) => s.length > 0) : []
        diagnosisData.symptomsText = combinedDescription
        diagnosisData.autopsyFindings = {
          abnormalities: selectedAbnormalities,
          description: this.data.autopsyDescription
        }
      }

      // ✅ 如果有图片，提示用户图片仅作参考
      if (this.data.images.length > 0) {
      }

      // ✨ 改为异步：提交诊断任务
      // 诊断前获取批次综合数据，用于动态生成Prompt
      let batchPromptData: unknown = null
      if (this.data.selectedBatchId) {
        try {
          const promptDataRawResult = await wx.cloud.callFunction({
            name: 'health-management',
            data: {
              action: 'get_batch_prompt_data',
              batchId: this.data.selectedBatchId
            }
          })
          const promptDataResult = normalizeCloudResult<unknown>(promptDataRawResult)
          if (promptDataResult?.success) {
            batchPromptData = promptDataResult.data
          } else {
          }
        } catch (promptError) {
        }
      }

      const rawResult = await wx.cloud.callFunction({
        name: 'ai-diagnosis',
        data: {
          ...diagnosisData,
          batchPromptData // 传递批次综合数据
        },
        timeout: 10000  // ✅ 设置10秒超时（ai-diagnosis 应该<2秒就返回）
      })


      const result = normalizeCloudResult<{ diagnosisId: string; status: string }>(rawResult)

      if (result?.success && result.data) {
        const { diagnosisId } = result.data
        
        
        // ✨ 保存诊断ID并开始轮询（不显示轮询UI）
        this.setData({
          diagnosisId: diagnosisId,
          diagnosisStatus: 'processing',
          pollRetries: 0,
          showPolling: false // 不显示轮询进度UI
        })
        
        // 静默处理，不显示toast提示
        
        // 开始轮询获取结果（不要在这里停止 submitting，让轮询完成后再停止）
        this.pollDiagnosisResult(diagnosisId)
      } else {
        const errorMsg = result?.message || result?.error || '诊断提交失败'
        logger.error('====== ai-diagnosis 返回错误 ======')
        logger.error('错误信息:', errorMsg)
        throw new Error(errorMsg)
      }
    } catch (error: unknown) {
      logger.error('====== 诊断提交失败 ======')
      logger.error('错误类型:', error.errCode)
      logger.error('错误信息:', error.errMsg || error.message)
      logger.error('完整错误:', error)
      
      // 提交失败时才停止加载
      this.setData({ submitting: false })
      
      // ✅ 特别处理超时错误
      if (error.errMsg && error.errMsg.includes('TIMEOUT')) {
        wx.showModal({
          title: '诊断提交超时',
          content: '网络连接超时，请检查网络后重试。如果问题持续，可能是服务器繁忙。',
          showCancel: false,
          confirmText: '我知道了'
        })
      } else if (error.errMsg && error.errMsg.includes('ESOCKETTIMEDOUT')) {
        wx.showModal({
          title: '连接超时',
          content: '服务器响应超时，请稍后重试。提示：诊断任务可能仍在后台处理。',
          showCancel: false,
          confirmText: '我知道了'
        })
      } else {
        wx.showToast({ 
          title: error.message || error.errMsg || '诊断失败，请重试', 
          icon: 'none',
          duration: 3000
        })
      }
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
        const result = await db.collection('health_ai_diagnosis')
          .doc(diagnosisId)
          .get()

        const task = result.data


        if (task.status === 'completed') {
          // ✨ 诊断完成
          
          // ✅ 确保 result 是对象，不是字符串
          let diagnosisResult = task.result
          if (typeof task.result === 'string') {
            try {
              diagnosisResult = JSON.parse(task.result)
            } catch (e) {
              logger.error('❌ JSON解析失败:', e)
              throw new Error('诊断结果格式错误')
            }
          }
          
          this.setData({
            diagnosisStatus: 'completed',
            diagnosisResult: diagnosisResult,
            showPolling: false,
            submitting: false // 完成后停止按钮加载
          })
          
          // 不显示toast，直接显示结果页面
          // wx.showToast({ title: '诊断完成', icon: 'success' })
        } else if (task.status === 'failed') {
          // ✨ 诊断失败
          logger.error('====== 诊断失败详情 ======')
          logger.error('错误信息:', task.error)
          logger.error('任务ID:', diagnosisId)
          logger.error('完整任务:', task)
          
          this.setData({
            diagnosisStatus: 'failed',
            diagnosisError: task.error,
            showPolling: false,
            submitting: false // 失败后停止按钮加载
          })
          
          // ✅ 提供更友好的错误提示和解决方案
          const errorMsg = task.error || '未知错误'
          const isImageError = errorMsg.includes('图片') || errorMsg.includes('过大') || errorMsg.includes('image')
          
          wx.showModal({
            title: isImageError ? '图片诊断失败' : '诊断失败',
            content: isImageError 
              ? `${errorMsg}\n\n💡 解决方案：\n1. 删除图片，使用纯文字描述症状\n2. 重新拍摄更清晰、更小的图片\n3. 联系技术支持获取帮助`
              : `${errorMsg}\n\n建议：检查网络连接后重试，或联系技术支持`,
            showCancel: isImageError,
            cancelText: '重新诊断',
            confirmText: '我知道了',
            success: (res) => {
              if (res.cancel && isImageError) {
                // 用户选择重新诊断，清除图片
                this.setData({
                  images: [],
                  validImagesCount: 0,
                  diagnosisResult: null,
                  diagnosisStatus: 'idle'
                })
                wx.showToast({
                  title: '已清除图片，请重新描述症状',
                  icon: 'none',
                  duration: 2000
                })
              }
            }
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
              showPolling: false,
              submitting: false // 超时后停止按钮加载
            })
            wx.showToast({ title: '诊断超时，请重试', icon: 'error' })
          }
        }
      } catch (error: unknown) {
        logger.error(`轮询失败: ${error.message}`)
        
        // 继续轮询，直到超时
        if (retries < maxRetries) {
          this.setData({ pollRetries: retries })
          setTimeout(() => poll(), pollInterval)
        } else {
          this.setData({ submitting: false }) // 超时后停止按钮加载
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
      const diagnosisType = this.data.diagnosisType
      const diagnosis = this.data.diagnosisResult
      
      if (diagnosisType === 'autopsy_analysis') {
        // 死因剖析：创建死亡记录并关联财务
        this.createDeathRecordWithFinance(diagnosis)
      } else {
        // 病鹅诊断：根据严重程度判断处理方式
        const severity = diagnosis.severity || diagnosis.primaryDiagnosis?.severity || 'moderate'
        
        if (severity === 'fatal' || severity === 'critical') {
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
          this.startTreatment(diagnosis)
        }
      }
    } catch (error) {
      logger.error('采纳AI建议失败:', error)
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
    }
  },

  // 开始治疗
  async startTreatment(diagnosis: unknown) {
    try {
      wx.showLoading({ title: '创建治疗记录...' })
      
      // 转换受影响数量为数字
      const affectedCount = parseInt(this.data.affectedCount) || 0
      
      // 获取诊断ID
      const diagnosisId = this.data.diagnosisId
      
      
      // 验证必填参数
      if (!diagnosisId) {
        throw new Error('诊断ID不存在，请重新诊断')
      }
      if (!this.data.selectedBatchId) {
        throw new Error('批次ID不存在')
      }
      if (affectedCount <= 0) {
        throw new Error('受影响数量必须大于0')
      }
      
      // 创建治疗记录
      const rawResult = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'create_treatment_from_diagnosis',
          diagnosisId: diagnosisId,
          batchId: this.data.selectedBatchId,
          affectedCount: affectedCount,
          diagnosis: diagnosis.primaryDiagnosis?.disease || '待确定',
          recommendations: diagnosis.treatmentRecommendation || diagnosis.recommendations
        }
      })
      
      wx.hideLoading()
      
      const result = normalizeCloudResult<{ treatmentId: string }>(rawResult)

      if (result && result.success && result.data) {
        const { treatmentId } = result.data

        wx.showToast({
          title: '治疗记录已创建',
          icon: 'success'
        })
        
        // 跳转到治疗记录页面
        setTimeout(() => {
          wx.navigateTo({
            url: `/packageHealth/treatment-record/treatment-record?treatmentId=${treatmentId}`
          })
        }, 1500)
      } else {
        throw new Error(result?.error || result?.message || '创建治疗记录失败')
      }
    } catch (error: unknown) {
      wx.hideLoading()
      logger.error('创建治疗记录失败:', error)
      
      // 显示详细错误信息
      const errorMsg = error.message || error.errMsg || '创建治疗记录失败'
      wx.showModal({
        title: '创建治疗记录失败',
        content: errorMsg,
        showCancel: false,
        confirmText: '我知道了'
      })
    }
  },

  // 创建死亡记录并关联财务（死因剖析专用）
  async createDeathRecordWithFinance(diagnosis: unknown) {
    try {
      const deathCount = parseInt(this.data.deathCount) || 0
      const deathCause = diagnosis.primaryCause?.disease || diagnosis.primaryDiagnosis?.disease || '待确定'
      
      wx.showLoading({ title: '创建死亡记录...' })
      
      const rawResult = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'create_death_record_with_finance',
          diagnosisId: this.data.diagnosisId,
          batchId: this.data.selectedBatchId,
          deathCount: deathCount,
          deathCause: deathCause,
          deathCategory: 'disease',
          autopsyFindings: this.data.autopsyDescription,
          diagnosisResult: diagnosis,
          images: this.data.images || [] // 传递剖检图片
        }
      })
      
      wx.hideLoading()
      
      const result = normalizeCloudResult<{ deathRecordId: string }>(rawResult)

      if (result && result.success && result.data) {
        const { deathRecordId } = result.data

        wx.showToast({
          title: '记录成功',
          icon: 'success',
          duration: 1500
        })

        setTimeout(() => {
          const targetId = deathRecordId ? encodeURIComponent(deathRecordId) : ''
          wx.redirectTo({
            url: targetId
              ? `/packageHealth/death-records-list/death-records-list?recordId=${targetId}`
              : '/packageHealth/death-records-list/death-records-list'
          })
        }, 1500)
      } else {
        throw new Error(result?.message || result?.error || '创建死亡记录失败')
      }
    } catch (error: unknown) {
      wx.hideLoading()
      wx.showToast({
        title: error.message || '创建失败',
        icon: 'none'
      })
    }
  },

  // 记录死亡（病鹅诊断用）
  async recordDeath(diagnosis: unknown) {
    const affectedCount = parseInt(this.data.affectedCount) || 0
    
    wx.showModal({
      title: '确认记录死亡',
      content: `确认${affectedCount}只动物因${diagnosis.primaryDiagnosis?.disease || '疾病'}死亡？`,
      success: (res) => {
        if (res.confirm) {
          // 跳转到死亡记录页面，携带诊断信息
          wx.navigateTo({
            url: `/packageHealth/death-record/death-record?diagnosisId=${diagnosis._id}&affectedCount=${affectedCount}`
          })
        }
      }
    })
  },

  // 保存为记录
  async saveRecord() {
    if (!this.data.diagnosisResult) return
    
    // ✅ 防止重复提交
    if (this.data.isSaving) {
      return
    }

    try {
      // ✅ 设置保存状态，禁止重复点击
      this.setData({ isSaving: true })
      
      wx.showLoading({ title: '保存中...' })
      
      const diagnosis = this.data.diagnosisResult
      const diagnosisType = this.data.diagnosisType
      const isAutopsy = diagnosisType === 'autopsy_analysis'

      const primaryResult = isAutopsy
        ? (diagnosis.primaryCause || diagnosis.primaryDiagnosis || null)
        : (diagnosis.primaryDiagnosis || diagnosis.primaryCause || null)

      const recordAffectedCount = isAutopsy
        ? (parseInt(this.data.deathCount, 10) || diagnosis.deathCount || 0)
        : (parseInt(this.data.affectedCount, 10) || diagnosis.affectedCount || 0)

      let recordSymptoms = this.data.symptoms
      if (isAutopsy) {
        if (!recordSymptoms && this.data.autopsyDescription) {
          recordSymptoms = this.data.autopsyDescription
        }
        if (!recordSymptoms && typeof diagnosis.symptomsText === 'string') {
          recordSymptoms = diagnosis.symptomsText
        }
      }

      const recordDiagnosis = primaryResult?.disease || '待确定'
      const recordConfidence = typeof primaryResult?.confidence === 'number'
        ? primaryResult.confidence
        : (diagnosis.primaryDiagnosis?.confidence || diagnosis.primaryCause?.confidence || 0)

      let diagnosisDetails: AnyObject | null = primaryResult ? { ...primaryResult } : null
      if (diagnosisDetails) {
        if (isAutopsy) {
          diagnosisDetails = {
            ...diagnosisDetails,
            autopsyEvidence: diagnosis.primaryCause?.autopsyEvidence || diagnosisDetails.autopsyEvidence || [],
            pathologicalFindings: diagnosis.pathologicalFindings || null,
            differentialCauses: diagnosis.differentialCauses || diagnosis.differentialDiagnosis || []
          }
        } else {
          diagnosisDetails = {
            ...diagnosisDetails,
            differentialDiagnosis: diagnosis.differentialDiagnosis || []
          }
        }
      }

      let aiRecommendation: AnyObject | null = diagnosis.treatmentRecommendation || diagnosis.recommendations || null
      if (isAutopsy) {
        const preventionAdvice = diagnosis.preventionAdvice || diagnosis.preventionMeasures || []
        const biosecurityAdvice = diagnosis.biosecurityAdvice || []
        const followUp = diagnosis.followUp || null
        const supportive: string[] = []

        if (Array.isArray(preventionAdvice) && preventionAdvice.length > 0) {
          supportive.push(...preventionAdvice)
        }
        if (Array.isArray(biosecurityAdvice) && biosecurityAdvice.length > 0) {
          supportive.push(...biosecurityAdvice)
        }

        aiRecommendation = (supportive.length > 0 || followUp)
          ? {
              supportive,
              preventionAdvice,
              biosecurityAdvice,
              followUp
            }
          : null
      }

      const recordData: AnyObject = {
        action: 'create_abnormal_record',
        diagnosisType,
        diagnosisId: this.data.diagnosisId,
        batchId: this.data.selectedBatchId,
        batchNumber: this.data.selectedBatchNumber,
        affectedCount: recordAffectedCount,
        symptoms: recordSymptoms,
        diagnosis: recordDiagnosis,
        diagnosisConfidence: recordConfidence,
        diagnosisDetails: diagnosisDetails,
        severity: diagnosis.severity || 'unknown',
        urgency: diagnosis.urgency || 'unknown',
        aiRecommendation,
        images: this.data.images || []
      }

      if (isAutopsy) {
        recordData.autopsyDescription = this.data.autopsyDescription || ''
        recordData.deathCount = recordAffectedCount
      }
      
      
      // 创建异常记录
      const rawResult = await wx.cloud.callFunction({
        name: 'health-management',
        data: recordData
      })
      
      wx.hideLoading()
      
      const result = normalizeCloudResult<{ abnormalRecordId?: string }>(rawResult)

      if (result?.success) {
        wx.showToast({
          title: '异常记录已保存',
          icon: 'success',
          duration: 1500
        })
        
        // ✅ 保存成功后跳转到异常记录列表页面
        setTimeout(() => {
          wx.redirectTo({
            url: '/packageHealth/abnormal-records-list/abnormal-records-list'
          })
        }, 1500)
      } else {
        throw new Error(result?.message || result?.error || '保存失败')
      }
    } catch (error: unknown) {
      wx.hideLoading()
      // ✅ 保存失败时重置状态，允许重试
      this.setData({ isSaving: false })
      wx.showToast({
        title: error.message || '保存失败',
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
            images: [],
            validImagesCount: 0,
            commonSymptoms: this.data.commonSymptoms.map((item: SymptomOption) => ({ ...item, checked: false }))
          })
          this.validateForm()
        }
      }
    })
  },

  // 查看诊断历史
  viewDiagnosisHistory() {
    wx.navigateTo({
      url: '/packageAI/diagnosis-history/diagnosis-history'
    })
  },

  // 联系兽医
  contactVet() {
    const vetPhoneNumber = '13925720708'
    wx.showModal({
      title: '联系专业兽医',
      content: `是否拨打兽医服务热线：${vetPhoneNumber}？`,
      confirmText: '拨打',
      success: (res) => {
        if (res.confirm) {
          wx.makePhoneCall({
            phoneNumber: vetPhoneNumber,
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
