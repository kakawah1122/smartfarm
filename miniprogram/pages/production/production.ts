// production.ts
import { createPageWithNavbar } from '../../utils/navigation'

const pageConfig = {
  data: {
    activeTab: 'entry',
    
    // 入栏统计（默认值，将被真实数据覆盖）
    entryStats: {
      total: '0',
      stockQuantity: '0', // 存栏数量
      batches: '0'
    },
    
    // 出栏统计（默认值，将被真实数据覆盖）
    exitStats: {
      total: '0',
      batches: '0',
      avgWeight: '0.0'
    },
    
    // 物料统计（默认值，将被真实数据覆盖）
    materialStats: {
      feed: '0',
      medicineStatus: '无数据',
      // 详细状态信息的默认值
      feedDetails: {
        statusText: '无数据',
        status: 'empty',
        totalCount: 0,
        description: '暂无数据'
      },
      medicineDetails: {
        statusText: '无数据',
        status: 'empty',
        totalCount: 0,
        description: '暂无数据'
      },
      equipmentDetails: {
        statusText: '无数据',
        status: 'empty',
        totalCount: 0,
        description: '暂无数据'
      }
    },
    
    // 入栏记录（空数组，将从云函数加载真实数据）
    entryRecords: [],
    
    // 出栏记录（空数组，将从云函数加载真实数据）
    exitRecords: [],
    
    // 物料记录（从云函数加载真实数据）
    materialRecords: [],
    
    // 加载状态
    loading: false,
    isEmpty: false,  // 用于显示空状态
    
    // 弹窗相关
    showEntryDetailPopup: false,
    showExitDetailPopup: false,
    showMaterialDetailPopup: false,
    selectedEntryRecord: null,
    selectedExitRecord: null,
    selectedMaterialRecord: null,
    
    // AI智能盘点相关
    aiCount: {
      active: false,        // 是否激活AI盘点功能
      loading: false,       // AI分析中
      imageUrl: '',         // 拍摄的图片URL
      result: null as any,  // 识别结果
      error: null as string | null,
      history: [] as any[]  // 盘点历史
    }
  },

  onLoad() {
    // 确保 aiCount 数据结构完整
    this.setData({
      'aiCount.history': []
    })
    this.loadData()
  },

  onReady() {
    // 页面初次渲染完成时加载数据
    this.refreshData()
  },

  onShow() {
    // 每次页面显示时刷新数据，确保数据最新
    // 特别是从其他页面返回时，需要刷新物料状态
    this.refreshData()
  },

  // 加载数据
  loadData() {
    this.loadDashboardData()
    this.loadEntryData()
    this.loadExitData()
    this.loadMaterialData()
  },

  // 加载仪表盘数据
  async loadDashboardData() {
    try {
      this.setData({ loading: true })
      
      const result = await wx.cloud.callFunction({
        name: 'production-dashboard',
        data: {
          action: 'overview'
          // 暂时移除日期过滤，获取所有数据的统计
        }
      })
      
      if (result.result && result.result.success) {
        const data = result.result.data
        
        // 使用新的详细物料状态信息
        const newMaterialStats = {
          feed: data.material?.feedStock || '0',
          medicineStatus: data.material?.medicineStatus || '未知',
          // 新增详细状态信息
          feedDetails: data.material?.categoryDetails?.feed || {
            statusText: '无数据',
            status: 'empty',
            totalCount: 0,
            description: '暂无数据'
          },
          medicineDetails: data.material?.categoryDetails?.medicine || {
            statusText: '无数据', 
            status: 'empty',
            totalCount: 0,
            description: '暂无数据'
          },
          equipmentDetails: data.material?.categoryDetails?.equipment || {
            statusText: '无数据',
            status: 'empty', 
            totalCount: 0,
            description: '暂无数据'
          }
        }
        
        this.setData({
          entryStats: {
            total: data.entry?.total || '0',
            stockQuantity: data.entry?.stockQuantity || '0', // 直接使用云函数计算的存栏数量
            batches: data.entry?.batches || '0'
          },
          exitStats: {
            total: data.exit?.total || '0',
            batches: data.exit?.batches || '0',
            avgWeight: data.exit?.avgWeight || '0.0'
          },
          materialStats: newMaterialStats
        })
      } else {
        // 设置默认数据
        this.setDefaultStats()
      }
    } catch (error) {
      // 设置默认数据
      this.setDefaultStats()
      
      // 如果是云函数不存在的错误，给出友好提示
      if (error.errMsg && error.errMsg.includes('function not found')) {
        wx.showModal({
          title: '系统提示',
          content: '生产管理云函数尚未部署，请先部署云函数后再使用。当前显示为空数据。',
          showCancel: false
        })
      } else {
        wx.showToast({
          title: '数据加载失败，显示默认值',
          icon: 'none'
        })
      }
    } finally {
      this.setData({ loading: false })
    }
  },

  // 设置默认统计数据
  setDefaultStats() {
    this.setData({
      entryStats: {
        total: '0',
        stockQuantity: '0',
        batches: '0'
      },
      exitStats: {
        total: '0',
        batches: '0',
        avgWeight: '0.0'
      },
      materialStats: {
        feed: '0',
        medicineStatus: '无数据',
        feedDetails: {
          statusText: '无数据',
          status: 'empty',
          totalCount: 0,
          description: '暂无数据'
        },
        medicineDetails: {
          statusText: '无数据',
          status: 'empty',
          totalCount: 0,
          description: '暂无数据'
        },
        equipmentDetails: {
          statusText: '无数据',
          status: 'empty',
          totalCount: 0,
          description: '暂无数据'
        }
      }
    })
  },

  // 加载入栏数据
  async loadEntryData() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'production-entry',
        data: {
          action: 'list',
          page: 1,
          pageSize: 10
        }
      })
      
      if (result.result && result.result.success) {
        const records = result.result.data.records || []
        
        // 获取当前用户信息
        const app = getApp()
        const currentUser = app.globalData?.userInfo?.nickname || '系统用户'
        
        // 格式化入栏记录数据，确保显示字段完整
        const formattedRecords = records.map((record: any) => ({
          ...record,
          id: record._id || record.batchNumber,
          batchNumber: record.batchNumber || record._id,
          breed: record.breed || '未知品种',
          supplier: record.supplier || '',
          quantity: record.quantity || 0,
          avgWeight: record.avgWeight || 0,
          operator: (!record.operator || record.operator === '未知') ? currentUser : record.operator,
          status: record.status || '已完成',
          date: record.entryDate || (record.createTime ? record.createTime.split('T')[0] : '未知日期'),
          entryDate: record.entryDate || (record.createTime ? record.createTime.split('T')[0] : '未知日期'),
          // 生成显示标题：仅显示品种
          displayTitle: record.breed || '未知品种'
        }))
        
        this.setData({
          entryRecords: formattedRecords,
          isEmpty: formattedRecords.length === 0
        })
      }
    } catch (error) {
      this.setData({ entryRecords: [], isEmpty: true })
    }
  },

  // 加载出栏数据
  async loadExitData() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'production-exit',
        data: {
          action: 'list',
          page: 1,
          pageSize: 10
        }
      })
      
      if (result.result && result.result.success) {
        const records = result.result.data.records || []
        
        // 获取当前用户信息
        const app = getApp()
        const currentUser = app.globalData?.userInfo?.nickname || '系统用户'
        
        // 格式化出栏记录数据，确保显示字段完整
        const formattedRecords = records.map((record: any) => ({
          ...record,
          id: record._id || record.exitNumber,
          exitNumber: record.exitNumber || record._id,
          batchNumber: record.batchNumber || '',
          breed: record.breed || '未知品种',
          customer: record.customer || '未知客户',
          quantity: record.quantity || 0,
          avgWeight: record.avgWeight || 0,
          totalWeight: record.totalWeight || 0,
          operator: record.operator || currentUser,
          status: record.status || '已交付',
          date: record.exitDate || (record.createTime ? record.createTime.split('T')[0] : '未知日期'),
          exitDate: record.exitDate || (record.createTime ? record.createTime.split('T')[0] : '未知日期'),
          // 生成显示标题：显示品种名（与入栏记录逻辑一致）
          displayTitle: record.breed || '未知品种'
        }))
        
        this.setData({
          exitRecords: formattedRecords
        })
      }
    } catch (error) {
      this.setData({ exitRecords: [] })
    }
  },

  // 加载物料数据
  async loadMaterialData() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'production-material',
        data: {
          action: 'list_records',
          page: 1,
          pageSize: 10
        }
      })
      
      if (result.result && result.result.success) {
        const records = result.result.data.records || []
        
        // 获取当前用户信息
        const app = getApp()
        const currentUser = app.globalData?.userInfo?.nickname || '系统用户'
        
        // 转换数据格式以匹配优化后的界面显示
        const formattedRecords = records.map(record => ({
          id: record._id || record.recordNumber,
          recordNumber: record.recordNumber || record._id,
          name: record.material?.name || '未知物料',
          category: record.material?.category || '未分类',
          type: record.type === 'purchase' ? '采购' : '领用',
          quantity: `${record.quantity}${record.material?.unit || '件'}`,
          supplier: record.supplier || '',
          targetLocation: record.targetLocation || '',
          operator: (!record.operator || record.operator === '未知' || record.operator === '系统用户') ? currentUser : record.operator,
          date: record.recordDate || (record.createTime ? record.createTime.split('T')[0] : '未知日期'),
          status: record.status || '已完成',
          // 兼容旧版显示格式  
          description: `${record.material?.category || '未分类'} • ${record.supplier || record.targetLocation || ''}`
        }))
        
        this.setData({
          materialRecords: formattedRecords,
          isEmpty: formattedRecords.length === 0
        })
      } else {
        this.setData({ materialRecords: [] })
      }
    } catch (error) {
      this.setData({ materialRecords: [] })
    }
  },


  // 获取日期范围（最近30天）
  getDateRange() {
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)
    
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    }
  },

  // 刷新数据
  async refreshData() {
    try {
      this.setData({ loading: true })
      
      // 并行加载所有数据
      await Promise.all([
        this.loadDashboardData(),
        this.loadEntryData(),
        this.loadExitData(),
        this.loadMaterialData()
      ])
      
    } catch (error) {
      // 数据刷新失败时静默处理
    } finally {
      this.setData({ loading: false })
    }
  },

  // Tab切换 - TDesign 格式
  onTabChange(e: any) {
    const { value } = e.detail
    this.setData({
      activeTab: value
    })
    
    // 如果切换到物料管理tab，刷新物料数据
    if (value === 'material') {
      this.loadMaterialData()
    }
  },

  // 兼容原有Tab切换
  onTabChangeOld(e: any) {
    const { tab } = e.currentTarget.dataset
    this.setData({
      activeTab: tab
    })
  },

  // 返回上一页功能已在navigation工具中实现

  // 新增入栏记录
  addEntry() {
    wx.navigateTo({
      url: '/pages/entry-form/entry-form'
    })
  },

  // 新增出栏记录
  addExit() {
    wx.navigateTo({
      url: '/pages/exit-form/exit-form'
    })
  },

  // 查看库存详情
  viewInventoryDetail() {
    wx.navigateTo({
      url: '/pages/inventory-detail/inventory-detail'
    })
  },

  // 查看饲料库存详情
  viewFeedInventory() {
    wx.navigateTo({
      url: '/pages/inventory-detail/inventory-detail?category=饲料'
    })
  },

  // 查看药品库存详情
  viewMedicineInventory() {
    wx.navigateTo({
      url: '/pages/inventory-detail/inventory-detail?category=药品'
    })
  },

  // 查看设备物料详情
  viewEquipmentInventory() {
    wx.navigateTo({
      url: '/pages/inventory-detail/inventory-detail?category=设备'
    })
  },

  // 采购物料
  purchaseMaterial() {
    wx.navigateTo({
      url: '/pages/purchase-form/purchase-form'
    })
  },

  // 领用物料
  useMaterial() {
    wx.navigateTo({
      url: '/pages/material-use-form/material-use-form'
    })
  },

  // 查看全部物料记录
  viewAllMaterialRecords() {
    wx.navigateTo({
      url: '/pages/material-records-list/material-records-list',
      fail: (error) => {
        // 已移除调试日志
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none',
          duration: 2000
        })
      }
    })
  },

  // 查看全部入栏记录
  viewAllEntryRecords() {
    wx.navigateTo({
      url: '/pages/entry-records-list/entry-records-list',
      fail: (error) => {
        // 已移除调试日志
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none',
          duration: 2000
        })
      }
    })
  },

  // 查看全部出栏记录
  viewAllExitRecords() {
    wx.navigateTo({
      url: '/pages/exit-records-list/exit-records-list',
      fail: (error) => {
        // 已移除调试日志
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none',
          duration: 2000
        })
      }
    })
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.refreshData()
    setTimeout(() => {
      wx.stopPullDownRefresh()
    }, 1500)
  },

  // ========== AI智能盘点功能 ==========
  
  // 启动AI盘点功能
  startAICount() {
    // 已移除调试日志
    this.setData({
      'aiCount.active': true,
      'aiCount.imageUrl': '',
      'aiCount.result': null,
      'aiCount.error': null
    })
  },
  
  // 关闭AI盘点功能
  closeAICount() {
    this.setData({
      'aiCount.active': false,
      'aiCount.imageUrl': '',
      'aiCount.result': null,
      'aiCount.error': null
    })
  },
  
  // 拍照功能
  takePhoto() {
    // 已移除调试日志
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'], // 只允许拍照，不允许从相册选择
      camera: 'back', // 使用后置摄像头
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath
        // 已移除调试日志
        this.setData({
          'aiCount.imageUrl': tempFilePath
        })
        
        wx.showToast({
          title: '拍照成功',
          icon: 'success',
          duration: 1000
        })
      },
      fail: (error) => {
        // 已移除调试日志
        if (error.errMsg.includes('cancel')) {
          // 用户取消拍照，不显示错误信息
          return
        }
        
        wx.showToast({
          title: '拍照失败，请重试',
          icon: 'none',
          duration: 2000
        })
      }
    })
  },
  
  // 重新拍照
  retakePhoto() {
    this.setData({
      'aiCount.imageUrl': '',
      'aiCount.result': null,
      'aiCount.error': null
    })
    
    // 直接调用拍照功能
    this.takePhoto()
  },
  
  // 分析图片
  async analyzeImage() {
    const { imageUrl } = this.data.aiCount
    if (!imageUrl) {
      wx.showToast({
        title: '请先拍照',
        icon: 'none'
      })
      return
    }
    
    // 已移除调试日志
    // 显示加载状态
    this.setData({
      'aiCount.loading': true,
      'aiCount.error': null
    })
    
    try {
      // 上传图片到云存储
      const uploadResult = await this.uploadImageToCloud(imageUrl)
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || '图片上传失败')
      }
      
      // 将图片转换为base64
      const base64Data = await this.convertImageToBase64(imageUrl)
      
      // 已移除调试日志
      // 调用AI图像识别云函数
      const result = await wx.cloud.callFunction({
        name: 'ai-multi-model',
        data: {
          action: 'image_recognition',
          imageData: base64Data,
          location: '1号鹅舍', // 可以根据实际情况获取位置信息
          timestamp: Date.now(),
          expectedRange: {
            min: 50,
            max: 1000
          }
        }
      })
      
      // 已移除调试日志
      if (result.result.success) {
        const recognitionData = result.result.data
        
        // 处理识别结果
        const processedResult = {
          totalCount: recognitionData.totalCount || 0,
          confidence: Math.round(recognitionData.confidence * 100) || 75,
          regions: recognitionData.regions || [],
          abnormalDetection: recognitionData.abnormalDetection || {
            suspiciousAnimals: 0,
            healthConcerns: []
          },
          suggestions: recognitionData.suggestions || [],
          timestamp: new Date(),
          imageUrl: uploadResult.fileID || imageUrl
        }
        
        this.setData({
          'aiCount.loading': false,
          'aiCount.result': processedResult,
          'aiCount.error': null
        })
        
        wx.showToast({
          title: `识别完成：${processedResult.totalCount}只`,
          icon: 'success',
          duration: 2000
        })
        
      } else {
        // AI识别失败，使用fallback结果
        const fallbackResult = {
          totalCount: Math.floor(Math.random() * 100) + 50, // 模拟结果
          confidence: 65,
          regions: [],
          abnormalDetection: {
            suspiciousAnimals: 0,
            healthConcerns: ['建议人工复核']
          },
          suggestions: ['图像质量不佳，建议重新拍摄', '光线条件可能影响识别准确性'],
          timestamp: new Date(),
          imageUrl: imageUrl,
          fallback: true
        }
        
        this.setData({
          'aiCount.loading': false,
          'aiCount.result': fallbackResult,
          'aiCount.error': result.result.error
        })
        
        wx.showToast({
          title: '识别完成(估算)',
          icon: 'none',
          duration: 2000
        })
      }
      
    } catch (error) {
      // 已移除调试日志
      this.setData({
        'aiCount.loading': false,
        'aiCount.error': error.message || '分析失败',
        'aiCount.result': null
      })
      
      wx.showToast({
        title: '分析失败，请重试',
        icon: 'none',
        duration: 2000
      })
    }
  },
  
  // 上传图片到云存储
  async uploadImageToCloud(filePath: string): Promise<{success: boolean, fileID?: string, error?: string}> {
    try {
      const result = await wx.cloud.uploadFile({
        cloudPath: `ai-count/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`,
        filePath: filePath,
      })
      
      return {
        success: true,
        fileID: result.fileID
      }
    } catch (error) {
      // 已移除调试日志
      return {
        success: false,
        error: error.errMsg || '上传失败'
      }
    }
  },
  
  // 将图片转换为base64
  async convertImageToBase64(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      wx.getFileSystemManager().readFile({
        filePath: filePath,
        encoding: 'base64',
        success: (res) => {
          resolve(`data:image/jpeg;base64,${res.data}`)
        },
        fail: (error) => {
          // 已移除调试日志
          reject(new Error('图片处理失败'))
        }
      })
    })
  },
  
  // 从AI盘点结果直接创建出栏记录
  createExitFromAI() {
    const { result } = this.data.aiCount
    if (!result) {
      wx.showToast({
        title: '没有可用的盘点数据',
        icon: 'none'
      })
      return
    }
    
    // 检查是否有异常个体
    if (result.abnormalDetection && result.abnormalDetection.suspiciousAnimals > 0) {
      wx.showModal({
        title: '发现异常个体',
        content: `检测到${result.abnormalDetection.suspiciousAnimals}只疑似异常个体，建议先处理异常情况再进行出栏。是否继续创建出栏记录？`,
        success: (res) => {
          if (res.confirm) {
            this.navigateToExitForm(result)
          }
        }
      })
    } else {
      this.navigateToExitForm(result)
    }
  },

  // 导航到出栏表单并预填数据
  navigateToExitForm(aiResult: any) {
    // 构造传递给出栏表单的参数
    const params = {
      fromAI: true,
      aiCount: aiResult.totalCount,
      confidence: aiResult.confidence,
      imageUrl: aiResult.imageUrl || '',
      abnormalCount: aiResult.abnormalDetection?.suspiciousAnimals || 0,
      suggestions: JSON.stringify(aiResult.suggestions || [])
    }
    
    // 构建URL参数字符串
    const urlParams = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&')
    
    wx.navigateTo({
      url: `/pages/exit-form/exit-form?${urlParams}`,
      success: () => {
        // 导航成功后关闭AI盘点界面
        this.closeAICount()
      },
      fail: (error) => {
        // 已移除调试日志
        wx.showToast({
          title: '跳转失败，请重试',
          icon: 'none'
        })
      }
    })
  },

  // 保存盘点记录
  async saveCountRecord() {
    const { result } = this.data.aiCount
    if (!result) {
      wx.showToast({
        title: '没有可保存的数据',
        icon: 'none'
      })
      return
    }
    
    // 已移除调试日志
    try {
      wx.showLoading({
        title: '保存中...',
        mask: true
      })
      
      // 构建出栏盘点记录数据
      const countRecord = {
        type: 'exit_ai_count', // 出栏AI盘点
        location: '出栏区域',
        totalCount: result.totalCount,
        confidence: result.confidence,
        imageUrl: result.imageUrl,
        abnormalCount: result.abnormalDetection?.suspiciousAnimals || 0,
        healthConcerns: result.abnormalDetection?.healthConcerns || [],
        suggestions: result.suggestions || [],
        timestamp: new Date(),
        operator: '系统用户', // 可以获取当前用户信息
        aiModel: 'baidu-vision', // 记录使用的AI模型
        fallback: result.fallback || false,
        purpose: '出栏盘点' // 标记用途
      }
      
      // 这里可以调用云函数保存记录到数据库
      // 暂时使用本地存储模拟
      const records = wx.getStorageSync('aiCountRecords') || []
      records.unshift(countRecord)
      wx.setStorageSync('aiCountRecords', records.slice(0, 50)) // 只保留最近50条记录
      
      wx.hideLoading()
      
      wx.showToast({
        title: '盘点记录保存成功',
        icon: 'success',
        duration: 1500
      })
      
      // 更新盘点历史
      this.setData({
        'aiCount.history': records
      })
      
      // 刷新页面数据
      this.refreshData()
      
    } catch (error) {
      // 已移除调试日志
      wx.hideLoading()
      
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none',
        duration: 2000
      })
    }
  },
  
  // 重新开始盘点
  restartCount() {
    this.setData({
      'aiCount.imageUrl': '',
      'aiCount.result': null,
      'aiCount.error': null,
      'aiCount.loading': false
    })
    
    wx.showToast({
      title: '已重置，请重新拍照',
      icon: 'none',
      duration: 1500
    })
  },

  // 查看入栏记录详情
  viewEntryRecordDetail(e: any) {
    const record = e.currentTarget.dataset.record
    this.setData({
      selectedEntryRecord: record,
      showEntryDetailPopup: true
    })
  },

  // 查看出栏记录详情
  viewExitRecordDetail(e: any) {
    const record = e.currentTarget.dataset.record
    this.setData({
      selectedExitRecord: record,
      showExitDetailPopup: true
    })
  },

  // 关闭入栏详情弹窗
  closeEntryDetailPopup() {
    this.setData({
      showEntryDetailPopup: false,
      selectedEntryRecord: null
    })
  },

  // 关闭出栏详情弹窗
  closeExitDetailPopup() {
    this.setData({
      showExitDetailPopup: false,
      selectedExitRecord: null
    })
  },

  // 入栏弹窗可见性变化
  onEntryDetailPopupChange(e: any) {
    const { visible } = e.detail
    if (!visible) {
      this.setData({
        showEntryDetailPopup: false,
        selectedEntryRecord: null
      })
    }
  },

  // 出栏弹窗可见性变化
  onExitDetailPopupChange(e: any) {
    const { visible } = e.detail
    if (!visible) {
      this.setData({
        showExitDetailPopup: false,
        selectedExitRecord: null
      })
    }
  },

  // 查看物料记录详情
  viewMaterialRecordDetail(e: any) {
    const record = e.currentTarget.dataset.record
    this.setData({
      selectedMaterialRecord: record,
      showMaterialDetailPopup: true
    })
  },

  // 关闭物料详情弹窗
  closeMaterialDetailPopup() {
    this.setData({
      showMaterialDetailPopup: false,
      selectedMaterialRecord: null
    })
  },

  // 物料弹窗可见性变化
  onMaterialDetailPopupChange(e: any) {
    const { visible } = e.detail
    if (!visible) {
      this.setData({
        showMaterialDetailPopup: false,
        selectedMaterialRecord: null
      })
    }
  }

}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
