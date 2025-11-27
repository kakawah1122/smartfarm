// 类型定义
interface SeriesItem {
  date: string
  value: number | string
}

interface PriceRangeItem {
  date: string
  min: number | string
  max: number | string
  avg?: number
}

interface ColorScheme {
  line?: string
  area?: string
}

interface BoundingRect {
  left: number
  top: number
  width: number
  height?: number
}

Component({
  properties: {
    series: {
      type: Array,
      value: [] as Array<{ date: string; value: number }>
    },
    // 新增：价格区间数据（用于蜡烛图）
    priceRanges: {
      type: Array,
      value: [] as Array<{ date: string; min: number; max: number; avg: number }>
    },
    // 图表类型：'line' | 'candlestick' | 'dual-line'
    chartType: {
      type: String,
      value: 'line' // 默认线性图，保持向后兼容
    },
    colorScheme: {
      type: Object,
      value: {
        line: '#16a34a',
        area: 'rgba(22, 163, 74, 0.18)'
      }
    },
    height: {
      type: Number,
      value: 200
    }
  },

  data: {
    hasData: false,
    axisLabels: [] as string[],
    tooltip: {
      show: false,
      x: 0,
      y: 0,
      date: '',
      max: '',
      min: ''
    }
  },

  lifetimes: {
    ready() {
      this.prepareCanvas()
    }
  },

  observers: {
    series() {
      this.renderChart()
    },
    priceRanges() {
      this.renderChart()
    },
    chartType() {
      this.renderChart()
    },
    colorScheme() {
      this.renderChart()
    },
    height() {
      this.prepareCanvas(true)
    }
  },

  methods: {
    prepareCanvas(force = false) {
      if (this.canvasReady && !force) {
        this.updateCanvasSize()
        this.renderChart()
        return
      }

      const query = this.createSelectorQuery()
      query
        .select('#trendCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0]) {
            console.warn('[price-trend-chart] Canvas query failed, retrying...')
            setTimeout(() => {
              this.prepareCanvas(force)
            }, 100)
            return
          }

          const result = res[0]
          if (!result.node) {
            console.warn('[price-trend-chart] Canvas node not found')
            return
          }

          this.canvas = result.node as WechatMiniprogram.Canvas
          const windowInfo = wx.getWindowInfo()
          this.dpr = windowInfo.pixelRatio || 2
          this.canvasWidth = result.width || 300

          this.updateCanvasSize()

          this.ctx = this.canvas.getContext('2d')
          if (this.ctx) {
            this.canvasReady = true
            this.renderChart()
          }
        })
    },

    updateCanvasSize() {
      if (!this.canvas) return
      const dpr = this.dpr || 1
      const width = this.canvasWidth || 0
      const height = this.properties.height || 200

      this.canvas.width = width * dpr
      this.canvas.height = height * dpr
      
      if (this.canvas.style) {
        this.canvas.style.width = `${width}px`
        this.canvas.style.height = `${height}px`
      }
    },

    renderChart() {
      if (!this.canvasReady || !this.ctx) {
        return
      }

      // 判断使用哪种图表类型
      const chartType = this.properties.chartType
      if (chartType === 'dual-line') {
        this.renderDualLineChart()
      } else {
        this.renderLineChart()
      }
    },

    // 原有的折线图绘制逻辑
    renderLineChart() {
      const series = (this.properties.series || []).map((item: SeriesItem) => ({
        date: item.date,
        value: typeof item.value === 'number' ? item.value : parseFloat(String(item.value))
      }))

      const hasData = series.length > 0
      this.setData({
        hasData,
        axisLabels: hasData ? series.map((item) => item.date) : []
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctx = this.ctx as any
      const dpr = this.dpr || 1
      const width = this.canvasWidth || 0
      const height = this.properties.height || 200
      const padding = 32
      const chartWidth = Math.max(1, width - padding * 2)
      const chartHeight = Math.max(1, height - padding * 2)

      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
      ctx.restore()

      if (!hasData) {
        return
      }

      const values = series.map((item) => item.value)
      let maxValue = Math.max(...values)
      let minValue = Math.min(...values)

      if (maxValue === minValue) {
        maxValue += 0.5
        minValue -= 0.5
      }

      const range = maxValue - minValue || 1

      const resolveX = (index: number) => {
        if (series.length === 1) {
          return padding + chartWidth / 2
        }
        const ratio = index / (series.length - 1)
        return padding + chartWidth * ratio
      }

      const resolveY = (value: number) => {
        const normalized = (value - minValue) / range
        return padding + (chartHeight - normalized * chartHeight)
      }

      ctx.save()
      ctx.scale(dpr, dpr)

      // 绘制背景网格
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)'
      ctx.lineWidth = 1
      const gridLines = 4
      for (let i = 0; i <= gridLines; i++) {
        const y = padding + (chartHeight / gridLines) * i
        ctx.beginPath()
        ctx.moveTo(padding, y)
        ctx.lineTo(padding + chartWidth, y)
        ctx.stroke()
      }

      const colorScheme = this.properties.colorScheme as ColorScheme
      const areaColor = colorScheme?.area || 'rgba(0, 82, 217, 0.12)'
      const lineColor = colorScheme?.line || '#0052d9'

      // 绘制面积
      ctx.beginPath()
      ctx.moveTo(padding, padding + chartHeight)
      series.forEach((point, index) => {
        const x = resolveX(index)
        const y = resolveY(point.value)
        ctx.lineTo(x, y)
      })
      const lastX = resolveX(series.length - 1)
      ctx.lineTo(lastX, padding + chartHeight)
      ctx.closePath()
      ctx.fillStyle = areaColor
      ctx.fill()

      // 绘制折线
      ctx.beginPath()
      series.forEach((point, index) => {
        const x = resolveX(index)
        const y = resolveY(point.value)
        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
      ctx.strokeStyle = lineColor
      ctx.lineWidth = 3
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.stroke()

      // 绘制数据点
      ctx.fillStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.strokeStyle = lineColor
      series.forEach((point, index) => {
        const x = resolveX(index)
        const y = resolveY(point.value)
        ctx.beginPath()
        ctx.arc(x, y, 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      })

      ctx.restore()
    },

    // 双线图绘制逻辑（最高价和最低价）
    renderDualLineChart() {
      const ranges = (this.properties.priceRanges || []).map((item: PriceRangeItem) => ({
        date: item.date,
        min: typeof item.min === 'number' ? item.min : parseFloat(String(item.min)),
        max: typeof item.max === 'number' ? item.max : parseFloat(String(item.max))
      }))

      const hasData = ranges.length > 0
      this.setData({
        hasData,
        axisLabels: hasData ? ranges.map((item) => item.date) : []
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctx = this.ctx as any
      const dpr = this.dpr || 1
      const width = this.canvasWidth || 0
      const height = this.properties.height || 200
      const paddingLeft = 50  // 左侧留出更多空间给Y轴标签
      const paddingRight = 20
      const paddingTop = 20
      const paddingBottom = 35  // 底部留出空间给X轴标签
      const chartWidth = Math.max(1, width - paddingLeft - paddingRight)
      const chartHeight = Math.max(1, height - paddingTop - paddingBottom)

      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
      ctx.restore()

      if (!hasData) {
        return
      }

      // 计算价格范围
      const allValues = ranges.flatMap(r => [r.min, r.max])
      let maxValue = Math.max(...allValues)
      let minValue = Math.min(...allValues)

      const rawRange = maxValue - minValue
      const paddingValue = Math.max(rawRange * 0.15, 0.5)
      maxValue += paddingValue
      minValue = Math.max(0, minValue - paddingValue)

      let range = maxValue - minValue
      if (range <= 0) {
        maxValue = minValue + 1
        range = 1
      }

      const resolveX = (index: number) => {
        if (ranges.length === 1) {
          return paddingLeft + chartWidth / 2
        }
        return paddingLeft + (chartWidth / (ranges.length - 1)) * index
      }

      const resolveY = (value: number) => {
        const normalized = (value - minValue) / range
        return paddingTop + chartHeight - (normalized * chartHeight)
      }

      ctx.save()
      ctx.scale(dpr, dpr)

      // 绘制背景网格
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      const gridLines = 4
      for (let i = 0; i <= gridLines; i++) {
        const y = paddingTop + (chartHeight / gridLines) * i
        ctx.beginPath()
        ctx.moveTo(paddingLeft, y)
        ctx.lineTo(paddingLeft + chartWidth, y)
        ctx.stroke()
      }
      ctx.setLineDash([])

      // 绘制坐标轴
      ctx.strokeStyle = '#cbd5e1'
      ctx.lineWidth = 1.5
      
      // Y轴
      ctx.beginPath()
      ctx.moveTo(paddingLeft, paddingTop)
      ctx.lineTo(paddingLeft, paddingTop + chartHeight)
      ctx.stroke()
      
      // X轴
      ctx.beginPath()
      ctx.moveTo(paddingLeft, paddingTop + chartHeight)
      ctx.lineTo(paddingLeft + chartWidth, paddingTop + chartHeight)
      ctx.stroke()

      // 绘制Y轴价格标签
      ctx.fillStyle = '#64748b'
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      for (let i = 0; i <= gridLines; i++) {
        const value = maxValue - (range / gridLines) * i
        const y = paddingTop + (chartHeight / gridLines) * i
        const label = `¥${value.toFixed(value >= 100 ? 0 : 1)}`
        ctx.fillText(label, paddingLeft - 8, y)
      }

      // 绘制X轴日期标签
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ranges.forEach((item, index) => {
        const x = resolveX(index)
        // 只显示月-日部分
        const dateLabel = item.date.substring(5) // 从 "11-06" 格式中提取
        ctx.fillText(dateLabel, x, paddingTop + chartHeight + 6)
      })

      // 绘制最低价线（蓝色）
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 2.5
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.beginPath()
      ranges.forEach((item, index) => {
        const x = resolveX(index)
        const y = resolveY(item.min)
        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
      ctx.stroke()

      // 绘制最低价数据点
      ctx.fillStyle = '#3b82f6'
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ranges.forEach((item, index) => {
        const x = resolveX(index)
        const y = resolveY(item.min)
        ctx.beginPath()
        ctx.arc(x, y, 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      })

      // 绘制最高价线（红色）
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 2.5
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.beginPath()
      ranges.forEach((item, index) => {
        const x = resolveX(index)
        const y = resolveY(item.max)
        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
      ctx.stroke()

      // 绘制最高价数据点
      ctx.fillStyle = '#ef4444'
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ranges.forEach((item, index) => {
        const x = resolveX(index)
        const y = resolveY(item.max)
        ctx.beginPath()
        ctx.arc(x, y, 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      })

      ctx.restore()
    },

    // 触摸事件处理
    onTouchStart(e: WechatMiniprogram.TouchEvent) {
      this.handleTouch(e)
    },

    onTouchMove(e: WechatMiniprogram.TouchEvent) {
      this.handleTouch(e)
    },

    onTouchEnd() {
      // 延迟隐藏提示框，让用户能看到信息
      setTimeout(() => {
        this.setData({
          'tooltip.show': false
        })
      }, 1500)
    },

    handleTouch(e: WechatMiniprogram.TouchEvent) {
      const chartType = this.properties.chartType
      
      // 只在双线图模式下处理触摸
      if (chartType !== 'dual-line') {
        return
      }

      const ranges = this.properties.priceRanges || []
      if (ranges.length === 0) {
        return
      }

      const touch = e.touches[0]
      const query = this.createSelectorQuery()
      
      query.select('#trendCanvas')
        .boundingClientRect((rect: BoundingRect | null) => {
          if (!rect) return

          // 计算触摸点相对于 canvas 的 X 位置
          const touchX = touch.clientX - rect.left

          // 使用与绘图相同的布局参数
          const width = rect.width
          const paddingLeft = 50
          const paddingRight = 20
          const chartWidth = Math.max(1, width - paddingLeft - paddingRight)

          // 计算每个数据点的 X 坐标
          const resolveX = (index: number) => {
            if (ranges.length === 1) {
              return paddingLeft + chartWidth / 2
            }
            return paddingLeft + (chartWidth / (ranges.length - 1)) * index
          }

          // 找到最近的数据点
          let nearestIndex = -1
          let minDistance = Infinity
          const touchThreshold = 40 // 触摸有效范围（像素），增大范围更容易触发

          ranges.forEach((_item: { date: string; min: number; max: number }, index: number) => {
            const x = resolveX(index)
            const distance = Math.abs(touchX - x)
            
            if (distance < minDistance && distance < touchThreshold) {
              minDistance = distance
              nearestIndex = index
            }
          })

          // 如果找到了最近的点，显示提示框
          if (nearestIndex !== -1) {
            const dataPoint = ranges[nearestIndex]

            this.setData({
              tooltip: {
                show: true,
                x: 0, // 不再使用，CSS 固定定位
                y: 0, // 不再使用，CSS 固定定位
                date: dataPoint.date,
                max: dataPoint.max.toFixed(2),
                min: dataPoint.min.toFixed(2)
              }
            })
          }
        })
        .exec()
    }
  }
})

