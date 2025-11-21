/**
 * 懒加载组件
 * 使用 IntersectionObserver 实现视窗内容的懒加载
 */

/// <reference path="../../../typings/index.d.ts" />

Component({
  properties: {
    // 加载阈值（元素距离视窗多少像素时开始加载）
    threshold: {
      type: Number,
      value: 100
    },
    // 是否只加载一次
    once: {
      type: Boolean,
      value: true
    },
    // 自定义类名
    customClass: {
      type: String,
      value: ''
    },
    // 最小高度（用于占位）
    minHeight: {
      type: String,
      value: '200rpx'
    },
    // 是否显示加载动画
    showLoading: {
      type: Boolean,
      value: true
    }
  },

  data: {
    isInView: false,
    isLoaded: false,
    hasError: false,
    _observer: null as WechatMiniprogram.IntersectionObserver | null
  },

  lifetimes: {
    attached() {
      this.initObserver()
    },
    
    detached() {
      this.disconnectObserver()
    }
  },

  methods: {
    /**
     * 初始化 IntersectionObserver
     */
    initObserver() {
      if ((this.data as unknown)._observer) return
      
      // 创建观察器
      const observer = this.createIntersectionObserver({
        thresholds: [0],
        observeAll: false
      })
      
      // 设置相对于视窗，并添加底部边距以实现提前加载
      const margins = {
        top: 0,
        left: 0,
        right: 0,
        bottom: (this.data as unknown).threshold || 100  // 提前加载的像素数
      }
      
      observer.relativeToViewport(margins)
      
      // 保存观察器
      this.setData({
        _observer: observer
      })
      
      // 开始观察
      observer.observe('.lazy-load-container', (result: WechatMiniprogram.IntersectionObserverObserveCallbackResult) => {
        if (result.intersectionRatio > 0) {
          this.handleInView()
        }
      })
    },
    
    /**
     * 处理进入视窗
     */
    handleInView() {
      const data = this.data as unknown
      if (data.isLoaded && data.once) {
        return
      }
      
      this.setData({
        isInView: true,
        isLoaded: true
      })
      
      // 触发加载事件
      this.triggerEvent('load', {})
      
      // 如果只加载一次，断开观察
      if (data.once) {
        this.disconnectObserver()
      }
    },
    
    /**
     * 断开观察器
     */
    disconnectObserver() {
      const observer = (this.data as unknown)._observer
      if (observer) {
        observer.disconnect()
        this.setData({
          _observer: null
        })
      }
    },
    
    /**
     * 重试加载
     */
    retry() {
      this.setData({
        hasError: false,
        isInView: true
      })
      this.triggerEvent('load', {})
    },
    
    /**
     * 处理加载错误
     */
    handleError(error: unknown) {
      this.setData({
        hasError: true
      })
      this.triggerEvent('error', error)
    }
  },
  
  observers: {
    'threshold, once': function() {
      // 属性变化时重新初始化
      if (this.disconnectObserver) {
        this.disconnectObserver()
      }
      if (this.initObserver) {
        this.initObserver()
      }
    }
  }
})
