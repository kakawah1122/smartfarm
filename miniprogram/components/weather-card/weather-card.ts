// weather-card.ts - 天气卡片组件
Component({
  options: {
    styleIsolation: 'apply-shared' // 允许外部样式应用，但组件样式优先
  },

  properties: {
    // 天气数据
    weather: {
      type: Object,
      value: {
        temperature: 22,
        humidity: 65,
        condition: '晴',
        emoji: '☀️',
        feelsLike: 22,
        windDirection: '无风',
        windScale: '0级',
        updateTime: '刚刚更新'
      }
    },
    // 位置信息
    location: {
      type: Object,
      value: {
        city: '',
        district: ''
      }
    },
    // 加载状态
    loading: {
      type: Boolean,
      value: false
    },
    // 错误状态
    hasError: {
      type: Boolean,
      value: false
    },
    // 是否可点击
    clickable: {
      type: Boolean,
      value: true
    },
    // 是否展示更新时间
    showUpdateTime: {
      type: Boolean,
      value: false
    },
    // 自定义类名
    className: {
      type: String,
      value: ''
    }
  },

  data: {
    // 初始化时使用默认"晴"天气的背景，避免首次渲染时的颜色闪烁
    weatherBackground: 'background: linear-gradient(135deg, rgba(15, 23, 42, 0.88) 0%, rgba(59, 130, 246, 0.68) 100%);',
    weatherEffect: '' // 天气动画效果类型
  },

  observers: {
    'weather.condition': function(condition: string) {
      if (condition) {
        this.setData({
          weatherBackground: this.getWeatherBackground(condition),
          weatherEffect: this.getWeatherEffect(condition)
        })
      }
    }
  },

  lifetimes: {
    attached() {
      // 组件初始化时立即设置背景和动画效果，避免闪烁
      const condition = (this.data.weather as any).condition || '晴'
      this.setData({
        weatherBackground: this.getWeatherBackground(condition),
        weatherEffect: this.getWeatherEffect(condition)
      })
    }
  },

  methods: {
    // 卡片点击事件
    onCardTap() {
      if (this.data.clickable) {
        this.triggerEvent('cardtap')
      }
    },

    // 刷新事件
    onRefresh() {
      // 阻止冒泡，避免触发卡片点击
      this.triggerEvent('refresh')
    },

    // 根据天气状况获取背景样式
    getWeatherBackground(condition: string): string {
      const backgroundMap: Record<string, string> = {
        '晴': 'background: linear-gradient(135deg, rgba(15, 23, 42, 0.88) 0%, rgba(59, 130, 246, 0.68) 100%);',
        '多云': 'background: linear-gradient(135deg, rgba(30, 41, 59, 0.88) 0%, rgba(100, 116, 139, 0.7) 100%);',
        '阴': 'background: linear-gradient(135deg, rgba(17, 24, 39, 0.9) 0%, rgba(55, 65, 81, 0.72) 100%);',
        '小雨': 'background: linear-gradient(135deg, rgba(15, 23, 42, 0.88) 0%, rgba(21, 94, 117, 0.68) 100%);',
        '中雨': 'background: linear-gradient(135deg, rgba(8, 47, 73, 0.88) 0%, rgba(15, 23, 42, 0.82) 100%);',
        '大雨': 'background: linear-gradient(135deg, rgba(11, 17, 32, 0.9) 0%, rgba(30, 41, 59, 0.78) 100%);',
        '雷阵雨': 'background: linear-gradient(135deg, rgba(17, 24, 39, 0.9) 0%, rgba(49, 46, 129, 0.72) 100%);',
        '雨': 'background: linear-gradient(135deg, rgba(14, 116, 144, 0.7) 0%, rgba(30, 41, 59, 0.8) 100%);',
        '雪': 'background: linear-gradient(135deg, rgba(30, 58, 138, 0.78) 0%, rgba(49, 46, 129, 0.72) 100%);',
        '小雪': 'background: linear-gradient(135deg, rgba(30, 64, 175, 0.76) 0%, rgba(67, 56, 202, 0.66) 100%);',
        '中雪': 'background: linear-gradient(135deg, rgba(29, 78, 216, 0.78) 0%, rgba(49, 46, 129, 0.7) 100%);',
        '大雪': 'background: linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(71, 85, 105, 0.72) 100%);',
        '雾': 'background: linear-gradient(135deg, rgba(31, 41, 55, 0.86) 0%, rgba(51, 65, 85, 0.66) 100%);',
        '霾': 'background: linear-gradient(135deg, rgba(31, 41, 55, 0.88) 0%, rgba(75, 85, 99, 0.68) 100%);',
        '沙尘暴': 'background: linear-gradient(135deg, rgba(120, 53, 15, 0.82) 0%, rgba(31, 41, 55, 0.7) 100%);',
        '浮尘': 'background: linear-gradient(135deg, rgba(67, 56, 202, 0.75) 0%, rgba(31, 41, 55, 0.7) 100%);',
        '扬沙': 'background: linear-gradient(135deg, rgba(146, 64, 14, 0.82) 0%, rgba(31, 41, 55, 0.72) 100%);'
      }

      return backgroundMap[condition] || 'background: linear-gradient(135deg, rgba(15, 23, 42, 0.88) 0%, rgba(59, 130, 246, 0.68) 100%);'
    },

    // 根据天气状况获取动画效果
    getWeatherEffect(condition: string): string {
      const effectMap: Record<string, string> = {
        '晴': '',
        '多云': 'cloudy',
        '阴': 'cloudy',
        '小雨': 'rain',
        '中雨': 'rain',
        '大雨': 'rain',
        '雨': 'rain',
        '雷阵雨': 'thunder',
        '雪': 'snow',
        '小雪': 'snow',
        '中雪': 'snow',
        '大雪': 'snow',
        '雾': 'fog',
        '霾': 'fog',
        '沙尘暴': 'fog',
        '浮尘': 'fog',
        '扬沙': 'fog'
      }
      
      return effectMap[condition] || ''
    }
  }
})

