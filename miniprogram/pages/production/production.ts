// production.ts
import { createPageWithNavbar } from '../../utils/navigation'

const pageConfig = {
  data: {
    activeTab: 'entry',
    
    // 入栏统计（默认值，将被真实数据覆盖）
    entryStats: {
      total: '0',
      stockQuantity: '0', // 存栏数量
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
      feed: '0',
      medicineStatus: '无数据',
      // 详细状态信息的默认值
      feedDetails: {
        statusText: '无数据',
        status: 'empty',
        totalCount: 0,
        description: '暂无数据'
      },
      medicineDetails: {
        statusText: '无数据',
        status: 'empty',
        totalCount: 0,
        description: '暂无数据'
      },
      equipmentDetails: {
        statusText: '无数据',
        status: 'empty',
        totalCount: 0,
        description: '暂无数据'
      }
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
    this.loadData()
  },

  onReady() {
    // 页面初次渲染完成时加载数据
    this.refreshData()
  },

  onShow() {
    // 每次页面显示时刷新数据，确保数据最新
    // 特别是从其他页面返回时，需要刷新物料状态
    this.refreshData()
  },

  // 加载数据
  loadData() {
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
      
      if (result.result && result.result.success) {
        const data = result.result.data
        
        // 使用新的详细物料状态信息
        const newMaterialStats = {
          feed: data.material?.feedStock || '0',
          medicineStatus: data.material?.medicineStatus || '未知',
          // 新增详细状态信息
          feedDetails: data.material?.categoryDetails?.feed || {
            statusText: '无数据',
            status: 'empty',
            totalCount: 0,
            description: '暂无数据'
          },
          medicineDetails: data.material?.categoryDetails?.medicine || {
            statusText: '无数据', 
            status: 'empty',
            totalCount: 0,
            description: '暂无数据'
          },
          equipmentDetails: data.material?.categoryDetails?.equipment || {
            statusText: '无数据',
            status: 'empty', 
            totalCount: 0,
            description: '暂无数据'
          }
        }
        
        this.setData({
          entryStats: {
            total: data.entry?.total || '0',
            stockQuantity: data.entry?.stockQuantity || '0', // 直接使用云函数计算的存栏数量
            batches: data.entry?.batches || '0'
          },
          exitStats: {
            total: data.exit?.total || '0',
            batches: data.exit?.batches || '0',
            avgWeight: data.exit?.avgWeight || '0.0'
          },
          materialStats: newMaterialStats
        })
      } else {
        // 设置默认数据
        this.setDefaultStats()
      }
    } catch (error) {
      // 设置默认数据
      this.setDefaultStats()
      
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

  // 设置默认统计数据
  setDefaultStats() {
    this.setData({
      entryStats: {
        total: '0',
        stockQuantity: '0',
        batches: '0'
      },
      exitStats: {
        total: '0',
        batches: '0',
        avgWeight: '0.0'
      },
      materialStats: {
        feed: '0',
        medicineStatus: '无数据',
        feedDetails: {
          statusText: '无数据',
          status: 'empty',
          totalCount: 0,
          description: '暂无数据'
        },
        medicineDetails: {
          statusText: '无数据',
          status: 'empty',
          totalCount: 0,
          description: '暂无数据'
        },
        equipmentDetails: {
          statusText: '无数据',
          status: 'empty',
          totalCount: 0,
          description: '暂无数据'
        }
      }
    })
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
        // 格式化入栏记录数据，确保显示字段完整
        const formattedRecords = records.map((record: any) => ({
          ...record,
          id: record._id || record.batchNumber,
          date: record.entryDate || (record.createTime ? record.createTime.split('T')[0] : '未知日期'),
          // 生成显示标题：品种 + 批次号
          displayTitle: `${record.breed || '未知品种'} - ${record.batchNumber || '批次号'}`
        }))
        
        this.setData({
          entryRecords: formattedRecords,
          isEmpty: formattedRecords.length === 0
        })
      }
    } catch (error) {
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
        // 格式化出栏记录数据，确保显示字段完整
        const formattedRecords = records.map((record: any) => ({
          ...record,
          id: record._id || record.exitNumber,
          date: record.exitDate || (record.createTime ? record.createTime.split('T')[0] : '未知日期'),
          // 确保有标题显示
          displayTitle: record.batchNumber || record.type || `出栏-${record.exitNumber || record._id}`
        }))
        
        this.setData({
          exitRecords: formattedRecords
        })
      }
    } catch (error) {
      this.setData({ exitRecords: [] })
    }
  },

  // 加载物料数据
  async loadMaterialData() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'production-material',
        data: {
          action: 'list_records',
          page: 1,
          pageSize: 10
        }
      })
      
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
      // 数据刷新失败时静默处理
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

  // 查看饲料库存详情
  viewFeedInventory() {
    wx.navigateTo({
      url: '/pages/inventory-detail/inventory-detail?category=feed'
    })
  },

  // 查看药品库存详情
  viewMedicineInventory() {
    wx.navigateTo({
      url: '/pages/inventory-detail/inventory-detail?category=medicine'
    })
  },

  // 查看设备物料详情
  viewEquipmentInventory() {
    wx.navigateTo({
      url: '/pages/inventory-detail/inventory-detail?category=equipment'
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


  // 下拉刷新
  onPullDownRefresh() {
    this.refreshData()
    setTimeout(() => {
      wx.stopPullDownRefresh()
    }, 1500)
  },

}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
