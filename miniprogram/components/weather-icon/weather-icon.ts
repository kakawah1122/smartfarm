// 临时空组件，用于解决编译错误
Component({
  properties: {
    weather: {
      type: String,
      value: '晴'
    }
  },
  
  data: {
    emoji: '☀️'
  },
  
  observers: {
    'weather': function(weather: string) {
      const emojiMap: Record<string, string> = {
        '晴': '☀️',
        '多云': '⛅',
        '阴': '☁️',
        '雨': '🌧️',
        '雪': '❄️',
        '雾': '🌫️'
      }
      this.setData({
        emoji: emojiMap[weather] || '☀️'
      })
    }
  }
})
