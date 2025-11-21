/**
 * 列表分页加载助手
 * 用于优化大列表的加载和渲染性能
 * 符合项目开发规范，不改变UI布局
 */

export interface PaginationOptions {
  pageSize?: number
  initialPageSize?: number
  maxItems?: number
}

export interface PaginatedList<T> {
  items: T[]
  hasMore: boolean
  currentPage: number
  pageSize: number
  totalCount: number
}

export class ListPaginator<T> {
  private allItems: T[] = []
  private currentPage: number = 0
  private pageSize: number
  private initialPageSize: number
  private maxItems: number
  
  constructor(options: PaginationOptions = {}) {
    this.pageSize = options.pageSize || 10
    this.initialPageSize = options.initialPageSize || 10
    this.maxItems = options.maxItems || 100
  }
  
  /**
   * 设置完整数据列表
   */
  setItems(items: T[]): void {
    // 限制最大项数，避免内存问题
    this.allItems = items.slice(0, this.maxItems)
    this.currentPage = 0
  }
  
  /**
   * 获取首页数据
   */
  getInitialPage(): PaginatedList<T> {
    const endIndex = Math.min(this.initialPageSize, this.allItems.length)
    this.currentPage = 1
    
    return {
      items: this.allItems.slice(0, endIndex),
      hasMore: endIndex < this.allItems.length,
      currentPage: this.currentPage,
      pageSize: this.initialPageSize,
      totalCount: this.allItems.length
    }
  }
  
  /**
   * 加载下一页数据
   */
  getNextPage(): PaginatedList<T> | null {
    const startIndex = this.currentPage * this.pageSize
    if (startIndex >= this.allItems.length) {
      return null // 没有更多数据
    }
    
    const endIndex = Math.min(startIndex + this.pageSize, this.allItems.length)
    this.currentPage++
    
    return {
      items: this.allItems.slice(startIndex, endIndex),
      hasMore: endIndex < this.allItems.length,
      currentPage: this.currentPage,
      pageSize: this.pageSize,
      totalCount: this.allItems.length
    }
  }
  
  /**
   * 获取当前已加载的所有项
   */
  getLoadedItems(): T[] {
    const endIndex = Math.min(this.currentPage * this.pageSize, this.allItems.length)
    return this.allItems.slice(0, endIndex)
  }
  
  /**
   * 重置分页状态
   */
  reset(): void {
    this.allItems = []
    this.currentPage = 0
  }
  
  /**
   * 获取分页信息
   */
  getInfo(): {
    totalCount: number
    loadedCount: number
    currentPage: number
    hasMore: boolean
  } {
    const loadedCount = Math.min(this.currentPage * this.pageSize, this.allItems.length)
    return {
      totalCount: this.allItems.length,
      loadedCount,
      currentPage: this.currentPage,
      hasMore: loadedCount < this.allItems.length
    }
  }
}

/**
 * 创建分页器实例
 */
export function createPaginator<T>(options?: PaginationOptions): ListPaginator<T> {
  return new ListPaginator<T>(options)
}

/**
 * 虚拟列表助手（适用于超长列表）
 * 只渲染可见区域的项，大幅提升性能
 */
export class VirtualList<T> {
  private items: T[] = []
  private itemHeight: number
  private containerHeight: number
  private scrollTop: number = 0
  private overscan: number = 3 // 额外渲染的项数，避免滚动时空白
  
  constructor(itemHeight: number, containerHeight: number) {
    this.itemHeight = itemHeight
    this.containerHeight = containerHeight
  }
  
  /**
   * 设置数据项
   */
  setItems(items: T[]): void {
    this.items = items
  }
  
  /**
   * 更新滚动位置
   */
  updateScroll(scrollTop: number): void {
    this.scrollTop = scrollTop
  }
  
  /**
   * 获取可见项
   */
  getVisibleItems(): {
    items: T[]
    startIndex: number
    endIndex: number
    offsetY: number
  } {
    const visibleCount = Math.ceil(this.containerHeight / this.itemHeight)
    const startIndex = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.overscan)
    const endIndex = Math.min(
      this.items.length,
      startIndex + visibleCount + this.overscan * 2
    )
    
    return {
      items: this.items.slice(startIndex, endIndex),
      startIndex,
      endIndex,
      offsetY: startIndex * this.itemHeight
    }
  }
  
  /**
   * 获取列表总高度
   */
  getTotalHeight(): number {
    return this.items.length * this.itemHeight
  }
}

/**
 * 懒加载助手
 * 监听滚动事件，自动加载更多数据
 */
export class LazyLoader {
  private callback: () => void
  private threshold: number
  private isLoading: boolean = false
  private hasMore: boolean = true
  
  constructor(callback: () => void, threshold: number = 100) {
    this.callback = callback
    this.threshold = threshold
  }
  
  /**
   * 处理滚动事件
   */
  onScroll(scrollTop: number, scrollHeight: number, clientHeight: number): void {
    if (this.isLoading || !this.hasMore) {
      return
    }
    
    // 当滚动到距离底部threshold像素时，触发加载
    if (scrollTop + clientHeight >= scrollHeight - this.threshold) {
      this.loadMore()
    }
  }
  
  /**
   * 加载更多数据
   */
  private async loadMore(): Promise<void> {
    if (this.isLoading) {
      return
    }
    
    this.isLoading = true
    try {
      await this.callback()
    } finally {
      this.isLoading = false
    }
  }
  
  /**
   * 设置是否还有更多数据
   */
  setHasMore(hasMore: boolean): void {
    this.hasMore = hasMore
  }
  
  /**
   * 重置加载状态
   */
  reset(): void {
    this.isLoading = false
    this.hasMore = true
  }
}
