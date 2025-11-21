// 微信小程序事件类型扩展
declare namespace WechatMiniprogram {
  interface CustomEvent<T = any> {
    currentTarget: {
      dataset: Record<string, any>
    }
    detail: T
    target: {
      dataset: Record<string, any>
    }
  }
  
  interface TapEvent extends CustomEvent {}
  interface InputEvent extends CustomEvent<{
    value: string
    cursor?: number
    keyCode?: number
  }> {}
  interface ScrollEvent extends CustomEvent<{
    scrollTop: number
    scrollLeft: number
  }> {}
}

// 全局logger
declare const logger: {
  info: (...args: any[]) => void
  warn: (...args: any[]) => void
  error: (...args: any[]) => void
  debug: (...args: any[]) => void
}

// 导出空对象以使文件成为模块
export {}
