/**
 * 虚拟列表组件
 * 用于优化长列表渲染性能
 * 只渲染可视区域内的元素，大幅减少DOM节点
 */

Component({
  properties: {
    // 列表数据
    list: {
      type: Array,
      value: []
    },
    // 每项高度（固定高度）
    itemHeight: {
      type: Number,
      value: 100
    },
    // 容器高度
    height: {
      type: Number,
      value: 600
    },
    // 缓冲区大小（上下各渲染几个额外项）
    bufferSize: {
      type: Number,
      value: 5
    },
    // 是否开启下拉刷新
    enablePullRefresh: {
      type: Boolean,
      value: false
    },
    // 是否开启上拉加载
    enableLoadMore: {
      type: Boolean,
      value: false
    }
  },

  data: {
    // 滚动位置
    scrollTop: 0,
    // 可视区域开始索引
    startIndex: 0,
    // 可视区域结束索引
    endIndex: 0,
    // 渲染列表
    visibleList: [] as any[],
    // 占位高度
    topHeight: 0,
    bottomHeight: 0,
    // 加载状态
    isRefreshing: false,
    isLoadingMore: false
  },

  observers: {
    'list, height, itemHeight': function() {
      this.updateVisibleList()
    }
  },

  lifetimes: {
    attached() {
      this.updateVisibleList()
    }
  },

  methods: {
    /**
     * 更新可视列表
     */
    updateVisibleList() {
      const { list, itemHeight, height, bufferSize, scrollTop } = this.data
      
      if (!list || !list.length) {
        this.setData({
          visibleList: [],
          topHeight: 0,
          bottomHeight: 0
        })
        return
      }

      // 计算可视区域能显示的项数
      const visibleCount = Math.ceil(height / itemHeight)
      
      // 计算开始索引
      let startIndex = Math.floor(scrollTop / itemHeight) - bufferSize
      startIndex = Math.max(0, startIndex)
      
      // 计算结束索引
      let endIndex = startIndex + visibleCount + bufferSize * 2
      endIndex = Math.min(list.length - 1, endIndex)
      
      // 获取可视数据
      const visibleList = list.slice(startIndex, endIndex + 1).map((item, index) => ({
        ...item,
        _virtualIndex: startIndex + index
      }))
      
      // 计算占位高度
      const topHeight = startIndex * itemHeight
      const bottomHeight = (list.length - endIndex - 1) * itemHeight
      
      this.setData({
        startIndex,
        endIndex,
        visibleList,
        topHeight,
        bottomHeight
      })
    },

    /**
     * 处理滚动事件
     */
    onScroll(e: WechatMiniprogram.ScrollViewScroll) {
      const { scrollTop } = e.detail
      const self = this as any
      
      // 节流处理
      if (self._scrollTimer) {
        clearTimeout(self._scrollTimer)
      }
      
      self._scrollTimer = setTimeout(() => {
        this.setData({ scrollTop }, () => {
          this.updateVisibleList()
        })
      }, 16) // 约60fps
      
      // 触发滚动事件
      this.triggerEvent('scroll', e.detail)
    },

    /**
     * 处理下拉刷新
     */
    onPullRefresh() {
      if (this.data.isRefreshing || !this.properties.enablePullRefresh) {
        return
      }
      
      this.setData({ isRefreshing: true })
      
      this.triggerEvent('refresh', {}, {
        bubbles: true,
        composed: true
      })
      
      // 超时自动停止
      setTimeout(() => {
        this.stopRefresh()
      }, 10000)
    },

    /**
     * 停止刷新
     */
    stopRefresh() {
      this.setData({ isRefreshing: false })
    },

    /**
     * 处理上拉加载
     */
    onScrollToLower() {
      if (this.data.isLoadingMore || !this.properties.enableLoadMore) {
        return
      }
      
      this.setData({ isLoadingMore: true })
      
      this.triggerEvent('loadmore', {}, {
        bubbles: true,
        composed: true
      })
      
      // 超时自动停止
      setTimeout(() => {
        this.stopLoadMore()
      }, 10000)
    },

    /**
     * 停止加载更多
     */
    stopLoadMore() {
      this.setData({ isLoadingMore: false })
    },

    /**
     * 处理列表项点击
     */
    onItemTap(e: WechatMiniprogram.TouchEvent) {
      const { index, item } = e.currentTarget.dataset
      this.triggerEvent('itemtap', { index, item })
    },

    /**
     * 滚动到指定索引
     */
    scrollToIndex(index: number) {
      const scrollTop = index * this.properties.itemHeight
      this.setData({ scrollTop })
    }
  }
})
