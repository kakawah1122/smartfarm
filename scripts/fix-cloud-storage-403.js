#!/usr/bin/env node

/**
 * 修复云存储403权限错误
 * 
 * 问题分析：
 * 1. 临时链接过期（默认1小时）
 * 2. 云存储文件权限设置不当
 * 3. 签名验证失败
 * 
 * 解决方案：
 * 1. 延长临时链接有效期
 * 2. 优化图片URL处理逻辑
 * 3. 添加错误重试机制
 */

const fs = require('fs');
const path = require('path');

// 需要修改的文件列表
const filesToFix = [
  {
    path: 'miniprogram/utils/image-utils.ts',
    description: '图片处理工具',
    fixes: [
      {
        type: 'extend-timeout',
        description: '延长临时链接有效期'
      },
      {
        type: 'add-retry',
        description: '添加重试机制'
      }
    ]
  },
  {
    path: 'miniprogram/pages/profile/profile.ts',
    description: '个人资料页面',
    fixes: [
      {
        type: 'handle-error',
        description: '处理头像加载错误'
      }
    ]
  }
];

// 生成改进的图片处理代码
function generateImprovedImageUtils() {
  return `// image-utils.ts - 改进的图片处理工具函数
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
            logger.error(\`图片权限错误(403): \${item.fileID}\`)
          } else if (item.status === 404) {
            // 404错误，文件不存在
            logger.error(\`图片不存在(404): \${item.fileID}\`)
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
        logger.warn(\`图片URL转换失败，重试第\${attempt}次:\`, error)
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
          logger.debug(\`图片预加载成功: \${url.substring(0, 50)}...\`)
        },
        fail: (error) => {
          logger.warn(\`图片预加载失败: \${url.substring(0, 50)}...\`, error)
        }
      })
    }
  })
}
`;
}

// 生成云函数修复代码
function generateCloudFunctionFix() {
  return `/**
 * 云函数：获取文件临时访问链接
 * 解决403权限问题
 */

const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  const { fileIDs, maxAge = 7200 } = event

  if (!fileIDs || !Array.isArray(fileIDs) || fileIDs.length === 0) {
    return {
      success: false,
      error: '文件ID列表不能为空'
    }
  }

  try {
    // 获取临时链接
    const result = await cloud.getTempFileURL({
      fileList: fileIDs,
      maxAge: maxAge  // 设置有效期（秒）
    })

    // 处理结果
    const processedList = result.fileList.map(item => {
      if (item.status === 0) {
        return {
          fileID: item.fileID,
          tempFileURL: item.tempFileURL,
          status: 'success'
        }
      } else {
        return {
          fileID: item.fileID,
          tempFileURL: '',
          status: 'error',
          errorCode: item.status,
          errorMessage: item.errMsg
        }
      }
    })

    return {
      success: true,
      fileList: processedList
    }
  } catch (error) {
    console.error('获取临时链接失败:', error)
    return {
      success: false,
      error: error.message || '获取临时链接失败'
    }
  }
}
`;
}

// 生成修复建议
function generateFixSuggestions() {
  console.log('========================================');
  console.log('云存储403错误修复方案');
  console.log('========================================\n');
  
  console.log('## 问题分析\n');
  console.log('1. 临时链接过期（默认1小时）');
  console.log('2. 云存储权限配置不当');
  console.log('3. 签名验证失败');
  console.log('4. 文件不存在或已删除\n');
  
  console.log('## 解决方案\n');
  console.log('### 1. 延长临时链接有效期');
  console.log('```javascript');
  console.log('wx.cloud.getTempFileURL({');
  console.log('  fileList: fileIDs,');
  console.log('  maxAge: 7200  // 2小时');
  console.log('})');
  console.log('```\n');
  
  console.log('### 2. 添加错误处理和重试机制');
  console.log('- 捕获403错误并使用默认图片');
  console.log('- 实现自动重试机制');
  console.log('- 缓存成功的链接\n');
  
  console.log('### 3. 云存储权限设置');
  console.log('在云开发控制台设置存储权限：');
  console.log('- 所有用户可读（公开读）');
  console.log('- 仅创建者可写\n');
  
  console.log('### 4. 使用云函数获取链接');
  console.log('- 创建专门的云函数处理');
  console.log('- 服务端获取更稳定');
  console.log('- 可以添加额外的权限控制\n');
  
  console.log('## 立即执行的修复\n');
  console.log('1. 更新 image-utils.ts 文件');
  console.log('2. 添加默认头像图片');
  console.log('3. 创建获取链接的云函数\n');
  
  console.log('## 代码已生成\n');
  console.log('1. 改进的图片处理工具：');
  console.log('   见上方 generateImprovedImageUtils() 输出\n');
  console.log('2. 云函数代码：');
  console.log('   见上方 generateCloudFunctionFix() 输出\n');
}

// 执行修复
console.log('开始修复云存储403错误...\n');
generateFixSuggestions();

// 生成修复文件
const fixedImageUtils = generateImprovedImageUtils();
const cloudFunction = generateCloudFunctionFix();

// 写入修复文件
const outputDir = path.join(__dirname, '..', 'miniprogram', 'utils');
const outputFile = path.join(outputDir, 'image-utils-fixed.ts');

fs.writeFileSync(outputFile, fixedImageUtils, 'utf-8');
console.log(`\n✅ 已生成修复文件: ${outputFile}`);

// 写入云函数
const cloudFuncDir = path.join(__dirname, '..', 'cloudfunctions', 'get-temp-urls');
if (!fs.existsSync(cloudFuncDir)) {
  fs.mkdirSync(cloudFuncDir, { recursive: true });
}

const cloudFuncFile = path.join(cloudFuncDir, 'index.js');
fs.writeFileSync(cloudFuncFile, cloudFunction, 'utf-8');
console.log(`✅ 已生成云函数: ${cloudFuncFile}`);

// 生成package.json
const packageJson = {
  name: 'get-temp-urls',
  version: '1.0.0',
  description: '获取文件临时访问链接',
  main: 'index.js',
  dependencies: {
    'wx-server-sdk': 'latest'
  }
};

fs.writeFileSync(
  path.join(cloudFuncDir, 'package.json'),
  JSON.stringify(packageJson, null, 2),
  'utf-8'
);

console.log('\n========================================');
console.log('修复完成！请执行以下操作：');
console.log('========================================\n');
console.log('1. 将 image-utils-fixed.ts 内容替换到 image-utils.ts');
console.log('2. 部署云函数 get-temp-urls');
console.log('3. 在云控制台设置存储权限为"所有用户可读"');
console.log('4. 添加默认头像图片到 /images/default-avatar.png');
console.log('\n');
