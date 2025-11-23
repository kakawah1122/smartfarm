// image-utils.ts - 改进的图片处理工具函数
import { logger } from './logger'

/**
 * 处理图片URL数组，将云存储文件ID转换为临时URL
 * @param images 图片URL数组（可能包含云存储fileID或HTTP URL）
 * @param options 处理选项
 * @returns 处理后的图片URL数组
 */
export async function processImageUrls(
  images: (string | null | undefined)[],
  options: {
    /** 是否只处理 cloud:// 开头的URL，默认 false（处理所有字符串） */
    onlyCloudFiles?: boolean
    /** 是否在转换失败时显示错误提示，默认 false */
    showErrorToast?: boolean
    /** 临时链接有效期（秒），默认 7200（2小时） */
    maxAge?: number
    /** 失败重试次数，默认 2 */
    retryCount?: number
  } = {}
): Promise<string[]> {
  const { 
    onlyCloudFiles = false, 
    showErrorToast = false,
    maxAge = 7200,  // 默认2小时
    retryCount = 2
  } = options

  // 首先过滤掉无效值
  let processedImages = images.filter(
    (url): url is string => url !== null && url !== undefined && typeof url === 'string'
  )

  if (processedImages.length === 0) {
    return []
  }

  // 分离已经是HTTP(S)链接和需要转换的文件
  const httpUrls = processedImages.filter(url => 
    url.startsWith('http://') || url.startsWith('https://')
  )
  const needConvert = processedImages.filter(url => 
    !url.startsWith('http://') && !url.startsWith('https://')
  )

  if (needConvert.length === 0) {
    return processedImages
  }

  // 重试机制
  let attempt = 0
  let lastError: unknown = null

  while (attempt <= retryCount) {
    try {
      const tempUrlResult = await wx.cloud.getTempFileURL({
        fileList: needConvert,
        maxAge: maxAge  // 设置有效期
      })

      if (tempUrlResult.fileList && tempUrlResult.fileList.length > 0) {
        const convertedUrls = new Map<string, string>()
        
        tempUrlResult.fileList.forEach((item: any) => {
          if (item.status === 0 && item.tempFileURL) {
            convertedUrls.set(item.fileID, item.tempFileURL)
          } else if (item.status === 403) {
            // 403错误，记录并使用默认图片
            logger.error(`图片权限错误(403): ${item.fileID}`)
          } else if (item.status === 404) {
            // 404错误，文件不存在
            logger.error(`图片不存在(404): ${item.fileID}`)
          }
        })

        // 合并转换结果
        processedImages = processedImages.map(url => {
          if (url.startsWith('http://') || url.startsWith('https://')) {
            return url
          }
          return convertedUrls.get(url) || ''  // 转换失败返回空
        }).filter(url => url !== '')  // 过滤掉空值

        return processedImages
      }
    } catch (error: unknown) {
      lastError = error
      attempt++
      
      if (attempt <= retryCount) {
        logger.warn(`图片URL转换失败，重试第${attempt}次:`, error)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))  // 延迟重试
      } else {
        logger.error('图片URL转换最终失败:', error)
        if (showErrorToast) {
          wx.showToast({
            title: '图片加载失败',
            icon: 'error'
          })
        }
        // 返回HTTP链接，过滤掉转换失败的
        return httpUrls
      }
    }
  }

  return httpUrls
}

/**
 * 获取默认头像URL
 */
export function getDefaultAvatar(): string {
  return '/images/default-avatar.png'
}

/**
 * 处理单个图片URL
 */
export async function processSingleImageUrl(
  url: string | null | undefined,
  options: {
    defaultUrl?: string
    maxAge?: number
  } = {}
): Promise<string> {
  const { defaultUrl = getDefaultAvatar(), maxAge = 7200 } = options

  if (!url || typeof url !== 'string') {
    return defaultUrl
  }

  // 已经是HTTP(S)链接，直接返回
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }

  try {
    const result = await processImageUrls([url], { maxAge, retryCount: 1 })
    return result[0] || defaultUrl
  } catch (error) {
    logger.error('处理单个图片URL失败:', error)
    return defaultUrl
  }
}

/**
 * 批量预加载图片
 */
export async function preloadImages(urls: string[]): Promise<void> {
  const validUrls = await processImageUrls(urls, { maxAge: 7200 })
  
  validUrls.forEach(url => {
    if (url) {
      wx.getImageInfo({
        src: url,
        success: () => {
          logger.debug(`图片预加载成功: ${url.substring(0, 50)}...`)
        },
        fail: (error) => {
          logger.warn(`图片预加载失败: ${url.substring(0, 50)}...`, error)
        }
      })
    }
  })
}
