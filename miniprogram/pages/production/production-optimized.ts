// production.ts - 性能优化版本
import type { 
  BaseResponse, 
  CloudFunctionResponse,
  Batch, 
  HealthRecord, 
  FinanceRecord,
  InputEvent, 
  TapEvent, 
  PickerEvent, 
  ScrollEvent 
} from '../../../typings/core';
import { createPageWithNavbar, type PageInstance } from '../../utils/navigation'
import CloudApi from '../../utils/cloud-api'
import { logger } from '../../utils/logger'

// 导入模块化管理器
import { setupNavigationHandlers } from './modules/production-navigation-module'
import { ProductionDataLoader } from './modules/production-data-loader'
import { ProductionAIManager } from './modules/production-ai-module'

// 分页配置
const PAGE_SIZE = 20;

type ProductionPageData = WechatMiniprogram.Page.DataOption & {
  // ... 原有data定义 ...
  
  // 新增分页相关
  pagination: {
    entry: { page: number; hasMore: boolean; loading: boolean };
    exit: { page: number; hasMore: boolean; loading: boolean };
    material: { page: number; hasMore: boolean; loading: boolean };
  };
  
  // 性能优化标记
  isFirstLoad: boolean;
  tabLoadStatus: {
    entry: boolean;
    exit: boolean;
    material: boolean;
  };
}

const pageConfig: Partial<PageInstance<ProductionPageData>> & { data: ProductionPageData } = {
  data: {
    // ... 原有data ...
    
    // 新增分页数据
    pagination: {
      entry: { page: 1, hasMore: true, loading: false },
      exit: { page: 1, hasMore: true, loading: false },
      material: { page: 1, hasMore: true, loading: false }
    },
    
    // 性能优化标记
    isFirstLoad: true,
    tabLoadStatus: {
      entry: false,
      exit: false,
      material: false
    }
  },

  // 🎯 优化点1：onLoad只加载必要数据
  async onLoad(): Promise<void> {
    logger.info('生产管理页面加载开始')
    const startTime = Date.now()
    
    try {
      // 设置导航处理器
      setupNavigationHandlers(this)
      
      // 只加载概览数据（快速显示首屏）
      await this.loadDashboardData()
      
      // 延迟加载当前tab数据
      setTimeout(() => {
        this.loadCurrentTabData()
      }, 100)
      
      logger.info(`生产页面首屏加载完成，耗时：${Date.now() - startTime}ms`)
    } catch (error) {
      logger.error('页面加载失败:', error)
    }
  },

  // 🎯 优化点2：按需加载tab数据
  loadCurrentTabData() {
    const activeTab = this.data.activeTab;
    
    // 检查是否已加载
    if (this.data.tabLoadStatus[activeTab]) {
      return;
    }
    
    switch(activeTab) {
      case 'entry':
        this.loadEntryData();
        break;
      case 'exit':
        this.loadExitData();
        break;
      case 'material':
        this.loadMaterialData();
        break;
    }
  },

  // 🎯 优化点3：分页加载入栏数据
  async loadEntryData(page = 1, append = false) {
    if (this.data.pagination.entry.loading) return;
    
    try {
      // 使用单次setData
      const updateData = {
        'pagination.entry.loading': true
      };
      
      if (!append) {
        updateData.loading = true;
      }
      
      this.setData(updateData);
      
      // 加载数据
      const records = await ProductionDataLoader.loadEntryRecords(page, PAGE_SIZE);
      
      // 合并setData更新
      const finalData = {
        entryRecords: append ? [...this.data.entryRecords, ...records] : records,
        'pagination.entry': {
          page: page,
          hasMore: records.length === PAGE_SIZE,
          loading: false
        },
        'tabLoadStatus.entry': true,
        loading: false,
        isEmpty: !append && records.length === 0
      };
      
      this.setData(finalData);
    } catch (error) {
      logger.error('加载入栏数据失败:', error);
      
      this.setData({
        entryRecords: append ? this.data.entryRecords : [],
        'pagination.entry.loading': false,
        loading: false,
        isEmpty: !append
      });
    }
  },

  // 🎯 优化点4：分页加载出栏数据
  async loadExitData(page = 1, append = false) {
    if (this.data.pagination.exit.loading) return;
    
    try {
      const updateData = {
        'pagination.exit.loading': true
      };
      
      if (!append) {
        updateData.loading = true;
      }
      
      this.setData(updateData);
      
      const records = await ProductionDataLoader.loadExitRecords(page, PAGE_SIZE);
      
      const finalData = {
        exitRecords: append ? [...this.data.exitRecords, ...records] : records,
        'pagination.exit': {
          page: page,
          hasMore: records.length === PAGE_SIZE,
          loading: false
        },
        'tabLoadStatus.exit': true,
        loading: false,
        isEmpty: !append && records.length === 0
      };
      
      this.setData(finalData);
    } catch (error) {
      logger.error('加载出栏数据失败:', error);
      
      this.setData({
        exitRecords: append ? this.data.exitRecords : [],
        'pagination.exit.loading': false,
        loading: false,
        isEmpty: !append
      });
    }
  },

  // 🎯 优化点5：分页加载物料数据
  async loadMaterialData(page = 1, append = false) {
    if (this.data.pagination.material.loading) return;
    
    try {
      const updateData = {
        'pagination.material.loading': true
      };
      
      if (!append) {
        updateData.loading = true;
      }
      
      this.setData(updateData);
      
      const records = await ProductionDataLoader.loadMaterialRecords(page, PAGE_SIZE);
      
      const finalData = {
        materialRecords: append ? [...this.data.materialRecords, ...records] : records,
        'pagination.material': {
          page: page,
          hasMore: records.length === PAGE_SIZE,
          loading: false
        },
        'tabLoadStatus.material': true,
        loading: false,
        isEmpty: !append && records.length === 0
      };
      
      this.setData(finalData);
    } catch (error) {
      logger.error('加载物料数据失败:', error);
      
      this.setData({
        materialRecords: append ? this.data.materialRecords : [],
        'pagination.material.loading': false,
        loading: false,
        isEmpty: !append
      });
    }
  },

  // 🎯 优化点6：Tab切换时按需加载
  onTabChange(e: TapEvent) {
    const tab = e.currentTarget.dataset.tab;
    
    this.setData({ activeTab: tab });
    
    // 延迟加载对应tab数据
    if (!this.data.tabLoadStatus[tab]) {
      setTimeout(() => {
        this.loadCurrentTabData();
      }, 50);
    }
  },

  // 🎯 优化点7：滚动加载更多
  onScrollToLower() {
    const activeTab = this.data.activeTab;
    const pagination = this.data.pagination[activeTab];
    
    if (!pagination.hasMore || pagination.loading) {
      return;
    }
    
    const nextPage = pagination.page + 1;
    
    switch(activeTab) {
      case 'entry':
        this.loadEntryData(nextPage, true);
        break;
      case 'exit':
        this.loadExitData(nextPage, true);
        break;
      case 'material':
        this.loadMaterialData(nextPage, true);
        break;
    }
  },

  // 🎯 优化点8：下拉刷新优化
  async onPullDownRefresh() {
    try {
      // 清除缓存
      ProductionDataLoader.clearCache();
      
      // 重置分页
      this.setData({
        'pagination.entry': { page: 1, hasMore: true, loading: false },
        'pagination.exit': { page: 1, hasMore: true, loading: false },
        'pagination.material': { page: 1, hasMore: true, loading: false },
        'tabLoadStatus': {
          entry: false,
          exit: false,
          material: false
        }
      });
      
      // 只刷新概览和当前tab
      await Promise.all([
        this.loadDashboardData(true),
        this.loadCurrentTabData()
      ]);
      
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  // ... 其他方法保持不变 ...
}

// 创建页面
createPageWithNavbar(pageConfig)
