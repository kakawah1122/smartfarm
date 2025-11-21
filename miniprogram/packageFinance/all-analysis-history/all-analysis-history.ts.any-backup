// 全部分析历史页面
Page({
  data: {
    // 历史记录列表
    analysisHistory: [] as any[],
    
    // 加载状态
    loading: false,
    loadingMore: false,
    
    // 分页
    currentPage: 1,
    pageSize: 20,
    hasMore: true,
    
    // 弹窗
    showDetailPopup: false,
    selectedAnalysisItem: null as any,
    
    // 空状态
    isEmpty: false
  },

  onLoad() {
    this.loadAnalysisHistory()
  },
  
  // 加载分析历史
  async loadAnalysisHistory(append: boolean = false) {
    if (this.data.loading || this.data.loadingMore) return
    
    this.setData({
      [append ? 'loadingMore' : 'loading']: true
    })
    
    try {
      const db = wx.cloud.database()
      
      // 分页查询
      const skip = append ? this.data.analysisHistory.length : 0
      const result = await db.collection('finance_analysis_history')
        .where({
          _openid: '{openid}'
        })
        .orderBy('createTime', 'desc')
        .skip(skip)
        .limit(this.data.pageSize)
        .get()
      
      const records = (result.data || []).map((item: any) => ({
        ...item,
        formattedDate: new Date(item.createTime).toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }),
        summary: this.extractSummary(item.analysisResult)
      }))
      
      const newList = append ? [...this.data.analysisHistory, ...records] : records
      const hasMore = records.length >= this.data.pageSize
      
      this.setData({
        analysisHistory: newList,
        hasMore,
        isEmpty: newList.length === 0
      })
      
    } catch (error) {
      console.error('加载分析历史失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
      
      if (!append) {
        this.setData({ isEmpty: true })
      }
    } finally {
      this.setData({
        loading: false,
        loadingMore: false
      })
    }
  },
  
  // 提取分析摘要
  extractSummary(result: any): string {
    if (!result) return '暂无摘要'
    
    if (result.format === 'text') {
      return (result.rawText || '').substring(0, 50) + '...'
    }
    
    // JSON格式，提取关键信息
    const summaries = []
    
    if (result.profitability?.summary) {
      summaries.push(result.profitability.summary)
    }
    
    if (result.costStructure?.summary) {
      summaries.push(result.costStructure.summary)
    }
    
    if (result.suggestions?.summary) {
      summaries.push(result.suggestions.summary)
    }
    
    return summaries.length > 0 
      ? summaries.join('；').substring(0, 80) + '...'
      : '分析完成'
  },
  
  // 点击历史记录项
  onClickHistoryItem(e: any) {
    const item = e.currentTarget.dataset.item
    this.setData({
      selectedAnalysisItem: item,
      showDetailPopup: true
    })
  },
  
  // 关闭详情弹窗
  closeDetailPopup() {
    this.setData({
      showDetailPopup: false
    })
    // 延迟清空数据，避免动画时闪烁
    setTimeout(() => {
      this.setData({
        selectedAnalysisItem: null
      })
    }, 300)
  },
  
  // 下拉刷新
  async onPullDownRefresh() {
    this.setData({
      currentPage: 1,
      analysisHistory: []
    })
    await this.loadAnalysisHistory()
    wx.stopPullDownRefresh()
  },
  
  // 上拉加载更多
  async onReachBottom() {
    if (!this.data.hasMore || this.data.loadingMore) {
      return
    }
    
    await this.loadAnalysisHistory(true)
    
    if (!this.data.hasMore) {
      wx.showToast({
        title: '已加载全部记录',
        icon: 'none',
        duration: 1500
      })
    }
  }
})
