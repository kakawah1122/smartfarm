"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// inventory-detail.ts - 物料库存详情页面
const navigation_1 = require("../../utils/navigation");
const pageConfig = {
    data: {
        // 搜索和筛选
        searchKeyword: '',
        // 物料列表
        materialsList: [],
        filteredMaterialsList: [],
        // 加载状态
        loading: false
    },
    onLoad() {
        this.loadMaterialsData();
    },
    // 加载物料数据
    async loadMaterialsData() {
        this.setData({ loading: true });
        try {
            console.log('🔍 开始加载物料库存数据...');
            // 获取物料数据
            const materialsData = await this.getMaterialsData();
            this.setData({
                materialsList: materialsData,
                filteredMaterialsList: materialsData
            });
            console.log('📦 物料数据加载完成:', materialsData.length, '个物料');
        }
        catch (error) {
            console.error('❌ 加载物料数据失败:', error);
            wx.showToast({
                title: '加载数据失败',
                icon: 'none'
            });
        }
        finally {
            this.setData({ loading: false });
        }
    },
    // 获取物料数据
    async getMaterialsData() {
        try {
            // 调用云函数获取物料列表
            const materialsResult = await wx.cloud.callFunction({
                name: 'production-material',
                data: {
                    action: 'list_materials'
                }
            });
            if (!materialsResult.result.success) {
                throw new Error('获取物料数据失败');
            }
            const materials = materialsResult.result.data.materials;
            console.log('📦 获取到物料数据:', materials.length, '个');
            // 转换为页面所需的格式
            const materialsDetails = materials.map(material => ({
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
            }));
            // 按物料名称排序
            return materialsDetails.sort((a, b) => a.materialName.localeCompare(b.materialName));
        }
        catch (error) {
            console.error('❌ 获取物料数据失败:', error);
            throw error;
        }
    },
    // 获取安全库存
    getSafetyStock(materialName, unit) {
        const safetyStockMap = {
            '鹅用配合饲料': 20, // 袋
            '玉米颗粒': 10, // 袋  
            '鹅用维生素': 5, // 瓶
            '消毒液': 3 // 桶
        };
        return safetyStockMap[materialName] || 5;
    },
    // 搜索变化
    onSearchChange(e) {
        const { value } = e.detail;
        this.setData({ searchKeyword: value });
        this.filterMaterialsList(value);
    },
    // 筛选物料列表
    filterMaterialsList(keyword) {
        let filtered = this.data.materialsList;
        if (keyword) {
            filtered = this.data.materialsList.filter(item => item.materialName.toLowerCase().includes(keyword.toLowerCase()));
        }
        this.setData({ filteredMaterialsList: filtered });
    },
    // 显示筛选
    showFilter() {
        wx.showActionSheet({
            itemList: ['全部物料', '饲料类', '药品类', '库存不足', '状态良好'],
            success: (res) => {
                this.applyFilter(res.tapIndex);
            }
        });
    },
    // 应用筛选
    applyFilter(filterIndex) {
        let filtered = this.data.materialsList;
        switch (filterIndex) {
            case 0: // 全部物料
                break;
            case 1: // 饲料类
                filtered = this.data.materialsList.filter(item => item.materialName.includes('饲料') || item.materialName.includes('玉米') || item.materialName.includes('feed'));
                break;
            case 2: // 药品类
                filtered = this.data.materialsList.filter(item => !item.materialName.includes('饲料') && !item.materialName.includes('玉米') && !item.materialName.includes('feed'));
                break;
            case 3: // 库存不足
                filtered = this.data.materialsList.filter(item => item.isLowStock);
                break;
            case 4: // 状态良好
                filtered = this.data.materialsList.filter(item => !item.isLowStock);
                break;
        }
        this.setData({ filteredMaterialsList: filtered });
    },
    // 显示物料详情
    showMaterialDetail(e) {
        const material = e.currentTarget.dataset.material;
        console.log('查看物料详情:', material);
    },
    // 页面分享
    onShareAppMessage() {
        return {
            title: '物料库存',
            path: '/pages/inventory-detail/inventory-detail'
        };
    }
};
// 使用导航栏适配工具创建页面
Page((0, navigation_1.createPageWithNavbar)(pageConfig));
