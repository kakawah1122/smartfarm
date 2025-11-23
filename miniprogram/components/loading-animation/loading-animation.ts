// 加载动画组件
Component({
  properties: {
    // 是否显示
    visible: {
      type: Boolean,
      value: true
    },
    // 动画类型：wave | pulse | spin | dots | progress
    type: {
      type: String,
      value: 'wave'
    },
    // 加载文字
    text: {
      type: String,
      value: ''
    },
    // 进度（仅progress类型使用）
    progress: {
      type: Number,
      value: 0,
      observer: 'onProgressChange'
    },
    // 动画速度：slow | normal | fast
    speed: {
      type: String,
      value: 'normal'
    },
    // 动画颜色
    color: {
      type: String,
      value: '#0052d9'
    },
    // 动画大小：small | medium | large
    size: {
      type: String,
      value: 'medium'
    }
  },
  
  data: {
    animationClass: ''
  },
  
  lifetimes: {
    attached() {
      this.updateAnimationClass()
    }
  },
  
  methods: {
    // 更新动画类
    updateAnimationClass() {
      const { speed, size } = this.properties
      const animationClass = `speed-${speed} size-${size}`
      this.setData({ animationClass })
    },
    
    // 进度变化
    onProgressChange(newVal: number) {
      // 限制进度值在0-100之间
      const progress = Math.max(0, Math.min(100, newVal))
      if (progress !== newVal) {
        this.setData({ progress })
      }
    },
    
    // 显示加载动画
    show(text?: string) {
      this.setData({
        visible: true,
        text: text || this.data.text
      })
    },
    
    // 隐藏加载动画
    hide() {
      this.setData({ visible: false })
    },
    
    // 更新进度
    updateProgress(progress: number, text?: string) {
      this.setData({
        progress,
        text: text || this.data.text
      })
    }
  },
  
  observers: {
    'speed, size': function() {
      this.updateAnimationClass()
    }
  }
})
