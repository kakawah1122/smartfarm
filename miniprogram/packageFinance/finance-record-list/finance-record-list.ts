// finance-record-list.ts - 财务记录列表页面
/// <reference path="../../../typings/index.d.ts" />
import { createPageWithNavbar, type PageInstance } from '../../utils/navigation'
import { logger } from '../../utils/logger'
import { safeCloudCall } from '../../utils/safe-cloud-call'
import { VirtualRenderHelper, throttle } from '../utils/virtual-render-helper'

interface AllFinanceRecordsResponse {
  records: unknown[]
}

interface CloudCallResult<T = any> {
  success: boolean
  data?: T
  error?: string
}

type PageData = {
  records: any[]
  displayRecords: any[]
  currentType: 'all' | 'income' | 'expense'
  typeTabs: { label: string; value: 'all' | 'income' | 'expense' }[]
  loading: boolean
  showDetailPopup: boolean
  selectedRecord: any
  // 虚拟渲染相关
  virtualRenderEnabled: boolean
  virtualDisplayRecords: any[]
  virtualTopHeight: number
  virtualBottomHeight: number}

// 创建虚拟渲染助手实例（初始禁用）
let virtualHelper: VirtualRenderHelper | null = null

const pageConfig: Partial<PageInstance<PageData>> & { data: PageData } = {
  // ✅ 定时器管理
  _timerIds: [] as number[],
  
  _safeSetTimeout(callback: () => void, delay: number): number {
    const timerId = setTimeout(() => {
      const index = this._timerIds.indexOf(timerId as unknown as number)
      if (index > -1) {
        this._timerIds.splice(index, 1)
      }
      callback()
    }, delay) as unknown as number
    this._timerIds.push(timerId)
    return timerId
  },
  
  _clearAllTimers() {
    this._timerIds.forEach((id: number) => clearTimeout(id))
    this._timerIds = []
  },

  data: {
    records: [],
    displayRecords: [],
    currentType: 'all', // all, income, expense
    typeTabs: [
      { label: '全部', value: 'all' },
      { label: '收入', value: 'income' },
      { label: '支出', value: 'expense' }
    ],
    loading: false,
    
    // 交易详情弹窗
    showDetailPopup: false,
    selectedRecord: null as unknown,
    
    // 虚拟渲染相关（生产环境默认开启）
    virtualRenderEnabled: true, // 生产环境默认开启
    virtualDisplayRecords: [],
    virtualTopHeight: 0,
    virtualBottomHeight: 0
  },

  onLoad(this: PageInstance<PageData>) {
    // 初始化虚拟渲染（生产环境）
    this.initVirtualRender()
    // 加载数据
    this.loadRecords()
  },

  onUnload() {
    this._clearAllTimers()
  },

  // 返回上一页
  goBack(e?: any) {
    // 阻止事件冒泡，避免 navigation-bar 执行默认返回
    if (e) {
      e.stopPropagation && e.stopPropagation()
    }
    
    const pages = getCurrentPages()
    
    if (pages.length > 1) {
      // 有上一页，正常返回
      wx.navigateBack({
        delta: 1,
        fail: (err) => {
          logger.error('返回失败:', err)
          // 返回失败，跳转到财务管理页面
          wx.redirectTo({
            url: '/packageFinance/finance/finance',
            fail: () => {
              // 如果跳转失败，尝试切换到首页
              wx.switchTab({
                url: '/pages/index/index'
              })
            }
          })
        }
      })
    } else {
      // 没有上一页，直接跳转到财务管理页面
      wx.redirectTo({
        url: '/packageFinance/finance/finance',
        fail: () => {
          wx.switchTab({
            url: '/pages/index/index'
          })
        }
      })
    }
  },

  // 切换类型
  onTypeChange(this: PageInstance<PageData>, e: WechatMiniprogram.BaseEvent & { currentTarget: { dataset: { type: 'all' | 'income' | 'expense' } } }) {
    const type = e.currentTarget.dataset.type
    this.setData({
      currentType: type
    })
    this.filterRecords()
  },

  // 加载记录
  async loadRecords(this: PageInstance<PageData>) {
    if (this.data.loading) return
    
    this.setData({ loading: true })
    
    try {
      const now = new Date()
      const startDate = new Date(now.getFullYear(), 0, 1).toISOString() // 今年开始
      const endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59).toISOString() // 今年结束

      const result = await safeCloudCall({
        name: 'finance-management',
        data: {
          action: 'get_all_finance_records',
          dateRange: { start: startDate, end: endDate }
        }
      }) as CloudCallResult<AllFinanceRecordsResponse>

      if (result?.success) {
        const allRecords = result.data?.records || []
        const records: any[] = []

        // 处理所有记录
        allRecords.forEach((record: any) => {
          let title = ''
          let description = record.description || ''
          
          // 确保 rawRecord 包含完整的原始数据
          let rawRecord = record.rawRecord || record
          
          // 对于业务记录，确保 rawRecord 包含所有必要字段
          if (record.source === 'exit' || record.source === 'entry' || record.source === 'feed' || record.source === 'purchase') {
            // 如果没有 rawRecord，使用 record 本身
            if (!record.rawRecord) {
              rawRecord = {
                ...(record as any),
                batchNumber: record.batchNumber,
                customer: record.customer,
                supplier: record.supplier,
                quantity: record.quantity,
                breed: record.breed,
                exitNumber: record.exitNumber,
                amount: record.materialAmount || record.feedAmount,
                unit: record.unit,
                materialName: record.materialName,
                name: record.name
              }
            }
          }

          if (record.source === 'finance') {
            if (record.type === 'income') {
              title = this.getRevenueTitle(record.revenueType, record.description)
            } else {
              if (record.isReimbursement && record.reimbursement) {
                title = record.reimbursement.typeName || this.getReimbursementTypeTitle(record.reimbursement.type) || record.description || '报销申请'
              } else {
                title = this.getCostTitle(record.costType, record.description)
              }
            }
          } else if (record.source === 'exit') {
            title = '成鹅销售收入'
            description = record.description || `批次：${record.batchNumber || ''} - 客户：${rawRecord?.customer || '未知'}`
          } else if (record.source === 'entry') {
            title = '入栏采购'
            description = record.description || `批次：${record.batchNumber || ''}`
          } else if (record.source === 'feed') {
            title = '饲料成本'
            description = record.description || `批次：${record.batchNumber || ''}`
          } else if (record.source === 'purchase') {
            if (record.costType === 'feed') {
              title = '饲料成本'
            } else if (record.costType === 'health') {
              title = '医疗费用'
            } else {
              title = '其他费用'
            }
            description = record.description || '物料采购'
          }

          records.push({
            id: record.id,
            type: record.type,
            title: title,
            description: description,
            amount: this.formatAmount(record.amount),
            date: this.formatDate(record.createTime || record.date),
            source: record.source, // 保存来源字段，用于解析详情
            rawRecord: rawRecord // 使用处理后的完整 rawRecord
          })
        })

        // 设置所有记录
        this.setData({
          records: records,
          loading: false
        })
        
        this.filterRecords()
      } else {
        this.setData({ loading: false })
        wx.showToast({
          title: result?.error || '加载失败',
          icon: 'none'
        })
      }
    } catch (error: unknown) {
      this.setData({ loading: false })
      logger.error('加载财务记录失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  // 筛选记录
  filterRecords(this: PageInstance<PageData>) {
    const { records, currentType } = this.data
    let filtered = records

    if (currentType !== 'all') {
      filtered = records.filter((r: any) => r.type === currentType)
    }

    // 如果启用虚拟渲染，更新虚拟渲染状态
    if (this.data.virtualRenderEnabled && virtualHelper) {
      virtualHelper.setData(filtered)
      this.updateVirtualDisplay()
    } else {
      // 使用传统方式显示所有数据
      this.setData({
        displayRecords: filtered
      })
    }
  },
  
  // 初始化虚拟渲染（生产环境）
  initVirtualRender(this: PageInstance<PageData>) {
    // 生产环境自动初始化
    if (!this.data.virtualRenderEnabled) return
    
    virtualHelper = new VirtualRenderHelper({
      itemHeight: 160, // 每项高度（rpx转px）
      containerHeight: 600, // 容器高度
      bufferSize: 5, // 缓冲区
      enableVirtual: true // 生产环境默认开启
    })
  },
  
  // 更新虚拟显示数据
  updateVirtualDisplay(this: PageInstance<PageData>) {
    if (!virtualHelper || !this.data.virtualRenderEnabled) {
      return
    }
    
    const state = virtualHelper.getVirtualState()
    this.setData({
      virtualDisplayRecords: state.visibleData,
      virtualTopHeight: state.topPlaceholder,
      virtualBottomHeight: state.bottomPlaceholder,
      // 同时更新displayRecords以保持兼容
      displayRecords: state.visibleData
    })
  },
  
  // 处理滚动事件（使用节流）
  onScroll: throttle(function(this: PageInstance<PageData>, e: WechatMiniprogram.ScrollViewScroll) {
    if (!virtualHelper || !this.data.virtualRenderEnabled) {
      return
    }
    
    virtualHelper.updateScrollTop(e.detail.scrollTop)
    this.updateVirtualDisplay()
  }, 16),
  
  // 切换虚拟渲染开关（供测试使用）
  toggleVirtualRender(this: PageInstance<PageData>) {
    const newState = !this.data.virtualRenderEnabled
    this.setData({
      virtualRenderEnabled: newState
    })
    
    if (newState && !virtualHelper) {
      this.initVirtualRender()
    }
    
    if (virtualHelper) {
      virtualHelper.toggle(newState)
    }
    
    // 重新筛选以应用虚拟渲染
    this.filterRecords()
  },

  // 查看记录详情
  viewRecordDetail(this: PageInstance<PageData>, e: WechatMiniprogram.BaseEvent & { currentTarget: { dataset: { item: any} } }) {
    const item = e.currentTarget.dataset.item
    this.setData({
      selectedRecord: item,
      showDetailPopup: true
    })
  },
  
  // 关闭详情弹窗
  closeDetailPopup(this: PageInstance<PageData>) {
    this.setData({
      showDetailPopup: false
    })
    // 延迟清空数据，避免弹窗关闭动画时数据闪烁
    this._safeSetTimeout(() => {
      this.setData({
        selectedRecord: null
      })
    }, 300)
  },

  // 格式化金额
  formatAmount(amount: number): string {
    return amount ? amount.toLocaleString('zh-CN', { maximumFractionDigits: 0 }) : '0'
  },

  // 安全解析日期
  parseDate(dateStr: string): Date {
    if (!dateStr) return new Date()
    
    if (dateStr.includes('T')) {
      return new Date(dateStr)
    }
    
    if (dateStr.includes('-') && dateStr.includes(' ')) {
      const normalized = dateStr.replace(/-/g, '/')
      return new Date(normalized)
    }
    
    if (dateStr.includes('-') && !dateStr.includes(' ')) {
      return new Date(dateStr)
    }
    
    if (dateStr.includes('/')) {
      return new Date(dateStr)
    }
    
    return new Date(dateStr)
  },

  // 格式化日期
  formatDate(dateStr: string): string {
    if (!dateStr) return ''
    const date = this.parseDate(dateStr)
    
    if (isNaN(date.getTime())) {
      return dateStr
    }
    
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}/${month}/${day} ${hours}:${minutes}`
  },

  // 获取收入标题
  getRevenueTitle(revenueType: string, description: string): string {
    const typeMap: unknown = {
      'sales': '销售收入',
      'other': '其他收入'
    }
    return typeMap[revenueType] || description || '收入记录'
  },

  // 获取支出标题
  getCostTitle(costType: string, description: string): string {
    const typeMap: unknown = {
      'feed': '饲料成本',
      'health': '医疗费用',
      'labor': '其他费用',
      'facility': '设施成本',
      'other': '其他费用',
      'loss': '损失费用',
      'death_loss': '死亡损失',
      'treatment': '治疗费用'
    }
    return typeMap[costType] || description || '支出记录'
  },

  // 获取报销类型标题
  getReimbursementTypeTitle(reimbursementType: string): string {
    const typeMap: unknown = {
      'feed': '饲料采购',
      'medicine': '兽药采购',
      'vaccine': '防疫费用',
      'equipment': '设备维修',
      'transport': '运输费用',
      'utilities': '水电费',
      'labor': '劳务费用',
      'other': '其他费用'
    }
    return typeMap[reimbursementType] || '其他费用'
  }
}

Page(createPageWithNavbar(pageConfig))

