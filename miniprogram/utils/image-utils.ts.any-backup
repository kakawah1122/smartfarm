// image-utils.ts - 图片处理工具函数
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
  } = {}
): Promise<string[]> {
  const { onlyCloudFiles = false, showErrorToast = false } = options

  // 首先过滤掉无效值
  let processedImages = images.filter(
    (url): url is string => url !== null && url !== undefined && typeof url === 'string'
  )

  if (processedImages.length === 0) {
    return []
  }

  // 如果需要只处理 cloud:// 开头的URL
  if (onlyCloudFiles) {
    const cloudFileIds = processedImages.filter((url) => url.startsWith('cloud://'))

    if (cloudFileIds.length === 0) {
      return processedImages
    }

    try {
      const tempUrlResult = await wx.cloud.getTempFileURL({
        fileList: cloudFileIds
      })

      if (tempUrlResult.fileList) {
        const tempUrlMap = new Map(
          tempUrlResult.fileList.map((file: any) => [file.fileID, file.tempFileURL])
        )

        processedImages = processedImages
          .map((url: string) => tempUrlMap.get(url) || url)
          .filter((url: string) => url && typeof url === 'string')
      }
    } catch (error: any) {
      logger.warn('图片URL转换失败，使用原始URL:', error)
      if (showErrorToast) {
        wx.showToast({
          title: '图片加载失败',
          icon: 'error'
        })
      }
    }

    return processedImages
  }

  // 处理所有字符串类型的URL
  try {
    const tempUrlResult = await wx.cloud.getTempFileURL({
      fileList: processedImages
    })

    if (tempUrlResult.fileList && tempUrlResult.fileList.length > 0) {
      processedImages = tempUrlResult.fileList
        .map((item: any) => item.tempFileURL || item.fileID)
        .filter((url: any) => url && typeof url === 'string')
    }
  } catch (error: any) {
    logger.warn('图片URL转换失败，使用原始URL:', error)
    if (showErrorToast) {
      wx.showToast({
        title: '图片加载失败',
        icon: 'error'
      })
    }
    // 继续使用已过滤的原始图片URL
  }

  return processedImages
}

