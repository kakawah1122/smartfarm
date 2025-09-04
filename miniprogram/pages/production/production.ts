// production.ts
import { createPageWithNavbar } from '../../utils/navigation'

const pageConfig = {
  data: {
    activeTab: 'entry',
    
    // 入栏统计（默认值，将被真实数据覆盖）
    entryStats: {
      total: '0',
      survivalRate: '0.0',
      batches: '0'
    },
    
    // 出栏统计（默认值，将被真实数据覆盖）
    exitStats: {
      total: '0',
      batches: '0',
      avgWeight: '0.0'
    },
    
    // 物料统计（默认值，将被真实数据覆盖）
    materialStats: {
      feed: '0'
    },
    
    // 入栏记录（空数组，将从云函数加载真实数据）
    entryRecords: [],
    
    // 出栏记录（空数组，将从云函数加载真实数据）
    exitRecords: [],
    
    // 物料记录（从云函数加载真实数据）
    materialRecords: [],
    
    // 加载状态
    loading: false,
    isEmpty: false  // 用于显示空状态
  },

  onLoad() {
    console.log('🚀 页面加载 - onLoad')
    this.loadData()
  },

  onReady() {
    console.log('📱 页面准备完毕 - onReady')
    // 页面初次渲染完成时加载数据
    this.refreshData()
  },

  onShow() {
    console.log('👀 页面显示 - onShow')
    // 每次页面显示时刷新数据，确保数据最新
    this.refreshData()
  },

  // 加载数据
  loadData() {
    console.log('📊 开始加载所有数据')
    this.loadDashboardData()
    this.loadEntryData()
    this.loadExitData()
    this.loadMaterialData()
  },

  // 加载仪表盘数据
  async loadDashboardData() {
    try {
      this.setData({ loading: true })
      
      const result = await wx.cloud.callFunction({
        name: 'production-dashboard',
        data: {
          action: 'overview'
          // 暂时移除日期过滤，获取所有数据的统计
        }
      })
      
      console.log('🔍 Dashboard调用结果:', JSON.stringify(result, null, 2))
      
      if (result.result && result.result.success) {
        const data = result.result.data
        console.log('📊 接收到的data:', JSON.stringify(data, null, 2))
        console.log('🥬 material数据:', JSON.stringify(data.material, null, 2))
        
        const newMaterialStats = {
          feed: data.material?.feedStock || '0',
          medicineStatus: data.material?.medicineStatus || '未知'
        }
        
        console.log('🎯 设置的materialStats:', JSON.stringify(newMaterialStats, null, 2))
        
        this.setData({
          entryStats: {
            total: data.entry?.total || '0',
            survivalRate: data.entry?.survivalRate || '0.0',
            batches: data.entry?.batches || '0'
          },
          exitStats: {
            total: data.exit?.total || '0',
            batches: data.exit?.batches || '0',
            avgWeight: data.exit?.avgWeight || '0.0'
          },
          materialStats: newMaterialStats
        })
        
        console.log('✅ 页面数据已更新')
      } else {
        console.error('❌ Dashboard调用失败或返回success=false')
      }
    } catch (error) {
      console.error('加载仪表盘数据失败:', error)
      // 如果是云函数不存在的错误，给出友好提示
      if (error.errMsg && error.errMsg.includes('function not found')) {
        wx.showModal({
          title: '系统提示',
          content: '生产管理云函数尚未部署，请先部署云函数后再使用。当前显示为空数据。',
          showCancel: false
        })
      } else {
        wx.showToast({
          title: '数据加载失败，显示默认值',
          icon: 'none'
        })
      }
    } finally {
      this.setData({ loading: false })
    }
  },

  // 加载入栏数据
  async loadEntryData() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'production-entry',
        data: {
          action: 'list',
          page: 1,
          pageSize: 10
        }
      })
      
      if (result.result && result.result.success) {
        const records = result.result.data.records || []
        this.setData({
          entryRecords: records,
          isEmpty: records.length === 0
        })
      }
    } catch (error) {
      console.error('加载入栏数据失败:', error)
      this.setData({ entryRecords: [], isEmpty: true })
    }
  },

  // 加载出栏数据
  async loadExitData() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'production-exit',
        data: {
          action: 'list',
          page: 1,
          pageSize: 10
        }
      })
      
      if (result.result && result.result.success) {
        const records = result.result.data.records || []
        this.setData({
          exitRecords: records
        })
      }
    } catch (error) {
      console.error('加载出栏数据失败:', error)
      this.setData({ exitRecords: [] })
    }
  },

  // 加载物料数据
  async loadMaterialData() {
    try {
      console.log('📦 开始加载物料记录数据')
      const result = await wx.cloud.callFunction({
        name: 'production-material',
        data: {
          action: 'list_records',
          page: 1,
          pageSize: 10
        }
      })
      
      console.log('🔍 物料记录云函数结果:', result)
      
      if (result.result && result.result.success) {
        const records = result.result.data.records || []
        
        // 转换数据格式以匹配界面显示
        const formattedRecords = records.map(record => ({
          id: record._id || record.recordNumber,
          name: record.material?.name || '未知物料',
          type: record.type === 'purchase' ? '采购' : '领用',
          description: `${record.material?.category || '未分类'} • ${record.supplier || record.targetLocation || ''}`,
          quantity: `${record.quantity}${record.material?.unit || '件'}`,
          date: record.recordDate || (record.createTime ? record.createTime.split('T')[0] : '未知日期'),
          status: record.status || '已完成'
        }))
        
        this.setData({
          materialRecords: formattedRecords,
          isEmpty: formattedRecords.length === 0
        })
      } else {
        this.setData({ materialRecords: [] })
      }
    } catch (error) {
      console.error('❌ 加载物料数据失败:', error)
      this.setData({ materialRecords: [] })
    }
  },


  // 获取日期范围（最近30天）
  getDateRange() {
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)
    
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    }
  },

  // 刷新数据
  async refreshData() {
    try {
      this.setData({ loading: true })
      
      // 并行加载所有数据
      await Promise.all([
        this.loadDashboardData(),
        this.loadEntryData(),
        this.loadExitData(),
        this.loadMaterialData()
      ])
      
    } catch (error) {
      console.error('❌ 数据刷新失败:', error)
    } finally {
      this.setData({ loading: false })
    }
  },

  // Tab切换 - TDesign 格式
  onTabChange(e: any) {
    const { value } = e.detail
    this.setData({
      activeTab: value
    })
    
    // 如果切换到物料管理tab，刷新物料数据
    if (value === 'material') {
      this.loadMaterialData()
    }
  },

  // 兼容原有Tab切换
  onTabChangeOld(e: any) {
    const { tab } = e.currentTarget.dataset
    this.setData({
      activeTab: tab
    })
  },

  // 返回上一页功能已在navigation工具中实现

  // 新增入栏记录
  addEntry() {
    wx.navigateTo({
      url: '/pages/entry-form/entry-form'
    })
  },

  // 新增出栏记录
  addExit() {
    wx.navigateTo({
      url: '/pages/exit-form/exit-form'
    })
  },

  // 查看库存详情
  viewInventoryDetail() {
    wx.navigateTo({
      url: '/pages/inventory-detail/inventory-detail'
    })
  },

  // 采购物料
  purchaseMaterial() {
    wx.navigateTo({
      url: '/pages/purchase-form/purchase-form'
    })
  },

  // 领用物料
  useMaterial() {
    wx.navigateTo({
      url: '/pages/material-use-form/material-use-form'
    })
  },

  // 查看记录详情
  viewRecord(e: any) {
    const { item } = e.currentTarget.dataset
    wx.showModal({
      title: '记录详情',
      content: `查看${item.breed || item.type || item.name}的详细信息`,
      showCancel: false,
      success: () => {
        // 实际开发中这里会跳转到详情页面
        wx.showToast({
          title: '功能开发中',
          icon: 'none'
        })
      }
    })
  },

  // 下拉刷新
  onPullDownRefresh() {
    console.log('🔄 下拉刷新触发')
    this.refreshData()
    setTimeout(() => {
      wx.stopPullDownRefresh()
    }, 1500)
  },

  // 强制刷新数据（调试用）
  async forceRefreshData() {
    console.log('🔥 强制刷新数据')
    try {
      this.setData({ loading: true })
      await this.loadDashboardData()
      await this.loadMaterialData()
      console.log('💾 当前页面materialStats:', JSON.stringify(this.data.materialStats, null, 2))
      wx.showToast({
        title: '数据已刷新',
        icon: 'success'
      })
    } catch (error) {
      console.error('强制刷新失败:', error)
      wx.showToast({
        title: '刷新失败',
        icon: 'error'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
