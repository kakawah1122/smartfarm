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
    // 自定义类名
    className: {
      type: String,
      value: ''
    }
  },

  data: {
    // 初始化时使用默认"晴"天气的背景，避免首次渲染时的颜色闪烁
    weatherBackground: 'background: linear-gradient(135deg, #FFA751 10%, #FFE259 100%);',
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
    onRefresh(e: any) {
      // 阻止冒泡，避免触发卡片点击
      this.triggerEvent('refresh')
    },

    // 根据天气状况获取背景样式
    getWeatherBackground(condition: string): string {
      const backgroundMap: Record<string, string> = {
        '晴': 'background: linear-gradient(135deg, #FFA751 10%, #FFE259 100%);',
        '多云': 'background: linear-gradient(135deg, #A8EDEA 0%, #FED6E3 100%);',
        '阴': 'background: linear-gradient(135deg, #D7D2CC 0%, #8E9EAB 100%);',
        '小雨': 'background: linear-gradient(135deg, #89F7FE 0%, #66A6FF 100%);',
        '中雨': 'background: linear-gradient(135deg, #4DA0B0 0%, #0F2027 100%);',
        '大雨': 'background: linear-gradient(135deg, #485563 0%, #29323C 100%);',
        '雷阵雨': 'background: linear-gradient(135deg, #373B44 0%, #4286F4 100%);',
        '雨': 'background: linear-gradient(135deg, #7F7FD5 0%, #86A8E7 50%, #91EAE4 100%);',
        '雪': 'background: linear-gradient(135deg, #E0EAFC 0%, #CFDEF3 100%);',
        '小雪': 'background: linear-gradient(135deg, #FFFFFF 0%, #ECE9E6 100%);',
        '中雪': 'background: linear-gradient(135deg, #E0EAFC 0%, #CFDEF3 100%);',
        '大雪': 'background: linear-gradient(135deg, #C9D6FF 0%, #E2E2E2 100%);',
        '雾': 'background: linear-gradient(135deg, #EFEFBB 0%, #D4D3DD 100%);',
        '霾': 'background: linear-gradient(135deg, #948E99 0%, #C2BEB3 100%);',
        '沙尘暴': 'background: linear-gradient(135deg, #C79081 0%, #DFA579 100%);',
        '浮尘': 'background: linear-gradient(135deg, #E0C9A6 0%, #B3946F 100%);',
        '扬沙': 'background: linear-gradient(135deg, #DECBA4 0%, #3E5151 100%);'
      }
      
      return backgroundMap[condition] || 'background: linear-gradient(135deg, #A8EDEA 0%, #FED6E3 100%);'
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

