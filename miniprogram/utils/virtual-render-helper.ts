/**
 * 虚拟渲染辅助类
 * 用于优化长列表渲染性能，不改变原有功能和UI
 * 
 * 特点：
 * 1. 保持原有数据结构不变
 * 2. 保持原有UI样式不变
 * 3. 仅优化渲染部分
 * 4. 支持降级回退
 */

export interface VirtualRenderConfig {
  itemHeight: number           // 每项高度
  bufferSize?: number          // 缓冲区大小
  containerHeight?: number     // 容器高度
  enableVirtual?: boolean      // 是否启用虚拟渲染（开关）
}

export interface VirtualRenderState<T> {
  visibleData: T[]            // 可见数据
  topPlaceholder: number      // 顶部占位高度
  bottomPlaceholder: number   // 底部占位高度
  startIndex: number          // 开始索引
  endIndex: number           // 结束索引
}

export class VirtualRenderHelper<T = any> {
  private config: VirtualRenderConfig
  private scrollTop: number = 0
  private allData: T[] = []
  
  constructor(config: VirtualRenderConfig) {
    this.config = {
      bufferSize: 5,
      containerHeight: 600,
      enableVirtual: true,
      ...config
    }
  }
  
  /**
   * 设置所有数据
   */
  setData(data: T[]): void {
    this.allData = data || []
  }
  
  /**
   * 更新滚动位置
   */
  updateScrollTop(scrollTop: number): void {
    this.scrollTop = scrollTop
  }
  
  /**
   * 获取虚拟渲染状态
   */
  getVirtualState(): VirtualRenderState<T> {
    // 如果未启用虚拟渲染，返回所有数据
    if (!this.config.enableVirtual) {
      return {
        visibleData: this.allData,
        topPlaceholder: 0,
        bottomPlaceholder: 0,
        startIndex: 0,
        endIndex: this.allData.length - 1
      }
    }
    
    const { itemHeight, bufferSize = 5, containerHeight = 600 } = this.config
    const totalCount = this.allData.length
    
    if (totalCount === 0) {
      return {
        visibleData: [],
        topPlaceholder: 0,
        bottomPlaceholder: 0,
        startIndex: 0,
        endIndex: -1
      }
    }
    
    // 计算可见区域
    const visibleCount = Math.ceil(containerHeight / itemHeight)
    const startIndex = Math.max(0, Math.floor(this.scrollTop / itemHeight) - bufferSize)
    const endIndex = Math.min(totalCount - 1, startIndex + visibleCount + bufferSize * 2)
    
    // 提取可见数据
    const visibleData = this.allData.slice(startIndex, endIndex + 1)
    
    // 计算占位高度
    const topPlaceholder = startIndex * itemHeight
    const bottomPlaceholder = Math.max(0, (totalCount - endIndex - 1) * itemHeight)
    
    return {
      visibleData,
      topPlaceholder,
      bottomPlaceholder,
      startIndex,
      endIndex
    }
  }
  
  /**
   * 是否启用虚拟渲染
   */
  isEnabled(): boolean {
    return this.config.enableVirtual ?? true
  }
  
  /**
   * 切换虚拟渲染开关
   */
  toggle(enable?: boolean): void {
    if (enable !== undefined) {
      this.config.enableVirtual = enable
    } else {
      this.config.enableVirtual = !this.config.enableVirtual
    }
  }
  
  /**
   * 更新配置
   */
  updateConfig(config: Partial<VirtualRenderConfig>): void {
    this.config = { ...this.config, ...config }
  }
  
  /**
   * 重置状态
   */
  reset(): void {
    this.scrollTop = 0
    this.allData = []
  }
}

/**
 * 节流函数
 */
export function throttle(fn: Function, delay: number = 16): Function {
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastTime = 0
  
  return function(this: any, ...args: any[]) {
    const now = Date.now()
    
    if (now - lastTime >= delay) {
      lastTime = now
      fn.apply(this, args)
    } else {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        lastTime = Date.now()
        fn.apply(this, args)
        timer = null
      }, delay - (now - lastTime))
    }
  }
}
