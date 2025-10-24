// inventory-detail.ts - 物料库存详情页面
import { createPageWithNavbar } from '../../utils/navigation'

// 物料详情接口
interface MaterialDetail {
  materialId: string;
  materialName: string;
  currentStock: number;
  unit: string;
  safetyStock: number;
  isLowStock: boolean;
  supplier: string;
  latestPurchaseDate: string;
  specification?: string;
  unitPrice: number;
}

const pageConfig = {
  data: {
    // 搜索和筛选
    searchKeyword: '',
    filterCategory: '', // 添加分类过滤
    pageTitle: '物料库存', // 页面标题
    
    // 物料列表
    materialsList: [] as MaterialDetail[],
    filteredMaterialsList: [] as MaterialDetail[],
    
    // 加载状态
    loading: false,
    
    // 弹窗相关
    showDetailPopup: false,
    selectedMaterial: null as MaterialDetail | null
  },

  onLoad(options: any) {
    // 获取分类参数
    const category = options?.category || ''
    
    // 根据分类设置页面标题
    let pageTitle = '物料库存'
    switch (category) {
      case '饲料':
        pageTitle = '饲料库存'
        break
      case '营养品':
        pageTitle = '营养品库存'
        break
      case '药品':
        pageTitle = '药品库存'
        break
      case '设备':
        pageTitle = '设备物料'
        break
      case '耗材':
        pageTitle = '耗材库存'
        break
      case '其他':
        pageTitle = '其他物料'
        break
      default:
        pageTitle = '物料库存'
        break
    }
    
    this.setData({
      filterCategory: category,
      pageTitle: pageTitle
    })
    
    this.loadMaterialsData()
  },

  // 加载物料数据
  async loadMaterialsData() {
    this.setData({ loading: true })
    
    try {
      // 获取物料数据
      const materialsData = await this.getMaterialsData()
      
      this.setData({
        materialsList: materialsData,
        filteredMaterialsList: materialsData
      })
    } catch (error) {
      wx.showToast({
        title: '加载数据失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 获取物料数据
  async getMaterialsData(): Promise<MaterialDetail[]> {
    try {
      // 调用云函数获取物料列表，支持分类过滤
      const requestData: any = {
        action: 'list_materials'
      }
      
      // 如果有分类过滤，直接使用英文分类值
      if (this.data.filterCategory) {
        requestData.category = this.data.filterCategory
      }
      
      const materialsResult = await wx.cloud.callFunction({
        name: 'production-material',
        data: requestData
      })
      
      if (!materialsResult.result.success) {
        throw new Error('获取物料数据失败')
      }
      
      const materials = materialsResult.result.data.materials
      
      // 转换为页面所需的格式
      const materialsDetails: MaterialDetail[] = materials.map(material => ({
        materialId: material._id,
        materialName: material.name,
        currentStock: Number(material.currentStock) || 0,
        unit: material.unit,
        safetyStock: this.getSafetyStock(material.name, material.unit),
        isLowStock: Number(material.currentStock) <= this.getSafetyStock(material.name, material.unit),
        supplier: material.supplier || '未知供应商',
        latestPurchaseDate: material.createTime ? material.createTime.split('T')[0] : new Date().toISOString().split('T')[0],
        specification: material.specification || '',
        unitPrice: Number(material.unitPrice) || 0
      }))
      
      // 按物料名称排序
      return materialsDetails.sort((a, b) => a.materialName.localeCompare(b.materialName))
      
    } catch (error) {
      throw error
    }
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


  // 搜索变化
  onSearchChange(e: any) {
    const { value } = e.detail
    this.setData({ searchKeyword: value })
    this.filterMaterialsList(value)
  },

  // 筛选物料列表
  filterMaterialsList(keyword: string) {
    let filtered = this.data.materialsList
    
    if (keyword) {
      filtered = this.data.materialsList.filter(item => 
        item.materialName.toLowerCase().includes(keyword.toLowerCase())
      )
    }
    
    this.setData({ filteredMaterialsList: filtered })
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
    let filtered = this.data.materialsList
    
    switch (filterIndex) {
      case 0: // 全部物料
        break
      case 1: // 饲料类
        filtered = this.data.materialsList.filter(item => 
          item.materialName.includes('饲料') || item.materialName.includes('玉米') || item.materialName.includes('feed')
        )
        break
      case 2: // 药品类
        filtered = this.data.materialsList.filter(item => 
          !item.materialName.includes('饲料') && !item.materialName.includes('玉米') && !item.materialName.includes('feed')
        )
        break
      case 3: // 库存不足
        filtered = this.data.materialsList.filter(item => item.isLowStock)
        break
      case 4: // 状态良好
        filtered = this.data.materialsList.filter(item => !item.isLowStock)
        break
    }
    
    this.setData({ filteredMaterialsList: filtered })
  },

  // 显示物料详情
  showMaterialDetail(e: any) {
    const material = e.currentTarget.dataset.material
    this.setData({
      selectedMaterial: material,
      showDetailPopup: true
    })
  },
  
  // 关闭详情弹窗
  closeMaterialDetailPopup() {
    this.setData({
      showDetailPopup: false,
      selectedMaterial: null
    })
  },
  
  // 弹窗可见性变化
  onDetailPopupChange(e: any) {
    const { visible } = e.detail
    if (!visible) {
      this.setData({
        showDetailPopup: false,
        selectedMaterial: null
      })
    }
  },



  // 页面分享
  onShareAppMessage() {
    return {
      title: '物料库存',
      path: '/packageProduction/inventory-detail/inventory-detail'
    }
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
