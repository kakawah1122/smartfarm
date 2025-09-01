// production.ts
import { createPageWithNavbar } from '../../utils/navigation'

const pageConfig = {
  data: {
    activeTab: 'entry',
    
    // 入栏统计
    entryStats: {
      total: '1,280',
      amount: '10.5',
      batches: '12'
    },
    
    // 出栏统计
    exitStats: {
      total: '850',
      revenue: '21.2',
      avgWeight: '4.8'
    },
    
    // 物料统计
    materialStats: {
      feed: '2.8'
    },
    
    // 入栏记录
    entryRecords: [
      {
        id: 1,
        breed: '白鹅苗',
        quality: '优质品种',
        supplier: '江苏鹅业有限公司',
        quantity: 200,
        amount: '1,640',
        date: '2024-03-15',
        operator: '张三',
        status: '已完成'
      },
      {
        id: 2,
        breed: '灰鹅苗',
        quality: '',
        supplier: '苏州养殖基地',
        quantity: 150,
        amount: '1,200',
        date: '2024-03-12',
        operator: '李四',
        status: '已完成'
      },
      {
        id: 3,
        breed: '黑鹅苗',
        quality: '特色品种',
        supplier: '无锡鹅苗批发市场',
        quantity: 100,
        amount: '900',
        date: '2024-03-10',
        operator: '王五',
        status: '待验收'
      }
    ],
    
    // 出栏记录
    exitRecords: [
      {
        id: 1,
        type: '成年白鹅',
        customer: '苏州农贸市场',
        quantity: 120,
        revenue: '18,000',
        avgWeight: '5.2',
        date: '2024-03-14',
        operator: '张三',
        status: '已交付'
      },
      {
        id: 2,
        type: '成年灰鹅',
        customer: '无锡餐饮集团',
        quantity: 80,
        revenue: '12,800',
        avgWeight: '4.9',
        date: '2024-03-11',
        operator: '李四',
        status: '运输中'
      }
    ],
    
    // 物料记录
    materialRecords: [
      {
        id: 1,
        name: '优质鹅用饲料',
        type: '采购',
        description: '供应商：正大集团',
        quantity: '1.5吨',
        amount: '4,500',
        date: '2024-03-15',
        operator: '张三',
        stock: '4.3吨'
      },
      {
        id: 2,
        name: '鹅用饲料',
        type: '领用',
        description: '1号鹅舍日常投喂',
        quantity: '200kg',
        date: '2024-03-14',
        operator: '李四',
        stock: '2.8吨'
      },
      {
        id: 3,
        name: '禽流感疫苗',
        type: '采购',
        description: '疫苗防疫物资',
        quantity: '50支',
        amount: '750',
        date: '2024-03-13',
        operator: '王五',
        stock: '68支'
      }
    ]
  },

  onLoad() {
    this.loadData()
  },

  onShow() {
    // 页面显示时刷新数据
    this.refreshData()
  },

  // 加载数据
  loadData() {
    this.loadEntryData()
    this.loadExitData()
    this.loadMaterialData()
  },

  // 加载入栏数据
  loadEntryData() {
    // 模拟API调用
    // 实际开发中这里会调用云函数或API
  },

  // 加载出栏数据
  loadExitData() {
    // 模拟API调用
  },

  // 加载物料数据
  loadMaterialData() {
    // 模拟API调用
  },

  // 刷新数据
  refreshData() {
    // 下拉刷新时调用
    this.loadData()
  },

  // Tab切换 - TDesign 格式
  onTabChange(e: any) {
    const { value } = e.detail
    this.setData({
      activeTab: value
    })
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
    wx.showModal({
      title: '新增入栏记录',
      content: '跳转到入栏记录添加页面',
      showCancel: false,
      success: () => {
        // 实际开发中这里会跳转到添加页面
        wx.showToast({
          title: '功能开发中',
          icon: 'none'
        })
      }
    })
  },

  // 新增出栏记录
  addExit() {
    wx.showModal({
      title: '新增出栏记录',
      content: '跳转到出栏记录添加页面',
      showCancel: false,
      success: () => {
        // 实际开发中这里会跳转到添加页面
        wx.showToast({
          title: '功能开发中',
          icon: 'none'
        })
      }
    })
  },

  // 采购物料
  purchaseMaterial() {
    wx.showModal({
      title: '采购入库',
      content: '跳转到物料采购页面',
      showCancel: false,
      success: () => {
        // 实际开发中这里会跳转到采购页面
        wx.showToast({
          title: '功能开发中',
          icon: 'none'
        })
      }
    })
  },

  // 领用物料
  useMaterial() {
    wx.showModal({
      title: '物料领用',
      content: '跳转到物料领用页面',
      showCancel: false,
      success: () => {
        // 实际开发中这里会跳转到领用页面
        wx.showToast({
          title: '功能开发中',
          icon: 'none'
        })
      }
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
    this.refreshData()
    setTimeout(() => {
      wx.stopPullDownRefresh()
    }, 1500)
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
