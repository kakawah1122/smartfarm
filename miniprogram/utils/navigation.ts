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
 * 扩展Page的类型定义，添加setData等方法
 */
export type PageInstance<D extends WechatMiniprogram.Page.DataOption = WechatMiniprogram.Page.DataOption> = WechatMiniprogram.Page.Instance<D, any>

/**
 * 获取系统状态栏高度并转换为rpx
 */
type WxExtended = typeof wx & {
  getWindowInfo?: () => { statusBarHeight?: number }
  getAppBaseInfo?: () => { statusBarHeight?: number }
}

function getStatusBarHeightPx(): number {
  try {
    const wxAny = wx as WxExtended

    if (typeof wxAny.getWindowInfo === 'function') {
      const windowInfo = wxAny.getWindowInfo()
      if (windowInfo && typeof windowInfo.statusBarHeight === 'number') {
        return windowInfo.statusBarHeight
      }
    }

    if (typeof wxAny.getAppBaseInfo === 'function') {
      const appInfo = wxAny.getAppBaseInfo()
      if (appInfo && typeof appInfo.statusBarHeight === 'number') {
        return appInfo.statusBarHeight
      }
    }

    // 返回默认值（新版基础库应该不会走到这里）
    return 44
  } catch (error) {
    return 44
  }
}

export function getSystemNavBarSizes(): NavbarSizes {
  try {
    const statusBarHeightPx = getStatusBarHeightPx()
    const navBarHeight = 88 // rpx，固定导航栏高度
    const statusBarHeightRpx = statusBarHeightPx * 2 // px转rpx

    return {
      statusBarHeight: statusBarHeightRpx,
      navBarHeight,
      totalNavHeight: statusBarHeightRpx + navBarHeight
    }
  } catch (error) {
    // 返回默认值
    return {
      statusBarHeight: 88,
      navBarHeight: 88,
      totalNavHeight: 176
    }
  }
}

/**
 * 创建带有自适应导航栏的页面
 * 会自动计算状态栏高度并设置
 */
export function createPageWithNavbar<D extends WechatMiniprogram.Page.DataOption = WechatMiniprogram.Page.DataOption>(
  pageConfig: Partial<PageInstance<D>> & { data: D }
): Partial<PageInstance<D & { statusBarHeight: number; navBarHeight: number; totalNavHeight: number }>> {
  const originalOnLoad = (pageConfig as unknown).onLoad || function() {};
  
  // 扩展data，添加导航栏高度
  pageConfig.data = {
    ...pageConfig.data,
    statusBarHeight: 88,
    navBarHeight: 88,
    totalNavHeight: 176,
  } as unknown;
  
  // 替换onLoad方法
  (pageConfig as unknown).onLoad = function(this: unknown, options: unknown) {
    // 检查登录状态
    if (!checkPageAuth()) {
      return // 如果未登录，停止页面加载
    }
    
    // 设置状态栏高度
    const sizes = getSystemNavBarSizes();
    this.setData({
      statusBarHeight: sizes.statusBarHeight,
      navBarHeight: sizes.navBarHeight,
      totalNavHeight: sizes.totalNavHeight
    });
    
    // 调用原始onLoad
    if (originalOnLoad) {
      originalOnLoad.call(this, options);
    }
  };
  
  // 添加goBack方法
  if (!(pageConfig as unknown).goBack) {
    (pageConfig as unknown).goBack = function(this: unknown) {
      if (getCurrentPages().length > 1) {
        wx.navigateBack();
      } else {
        wx.switchTab({
          url: '/pages/index/index'
        });
      }
    };
  }
  
  return pageConfig as unknown;
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
