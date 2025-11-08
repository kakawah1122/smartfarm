Component({
  properties: {
    series: {
      type: Array,
      value: [] as Array<{ date: string; value: number }>
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
    axisLabels: [] as string[]
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
            console.warn('Canvas query failed, retrying...')
            setTimeout(() => {
              this.prepareCanvas(force)
            }, 100)
            return
          }

          const result = res[0]
          if (!result.node) {
            console.warn('Canvas node not found')
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

      const series = (this.properties.series || []).map((item: any) => ({
        date: item.date,
        value: typeof item.value === 'number' ? item.value : parseFloat(item.value)
      }))

      const hasData = series.length > 0
      this.setData({
        hasData,
        axisLabels: hasData ? series.map((item) => item.date) : []
      })

      const ctx = this.ctx as WechatMiniprogram.RenderingContext
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

      const areaColor = (this.properties.colorScheme as any)?.area || 'rgba(0, 82, 217, 0.12)'
      const lineColor = (this.properties.colorScheme as any)?.line || '#0052d9'

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
    }
  }
})

