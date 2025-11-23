/**
 * 页面过渡效果管理器
 */

declare const wx: any

export interface TransitionOptions {
  duration?: number
  delay?: number
  easing?: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out'
  type?: 'fade' | 'slide' | 'zoom' | 'flip' | 'rotate'
  direction?: 'left' | 'right' | 'up' | 'down'
}

class PageTransition {
  private static instance: PageTransition
  private animationQueue: any[] = []
  
  static getInstance(): PageTransition {
    if (!PageTransition.instance) {
      PageTransition.instance = new PageTransition()
    }
    return PageTransition.instance
  }
  
  // 创建动画
  private createAnimation(options: TransitionOptions = {}): any {
    return wx.createAnimation({
      duration: options.duration || 300,
      timingFunction: options.easing || 'ease',
      delay: options.delay || 0
    })
  }
  
  // 淡入效果
  fadeIn(options: TransitionOptions = {}): any {
    const animation = this.createAnimation(options)
    animation.opacity(1).step()
    return animation
  }
  
  // 淡出效果
  fadeOut(options: TransitionOptions = {}): any {
    const animation = this.createAnimation(options)
    animation.opacity(0).step()
    return animation
  }
  
  // 滑动进入
  slideIn(options: TransitionOptions = {}): any {
    const animation = this.createAnimation(options)
    const direction = options.direction || 'right'
    
    switch (direction) {
      case 'left':
        animation.translateX(0).opacity(1).step()
        break
      case 'right':
        animation.translateX(0).opacity(1).step()
        break
      case 'up':
        animation.translateY(0).opacity(1).step()
        break
      case 'down':
        animation.translateY(0).opacity(1).step()
        break
    }
    
    return animation
  }
  
  // 滑动退出
  slideOut(options: TransitionOptions = {}): any {
    const animation = this.createAnimation(options)
    const direction = options.direction || 'right'
    const distance = 750 // rpx
    
    switch (direction) {
      case 'left':
        animation.translateX(-distance).opacity(0).step()
        break
      case 'right':
        animation.translateX(distance).opacity(0).step()
        break
      case 'up':
        animation.translateY(-distance).opacity(0).step()
        break
      case 'down':
        animation.translateY(distance).opacity(0).step()
        break
    }
    
    return animation
  }
  
  // 缩放进入
  zoomIn(options: TransitionOptions = {}): any {
    const animation = this.createAnimation(options)
    animation.scale(1, 1).opacity(1).step()
    return animation
  }
  
  // 缩放退出
  zoomOut(options: TransitionOptions = {}): any {
    const animation = this.createAnimation(options)
    animation.scale(0, 0).opacity(0).step()
    return animation
  }
  
  // 翻转进入
  flipIn(options: TransitionOptions = {}): any {
    const animation = this.createAnimation(options)
    animation.rotateY(0).opacity(1).step()
    return animation
  }
  
  // 翻转退出
  flipOut(options: TransitionOptions = {}): any {
    const animation = this.createAnimation(options)
    animation.rotateY(90).opacity(0).step()
    return animation
  }
  
  // 旋转进入
  rotateIn(options: TransitionOptions = {}): any {
    const animation = this.createAnimation(options)
    animation.rotate(0).opacity(1).step()
    return animation
  }
  
  // 旋转退出
  rotateOut(options: TransitionOptions = {}): any {
    const animation = this.createAnimation(options)
    animation.rotate(180).opacity(0).step()
    return animation
  }
  
  // 组合动画
  combine(...animations: any[]): any {
    // 合并多个动画效果
    const combined = this.createAnimation()
    animations.forEach(ani => {
      this.animationQueue.push(ani)
    })
    return combined
  }
  
  // 顺序执行动画
  async sequence(animations: { animation: any; delay?: number }[]): Promise<void> {
    for (const { animation, delay } of animations) {
      if (delay) {
        await this.delay(delay)
      }
      // 这里需要页面配合使用 setData 来应用动画
    }
  }
  
  // 并行执行动画
  parallel(animations: any[]): any[] {
    return animations
  }
  
  // 延迟
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
  
  // 页面进入动画
  pageEnter(page: any, options: TransitionOptions = {}) {
    const animation = this.fadeIn({
      ...options,
      duration: 300
    })
    
    page.setData({
      pageAnimation: animation.export()
    })
  }
  
  // 页面退出动画
  pageExit(page: any, options: TransitionOptions = {}) {
    const animation = this.fadeOut({
      ...options,
      duration: 200
    })
    
    page.setData({
      pageAnimation: animation.export()
    })
  }
  
  // Tab切换动画
  tabSwitch(page: any, fromIndex: number, toIndex: number) {
    const direction = toIndex > fromIndex ? 'left' : 'right'
    const slideOutAni = this.slideOut({ direction, duration: 200 })
    const slideInAni = this.slideIn({ direction, duration: 200, delay: 100 })
    
    // 先滑出
    page.setData({
      tabAnimation: slideOutAni.export()
    })
    
    // 再滑入
    setTimeout(() => {
      page.setData({
        tabAnimation: slideInAni.export()
      })
    }, 200)
  }
  
  // 列表项动画
  listItemEnter(page: any, index: number) {
    const animation = this.slideIn({
      direction: 'right',
      duration: 300,
      delay: index * 50 // 依次进入
    })
    
    page.setData({
      [`listAnimations[${index}]`]: animation.export()
    })
  }
  
  // 弹窗动画
  modalShow(page: any, modalId: string = 'modal') {
    const bgAnimation = this.fadeIn({ duration: 200 })
    const contentAnimation = this.zoomIn({ duration: 300, delay: 100 })
    
    page.setData({
      [`${modalId}BgAnimation`]: bgAnimation.export(),
      [`${modalId}ContentAnimation`]: contentAnimation.export()
    })
  }
  
  modalHide(page: any, modalId: string = 'modal') {
    const contentAnimation = this.zoomOut({ duration: 200 })
    const bgAnimation = this.fadeOut({ duration: 200, delay: 100 })
    
    page.setData({
      [`${modalId}ContentAnimation`]: contentAnimation.export(),
      [`${modalId}BgAnimation`]: bgAnimation.export()
    })
  }
}

export const pageTransition = PageTransition.getInstance()
