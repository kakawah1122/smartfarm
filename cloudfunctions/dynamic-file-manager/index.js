// cloudfunctions/dynamic-file-manager/index.js
// 动态文件管理云函数 - 遵循微信云开发最佳实践
//
// 功能特性：
// 1. 动态文件夹创建和管理
// 2. 文件信息记录与索引
// 3. 时间范围查询优化
// 4. 自动清理和生命周期管理
// 5. 存储统计和分析

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// 微信云开发数据库最佳实践配置
const DB_CONFIG = {
  // 集合名称规范
  collections: {
    dynamicFiles: 'dynamic_file_records',  // 动态文件记录
    storageStats: 'storage_statistics',    // 存储统计
    cleanupLogs: 'cleanup_logs'           // 清理日志
  },
  
  // 查询优化配置
  queryLimits: {
    defaultLimit: 20,      // 默认查询限制
    maxLimit: 100,         // 最大查询限制
    batchSize: 500         // 批量操作大小
  },
  
  // 索引优化建议
  indexes: [
    { keys: { category: 1, subCategory: 1, recordDate: -1 } },
    { keys: { userId: 1, recordDate: -1 } },
    { keys: { timeDimension: 1, isActive: 1 } },
    { keys: { uploadTime: -1 } },
    { keys: { isActive: 1, category: 1 } }
  ]
};

// 时间维度解析器
const TIME_DIMENSION_PATTERNS = {
  year: /^(\d{4})$/,
  quarter: /^(\d{4})-Q([1-4])$/,
  month: /^(\d{4})-(\d{2})$/,
  week: /^(\d{4})-W(\d{2})$/,
  day: /^(\d{4})-(\d{2})-(\d{2})$/
};

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { action } = event;
  
  // 已移除调试日志
  try {
    switch (action) {
      case 'record_upload':
        return await recordUpload(event, wxContext);
      case 'query_by_time_range':
        return await queryByTimeRange(event, wxContext);
      case 'delete_file':
        return await deleteFile(event, wxContext);
      case 'get_storage_stats':
        return await getStorageStats(event, wxContext);
      case 'cleanup_expired_files':
        return await cleanupExpiredFiles(event, wxContext);
      case 'optimize_storage':
        return await optimizeStorage(event, wxContext);
      case 'get_time_dimensions':
        return await getTimeDimensions(event, wxContext);
      default:
        throw new Error(`不支持的操作: ${action}`);
    }
  } catch (error) {
    // 已移除调试日志
    return {
      success: false,
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    };
  }
};

/**
 * 记录文件上传信息
 * 创建完整的文件元数据记录，支持时间维度索引
 */
async function recordUpload(event, wxContext) {
  const {
    fileID,
    cloudPath,
    category,
    subCategory,
    recordDate,
    timeDimension,
    metadata = {},
    fileSize = 0,
    uploadTime
  } = event;
  
  // 参数验证
  if (!fileID || !cloudPath || !category || !subCategory || !recordDate) {
    throw new Error('文件记录信息不完整');
  }
  
  // 解析时间维度
  const parsedTimeDimension = parseTimeDimension(timeDimension);
  const recordDateObj = new Date(recordDate);
  const uploadTimeObj = new Date(uploadTime || Date.now());
  
  // 构建文件记录
  const fileRecord = {
    // 基础信息
    fileID,
    cloudPath,
    category,
    subCategory,
    
    // 时间信息 - 支持多维度时间查询
    recordDate: recordDateObj,
    uploadTime: uploadTimeObj,
    timeDimension,
    year: recordDateObj.getFullYear(),
    month: recordDateObj.getMonth() + 1,
    quarter: Math.ceil((recordDateObj.getMonth() + 1) / 3),
    week: getWeekOfYear(recordDateObj),
    dayOfYear: getDayOfYear(recordDateObj),
    
    // 时间维度解析结果
    timeDimensionParsed: parsedTimeDimension,
    
    // 用户信息
    userId: wxContext.OPENID,
    
    // 业务信息
    batchId: metadata.batchId || null,
    sessionId: metadata.sessionId || null,
    location: metadata.location || null,
    relatedRecordId: metadata.relatedRecordId || null,
    
    // 文件信息
    fileSize,
    fileType: metadata.fileType || 'unknown',
    originalName: metadata.originalName || '',
    
    // 状态信息
    isActive: true,
    
    // 标签和搜索
    tags: generateFileTags(category, subCategory, metadata),
    searchKeywords: generateSearchKeywords(category, subCategory, metadata, recordDate),
    
    // 生命周期管理
    retentionPolicy: getRetentionPolicy(category, subCategory),
    expiryDate: calculateExpiryDate(category, subCategory, uploadTimeObj),
    
    // 统计信息
    accessCount: 0,
    lastAccessTime: null,
    
    // 系统信息
    createTime: uploadTimeObj,
    updateTime: uploadTimeObj,
    version: 1
  };
  
  try {
    // 写入数据库
    const result = await db.collection(DB_CONFIG.collections.dynamicFiles).add({
      data: fileRecord
    });
    
    // 更新存储统计
    await updateStorageStats(category, subCategory, fileSize, 'upload');
    
    // 已移除调试日志
    return {
      success: true,
      recordId: result._id,
      timeDimension,
      message: `文件已保存至: ${cloudPath}`
    };
    
  } catch (dbError) {
    // 已移除调试日志
    throw new Error('文件信息记录失败，请重试');
  }
}

/**
 * 按时间范围查询文件
 * 支持多种时间维度和业务条件的复合查询
 */
async function queryByTimeRange(event, wxContext) {
  const {
    category,
    subCategory,
    startDate,
    endDate,
    batchId,
    tags = [],
    limit = DB_CONFIG.queryLimits.defaultLimit,
    page = 1,
    sortField = 'recordDate',
    sortOrder = 'desc'
  } = event;
  
  // 构建查询条件
  let whereCondition = {
    isActive: true,
    userId: wxContext.OPENID  // 用户隔离
  };
  
  // 分类条件
  if (category) {
    whereCondition.category = category;
  }
  if (subCategory) {
    whereCondition.subCategory = subCategory;
  }
  
  // 时间范围条件
  if (startDate && endDate) {
    whereCondition.recordDate = _.gte(new Date(startDate)).and(_.lte(new Date(endDate)));
  } else if (startDate) {
    whereCondition.recordDate = _.gte(new Date(startDate));
  } else if (endDate) {
    whereCondition.recordDate = _.lte(new Date(endDate));
  }
  
  // 业务条件
  if (batchId) {
    whereCondition.batchId = batchId;
  }
  
  // 标签条件
  if (tags.length > 0) {
    whereCondition.tags = _.in(tags);
  }
  
  try {
    // 执行查询
    const queryLimit = Math.min(limit, DB_CONFIG.queryLimits.maxLimit);
    const skip = (page - 1) * queryLimit;
    
    const queryBuilder = db.collection(DB_CONFIG.collections.dynamicFiles)
      .where(whereCondition)
      .orderBy(sortField, sortOrder)
      .skip(skip)
      .limit(queryLimit);
    
    const result = await queryBuilder.get();
    
    // 获取总数
    const countResult = await db.collection(DB_CONFIG.collections.dynamicFiles)
      .where(whereCondition)
      .count();
    
    // 处理返回数据
    const processedData = result.data.map(item => ({
      ...item,
      // 添加便于前端使用的字段
      displayName: generateDisplayName(item),
      relativePath: item.cloudPath.replace(/^.*\//, ''), // 相对路径
      sizeFormatted: formatFileSize(item.fileSize),
      ageInDays: Math.floor((Date.now() - item.uploadTime.getTime()) / (24 * 60 * 60 * 1000))
    }));
    
    return {
      success: true,
      data: processedData,
      pagination: {
        total: countResult.total,
        page,
        limit: queryLimit,
        totalPages: Math.ceil(countResult.total / queryLimit)
      },
      timeDimensions: await getRelatedTimeDimensions(whereCondition)
    };
    
  } catch (error) {
    // 已移除调试日志
    throw new Error('文件查询失败，请重试');
  }
}

/**
 * 删除文件
 * 执行软删除和硬删除，更新统计信息
 */
async function deleteFile(event, wxContext) {
  const { fileID, hardDelete = false } = event;
  
  if (!fileID) {
    throw new Error('文件ID不能为空');
  }
  
  try {
    // 查询文件记录
    const fileRecord = await db.collection(DB_CONFIG.collections.dynamicFiles)
      .where({
        fileID,
        userId: wxContext.OPENID,  // 确保用户只能删除自己的文件
        isActive: true
      })
      .get();
    
    if (fileRecord.data.length === 0) {
      throw new Error('文件不存在或无权限删除');
    }
    
    const file = fileRecord.data[0];
    
    if (hardDelete) {
      // 硬删除：从云存储删除物理文件
      try {
        await cloud.deleteFile({
          fileList: [fileID]
        });
      } catch (storageError) {
        // 已移除调试日志
        // 继续执行，软删除数据库记录
      }
      
      // 删除数据库记录
      await db.collection(DB_CONFIG.collections.dynamicFiles)
        .doc(file._id)
        .remove();
        
    } else {
      // 软删除：仅标记为不活跃
      await db.collection(DB_CONFIG.collections.dynamicFiles)
        .doc(file._id)
        .update({
          data: {
            isActive: false,
            deleteTime: new Date(),
            updateTime: new Date()
          }
        });
    }
    
    // 更新存储统计
    await updateStorageStats(file.category, file.subCategory, -file.fileSize, 'delete');
    
    return {
      success: true,
      message: hardDelete ? '文件已彻底删除' : '文件已删除'
    };
    
  } catch (error) {
    // 已移除调试日志
    throw new Error(error.message || '文件删除失败');
  }
}

/**
 * 获取存储统计信息
 * 提供多维度的存储使用统计
 */
async function getStorageStats(event, wxContext) {
  try {
    // 已移除调试日志
    // 首先检查集合是否存在数据
    const fileCount = await db.collection(DB_CONFIG.collections.dynamicFiles)
      .where({
        userId: wxContext.OPENID,
        isActive: true
      })
      .count();
      
    // 已移除调试日志
    if (fileCount.total === 0) {
      // 没有数据时返回空统计
      return {
        success: true,
        data: {
          totalStats: {
            totalFiles: 0,
            totalSize: 0,
            totalSizeFormatted: '0 B',
            categoryCount: 0,
            subCategoryCount: 0
          },
          categoryStats: [],
          message: '暂无文件数据',
          generatedAt: new Date()
        }
      };
    }
    
    // 有数据时进行详细统计
    const pipeline = [
      {
        $match: {
          userId: wxContext.OPENID,
          isActive: true
        }
      },
      {
        $group: {
          _id: {
            category: '$category',
            subCategory: '$subCategory'
          },
          count: { $sum: 1 },
          totalSize: { $sum: '$fileSize' },
          avgSize: { $avg: '$fileSize' },
          oldestUpload: { $min: '$uploadTime' },
          newestUpload: { $max: '$uploadTime' }
        }
      }
    ];
    
    const aggregateResult = await db.collection(DB_CONFIG.collections.dynamicFiles)
      .aggregate()
      .pipeline(pipeline)
      .end();
    
    // 已移除调试日志
    // 处理统计结果
    const categoryStats = aggregateResult.list.map(item => ({
      category: item._id.category,
      subCategory: item._id.subCategory,
      fileCount: item.count,
      totalSize: item.totalSize || 0,
      totalSizeFormatted: formatFileSize(item.totalSize || 0),
      averageSize: Math.round(item.avgSize || 0),
      averageSizeFormatted: formatFileSize(item.avgSize || 0),
      oldestUpload: item.oldestUpload,
      newestUpload: item.newestUpload,
      retentionDays: item.oldestUpload ? Math.floor((Date.now() - item.oldestUpload.getTime()) / (24 * 60 * 60 * 1000)) : 0
    }));
    
    // 总体统计
    const totalStats = {
      totalFiles: categoryStats.reduce((sum, item) => sum + item.fileCount, 0),
      totalSize: categoryStats.reduce((sum, item) => sum + item.totalSize, 0),
      totalSizeFormatted: formatFileSize(categoryStats.reduce((sum, item) => sum + item.totalSize, 0)),
      categoryCount: new Set(categoryStats.map(item => item.category)).size,
      subCategoryCount: categoryStats.length
    };
    
    return {
      success: true,
      data: {
        totalStats,
        categoryStats,
        message: '统计获取成功',
        generatedAt: new Date()
      }
    };
    
  } catch (error) {
    // 已移除调试日志
    // 已移除调试日志
    return {
      success: false,
      error: `统计查询失败: ${error.message}`,
      code: 'STATS_QUERY_ERROR',
      details: {
        errorType: error.name,
        errorMessage: error.message
      }
    };
  }
}

/**
 * 清理过期文件
 * 根据保留策略自动清理过期文件
 */
async function cleanupExpiredFiles(event, wxContext) {
  const { dryRun = false, category = null } = event;
  
  let whereCondition = {
    isActive: true,
    expiryDate: _.lt(new Date())
  };
  
  if (category) {
    whereCondition.category = category;
  }
  
  // 如果不是管理员调用，只清理自己的文件
  if (!event.isSystemCall) {
    whereCondition.userId = wxContext.OPENID;
  }
  
  try {
    // 查询过期文件
    const expiredFiles = await db.collection(DB_CONFIG.collections.dynamicFiles)
      .where(whereCondition)
      .limit(DB_CONFIG.queryLimits.batchSize)
      .get();
    
    if (expiredFiles.data.length === 0) {
      return {
        success: true,
        message: '没有过期文件需要清理',
        cleaned: 0
      };
    }
    
    let cleanedCount = 0;
    let totalSize = 0;
    const results = [];
    
    if (!dryRun) {
      // 执行实际清理
      for (const file of expiredFiles.data) {
        try {
          // 删除云存储文件
          await cloud.deleteFile({
            fileList: [file.fileID]
          });
          
          // 更新数据库记录
          await db.collection(DB_CONFIG.collections.dynamicFiles)
            .doc(file._id)
            .update({
              data: {
                isActive: false,
                deleteTime: new Date(),
                deleteReason: 'expired_auto_cleanup'
              }
            });
          
          cleanedCount++;
          totalSize += file.fileSize;
          results.push({
            fileID: file.fileID,
            cloudPath: file.cloudPath,
            size: file.fileSize,
            status: 'success'
          });
          
        } catch (error) {
          // 已移除调试日志
          results.push({
            fileID: file.fileID,
            cloudPath: file.cloudPath,
            status: 'failed',
            error: error.message
          });
        }
      }
      
      // 记录清理日志
      await db.collection(DB_CONFIG.collections.cleanupLogs).add({
        data: {
          cleanupTime: new Date(),
          category: category || 'all',
          totalFound: expiredFiles.data.length,
          totalCleaned: cleanedCount,
          totalSizeFreed: totalSize,
          results: results.slice(0, 50), // 只记录前50条详情
          executedBy: wxContext.OPENID
        }
      });
    }
    
    return {
      success: true,
      dryRun,
      found: expiredFiles.data.length,
      cleaned: cleanedCount,
      totalSizeFreed: totalSize,
      totalSizeFreedFormatted: formatFileSize(totalSize),
      results: dryRun ? expiredFiles.data.map(f => ({
        fileID: f.fileID,
        cloudPath: f.cloudPath,
        expiryDate: f.expiryDate,
        size: f.fileSize
      })) : results
    };
    
  } catch (error) {
    // 已移除调试日志
    throw new Error('文件清理失败');
  }
}

// 辅助函数

/**
 * 解析时间维度
 */
function parseTimeDimension(timeDimension) {
  if (!timeDimension) return null;
  
  for (const [type, pattern] of Object.entries(TIME_DIMENSION_PATTERNS)) {
    const match = timeDimension.match(pattern);
    if (match) {
      return {
        type,
        raw: timeDimension,
        parsed: match.slice(1).map(Number)
      };
    }
  }
  
  return { type: 'unknown', raw: timeDimension, parsed: [] };
}

/**
 * 获取年份中的周数
 */
function getWeekOfYear(date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = Math.floor((date.getTime() - firstDayOfYear.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

/**
 * 获取年份中的天数
 */
function getDayOfYear(date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  return Math.floor((date.getTime() - firstDayOfYear.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

/**
 * 生成文件标签
 */
function generateFileTags(category, subCategory, metadata) {
  const tags = [category, subCategory];
  
  if (metadata.batchId) tags.push(`batch:${metadata.batchId}`);
  if (metadata.location) tags.push(`location:${metadata.location}`);
  if (metadata.sessionId) tags.push(`session:${metadata.sessionId}`);
  
  return tags;
}

/**
 * 生成搜索关键词
 */
function generateSearchKeywords(category, subCategory, metadata, recordDate) {
  const keywords = [category, subCategory, recordDate];
  
  if (metadata.originalName) {
    keywords.push(...metadata.originalName.split(/[\s\-_\.]/));
  }
  
  return keywords.filter(k => k && k.length > 0);
}

/**
 * 获取保留策略
 */
function getRetentionPolicy(category, subCategory) {
  const policies = {
    'health': { days: 1095, description: '3年' },     // 健康数据保留3年
    'production': { days: 1825, description: '5年' }, // 生产数据保留5年
    'ai-diagnosis': { days: 365, description: '1年' }, // AI诊断保留1年
    'documents': { days: 3650, description: '10年' }, // 文档保留10年
    'temp': { days: 7, description: '7天' },          // 临时文件7天
    'system': { days: 90, description: '90天' }       // 系统文件90天
  };
  
  return policies[category] || policies['system'];
}

/**
 * 计算过期日期
 */
function calculateExpiryDate(category, subCategory, uploadTime) {
  const policy = getRetentionPolicy(category, subCategory);
  const expiryDate = new Date(uploadTime);
  expiryDate.setDate(expiryDate.getDate() + policy.days);
  return expiryDate;
}

/**
 * 更新存储统计
 */
async function updateStorageStats(category, subCategory, sizeChange, operation) {
  const statsId = `${category}_${subCategory}`;
  
  try {
    await db.collection(DB_CONFIG.collections.storageStats)
      .doc(statsId)
      .set({
        data: {
          category,
          subCategory,
          fileCount: _.inc(operation === 'delete' ? -1 : 1),
          totalSize: _.inc(sizeChange),
          lastOperation: operation,
          lastUpdateTime: new Date()
        }
      });
  } catch (error) {
    // 已移除调试日志
  }
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * 生成显示名称
 */
function generateDisplayName(fileRecord) {
  const { category, subCategory, originalName, recordDate } = fileRecord;
  
  if (originalName) {
    return originalName;
  }
  
  const dateStr = new Date(recordDate).toLocaleDateString('zh-CN');
  return `${category}_${subCategory}_${dateStr}`;
}

// 导出配置供其他函数使用
module.exports.DB_CONFIG = DB_CONFIG;
