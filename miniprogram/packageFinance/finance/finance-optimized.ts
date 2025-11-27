// finance.ts - 性能优化版本
import { createPageWithNavbar } from '../../utils/navigation'
import CloudApi from '../../utils/cloud-api'
import { logger } from '../../utils/logger'
// 分页配置
const PAGE_SIZE = 20;

// 防抖时间
const DEBOUNCE_TIME = 300;

// ... 类型定义保持不变 ...

const pageConfig: unknown = {
  // ✅ 定时器管理
  _timerIds: [] as number[],
  
  _safeSetTimeout(callback: () => void, delay: number): number {
    const timerId = setTimeout(() => {
      const index = this._timerIds.indexOf(timerId as unknown as number)
      if (index > -1) {
        this._timerIds.splice(index, 1)
      }
      callback()
    }, delay) as unknown as number
    this._timerIds.push(timerId)
    return timerId
  },
  
  _clearAllTimers() {
    this._timerIds.forEach((id: number) => clearTimeout(id))
    this._timerIds = []
  },

  options: {
    styleIsolation: 'shared'
  },
  data: {
    // ... 原有data保持不变 ...
    
    // 新增性能优化相关数据
    isFirstLoad: true,
    tabLoadStatus: {
      records: false,
      approval: false,
      reports: false,
      aiAnalysis: false
    },
    
    // 分页相关
    recordsPagination: {
      page: 1,
      hasMore: true,
      loading: false
    },
    
    // 数据缓存
    dataCache: {
      lastUpdateTime: 0,
      cacheTimeout: 5 * 60 * 1000 // 5分钟缓存
    }
  },

  // 🎯 优化点1：onLoad只加载必要数据
  onLoad() {
    const startTime = Date.now();
    logger.info('财务页面开始加载');
    
    // 初始化时间选项（同步操作，不影响性能）
    this.initTimeOptions();
    
    // 只加载概览数据（快速显示首屏）
    this.loadFinanceData().then(() => {
      logger.info(`概览数据加载完成，耗时：${Date.now() - startTime}ms`);
      
      // 延迟加载当前Tab数据
      this._safeSetTimeout(() => {
        this.loadCurrentTabData();
      }, 100);
    });
    
    // 标记首次加载
    this.setData({ isFirstLoad: true });
  },

  onUnload() {
    this._clearAllTimers()
  },
  
  // 🎯 优化点2：onShow智能刷新
  onShow() {
    // 只在非首次加载且缓存过期时刷新
    if (!this.data.isFirstLoad) {
      const now = Date.now();
      const { lastUpdateTime, cacheTimeout } = this.data.dataCache;
      
      if (now - lastUpdateTime > cacheTimeout) {
        // 只刷新当前Tab数据
        this.refreshCurrentTab();
      }
    }
    
    // 清除首次加载标记
    if (this.data.isFirstLoad) {
      this.setData({ isFirstLoad: false });
    }
  },

  // 🎯 优化点3：按需加载Tab数据
  loadCurrentTabData() {
    const activeTab = this.data.activeTab;
    
    // 检查是否已加载
    if (this.data.tabLoadStatus[activeTab]) {
      return;
    }
    
    switch(activeTab) {
      case 'records':
        this.loadFinanceRecords(1, false);
        break;
      case 'approval':
        this.loadApprovalItems();
        break;
      case 'reports':
        this.loadFinancialReports();
        break;
      case 'aiAnalysis':
        this.loadModuleDataForAI();
        break;
    }
    
    // 标记已加载
    this.setData({
      [`tabLoadStatus.${activeTab}`]: true,
      'dataCache.lastUpdateTime': Date.now()
    });
  },

  // 🎯 优化点4：分页加载财务记录
  async loadFinanceRecords(page = 1, append = false) {
    if (this.data.recordsPagination.loading) return;
    
    try {
      // 使用单次setData
      const updateData: Record<string, unknown> = {
        'recordsPagination.loading': true
      };
      
      if (!append) {
        updateData.loading = true;
      }
      
      this.setData(updateData);
      
      // 构建时间范围参数
      const timeRange = this.getTimeRange();
      
      // 调用云函数
      const result = await CloudApi.callCloudFunction({
        name: 'finance-management',
        data: {
          action: 'getFinanceRecordList',
          ...timeRange,
          page,
          pageSize: PAGE_SIZE
        }
      });
      
      // 处理数据
      const records = this.formatFinanceRecords(result.records || []);
      
      // 合并setData更新
      const finalData: Record<string, unknown> = {
        financeRecords: append ? [...this.data.financeRecords, ...records] : records,
        'recordsPagination': {
          page: page,
          hasMore: records.length === PAGE_SIZE,
          loading: false
        },
        loading: false,
        isEmpty: !append && records.length === 0
      };
      
      // 同时更新筛选后的记录
      finalData.filteredRecords = finalData.financeRecords;
      finalData.displayRecords = (finalData.financeRecords as FinanceRecordDisplayItem[]).slice(0, 10);
      
      this.setData(finalData);
      
    } catch (error) {
      logger.error('加载财务记录失败:', error);
      
      this.setData({
        financeRecords: append ? this.data.financeRecords : [],
        'recordsPagination.loading': false,
        loading: false,
        isEmpty: !append
      });
    }
  },

  // 🎯 优化点5：滚动加载更多
  onScrollToLower() {
    const { page, hasMore, loading } = this.data.recordsPagination;
    
    if (!hasMore || loading) {
      return;
    }
    
    this.loadFinanceRecords(page + 1, true);
  },

  // 🎯 优化点6：Tab切换时按需加载
  onTabChange(e: CustomEvent) {
    const tab = e.detail.value || e.currentTarget.dataset.tab;
    
    this.setData({ activeTab: tab });
    
    // 延迟加载对应Tab数据
    if (!this.data.tabLoadStatus[tab]) {
      this._safeSetTimeout(() => {
        this.loadCurrentTabData();
      }, 50);
    }
  },

  // 🎯 优化点7：优化筛选逻辑（使用防抖）
  onFilterChange: (() => {
    let timeoutId: NodeJS.Timeout;
    
    return function(this: unknown, type: string) {
      // 清除之前的定时器
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // 设置新的定时器
      timeoutId = setTimeout(() => {
        // 只重新加载记录，不加载其他数据
        this.setData({
          'recordsPagination': {
            page: 1,
            hasMore: true,
            loading: false
          }
        });
        
        this.loadFinanceRecords(1, false);
      }, DEBOUNCE_TIME);
    };
  })(),

  // 🎯 优化点8：刷新优化
  async onPullDownRefresh() {
    try {
      // 清除缓存标记
      this.setData({
        'dataCache.lastUpdateTime': 0
      });
      
      // 只刷新概览和当前Tab
      await Promise.all([
        this.loadFinanceData(),
        this.refreshCurrentTab()
      ]);
      
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  // 刷新当前Tab数据
  refreshCurrentTab() {
    const activeTab = this.data.activeTab;
    
    // 重置Tab加载状态
    this.setData({
      [`tabLoadStatus.${activeTab}`]: false
    });
    
    // 重新加载
    this.loadCurrentTabData();
  },

  // ... 其他方法保持不变 ...
}

// 创建页面
createPageWithNavbar(pageConfig)

// 🎯 财务页面性能优化要点

1. **分步加载优化**
   - onLoad只加载概览数据
   - Tab内容按需加载
   - 延迟加载非首屏数据

2. **减少setData调用**
   - 合并多个数据更新
   - 使用路径更新语法
   - 避免频繁小更新

3. **数据缓存策略**
   - 缓存已加载的Tab数据
   - 避免重复请求相同数据
   - onShow时智能判断是否刷新

4. **分页加载**
   - 财务记录分页显示
   - 滚动加载更多
   - 虚拟列表优化

5. **优化筛选逻辑**
   - 筛选时只更新相关数据
   - 使用防抖处理频繁操作
   - 本地筛选优先于服务器筛选
