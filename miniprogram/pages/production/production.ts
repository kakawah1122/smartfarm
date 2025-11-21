import type { 
  BaseResponse, 
  CloudFunctionResponse,
  Batch, 
  HealthRecord, 
  FinanceRecord,
  InputEvent, 
  TapEvent, 
  PickerEvent, 
  ScrollEvent 
} from '../../../typings/core';
// production.ts
import { createPageWithNavbar, type PageInstance } from '../../utils/navigation'
import CloudApi from '../../utils/cloud-api'
import { logger } from '../../utils/logger'
import { createSetDataWrapper, SetDataWrapper } from '../health/helpers/setdata-wrapper'

// 导入模块化管理器
import { setupNavigationHandlers } from './modules/production-navigation-module'
import { ProductionDataLoader } from './modules/production-data-loader'
import { ProductionAIManager } from './modules/production-ai-module'

// 分页配置
const PAGE_SIZE = 20;

type ProductionPageData = WechatMiniprogram.Page.DataOption & {
  aiCount: {
    active: boolean
    loading: boolean
    imageUrl: string
    result: unknown
    error: string | null
    history: unknown[]
    rounds: unknown[]
    currentRound: number
    cumulativeTotal: number
  },
  
  // 新增分页相关
  pagination: {
    entry: { page: number; hasMore: boolean; loading: boolean };
    exit: { page: number; hasMore: boolean; loading: boolean };
    material: { page: number; hasMore: boolean; loading: boolean };
  };
  
  // 性能优化标记
  isFirstLoad: boolean;
  tabLoadStatus: {
    entry: boolean;
    exit: boolean;
    material: boolean;
  };
}

const pageConfig: Partial<PageInstance<ProductionPageData>> & { data: ProductionPageData } = {
  // 优化器实例
  setDataWrapper: null as SetDataWrapper | null,
  
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
      result: null as BaseResponse,  // 识别结果
      error: null as string | null,
      history: [] as unknown[], // 盘点历史
      
      // 累加相关
      rounds: [] as unknown[],       // 各轮次记录
      currentRound: 0,           // 当前轮次
      cumulativeTotal: 0         // 累计总数
    },
    
    // 新增分页数据
    pagination: {
      entry: { page: 1, hasMore: true, loading: false },
      exit: { page: 1, hasMore: true, loading: false },
      material: { page: 1, hasMore: true, loading: false }
    },
    
    // 性能优化标记
    isFirstLoad: true,
    tabLoadStatus: {
      entry: false,
      exit: false,
      material: false
    }
  },

  onLoad() {
    // 🎯 性能优化：分步加载
    const startTime = Date.now()
    logger.info('生产页面开始加载')
    
    // ✅ 性能优化：初始化setData包装器
    this.setDataWrapper = createSetDataWrapper(this)
    
    // 初始化导航处理器
    setupNavigationHandlers(this)
    
    // 确保 aiCount 数据结构完整
    this.setData({
      'aiCount.history': [],
      'aiCount.rounds': [],
      'aiCount.currentRound': 0,
      'aiCount.cumulativeTotal': 0,
      isDataLoaded: false,
      isFirstLoad: true
    })
    
    // 🎯 优化：先加载概览数据，然后加载必要的列表数据
    this.loadDashboardData().then(() => {
      logger.info(`概览数据加载完成，耗时：${Date.now() - startTime}ms`)
      
      // 延迟100ms后加载必要数据（入栏和出栏都需要在首页显示）
      setTimeout(() => {
        // 加载入栏数据（当前tab）
        this.loadEntryData()
        // 加载出栏数据（首页需要显示最近出栏记录）
        this.loadExitData()
        // 标记已加载
        this.setData({
          'tabLoadStatus.entry': true,
          'tabLoadStatus.exit': true
        })
      }, 100)
    })
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

  // 🎯 优化：按需加载当前tab数据
  loadCurrentTabData() {
    const activeTab = this.data.activeTab
    
    // 检查是否已加载
    if (this.data.tabLoadStatus[activeTab]) {
      return
    }
    
    switch(activeTab) {
      case 'entry':
        this.loadEntryData()
        break
      case 'exit':
        this.loadExitData()
        break
      case 'material':
        this.loadMaterialData()
        break
    }
  },
  
  // 原有loadData方法保留（兼容性）
  async loadData() {
    if (this.data.isDataLoaded) return
    
    try {
      await this.loadDashboardData()
      // 只加载当前tab
      this.loadCurrentTabData()
      this.setData({ isDataLoaded: true })
    } catch (error: unknown) {
      logger.error('加载数据失败:', error)
    }
  },

  // 加载仪表盘数据（使用模块化数据加载器）
  async loadDashboardData(forceRefresh: boolean = false): Promise<void> {
    try {
      this.setData({ loading: true })
      
      // 使用模块化的数据加载器
      const data = await ProductionDataLoader.loadOverviewData(forceRefresh)
      if (data) {
        this.setData(data)
      } else {
        // 设置默认数据
        const defaultStats = ProductionDataLoader.getDefaultStats()
        this.setData(defaultStats)
      }
    } catch (error: unknown) {
      logger.error('概览数据加载失败:', error)
      // 设置默认数据
      const defaultStats = ProductionDataLoader.getDefaultStats()
      this.setData(defaultStats)
      
      // 如果是云函数不存在的错误，给出友好提示
      if (error.errMsg && error.errMsg.includes('function not found')) {
        wx.showModal({
          title: '系统提示',
          content: '生产管理云函数尚未部署，请先部署云函数后再使用。当前显示为空数据。',
          showCancel: false
        })
      } else {
        // 提示加载失败
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

  // 加载入栏数据（使用模块化数据加载器）
  async loadEntryData() {
    try {
      const records = await ProductionDataLoader.loadEntryRecords()
      this.setData({
        entryRecords: records,
        isEmpty: records.length === 0
      })
    } catch (error: unknown) {
      logger.error('加载入栏数据失败:', error)
      this.setData({ entryRecords: [], isEmpty: true })
    }
  },

  // 加载出栏数据（使用模块化数据加载器）
  async loadExitData() {
    try {
      const records = await ProductionDataLoader.loadExitRecords()
      this.setData({
        exitRecords: records,
        isEmpty: records.length === 0
      })
    } catch (error: unknown) {
      logger.error('加载出栏数据失败:', error)
      this.setData({ exitRecords: [], isEmpty: true })
    }
  },

  // 加载物料数据（使用模块化数据加载器）
  async loadMaterialData() {
    try {
      const records = await ProductionDataLoader.loadMaterialRecords()
      // 只显示前5条记录
      this.setData({
        materialRecords: records.slice(0, 5),
        isEmpty: records.length === 0
      })
    } catch (error: unknown) {
      logger.error('加载物料数据失败:', error)
      this.setData({ materialRecords: [], isEmpty: true })
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
      // 清除缓存，确保获取最新数据
      ProductionDataLoader.clearCache()
      
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
  onTabChange(e: WechatMiniprogram.CustomEvent) {
    const { value } = e.detail
    this.setData({
      activeTab: value
    })
    
    // 按需加载tab数据
    if (!this.data.tabLoadStatus[value]) {
      switch(value) {
        case 'entry':
          this.loadEntryData()
          break
        case 'exit':
          this.loadExitData()
          break
        case 'material':
          this.loadMaterialData()
          break
      }
      this.setData({
        [`tabLoadStatus.${value}`]: true
      })
    }
  },
  
  // Tab切换（兼容旧版本）
  switchTab(e: WechatMiniprogram.CustomEvent) {
    this.onTabChange(e)
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

  // 下拉刷新（优化：清除缓存，确保获取最新数据）
  onPullDownRefresh() {
    // 下拉刷新时清除缓存
    ProductionDataLoader.clearCache()
    this.refreshData()
    setTimeout(() => {
      wx.stopPullDownRefresh()
    }, 1500)
  },

  // ========== AI智能盘点功能 ==========
  
  // 启动AI盘点功能（使用模块化AI管理器）
  startAICount() {
    ProductionAIManager.startAICount()
    this.setData({
      'aiCount.active': true
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
  
  // 删除照片
  deletePhoto() {
    this.setData({
      'aiCount.imageUrl': '',
      'aiCount.result': null,
      'aiCount.error': null
    })
  },
  
  // 分析图片
  async analyzeImage() {
    const imageUrl = this.data.aiCount.imageUrl
    if (!imageUrl) {
      wx.showToast({ title: '请先拍照', icon: 'none' })
      return
    }
    
    this.setData({ 'aiCount.loading': true })
    
    try {
      const result = await ProductionAIManager.analyzeImage(imageUrl)
      
      // 更新当前结果
      this.setData({
        'aiCount.result': result,
        'aiCount.loading': false
      })
      
      // 如果是累积模式，添加到历史记录
      if (this.data.aiCount.rounds.length > 0 || this.data.aiCount.cumulativeTotal > 0) {
        this.addToRounds(result)
      }
    } catch (error) {
      this.setData({
        'aiCount.loading': false,
        'aiCount.error': '识别失败，请重试'
      })
    }
  },
  
  // 添加到累积记录
  addToRounds(result: any) {
    const rounds = this.data.aiCount.rounds || []
    const newRound = {
      roundId: rounds.length + 1,
      count: result.totalCount || 0,
      confidence: result.confidence || 0,
      timestamp: new Date().toLocaleTimeString('zh-CN')
    }
    
    rounds.push(newRound)
    const cumulativeTotal = rounds.reduce((sum: number, r: any) => sum + r.count, 0)
    
    this.setData({
      'aiCount.rounds': rounds,
      'aiCount.cumulativeTotal': cumulativeTotal
    })
  },
  
  // 继续识别（累积模式）
  continueRecognition() {
    // 保留结果，清空图片，准备下一次拍照
    this.setData({
      'aiCount.imageUrl': '',
      'aiCount.result': null
    })
    
    wx.showToast({
      title: '请继续拍照盘点',
      icon: 'none'
    })
  },
  
  // 结束盘点
  finishCounting() {
    const total = this.data.aiCount.cumulativeTotal || this.data.aiCount.result?.totalCount || 0
    
    wx.showModal({
      title: '盘点完成',
      content: `本次共盘点出栏数量：${total}只`,
      confirmText: '确定',
      showCancel: false,
      success: () => {
        // 重置AI盘点状态
        this.setData({
          'aiCount.active': false,
          'aiCount.imageUrl': '',
          'aiCount.result': null,
          'aiCount.rounds': [],
          'aiCount.cumulativeTotal': 0
        })
      }
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
    } catch (error: unknown) {
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
  
  // 分析图片（AI模块）
  async analyzeImageFromAI() {
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
      const result = await CloudApi.callFunction<BaseResponse>(
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
      
    } catch (error: unknown) {
      
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
  async correctRecognitionResult(recognitionResult: unknown, imageFileID: string) {
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
            const result = await CloudApi.callFunction<BaseResponse>(
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
                const cumulativeTotal = rounds.reduce((sum: number, r: unknown) => sum + r.totalCount, 0)
                
                this.setData({
                  'aiCount.rounds': rounds,
                  'aiCount.cumulativeTotal': cumulativeTotal
                })
              }
            } else {
              throw new Error(result.error || '保存失败')
            }
          } catch (error: unknown) {
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
    } catch (error: unknown) {
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
  navigateToExitForm(aiResult: unknown) {
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
      fail: (_error: unknown) => {
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
      
    } catch (error: unknown) {
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
  addRecognitionToRounds(result: unknown) {
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

  // 计算平均置信度
  calculateAvgConfidence(rounds: unknown[]) {
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
  viewEntryRecordDetail(e: WechatMiniprogram.CustomEvent) {
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
  viewExitRecordDetail(e: WechatMiniprogram.CustomEvent) {
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
  viewMaterialRecordDetail(e: WechatMiniprogram.CustomEvent) {
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
  
  /**
   * 页面卸载时清理资源
   * ✅ 性能优化：清理setData包装器
   */
  onUnload() {
    if (this.setDataWrapper) {
      this.setDataWrapper.destroy()
      this.setDataWrapper = null
    }
  }

}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
