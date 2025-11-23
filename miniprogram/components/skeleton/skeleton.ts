// 骨架屏组件
Component({
  properties: {
    // 是否显示骨架屏
    loading: {
      type: Boolean,
      value: true
    },
    // 骨架屏类型：card | list | stats | table | detail | custom
    type: {
      type: String,
      value: 'card'
    },
    // 行数
    rows: {
      type: Number,
      value: 3
    },
    // 列数（仅table类型使用）
    columns: {
      type: Number,
      value: 4
    },
    // 动画速度：slow | normal | fast
    animationSpeed: {
      type: String,
      value: 'normal'
    },
    // 是否启用动画
    animate: {
      type: Boolean,
      value: true
    },
    // 背景色
    backgroundColor: {
      type: String,
      value: '#f5f5f5'
    },
    // 高亮色
    highlightColor: {
      type: String,
      value: '#ffffff'
    }
  },

  data: {
    animationClass: ''
  },

  lifetimes: {
    attached() {
      this.setAnimationClass()
    }
  },

  methods: {
    // 设置动画类
    setAnimationClass() {
      const { animationSpeed, animate } = this.properties
      if (!animate) {
        this.setData({ animationClass: '' })
        return
      }

      const speedMap = {
        slow: 'skeleton-animate-slow',
        normal: 'skeleton-animate',
        fast: 'skeleton-animate-fast'
      }
      
      this.setData({
        animationClass: speedMap[animationSpeed] || 'skeleton-animate'
      })
    }
  },

  observers: {
    'animationSpeed, animate': function() {
      this.setAnimationClass()
    }
  }
})
