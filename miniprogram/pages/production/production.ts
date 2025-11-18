// production.ts
import { createPageWithNavbar } from '../../utils/navigation'
import CloudApi from '../../utils/cloud-api'
import { logger } from '../../utils/logger'

// ✅ 优化：概览数据缓存配置（参考健康模块，使用5分钟缓存）
const OVERVIEW_CACHE_KEY = 'production_overview_cache'
const CACHE_DURATION = 5 * 60 * 1000 // 5分钟缓存，与健康模块保持一致
const MAX_RETRY_COUNT = 3 // 最大重试次数
const RETRY_DELAY = 1000 // 重试延迟（毫秒）

interface CachedOverviewData {
  data: {
    entryStats: any
    exitStats: any
    materialStats: any
  }
  timestamp: number
}

/**
 * 检查概览缓存是否有效
 */
function isOverviewCacheValid(): boolean {
  try {
    const cached = wx.getStorageSync(OVERVIEW_CACHE_KEY) as CachedOverviewData
    if (!cached) return false
    
    const now = Date.now()
    return (now - cached.timestamp) < CACHE_DURATION
  } catch (error) {
    return false
  }
}

/**
 * 获取缓存的概览数据
 */
function getCachedOverviewData(): CachedOverviewData['data'] | null {
  try {
    const cached = wx.getStorageSync(OVERVIEW_CACHE_KEY) as CachedOverviewData
    return cached ? cached.data : null
  } catch (error) {
    return null
  }
}

/**
 * 设置概览数据缓存
 */
function setCachedOverviewData(data: CachedOverviewData['data']) {
  try {
    wx.setStorageSync(OVERVIEW_CACHE_KEY, {
      data,
      timestamp: Date.now()
    })
  } catch (error) {
    // 缓存失败不影响主流程
    logger.warn('设置概览缓存失败:', error)
  }
}

/**
 * 清除概览数据缓存
 */
function clearOverviewCache() {
  try {
    wx.removeStorageSync(OVERVIEW_CACHE_KEY)
  } catch (error) {
    // 缓存清理失败时静默处理
  }
}

const pageConfig: WechatMiniprogram.Page.Options<WechatMiniprogram.Page.DataOption, WechatMiniprogram.Page.CustomOption> = {
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
    isDataLoaded: false,  // 标记数据是否已加载，避免重复加载
    
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
      loading: false,       // AI盘点中
      imageUrl: '',         // 拍摄的图片URL
      result: null as any,  // 识别结果
      error: null as string | null,
      history: [] as any[], // 盘点历史
      
      // 累加相关
      rounds: [] as any[],       // 各轮次记录
      currentRound: 0,           // 当前轮次
      cumulativeTotal: 0         // 累计总数
    }
  },

  onLoad() {
    // 确保 aiCount 数据结构完整
    this.setData({
      'aiCount.history': [],
      'aiCount.rounds': [],
      'aiCount.currentRound': 0,
      'aiCount.cumulativeTotal': 0,
      isDataLoaded: false
    })
    // 只在 onLoad 时加载一次初始数据
    this.loadData()
  },

  onReady() {
    // 页面渲染完成，不再重复加载数据
  },

  onShow() {
    // 只在数据已经加载过的情况下才刷新（从其他页面返回时）
    if (this.data.isDataLoaded) {
    this.refreshData()
    }
  },

  // 加载数据
  async loadData() {
    try {
      // 并行加载所有数据
      await Promise.all([
        this.loadDashboardData(),
        this.loadEntryData(),
        this.loadExitData(),
    this.loadMaterialData()
      ])
      
      // 标记数据已加载
      this.setData({ isDataLoaded: true })
    } catch (error: any) {
      logger.error('加载数据失败:', error)
    }
  },

  // 加载仪表盘数据（✅优化：添加缓存机制和错误重试）
  async loadDashboardData(forceRefresh: boolean = false, retryCount: number = 0): Promise<void> {
    try {
      // ✅ 优化：如果不是强制刷新，先检查缓存
      if (!forceRefresh && isOverviewCacheValid()) {
        const cachedData = getCachedOverviewData()
        if (cachedData) {
          // 使用缓存数据，不显示loading
          this.setData({
            entryStats: cachedData.entryStats,
            exitStats: cachedData.exitStats,
            materialStats: cachedData.materialStats
          })
          logger.log('使用缓存的概览数据')
          return
        }
      }
      
      // 需要加载数据时显示loading
      if (retryCount === 0) {
        this.setData({ loading: true })
      }
      
      const result = await CloudApi.callFunction<any>(
        'production-dashboard',
        {
          action: 'overview'
          // 暂时移除日期过滤，获取所有数据的统计
        },
        {
          showError: false
        }
      )
      
      if (result.success && result.data) {
        const data = result.data
        
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
        
        const overviewData = {
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
        }
        
        // ✅ 优化：保存到缓存
        setCachedOverviewData(overviewData)
        
        this.setData(overviewData)
      } else {
        // 设置默认数据
        this.setDefaultStats()
      }
    } catch (error: any) {
      // ✅ 优化：添加错误重试机制
      if (retryCount < MAX_RETRY_COUNT) {
        logger.warn(`概览数据加载失败，${RETRY_DELAY}ms后重试 (${retryCount + 1}/${MAX_RETRY_COUNT}):`, error)
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
        return this.loadDashboardData(forceRefresh, retryCount + 1)
      }
      
      // 重试次数用尽，设置默认数据
      logger.error('概览数据加载失败，已重试' + MAX_RETRY_COUNT + '次:', error)
      this.setDefaultStats()
      
      // 如果是云函数不存在的错误，给出友好提示
      if (error.errMsg && error.errMsg.includes('function not found')) {
        wx.showModal({
          title: '系统提示',
          content: '生产管理云函数尚未部署，请先部署云函数后再使用。当前显示为空数据。',
          showCancel: false
        })
      } else if (retryCount === 0) {
        // 只在第一次失败时提示，避免重复提示
        wx.showToast({
          title: '数据加载失败，显示默认值',
          icon: 'none'
        })
      }
    } finally {
      if (retryCount === 0) {
        this.setData({ loading: false })
      }
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
      const result = await CloudApi.callFunction<any>(
        'production-entry',
        {
          action: 'list',
          page: 1,
          pageSize: 10
        },
        {
          showError: false
        }
      )
      
      if (result.success && result.data) {
        const records = result.data.records || []
        
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
      } else {
        this.setData({ entryRecords: [], isEmpty: true })
      }
    } catch (error: any) {
      this.setData({ entryRecords: [], isEmpty: true })
    }
  },

  // 加载出栏数据
  async loadExitData() {
    try {
      const result = await CloudApi.callFunction<any>(
        'production-exit',
        {
          action: 'list',
          page: 1,
          pageSize: 10
        },
        {
          showError: false
        }
      )
      
      if (result.success && result.data) {
        const records = result.data.records || []
        
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
      } else {
        this.setData({ exitRecords: [] })
      }
    } catch (error: any) {
      this.setData({ exitRecords: [] })
    }
  },

  // 加载物料数据
  async loadMaterialData() {
    try {
      const result = await CloudApi.callFunction<any>(
        'production-material',
        {
          action: 'list_records',
          page: 1,
          pageSize: 10,
          includeFeedRecords: true // 包含饲料投喂记录
        },
        {
          showError: false
        }
      )
      
      if (result.success && result.data) {
        const records = result.data.records || []
        
        // 获取当前用户信息
        const app = getApp()
        const currentUser = app.globalData?.userInfo?.nickname || '系统用户'
        
        // 转换数据格式以匹配优化后的界面显示
        const formattedRecords = records.map((record: any) => {
          // 判断记录类型
          let displayType = '领用'
          let displayDescription = ''
          
          if (record.type === 'purchase') {
            displayType = '采购'
            displayDescription = `${record.material?.category || '未分类'} • ${record.supplier || ''}`
          } else if (record.type === 'feed') {
            displayType = '投喂'
            displayDescription = `${record.material?.category || '饲料'} • 批次${record.batchNumber || '未知'}`
          } else {
            displayType = '领用'
            displayDescription = `${record.material?.category || '未分类'} • ${record.targetLocation || ''}`
          }
          
          return {
            id: record.recordNumber || record._id, // 优先使用短单据号
            recordNumber: record.recordNumber || record._id,
            name: record.material?.name || '未知物料',
            category: record.material?.category || '未分类',
            type: displayType,
            recordType: record.recordType || 'material', // 'material' 或 'feed'
            quantity: `${record.quantity}${record.material?.unit || '件'}`,
            supplier: record.supplier || '',
            targetLocation: record.targetLocation || '',
            batchNumber: record.batchNumber || '',
            operator: (!record.operator || record.operator === '未知' || record.operator === '系统用户') ? currentUser : record.operator,
            date: record.recordDate || (record.createTime ? record.createTime.split('T')[0] : '未知日期'),
            status: record.status || '已完成',
            description: displayDescription,
            // 饲料投喂相关额外信息
            currentStock: record.currentStock || null,
            costPerBird: record.costPerBird || null,
            dayAge: record.dayAge || null
          }
        })
        
        const sortedRecords = formattedRecords.sort((a: any, b: any) => {
          const parseTime = (value: any) => {
            if (!value) return 0
            const timeValue = value instanceof Date ? value : new Date(value)
            const timestamp = timeValue.getTime()
            return Number.isNaN(timestamp) ? 0 : timestamp
          }
          return parseTime(b.createTime || b.date || b.recordDate) - parseTime(a.createTime || a.date || a.recordDate)
        })

        this.setData({
          materialRecords: sortedRecords.slice(0, 5),
          isEmpty: sortedRecords.length === 0
        })
      } else {
        this.setData({ materialRecords: [] })
      }
    } catch (error: any) {
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

  // 刷新数据（✅优化：下拉刷新时清除缓存，强制刷新）
  async refreshData() {
    try {
      // ✅ 优化：下拉刷新时清除缓存，确保获取最新数据
      clearOverviewCache()
      
      this.setData({ loading: true })
      
      // 并行加载所有数据（强制刷新概览数据）
      await Promise.all([
        this.loadDashboardData(true), // 强制刷新
        this.loadEntryData(),
        this.loadExitData(),
        this.loadMaterialData()
      ])
      
      // 标记数据已加载
      this.setData({ isDataLoaded: true })
      
    } catch (error) {
      // 数据刷新失败时静默处理
      logger.error('刷新数据失败:', error)
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


  // 返回上一页功能已在navigation工具中实现

  // 新增入栏记录
  addEntry() {
    wx.navigateTo({
      url: '/packageProduction/entry-form/entry-form'
    })
  },

  // 新增出栏记录
  addExit() {
    wx.navigateTo({
      url: '/packageProduction/exit-form/exit-form'
    })
  },

  // 查看库存详情
  viewInventoryDetail() {
    wx.navigateTo({
      url: '/packageProduction/inventory-detail/inventory-detail'
    })
  },

  // 查看饲料库存详情
  viewFeedInventory() {
    wx.navigateTo({
      url: '/packageProduction/inventory-detail/inventory-detail?category=饲料'
    })
  },

  // 查看药品库存详情
  viewMedicineInventory() {
    wx.navigateTo({
      url: '/packageProduction/inventory-detail/inventory-detail?category=药品'
    })
  },

  // 查看设备物料详情
  viewEquipmentInventory() {
    wx.navigateTo({
      url: '/packageProduction/inventory-detail/inventory-detail?category=设备'
    })
  },

  // 采购物料
  purchaseMaterial() {
    wx.navigateTo({
      url: '/packageProduction/purchase-form/purchase-form'
    })
  },

  // 领用物料
  useMaterial() {
    wx.navigateTo({
      url: '/packageProduction/material-use-form/material-use-form'
    })
  },
  
  // 饲料投喂记录
  recordFeedUsage() {
    wx.navigateTo({
      url: '/packageProduction/feed-usage-form/feed-usage-form'
    })
  },
  
  // 查看全部物料记录
  viewAllMaterialRecords() {
    wx.navigateTo({
      url: '/packageProduction/material-records-list/material-records-list',
      fail: (_error) => {
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
      url: '/packageProduction/entry-records-list/entry-records-list',
      fail: (_error) => {
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
      url: '/packageProduction/exit-records-list/exit-records-list',
      fail: (_error) => {
        // 已移除调试日志
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none',
          duration: 2000
        })
      }
    })
  },

  // 下拉刷新（✅优化：清除缓存，确保获取最新数据）
  onPullDownRefresh() {
    // ✅ 优化：下拉刷新时清除缓存
    clearOverviewCache()
    this.refreshData()
    setTimeout(() => {
      wx.stopPullDownRefresh()
    }, 1500)
  },

  // ========== AI智能盘点功能 ==========
  
  // 启动AI盘点功能
  startAICount() {
    if (this.data.aiCount?.active) {
      this.closeAICount()
      return
    }

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
  async takePhoto() {
    try {
      const res = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['camera', 'album'], // 支持拍照和从相册选择
        camera: 'back', // 使用后置摄像头
        sizeType: ['compressed'], // 优先使用压缩图
        maxDuration: 10
      })
      
      let tempFilePath = res.tempFiles[0].tempFilePath
      
      // 压缩图片以提高识别速度和降低成本
      try {
        const compressedPath = await this.compressImage(tempFilePath)
        tempFilePath = compressedPath
      } catch (compressError) {
        logger.warn('图片压缩失败，使用原图:', compressError)
        // 压缩失败不影响主流程，继续使用原图
      }
      
      this.setData({
        'aiCount.imageUrl': tempFilePath
      })
      
      wx.showToast({
        title: '拍照成功',
        icon: 'success',
        duration: 1000
      })
    } catch (error: any) {
      // 用户取消不显示错误
      if (error.errMsg && error.errMsg.includes('cancel')) {
        return
      }
      
      logger.error('拍照失败:', error)
      wx.showToast({
        title: '拍照失败，请重试',
        icon: 'none',
        duration: 2000
      })
    }
  },
  
  // 压缩图片
  async compressImage(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // 获取图片信息
      wx.getImageInfo({
        src: filePath,
        success: (info) => {
          // 如果图片已经较小，直接返回
          if (info.width * info.height < 1024 * 1024) {
            resolve(filePath)
            return
          }
          
          // 压缩图片
          wx.compressImage({
            src: filePath,
            quality: 85, // 高质量压缩（保持清晰度）
            compressedWidth: Math.min(info.width, 1920), // 最大宽度1920px
            compressedHeight: Math.min(info.height, 1080), // 最大高度1080px
            success: (res) => {
              resolve(res.tempFilePath)
            },
            fail: (error) => {
              logger.warn('图片压缩失败:', error)
              reject(error)
            }
          })
        },
        fail: reject
      })
    })
  },
  
  // 重新拍照
  retakePhoto() {
    // 清除识别结果和错误，但保留现有图片
    // 只有在用户成功选择新图片后才会替换
    this.setData({
      'aiCount.result': null,
      'aiCount.error': null
    })
    
    // 直接调用拍照功能
    this.takePhoto()
  },
  
  // 删除图片
  deletePhoto() {
    this.setData({
      'aiCount.imageUrl': '',
      'aiCount.result': null,
      'aiCount.error': null
    })
    
    wx.showToast({
      title: '已删除图片',
      icon: 'success',
      duration: 1500
    })
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
      
      // 调用AI图像识别云函数（传递云存储文件ID）
      const result = await CloudApi.callFunction<any>(
        'ai-multi-model',
        {
          action: 'image_recognition',
          images: [uploadResult.fileID],
          location: '1号鹅舍',
          timestamp: Date.now(),
          expectedRange: {
            min: 50,
            max: 1000
          }
        },
        {
          showError: false
        }
      )
      
      if (result.success && result.data) {
        const recognitionData = result.data
        
        // 处理识别结果（多特征融合）
        const processedResult = {
          totalCount: recognitionData.totalCount || 0,
          confidence: Math.round((recognitionData.confidence || 0.75) * 100),
          detectionMethod: recognitionData.detectionMethod || 'multi-feature-fusion',
          
          // 特征分布
          featureBreakdown: recognitionData.featureBreakdown || {
            tier1_complete: 0,
            tier2_partial: 0,
            tier3_inferred: 0,
            excluded_lowConfidence: 0
          },
          
          // 个体分析（仅保存前10个用于展示）
          individualAnalysis: (recognitionData.individualAnalysis || []).slice(0, 10),
          
          regions: recognitionData.regions || [],
          abnormalDetection: recognitionData.abnormalDetection || {
            suspiciousAnimals: 0,
            healthConcerns: []
          },
          suggestions: recognitionData.suggestions || [],
          reasoning: recognitionData.reasoning || '',
          timestamp: new Date(),
          imageUrl: uploadResult.fileID || imageUrl,
          
          // 场景特征（用于学习）
          sceneFeatures: {
            ...recognitionData.sceneAnalysis,
            occlusion_level: recognitionData.sceneAnalysis?.occlusion_level || 'medium'
          }
        }
        
        // 自动添加到累加记录
        this.addRecognitionToRounds(processedResult)
        
        // 显示多特征融合识别结果
        const { featureBreakdown } = processedResult
        const detailInfo = `识别方法：多特征融合
完整个体：${featureBreakdown.tier1_complete}只
部分遮挡：${featureBreakdown.tier2_partial}只
特征推断：${featureBreakdown.tier3_inferred}只
置信度：${processedResult.confidence}%

如果数量不准确，点击"修正"标记正确数量，帮助AI学习提升。`
        
        wx.showModal({
          title: `识别完成：${processedResult.totalCount}只`,
          content: detailInfo,
          confirmText: '修正',
          cancelText: '关闭',
          success: (res) => {
            if (res.confirm) {
              // 用户选择修正
              this.correctRecognitionResult(processedResult, uploadResult.fileID)
            }
            // 点击关闭按钮直接关闭弹窗，无需额外操作
          }
        })
        
      } else {
        // AI识别失败
        
        this.setData({
          'aiCount.loading': false,
          'aiCount.error': result.error || '识别失败',
          'aiCount.result': null
        })
        
        // 显示详细错误信息
        wx.showModal({
          title: '识别失败',
          content: result.errorDetail || result.error || '未知错误',
          showCancel: true,
          confirmText: '重试',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              this.retakePhoto()
            }
          }
        })
      }
      
    } catch (error: any) {
      
      this.setData({
        'aiCount.loading': false,
        'aiCount.error': error.message || '分析失败',
        'aiCount.result': null
      })
      
      // 显示详细错误信息
      wx.showModal({
        title: '识别异常',
        content: `错误: ${error.message}\n\n建议: 请检查网络连接，确保图片清晰`,
        showCancel: true,
        confirmText: '重试',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            this.retakePhoto()
          }
        }
      })
    }
  },
  
  // 修正识别结果（用于AI学习）
  async correctRecognitionResult(recognitionResult: any, imageFileID: string) {
    wx.showModal({
      title: '标记正确数量',
      editable: true,
      placeholderText: `AI识别: ${recognitionResult.totalCount}只`,
      success: async (res) => {
        if (res.confirm && res.content) {
          const correctCount = parseInt(res.content)
          
          if (isNaN(correctCount) || correctCount < 0) {
            wx.showToast({
              title: '请输入有效数字',
              icon: 'none'
            })
            return
          }
          
          // 保存学习案例（使用AI分析的场景特征）
          try {
            const result = await CloudApi.callFunction<any>(
              'ai-learning-cases',
              {
                action: 'save_case',
                imageFileID: imageFileID,
                aiCount: recognitionResult.totalCount,
                correctCount: correctCount,
                sceneFeatures: recognitionResult.sceneFeatures || {
                  lighting: 'unknown',
                  crowding: 'unknown',
                  occlusion_level: 'unknown',
                  imageQuality: 'unknown'
                },
                operator: wx.getStorageSync('userInfo')?.nickName || wx.getStorageSync('userInfo')?.nickname || '养殖户'
              },
              {
                showError: false
              }
            )
            
            if (result.success) {
              wx.showToast({
                title: '标记成功，AI将学习此案例',
                icon: 'success',
                duration: 2000
              })
              
              // 更新识别结果为正确数量
              const updatedResult = {
                ...recognitionResult,
                totalCount: correctCount,
                corrected: true
              }
              
              // 更新累加记录中最后一条数据
              const rounds = this.data.aiCount.rounds
              if (rounds.length > 0) {
                rounds[rounds.length - 1] = updatedResult
                
                // 重新计算累加总数
                const cumulativeTotal = rounds.reduce((sum: number, r: any) => sum + r.totalCount, 0)
                
                this.setData({
                  'aiCount.rounds': rounds,
                  'aiCount.cumulativeTotal': cumulativeTotal
                })
              }
            } else {
              throw new Error(result.error || '保存失败')
            }
          } catch (error: any) {
            wx.showToast({
              title: '保存失败：' + error.message,
              icon: 'none'
            })
          }
        }
      }
    })
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
    } catch (error: any) {
      // 已移除调试日志
      return {
        success: false,
        error: error.errMsg || '上传失败'
      }
    }
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
      url: `/packageProduction/exit-form/exit-form?${urlParams}`,
      success: () => {
        // 导航成功后关闭AI盘点界面
        this.closeAICount()
      },
      fail: (_error: any) => {
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
      
    } catch (error: any) {
      // 已移除调试日志
      wx.hideLoading()
      
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none',
        duration: 2000
      })
    }
  },
  
  // 添加识别结果到累加记录
  addRecognitionToRounds(result: any) {
    const { rounds, currentRound, cumulativeTotal } = this.data.aiCount
    
    // 创建新的轮次记录
    const newRound = {
      roundId: currentRound + 1,
      count: result.totalCount,
      confidence: result.confidence,
      timestamp: new Date().toLocaleString('zh-CN', { 
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }),
      imageUrl: result.imageUrl
    }
    
    const updatedRounds = [...rounds, newRound]
    const newTotal = cumulativeTotal + result.totalCount
    
    this.setData({
      'aiCount.result': result,
      'aiCount.rounds': updatedRounds,
      'aiCount.currentRound': newRound.roundId,
      'aiCount.cumulativeTotal': newTotal,
      'aiCount.loading': false,
      'aiCount.error': null
    })
  },

  // 继续识别
  continueRecognition() {
    wx.showModal({
      title: '提示',
      content: '请将已盘点的鹅群转移到其他区域，避免重复计数',
      confirmText: '继续拍照',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          // 清空当前结果，准备下一轮
          this.setData({
            'aiCount.imageUrl': '',
            'aiCount.result': null
          })
          // 直接调用拍照
          this.takePhoto()
        }
      }
    })
  },

  // 结束盘点
  finishCounting() {
    const { cumulativeTotal, rounds } = this.data.aiCount
    
    if (rounds.length === 0) {
      wx.showToast({
        title: '请先进行识别',
        icon: 'none'
      })
      return
    }
    
    const avgConfidence = this.calculateAvgConfidence(rounds)
    
    wx.showModal({
      title: '完成盘点',
      content: `共识别 ${rounds.length} 次，累计 ${cumulativeTotal} 只鹅\n平均置信度：${avgConfidence}%\n\n是否创建出栏记录？`,
      confirmText: '创建记录',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          // 跳转到出栏表单，传递累计数据
          this.navigateToExitForm({
            totalCount: cumulativeTotal,
            confidence: avgConfidence,
            type: 'cumulative',
            rounds: rounds
          })
          // 重置盘点数据
          this.resetCountData()
        }
      }
    })
  },

  // 计算平均置信度
  calculateAvgConfidence(rounds: any[]) {
    if (!rounds || rounds.length === 0) return 0
    const sum = rounds.reduce((acc, r) => acc + (r.confidence || 0), 0)
    return Math.round(sum / rounds.length)
  },

  // 重置盘点数据
  resetCountData() {
    this.setData({
      'aiCount.active': false,
      'aiCount.result': null,
      'aiCount.imageUrl': '',
      'aiCount.rounds': [],
      'aiCount.currentRound': 0,
      'aiCount.cumulativeTotal': 0,
      'aiCount.loading': false,
      'aiCount.error': null
    })
  },


  // 查看入栏记录详情
  viewEntryRecordDetail(e: any) {
    const record = e.currentTarget.dataset.record
    // 格式化数据以匹配组件期望的字段
    const formattedRecord = {
      ...record,
      displayQuantity: `${record.quantity}羽`,
      date: record.entryDate || record.date,
      healthStatus: record.healthStatus || '良好'
    }
    this.setData({
      selectedEntryRecord: formattedRecord,
      showEntryDetailPopup: true
    })
  },

  // 查看出栏记录详情
  viewExitRecordDetail(e: any) {
    const record = e.currentTarget.dataset.record
    // 格式化数据以匹配组件期望的字段
    const formattedRecord = {
      ...record,
      displayQuantity: `${record.quantity}羽`,
      date: record.exitDate || record.date,
      customer: record.customer || record.buyerName || '',
      exitNumber: record.exitNumber || record.id
    }
    this.setData({
      selectedExitRecord: formattedRecord,
      showExitDetailPopup: true
    })
  },

  // 关闭入栏详情弹窗
  closeEntryDetailPopup() {
    this.setData({
      showEntryDetailPopup: false
    })
    // 延迟清空数据，避免弹窗关闭动画时数据闪烁
    setTimeout(() => {
      this.setData({
        selectedEntryRecord: null
      })
    }, 300)
  },


  // 关闭出栏详情弹窗
  closeExitDetailPopup() {
    this.setData({
      showExitDetailPopup: false
    })
    // 延迟清空数据，避免弹窗关闭动画时数据闪烁
    setTimeout(() => {
      this.setData({
        selectedExitRecord: null
      })
    }, 300)
  },


  // 查看物料记录详情
  viewMaterialRecordDetail(e: any) {
    const record = e.currentTarget.dataset.record
    // 格式化数据以匹配组件期望的字段
    const formattedRecord = {
      ...record,
      displayQuantity: record.quantity || '',
      targetLocation: record.targetLocation || record.purpose || ''
    }
    this.setData({
      selectedMaterialRecord: formattedRecord,
      showMaterialDetailPopup: true
    })
  },

  // 关闭物料详情弹窗
  closeMaterialDetailPopup() {
    this.setData({
      showMaterialDetailPopup: false
    })
    // 延迟清空数据，避免弹窗关闭动画时数据闪烁
    setTimeout(() => {
      this.setData({
        selectedMaterialRecord: null
      })
    }, 300)
  },


}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
