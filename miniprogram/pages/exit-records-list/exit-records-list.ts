// pages/exit-records-list/exit-records-list.ts
import { createPageWithNavbar } from '../../utils/navigation'

const pageConfig = {
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
    activeFilter: 'all', // 'all', 'pending', 'delivered'
    searchKeyword: '',
    
    // 加载状态
    loading: false,
    loadingMore: false,
    isEmpty: false
  },

  onLoad() {
    this.loadRecords()
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
      const queryData: any = {
        action: 'list',
        page: page,
        pageSize: this.data.pageSize
      }

      const result = await wx.cloud.callFunction({
        name: 'production-exit',
        data: queryData
      })

      if (result.result && result.result.success) {
        const records = result.result.data.records || []
        const pagination = result.result.data.pagination || {}

        // 获取当前用户信息
        const app = getApp()
        const currentUser = app.globalData?.userInfo?.nickname || '系统用户'
        
        // 转换数据格式
        const formattedRecords = records.map(record => ({
          id: record._id || record.exitNumber,
          exitNumber: record.exitNumber || record._id,
          batchNumber: record.batchNumber || '',
          breed: record.breed || '未知品种',
          customer: record.customer || '未知客户',
          quantity: record.quantity || 0,
          unit: record.unit || '羽',
          avgWeight: record.avgWeight || 0,
          totalWeight: record.totalWeight || 0,
          operator: record.operator || currentUser,
          status: record.status || '已交付',
          notes: record.notes || '',
          date: record.exitDate || (record.createTime ? record.createTime.split('T')[0] : '未知日期'),
          createTime: record.createTime,
          displayTitle: record.breed || '未知品种',
          displayQuantity: `${record.quantity || 0}${record.unit || '羽'}`
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
      console.error('加载记录失败:', error)
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
  onFilterChange(e: any) {
    const { value } = e.detail
    this.setData({
      activeFilter: value,
      currentPage: 1
    })
    this.loadRecords()
  },

  // 搜索功能
  onSearch(e: any) {
    const keyword = e.detail.value
    this.setData({
      searchKeyword: keyword,
      currentPage: 1
    })
    
    // 这里可以实现搜索逻辑
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
  viewRecordDetail(e: any) {
    const { record } = e.currentTarget.dataset
    
    // 构建详情内容
    let content = `客户：${record.customer}\n出栏号：${record.exitNumber}\n数量：${record.displayQuantity}`
    
    if (record.batchNumber) {
      content += `\n批次号：${record.batchNumber}`
    }
    
    if (record.avgWeight > 0) {
      content += `\n平均重量：${record.avgWeight}斤`
    }
    
    if (record.totalWeight > 0) {
      content += `\n总重量：${record.totalWeight}斤`
    }
    
    content += `\n操作员：${record.operator}\n时间：${record.date}\n状态：${record.status}`
    
    if (record.notes) {
      content += `\n备注：${record.notes}`
    }
    
    wx.showModal({
      title: '出栏记录详情',
      content: content,
      showCancel: false
    })
  },

  // 新增出栏记录
  addExit() {
    wx.navigateTo({
      url: '/pages/exit-form/exit-form'
    })
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
