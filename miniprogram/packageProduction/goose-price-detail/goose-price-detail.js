Page({
  data: {
    priceUpdateTime: '--:--',
    priceBreeds: [],
    priceData: {},
    currentBreed: 'extraLarge',
    currentBreedLabel: '特大种',
    activeTab: 'adult',
    currentPriceDisplay: {
      price: '--',
      trend: 0,
      change: '+0.0'
    },
    currentHistory: [],
    currentUnit: '/斤',
    chartScheme: {
      line: '#16a34a',
      area: 'rgba(22, 163, 74, 0.18)'
    },
    chartPresets: {
      adult: {
        line: '#16a34a',
        area: 'rgba(22, 163, 74, 0.18)'
      },
      gosling: {
        line: '#0052d9',
        area: 'rgba(0, 82, 217, 0.16)'
      }
    }
  },

  onLoad(options) {
    const defaultBreed = (options && options.breed) ? options.breed : 'extraLarge'
    const defaultTab = (options && options.tab) ? options.tab : 'adult'
    this.initializePriceDetail(defaultBreed, defaultTab)
  },

  initializePriceDetail(defaultBreed, defaultTab) {
    const snapshot = this.getCachedPriceSnapshot()

    if (snapshot) {
      this.setData({
        priceUpdateTime: snapshot.updateTime || '--:--',
        priceBreeds: snapshot.breeds || [],
        priceData: snapshot.data || {}
      }, () => {
        const hasBreed = snapshot.data && snapshot.data[defaultBreed]
        const fallbackBreed = snapshot.breeds && snapshot.breeds.length > 0 ? snapshot.breeds[0].key : 'extraLarge'
        const targetBreed = hasBreed ? defaultBreed : fallbackBreed
        this.updateCurrentDisplay(targetBreed, defaultTab)
      })
      return
    }

    const mock = this.createMockPriceDataset()
    this.setData({
      priceUpdateTime: '--:--',
      priceBreeds: mock.breeds,
      priceData: mock.data
    }, () => {
      const targetBreed = defaultBreed || 'extraLarge'
      this.updateCurrentDisplay(targetBreed, defaultTab)
    })
  },

  getCachedPriceSnapshot() {
    try {
      const snapshot = wx.getStorageSync('goose_price_snapshot')
      if (snapshot && snapshot.data) {
        return snapshot
      }
      return null
    } catch (error) {
      return null
    }
  },

  onBreedChange(event) {
    const breedKey = event.currentTarget.dataset.key
    if (!breedKey || breedKey === this.data.currentBreed) {
      return
    }
    this.updateCurrentDisplay(breedKey, this.data.activeTab)
  },

  onBreedCardTap(event) {
    const breedKey = event.currentTarget.dataset.key
    if (!breedKey) {
      return
    }
    this.updateCurrentDisplay(breedKey, this.data.activeTab)
  },

  onTabChange(event) {
    const tabValue = (event && event.detail && event.detail.value) ? event.detail.value : 'adult'
    this.updateCurrentDisplay(this.data.currentBreed, tabValue)
  },

  updateCurrentDisplay(breedKey, tabKey) {
    const priceData = this.data.priceData || {}
    const breedData = priceData[breedKey]
    if (!breedData) {
      return
    }

    const historyStore = breedData.history || {}
    const tabData = breedData[tabKey] || {}
    const history = historyStore[tabKey] || []
    const scheme = (this.data.chartPresets && this.data.chartPresets[tabKey]) || this.data.chartScheme
    const unit = tabKey === 'adult' ? '/斤' : '/羽'

    this.setData({
      currentBreed: breedKey,
      currentBreedLabel: breedData.label || '特大种',
      activeTab: tabKey,
      currentPriceDisplay: {
        price: tabData.price || '--',
        trend: typeof tabData.trend === 'number' ? tabData.trend : 0,
        change: tabData.change || '+0.0'
      },
      currentHistory: history,
      currentUnit: unit,
      chartScheme: scheme
    })
  },

  createMockPriceDataset() {
    const breedConfigs = [
      { key: 'normal', label: '普通种', baseAdult: 12.0, baseGosling: 5.6 },
      { key: 'large', label: '大种', baseAdult: 13.2, baseGosling: 5.9 },
      { key: 'extraLarge', label: '特大种', baseAdult: 14.1, baseGosling: 6.2 },
      { key: 'baisha', label: '白沙鹅', baseAdult: 13.5, baseGosling: 6.0 }
    ]

    const data = {}

    breedConfigs.forEach((config) => {
      const adultHistory = this.generatePriceHistory(config.baseAdult, 7, 0.8)
      const goslingHistory = this.generatePriceHistory(config.baseGosling, 7, 0.5)
      const adultTrendInfo = this.calculateTrend(adultHistory)
      const goslingTrendInfo = this.calculateTrend(goslingHistory)

      const latestAdult = adultHistory.length > 0 ? adultHistory[adultHistory.length - 1].value : config.baseAdult
      const latestGosling = goslingHistory.length > 0 ? goslingHistory[goslingHistory.length - 1].value : config.baseGosling

      data[config.key] = {
        label: config.label,
        adult: {
          price: latestAdult.toFixed(1),
          trend: adultTrendInfo.trend,
          change: adultTrendInfo.change
        },
        gosling: {
          price: latestGosling.toFixed(1),
          trend: goslingTrendInfo.trend,
          change: goslingTrendInfo.change
        },
        history: {
          adult: adultHistory,
          gosling: goslingHistory
        }
      }
    })

    return {
      breeds: breedConfigs.map((item) => ({ key: item.key, label: item.label })),
      data
    }
  },

  generatePriceHistory(base, days, volatility) {
    const history = []
    const today = new Date()
    let previousValue = base

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(today.getDate() - i)

      const fluctuation = (Math.random() * volatility * 2) - volatility
      const nextValue = Math.max(0, parseFloat((previousValue + fluctuation).toFixed(1)))
      previousValue = nextValue

      history.push({
        date: `${date.getMonth() + 1}-${String(date.getDate()).padStart(2, '0')}`,
        value: nextValue
      })
    }

    return history
  },

  calculateTrend(history) {
    if (!history || history.length < 2) {
      return { trend: 0, change: '+0.0' }
    }
    const last = history[history.length - 1].value
    const previous = history[history.length - 2].value
    const diff = parseFloat((last - previous).toFixed(1))

    let trend = 0
    if (diff > 0) {
      trend = 1
    } else if (diff < 0) {
      trend = -1
    }
    const sign = diff > 0 ? '+' : diff < 0 ? '-' : '+'
    const change = `${sign}${Math.abs(diff).toFixed(1)}`
    return { trend, change }
  }
})

