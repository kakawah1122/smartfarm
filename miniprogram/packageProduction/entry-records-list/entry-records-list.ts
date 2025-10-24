// pages/entry-records-list/entry-records-list.ts
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
    
    // 搜索条件
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
        name: 'production-entry',
        data: queryData
      })

      if (result.result && result.result.success) {
        const records = result.result.data.records || []
        const pagination = result.result.data.pagination || {}

        // 获取当前用户信息
        const app = getApp()
        const currentUser = app.globalData?.userInfo?.nickname || app.globalData?.userInfo?.nickName || '系统用户'
        
        // 转换数据格式
        const formattedRecords = records.map(record => ({
          id: record._id || record.batchNumber,
          batchNumber: record.batchNumber || record._id,
          breed: record.breed || '未知品种',
          supplier: record.supplier || '未知供应商',
          quantity: record.quantity || 0,
          unit: record.unit || '羽',
          avgWeight: record.avgWeight || 0,
          operator: (!record.operator || record.operator === '未知') ? currentUser : record.operator,
          status: record.status || '已完成',
          notes: record.notes || '',
          date: record.entryDate || (record.createTime ? record.createTime.split('T')[0] : '未知日期'),
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
    let content = `品种：${record.breed}\n批次号：${record.batchNumber}\n数量：${record.displayQuantity}`
    
    if (record.supplier) {
      content += `\n供应商：${record.supplier}`
    }
    
    if (record.avgWeight > 0) {
      content += `\n平均重量：${record.avgWeight}斤`
    }
    
    content += `\n健康状况：${record.healthStatus}\n操作员：${record.operator}\n时间：${record.date}\n状态：${record.status}`
    
    if (record.notes) {
      content += `\n备注：${record.notes}`
    }
    
    this.setData({
      selectedRecord: record,
      showDetailPopup: true
    })
  },
  
  // 关闭详情弹窗
  closeDetailPopup() {
    this.setData({
      showDetailPopup: false,
      selectedRecord: null
    })
  },
  
  // 弹窗可见性变化
  onDetailPopupChange(e: any) {
    const { visible } = e.detail
    if (!visible) {
      this.setData({
        showDetailPopup: false,
        selectedRecord: null
      })
    }
  },

  // 新增入栏记录
  addEntry() {
    wx.navigateTo({
      url: '/packageProduction/entry-form/entry-form'
    })
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
