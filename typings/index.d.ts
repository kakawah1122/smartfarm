/// <reference path="./types/index.d.ts" />

interface IAppOption {
  globalData: {
    userInfo?: WechatMiniprogram.UserInfo,
  }
  userInfoReadyCallback?: WechatMiniprogram.GetUserInfoSuccessCallback,
}

// 扩展微信小程序API类型定义
declare namespace WechatMiniprogram {
  interface Wx {
    /**
     * 获取窗口信息
     * @since 2.20.1
     */
    getWindowInfo(): {
      /** 窗口宽度，单位px */
      windowWidth: number
      /** 窗口高度，单位px */
      windowHeight: number
      /** 可使用窗口宽度，单位px */
      screenWidth: number
      /** 可使用窗口高度，单位px */
      screenHeight: number
      /** 状态栏的高度，单位px */
      statusBarHeight: number
      /** 在竖屏正方向下的安全区域 */
      safeArea: {
        left: number
        right: number
        top: number
        bottom: number
        width: number
        height: number
      }
      /** 屏幕方向 */
      screenTop: number
      /** 设备像素比 */
      pixelRatio: number
    }
    
    /**
     * 预加载分包
     * @since 2.9.2
     */
    preloadSubpackage(options: {
      /** 分包的 root */
      package: string
      /** 预下载完成的回调函数 */
      success?: () => void
      /** 预下载失败的回调函数 */
      fail?: (error: any) => void
      /** 预下载结束的回调函数 */
      complete?: () => void
    }): void
  }
}