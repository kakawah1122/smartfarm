// inventory-detail.ts - 库存详情页面逻辑
import { createPageWithNavbar } from '../../utils/navigation'

// 物料库存接口
interface MaterialInventory {
  materialId: string;
  materialName: string;
  totalQuantity: number;
  unit: string;
  safetyStock: number;
  isLowStock: boolean;
  batchCount: number;
  latestPurchaseDate: string;
  batches: PurchaseBatch[];
}

// 采购批次接口  
interface PurchaseBatch {
  batchId: string;
  totalQuantity: number;
  remainingQuantity: number;
  unitPrice: number;
  supplier: string;
  purchaseDate: string;
}

const pageConfig = {
  data: {
    // 搜索和筛选
    searchKeyword: '',
    
    // 概览数据
    totalFeedWeight: '0.0',
    feedStatus: 'good',
    feedStatusText: '状态良好',
    totalMedicineCount: 0,
    medicineStatus: 'good', 
    medicineStatusText: '充足',
    
    // 库存列表
    inventoryList: [] as MaterialInventory[],
    filteredInventoryList: [] as MaterialInventory[],
    
    
    // 加载状态
    loading: false
  },

  onLoad() {
    this.loadInventoryData()
  },

  // 加载库存数据
  async loadInventoryData() {
    this.setData({ loading: true })
    
    try {
      // 获取所有采购批次数据
      const purchaseData = await this.getPurchaseData()
      
      // 汇总生成库存数据
      const inventoryData = this.generateInventoryData(purchaseData)
      
      // 计算概览数据
      const overviewData = this.calculateOverview(inventoryData)
      
      this.setData({
        inventoryList: inventoryData,
        filteredInventoryList: inventoryData,
        ...overviewData
      })
      
      console.log('库存数据加载完成:', inventoryData)
    } catch (error) {
      console.error('加载库存数据失败:', error)
      wx.showToast({
        title: '加载数据失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 模拟获取采购数据
  async getPurchaseData(): Promise<any[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockPurchases = [
          {
            batchId: 'CG-20241201',
            materialName: '鹅用配合饲料',
            specification: '25kg/袋',
            unit: '袋',
            totalQuantity: 50,
            usedQuantity: 15,
            remainingQuantity: 35,
            unitPrice: 45.0,
            supplier: '正大饲料公司',
            purchaseDate: '2024-12-01'
          },
          {
            batchId: 'CG-20241128',
            materialName: '鹅用配合饲料', 
            specification: '25kg/袋',
            unit: '袋',
            totalQuantity: 30,
            usedQuantity: 5,
            remainingQuantity: 25,
            unitPrice: 46.0,
            supplier: '希望饲料集团',
            purchaseDate: '2024-11-28'
          },
          {
            batchId: 'CG-20241125',
            materialName: '玉米颗粒',
            specification: '50kg/袋', 
            unit: '袋',
            totalQuantity: 25,
            usedQuantity: 3,
            remainingQuantity: 22,
            unitPrice: 85.0,
            supplier: '安徽粮油集团',
            purchaseDate: '2024-11-25'
          },
          {
            batchId: 'CG-20241203',
            materialName: '鹅用维生素',
            specification: '1kg/瓶',
            unit: '瓶', 
            totalQuantity: 20,
            usedQuantity: 3,
            remainingQuantity: 17,
            unitPrice: 28.0,
            supplier: '华大生物科技',
            purchaseDate: '2024-12-03'
          },
          {
            batchId: 'CG-20241205',
            materialName: '消毒液',
            specification: '5L/桶',
            unit: '桶',
            totalQuantity: 10,
            usedQuantity: 1, 
            remainingQuantity: 9,
            unitPrice: 35.0,
            supplier: '武汉健康兽药',
            purchaseDate: '2024-12-05'
          }
        ]
        resolve(mockPurchases)
      }, 200)
    })
  },

  // 汇总生成库存数据
  generateInventoryData(purchaseData: any[]): MaterialInventory[] {
    const materialMap = new Map<string, any>()
    
    // 按物料名称分组汇总
    purchaseData.forEach(batch => {
      const key = batch.materialName
      
      if (!materialMap.has(key)) {
        materialMap.set(key, {
          materialId: this.generateMaterialId(batch.materialName),
          materialName: batch.materialName,
          unit: batch.unit,
          totalQuantity: 0,
          safetyStock: this.getSafetyStock(batch.materialName, batch.unit),
          batches: [],
          latestPurchaseDate: batch.purchaseDate
        })
      }
      
      const material = materialMap.get(key)
      material.totalQuantity += batch.remainingQuantity
      material.batches.push({
        batchId: batch.batchId,
        totalQuantity: batch.totalQuantity,
        remainingQuantity: batch.remainingQuantity,
        unitPrice: batch.unitPrice,
        supplier: batch.supplier,
        purchaseDate: batch.purchaseDate
      })
      
      // 更新最新采购日期
      if (batch.purchaseDate > material.latestPurchaseDate) {
        material.latestPurchaseDate = batch.purchaseDate
      }
    })
    
    // 转换为数组并计算附加信息
    const inventoryList: MaterialInventory[] = Array.from(materialMap.values()).map(material => ({
      ...material,
      batchCount: material.batches.length,
      isLowStock: material.totalQuantity <= material.safetyStock,
      batches: material.batches.sort((a: any, b: any) => a.purchaseDate.localeCompare(b.purchaseDate)) // 按日期排序，先进先出
    }))
    
    return inventoryList.sort((a, b) => a.materialName.localeCompare(b.materialName))
  },

  // 生成物料ID
  generateMaterialId(materialName: string): string {
    const hash = materialName.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0)
      return a & a
    }, 0)
    return `MAT${Math.abs(hash).toString().slice(0, 6)}`
  },

  // 获取安全库存
  getSafetyStock(materialName: string, unit: string): number {
    const safetyStockMap: Record<string, number> = {
      '鹅用配合饲料': 20, // 袋
      '玉米颗粒': 10,     // 袋  
      '鹅用维生素': 5,    // 瓶
      '消毒液': 3         // 桶
    }
    return safetyStockMap[materialName] || 5
  },

  // 计算概览数据
  calculateOverview(inventoryList: MaterialInventory[]) {
    let totalFeedWeight = 0
    let feedLowCount = 0 
    let medicineCount = 0
    let medicineLowCount = 0
    
    inventoryList.forEach(material => {
      if (material.materialName.includes('饲料') || material.materialName.includes('玉米')) {
        // 假设每袋25-50kg，计算总重量
        const weightPerBag = material.materialName.includes('玉米') ? 50 : 25
        totalFeedWeight += (material.totalQuantity * weightPerBag) / 1000 // 转换为吨
        
        if (material.isLowStock) feedLowCount++
      } else {
        medicineCount++
        if (material.isLowStock) medicineLowCount++
      }
    })
    
    return {
      totalFeedWeight: totalFeedWeight.toFixed(1),
      feedStatus: feedLowCount > 0 ? 'warning' : 'good',
      feedStatusText: feedLowCount > 0 ? '库存不足' : '状态良好',
      totalMedicineCount: medicineCount,
      medicineStatus: medicineLowCount > 0 ? 'warning' : 'good', 
      medicineStatusText: medicineLowCount > 0 ? '库存不足' : '充足'
    }
  },

  // 搜索变化
  onSearchChange(e: any) {
    const { value } = e.detail
    this.setData({ searchKeyword: value })
    this.filterInventoryList(value)
  },

  // 筛选库存列表
  filterInventoryList(keyword: string) {
    let filtered = this.data.inventoryList
    
    if (keyword) {
      filtered = this.data.inventoryList.filter(item => 
        item.materialName.toLowerCase().includes(keyword.toLowerCase())
      )
    }
    
    this.setData({ filteredInventoryList: filtered })
  },

  // 显示筛选
  showFilter() {
    wx.showActionSheet({
      itemList: ['全部物料', '饲料类', '药品类', '库存不足', '状态良好'],
      success: (res) => {
        this.applyFilter(res.tapIndex)
      }
    })
  },

  // 应用筛选
  applyFilter(filterIndex: number) {
    let filtered = this.data.inventoryList
    
    switch (filterIndex) {
      case 0: // 全部物料
        break
      case 1: // 饲料类
        filtered = this.data.inventoryList.filter(item => 
          item.materialName.includes('饲料') || item.materialName.includes('玉米')
        )
        break
      case 2: // 药品类
        filtered = this.data.inventoryList.filter(item => 
          !item.materialName.includes('饲料') && !item.materialName.includes('玉米')
        )
        break
      case 3: // 库存不足
        filtered = this.data.inventoryList.filter(item => item.isLowStock)
        break
      case 4: // 状态良好
        filtered = this.data.inventoryList.filter(item => !item.isLowStock)
        break
    }
    
    this.setData({ filteredInventoryList: filtered })
  },

  // 显示物料详情
  showMaterialDetail(e: any) {
    const material = e.currentTarget.dataset.material
    console.log('查看物料详情:', material)
  },



  // 页面分享
  onShareAppMessage() {
    return {
      title: '库存详情',
      path: '/pages/inventory-detail/inventory-detail'
    }
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
