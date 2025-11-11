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

    // 无缓存数据时显示空状态
    this.setData({
      priceUpdateTime: '--:--',
      priceBreeds: [],
      priceData: {}
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

})

