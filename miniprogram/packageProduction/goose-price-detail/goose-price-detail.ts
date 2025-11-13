import { logger } from '../../utils/logger'
/**
 * 鹅价详情页
 * 
 * v2.0 更新：
 * - 成鹅价格：显示120日龄、130日龄（meatBreeds）
 * - 鹅苗价格：显示中种鹅、大种鹅、特大种鹅（goslingBreeds）
 * - 趋势图：从数据库加载真实历史数据（最近30天）
 */
Page({
  data: {
    priceUpdateTime: '--:--',
    
    // 成鹅品种（日龄）
    meatBreeds: [] as Array<{ key: string; label: string }>,
    meatData: {} as Record<string, any>,
    
    // 鹅苗品种
    goslingBreeds: [] as Array<{ key: string; label: string }>,
    goslingData: {} as Record<string, any>,
    
    currentBreed: 'meat130',
    currentBreedLabel: '130日龄',
    activeTab: 'adult',
    
    currentPriceDisplay: {
      range: '--',
      min: 0,
      max: 0,
      trend: 0,
      change: '+0.0'
    },
    currentHistory: [] as Array<{ date: string; min: number; max: number; avg: number }>,
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

  onLoad(options: Record<string, any>) {
    const defaultTab = options?.tab || 'adult'
    const defaultBreed = defaultTab === 'adult' ? 'meat130' : 'extraLarge'
    this.loadPriceDataFromDB(defaultBreed, defaultTab)
  },

  // 从数据库加载鹅价数据
  async loadPriceDataFromDB(defaultBreed: string, defaultTab: string) {
    try {
      const db = wx.cloud.database()
      
      // 查询最近30天的历史数据
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const dateStr = thirtyDaysAgo.toISOString().split('T')[0]
      
      const result = await db.collection('goose_prices')
        .where({
          date: db.command.gte(dateStr)
        })
        .orderBy('date', 'asc')  // 升序，方便计算趋势
        .limit(30)
        .get()

      if (result.data && result.data.length > 0) {
        this.processHistoricalData(result.data, defaultBreed, defaultTab)
      } else {
        // 没有数据，显示空状态
        this.setEmptyState()
      }
    } catch (error) {
      logger.error('加载鹅价数据失败:', error)
      this.setEmptyState()
    }
  },

  // 处理历史数据
  processHistoricalData(records: any[], defaultBreed: string, defaultTab: string) {
    // 1. 构建肉鹅数据（成鹅价格）
    const meatBreedsMap: Record<string, any> = {}
    const meatKeys = ['meat120', 'meat130']
    const meatLabels: Record<string, string> = {
      'meat120': '120日龄',
      'meat130': '130日龄'
    }

    meatKeys.forEach(key => {
      const history: Array<{ date: string; min: number; max: number; avg: number }> = []
      
      records.forEach(record => {
        const breed = record.meatBreeds?.find((b: any) => b.key === key)
        if (breed && breed.range) {
          // 保存完整的价格区间数据
          history.push({
            date: this.formatDate(record.date),
            min: breed.min || 0,
            max: breed.max || 0,
            avg: (breed.min + breed.max) / 2
          })
        }
      })

      if (history.length > 0) {
        // 只保留最近7天数据
        const recentHistory = history.slice(-7)
        
        const latestRecord = records[records.length - 1]
        const latestBreed = latestRecord.meatBreeds?.find((b: any) => b.key === key)
        // 计算趋势（基于均价）
        const avgHistory = recentHistory.map(h => ({ date: h.date, value: h.avg }))
        const trendInfo = this.calculateTrendFromHistory(avgHistory)
        
        // 格式化价格显示：如果最低价和最高价一致，只显示一个数字
        const formatPriceRange = (min: number, max: number, range: string) => {
          if (min === max && min > 0) {
            return min.toString()
          }
          if (range && range !== '--') {
            return range
          }
          if (min > 0 && max > 0) {
            return `${min}-${max}`
          }
          return '--'
        }
        
        meatBreedsMap[key] = {
          label: meatLabels[key],
          range: formatPriceRange(latestBreed?.min || 0, latestBreed?.max || 0, latestBreed?.range || '--'),
          min: latestBreed?.min || 0,
          max: latestBreed?.max || 0,
          trend: trendInfo.trend,
          change: trendInfo.change,
          history: recentHistory, // 只保留最近7天的完整价格区间历史数据
          avgHistory // 均价历史数据（用于趋势计算）
        }
      }
    })

    // 2. 构建鹅苗数据
    const goslingBreedsMap: Record<string, any> = {}
    const goslingKeys = ['middle', 'large', 'extraLarge']
    const goslingLabels: Record<string, string> = {
      'middle': '中种鹅',
      'large': '大种鹅',
      'extraLarge': '特大种鹅'
    }

    goslingKeys.forEach(key => {
      const history: Array<{ date: string; min: number; max: number; avg: number }> = []
      
      records.forEach(record => {
        const breed = record.goslingBreeds?.find((b: any) => b.key === key)
        if (breed && breed.range) {
          // 保存完整的价格区间数据
          history.push({
            date: this.formatDate(record.date),
            min: breed.min || 0,
            max: breed.max || 0,
            avg: (breed.min + breed.max) / 2
          })
        }
      })

      if (history.length > 0) {
        // 只保留最近7天数据
        const recentHistory = history.slice(-7)
        
        const latestRecord = records[records.length - 1]
        const latestBreed = latestRecord.goslingBreeds?.find((b: any) => b.key === key)
        // 计算趋势（基于均价）
        const avgHistory = recentHistory.map(h => ({ date: h.date, value: h.avg }))
        const trendInfo = this.calculateTrendFromHistory(avgHistory)
        
        // 格式化价格显示：如果最低价和最高价一致，只显示一个数字
        const formatPriceRange = (min: number, max: number, range: string) => {
          if (min === max && min > 0) {
            return min.toString()
          }
          if (range && range !== '--') {
            return range
          }
          if (min > 0 && max > 0) {
            return `${min}-${max}`
          }
          return '--'
        }
        
        goslingBreedsMap[key] = {
          label: goslingLabels[key],
          range: formatPriceRange(latestBreed?.min || 0, latestBreed?.max || 0, latestBreed?.range || '--'),
          min: latestBreed?.min || 0,
          max: latestBreed?.max || 0,
          trend: trendInfo.trend,
          change: trendInfo.change,
          history: recentHistory, // 只保留最近7天的完整价格区间历史数据
          avgHistory // 均价历史数据（用于趋势计算）
        }
      }
    })

    // 3. 构建品种列表
    const meatBreeds = meatKeys
      .filter(key => meatBreedsMap[key])
      .map(key => ({ key, label: meatLabels[key] }))
    
    const goslingBreeds = goslingKeys
      .filter(key => goslingBreedsMap[key])
      .map(key => ({ key, label: goslingLabels[key] }))

    // 4. 获取最新更新时间
    const latestRecord = records[records.length - 1]
    const updateTime = latestRecord ? this.formatDate(latestRecord.date) : '--:--'

    // 5. 更新页面数据
    this.setData({
      meatBreeds,
      meatData: meatBreedsMap,
      goslingBreeds,
      goslingData: goslingBreedsMap,
      priceUpdateTime: updateTime
    }, () => {
      // 默认选择第一个可用品种
      let initialBreed = defaultBreed
      if (defaultTab === 'adult' && !meatBreedsMap[defaultBreed] && meatBreeds.length > 0) {
        initialBreed = meatBreeds[0].key
      } else if (defaultTab === 'gosling' && !goslingBreedsMap[defaultBreed] && goslingBreeds.length > 0) {
        initialBreed = goslingBreeds[0].key
      }
      
      this.updateCurrentDisplay(initialBreed, defaultTab as 'adult' | 'gosling')
    })
  },

  // 设置空状态
  setEmptyState() {
    this.setData({
      meatBreeds: [],
      meatData: {},
      goslingBreeds: [],
      goslingData: {},
      priceUpdateTime: '--:--',
      currentHistory: []
    })
  },

  // 格式化日期
  formatDate(dateStr: string) {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}-${date.getDate().toString().padStart(2, '0')}`
  },

  // 从历史数据计算趋势
  calculateTrendFromHistory(history: Array<{ value: number }>) {
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
  },

  onBreedCardTap(event: WechatMiniprogram.TouchEvent) {
    const breedKey = event.currentTarget.dataset.key as string
    if (!breedKey) {
      return
    }
    this.updateCurrentDisplay(breedKey, this.data.activeTab as 'adult' | 'gosling')
  },

  onTabChange(event: any) {
    const tabValue = event.detail?.value || 'adult'
    
    // 切换 tab 时，选择该 tab 的第一个品种
    let newBreed = this.data.currentBreed
    if (tabValue === 'adult') {
      const meatBreeds = this.data.meatBreeds
      if (meatBreeds.length > 0) {
        newBreed = meatBreeds[0].key
      }
    } else {
      const goslingBreeds = this.data.goslingBreeds
      if (goslingBreeds.length > 0) {
        newBreed = goslingBreeds[0].key
      }
    }
    
    this.updateCurrentDisplay(newBreed, tabValue as 'adult' | 'gosling')
  },

  updateCurrentDisplay(breedKey: string, tabKey: 'adult' | 'gosling') {
    // 根据 tab 选择对应的数据源
    const dataSource = tabKey === 'adult' ? this.data.meatData : this.data.goslingData
    const breedData = dataSource?.[breedKey]
    
    if (!breedData) {
      logger.warn('未找到品种数据:', breedKey, tabKey)
      return
    }

    const unit = tabKey === 'adult' ? '/斤' : '/只'
    const scheme = this.data.chartPresets?.[tabKey] || this.data.chartScheme

    this.setData({
      currentBreed: breedKey,
      currentBreedLabel: breedData.label || '--',
      activeTab: tabKey,
      currentPriceDisplay: {
        range: breedData.range || '--',
        min: breedData.min || 0,
        max: breedData.max || 0,
        trend: breedData.trend ?? 0,
        change: breedData.change || '+0.0'
      },
      currentHistory: breedData.history || [],
      currentUnit: unit,
      chartScheme: scheme
    })
  },

})

