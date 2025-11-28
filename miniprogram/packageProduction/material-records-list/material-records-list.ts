// pages/material-records-list/material-records-list.ts
import { createPageWithNavbar } from '../../utils/navigation'

// 物料信息接口
interface MaterialInfo {
  name?: string;
  category?: string;
  unit?: string;
}

// 物料记录接口
interface MaterialRecord {
  _id?: string;
  recordNumber?: string;
  material?: MaterialInfo;
  type?: string;
  supplier?: string;
  targetLocation?: string;
  quantity?: number;
  operator?: string;
  status?: string;
  notes?: string | Record<string, unknown>;
  recordDate?: string;
  createTime?: string;
}

// 查询参数接口
interface QueryData {
  action: string;
  page: number;
  pageSize: number;
  type?: string;
}

// 自定义事件类型
type CustomEvent<T = Record<string, unknown>> = WechatMiniprogram.CustomEvent<T>;

const pageConfig = {
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
    // 记录列表
    records: [],
    
    // 分页信息
    currentPage: 1,
    pageSize: 20,
    totalRecords: 0,
    totalPages: 0,
    hasMore: false,
    
    // 筛选条件
    activeFilter: 'all', // 'all', 'purchase', 'use'
    searchKeyword: '',
    
    // 加载状态
    loading: false,
    loadingMore: false,
    isEmpty: false,
    
    // 弹窗相关
    showDetailPopup: false,
    selectedRecord: null
  },

  onLoad() {
    this.loadRecords()
  },

  onUnload() {
    this._clearAllTimers()
  },

  onReady() {
    // 页面初次渲染完成
  },

  onShow() {
    // 页面显示时刷新数据
    this.refreshData()
  },

  // 加载记录列表
  async loadRecords(append = false) {
    try {
      const isLoadMore = append
      
      if (isLoadMore) {
        this.setData({ loadingMore: true })
      } else {
        this.setData({ loading: true })
      }

      const page = isLoadMore ? this.data.currentPage + 1 : 1
      
      // 构建查询参数
      const queryData: QueryData = {
        action: 'list_records',
        page: page,
        pageSize: this.data.pageSize
      }

      // 添加筛选条件
      if (this.data.activeFilter !== 'all') {
        queryData.type = this.data.activeFilter
      }

      const result = await wx.cloud.callFunction({
        name: 'production-material',
        data: queryData
      })

      if (result.result && result.result.success) {
        const records = result.result.data.records || []
        const pagination = result.result.data.pagination || {}

        // 获取当前用户信息
        const app = getApp()
        const currentUser = app.globalData?.userInfo?.nickname || app.globalData?.userInfo?.nickName || '系统用户'
        
        // 转换数据格式
        const formattedRecords = records.map((record: MaterialRecord) => ({
          id: record._id || record.recordNumber,
          recordNumber: record.recordNumber || record._id,
          name: record.material?.name || '未知物料',
          type: record.type === 'purchase' ? '采购' : '领用',
          typeOriginal: record.type,
          category: record.material?.category || '未分类',
          supplier: record.supplier || '',
          targetLocation: record.targetLocation || '',
          quantity: record.quantity,
          unit: record.material?.unit || '件',
          operator: (!record.operator || record.operator === '未知' || record.operator === '系统用户') ? currentUser : record.operator,
          status: record.status || '已完成',
          notes: (() => {
            // 处理备注字段
            const notes = record.notes
            
            // 如果是字符串
            if (typeof notes === 'string') {
              // 检查是否是[object Object]错误字符串
              if (notes === '[object Object]' || notes === 'undefined' || notes === 'null') {
                return '无'
              }
              return notes
            }
            
            // 如果是对象
            if (notes && typeof notes === 'object') {
              // 尝试提取文本字段
              const text = notes.content || notes.text || notes.remark || notes.value
              if (text) return String(text)
              
              // 尝试JSON序列化
              try {
                const jsonStr = JSON.stringify(notes)
                if (jsonStr === '{}') return '无'
                return jsonStr
              } catch (e) {
                return '无'
              }
            }
            
            // 其他情况
            return notes ? String(notes) : '无'
          })(),
          date: record.recordDate || (record.createTime ? record.createTime.split('T')[0] : '未知日期'),
          createTime: record.createTime,
          description: `${record.material?.category || '未分类'} • ${record.supplier || record.targetLocation || ''}`,
          displayQuantity: `${record.quantity}${record.material?.unit || '件'}`
        }))

        // 根据是否追加来更新数据
        const finalRecords = isLoadMore 
          ? [...this.data.records, ...formattedRecords]
          : formattedRecords

        this.setData({
          records: finalRecords,
          currentPage: page,
          totalRecords: pagination.total || 0,
          totalPages: pagination.totalPages || 1,
          hasMore: page < (pagination.totalPages || 1),
          isEmpty: finalRecords.length === 0
        })

      } else {
        this.setData({ 
          records: [],
          isEmpty: true 
        })
      }

    } catch (error) {
      // 已移除调试日志
      wx.showToast({
        title: '加载失败',
        icon: 'none',
        duration: 2000
      })
      
      if (!append) {
        this.setData({ 
          records: [],
          isEmpty: true 
        })
      }
    } finally {
      this.setData({
        loading: false,
        loadingMore: false
      })
    }
  },

  // 筛选切换
  onFilterChange(e: CustomEvent) {
    const { value } = e.detail
    this.setData({
      activeFilter: value,
      currentPage: 1
    })
    this.loadRecords()
  },

  // 搜索功能
  onSearch(e: CustomEvent) {
    const keyword = e.detail.value
    this.setData({
      searchKeyword: keyword,
      currentPage: 1
    })
    
    // 这里可以实现搜索逻辑
    // 暂时先刷新所有数据
    this.loadRecords()
  },

  // 加载更多
  async loadMore() {
    if (!this.data.hasMore || this.data.loadingMore) {
      return
    }
    
    await this.loadRecords(true)
    
    if (!this.data.hasMore) {
      wx.showToast({
        title: '已加载全部记录',
        icon: 'success',
        duration: 1000
      })
    }
  },

  // 刷新数据
  async refreshData() {
    this.setData({
      currentPage: 1
    })
    await this.loadRecords()
  },

  // 下拉刷新
  async onPullDownRefresh() {
    await this.refreshData()
    wx.stopPullDownRefresh()
  },

  // 触底加载更多
  onReachBottom() {
    this.loadMore()
  },

  // 查看记录详情
  viewRecordDetail(e: CustomEvent) {
    const { record } = e.currentTarget.dataset
    this.setData({
      selectedRecord: record,
      showDetailPopup: true
    })
  },
  
  // 关闭详情弹窗
  closeDetailPopup() {
    this.setData({
      showDetailPopup: false
    })
    // 延迟清空数据，避免弹窗关闭动画时数据闪烁
    this._safeSetTimeout(() => {
      this.setData({
        selectedRecord: null
      })
    }, 300)
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
