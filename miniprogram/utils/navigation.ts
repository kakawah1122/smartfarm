/**
 * 导航栏适配工具类
 * 统一处理状态栏高度适配问题
 */
import { checkPageAuth } from './auth-guard'

export interface NavbarSizes {
  statusBarHeight: number;  // 状态栏高度(rpx)
  navBarHeight: number;     // 导航栏高度(rpx)
  totalNavHeight: number;   // 总导航高度(rpx)
}

/**
 * 获取系统状态栏高度并转换为rpx
 */
export function getSystemNavBarSizes(): NavbarSizes {
  try {
    const systemInfo = wx.getSystemInfoSync();
    const statusBarHeight = systemInfo.statusBarHeight || 44; // px
    const navBarHeight = 88; // rpx，固定导航栏高度
    const statusBarHeightRpx = statusBarHeight * 2; // px转rpx
    
    return {
      statusBarHeight: statusBarHeightRpx,
      navBarHeight: navBarHeight,
      totalNavHeight: statusBarHeightRpx + navBarHeight
    };
  } catch (error) {
    // 返回默认值
    return {
      statusBarHeight: 88,
      navBarHeight: 88,
      totalNavHeight: 176
    };
  }
}

/**
 * 页面Mixin，为页面添加状态栏适配功能
 */
export function createPageWithNavbar(pageConfig: any) {
  const originalOnLoad = pageConfig.onLoad || function() {};
  
  return {
    ...pageConfig,
    data: {
      ...pageConfig.data,
      // 状态栏相关数据
      statusBarHeight: 88,
      navBarHeight: 88,
      totalNavHeight: 176,
    },
    
    onLoad(options: any) {
      // 检查登录状态
      if (!checkPageAuth()) {
        return // 如果未登录，停止页面加载
      }
      
      // 设置状态栏高度
      this.setStatusBarHeight();
      
      // 调用原始onLoad
      originalOnLoad.call(this, options);
    },
    
    /**
     * 设置状态栏高度
     */
    setStatusBarHeight() {
      const sizes = getSystemNavBarSizes();
      
      this.setData({
        statusBarHeight: sizes.statusBarHeight,
        navBarHeight: sizes.navBarHeight,
        totalNavHeight: sizes.totalNavHeight
      });
      
      // 同步到全局数据
      const app = getApp<IAppOption>();
      if (app.globalData) {
        app.globalData.statusBarHeight = sizes.statusBarHeight / 2; // 转回px
        app.globalData.navBarHeight = sizes.navBarHeight;
      }

    },
    
    /**
     * 返回上一页
     */
    goBack() {
      if (getCurrentPages().length > 1) {
        wx.navigateBack();
      } else {
        wx.switchTab({
          url: '/pages/index/index'
        });
      }
    }
  };
}

/**
 * 设置当前页面的状态栏样式
 */
export function setNavigationBarStyle(options: {
  frontColor?: '#000000' | '#ffffff';
  backgroundColor?: string;
  title?: string;
}) {
  try {
    wx.setNavigationBarColor({
      frontColor: options.frontColor || '#ffffff',
      backgroundColor: options.backgroundColor || '#0ea5e9',
      animation: {
        duration: 200,
        timingFunc: 'easeIn'
      }
    });
    
    if (options.title) {
      wx.setNavigationBarTitle({
        title: options.title
      });
    }
  } catch (error) {
    // 设置导航栏样式失败
  }
}
