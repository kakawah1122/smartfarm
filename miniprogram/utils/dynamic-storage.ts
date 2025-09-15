// miniprogram/utils/dynamic-storage.ts
// 动态云存储管理工具 - 符合微信云开发最佳实践
// 
// 设计原则：
// 1. 遵循微信云开发存储规范
// 2. 基于业务录入数据动态生成时间文件夹
// 3. 支持灵活的权限控制和缓存配置
// 4. 提供完整的文件生命周期管理

interface DynamicPathOptions {
  category: string;           // 业务分类: health, production, ai-diagnosis 等
  subCategory: string;        // 子分类: symptoms, entry, input 等
  recordDate: string;         // 业务记录日期 (用户选择) '2024-01-15'
  timeGranularity?: 'year' | 'quarter' | 'month' | 'week' | 'day'; // 时间粒度
  devMode?: boolean;          // 开发模式标识
  metadata?: {
    batchId?: string;         // 批次ID
    sessionId?: string;       // 会话ID
    location?: string;        // 位置信息
    relatedRecordId?: string; // 关联记录ID
    fileType?: string;        // MIME类型
    originalName?: string;    // 原始文件名
  };
}

interface UploadResult {
  success: boolean;
  fileID?: string;
  cloudPath?: string;
  downloadURL?: string;
  timeDimension?: string;     // 生成的时间维度文件夹
  error?: string;
}

interface QueryOptions {
  category: string;
  subCategory?: string;
  startDate: string;
  endDate: string;
  batchId?: string;
  tags?: string[];
  limit?: number;
}

// 微信云开发存储最佳实践配置
const WECHAT_STORAGE_CONFIG = {
  // 文件命名规范 - 避免中文和特殊字符
  fileNaming: {
    maxLength: 120,           // 微信云存储路径长度限制
    allowedChars: /^[a-zA-Z0-9\-_\/\.]+$/, // 仅允许英文、数字、横线、下划线
    timeFormat: 'YYYYMMDD',   // 时间格式
    randomLength: 8           // 随机字符串长度
  },
  
  // 支持的文件类型
  allowedFileTypes: {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'text/plain': '.txt',
    'application/json': '.json'
  },
  
  // 文件大小限制 (微信云开发单文件100MB限制)
  fileSizeLimit: {
    default: 50 * 1024 * 1024,      // 50MB 默认限制
    image: 20 * 1024 * 1024,        // 20MB 图片限制
    document: 100 * 1024 * 1024     // 100MB 文档限制
  }
};

// 业务时间粒度配置 - 根据不同业务特点设置最优的时间分层
const BUSINESS_TIME_CONFIG = {
  // 健康管理 - 按月分层便于统计分析
  health: {
    symptoms: 'month',      // 症状按月：便于月度健康报告
    treatment: 'month',     // 治疗按月：便于疗效统计
    recovery: 'quarter',    // 恢复按季度：长期跟踪
    records: 'month'        // 记录按月：便于档案管理
  },
  
  // 生产管理 - 按季度/月分层便于生产计划
  production: {
    entry: 'quarter',       // 入栏按季度：配合生产周期
    exit: 'quarter',        // 出栏按季度：配合销售周期
    material: 'month',      // 物料按月：便于成本核算
    inventory: 'week',      // 盘点按周：便于库存管理
    daily: 'month'          // 日常管理按月
  },
  
  // AI功能 - 按周分层便于模型优化
  'ai-diagnosis': {
    input: 'week',          // AI输入按周：便于模型训练
    results: 'week',        // AI结果按周：便于准确率统计
    cache: 'day'            // 缓存按天：便于定期清理
  },
  
  'ai-count': {
    raw: 'week',           // 原始图片按周
    processed: 'week'      // 处理结果按周
  },
  
  // 文档管理 - 按年/月分层便于归档
  documents: {
    reports: 'month',       // 报告按月
    certificates: 'year',  // 证书按年
    manuals: 'none'        // 手册不分层
  },
  
  // 系统文件 - 按需分层
  system: {
    exports: 'month',      // 导出按月
    backups: 'day',        // 备份按天
    logs: 'day',           // 日志按天
    temp: 'none'           // 临时文件不分层
  }
};

export class DynamicStorageManager {
  
  // 开发模式配置
  private static isDevelopmentMode: boolean = true; // 开发期默认启用
  
  /**
   * 设置开发模式
   * @param enabled 是否启用开发模式
   */
  static setDevelopmentMode(enabled: boolean) {
    this.isDevelopmentMode = enabled;
    // 动态存储开发模式切换
  }
  
  /**
   * 获取当前是否为开发模式
   */
  static isDev(): boolean {
    return this.isDevelopmentMode;
  }
  
  /**
   * 动态上传文件 - 根据业务数据自动创建时间文件夹
   * @param filePath 本地文件路径
   * @param options 上传选项
   * @returns 上传结果
   */
  static async uploadFile(filePath: string, options: DynamicPathOptions): Promise<UploadResult> {
    try {
      // 1. 参数验证
      const validation = this.validateUploadParams(filePath, options);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }
      
      // 2. 生成符合微信规范的云存储路径（自动应用开发模式）
      const cloudPath = this.generateCloudPath({
        ...options,
        devMode: options.devMode !== undefined ? options.devMode : this.isDevelopmentMode
      });
      
      // 3. 执行上传
      const uploadResult = await wx.cloud.uploadFile({
        cloudPath,
        filePath
      });
      
      // 4. 记录文件信息到数据库
      const recordResult = await this.recordFileInfo({
        fileID: uploadResult.fileID,
        cloudPath,
        options,
        uploadResult
      });
      
      if (!recordResult.success) {
        // 文件信息记录失败
      }
      
      return {
        success: true,
        fileID: uploadResult.fileID,
        cloudPath,
        downloadURL: uploadResult.fileID,
        timeDimension: this.extractTimeDimension(cloudPath)
      };
      
    } catch (error) {
      // 动态上传失败
      return {
        success: false,
        error: error.message || '上传失败，请检查网络连接'
      };
    }
  }
  
  /**
   * 批量上传文件
   * @param filePaths 文件路径数组
   * @param options 上传选项
   * @returns 上传结果数组
   */
  static async uploadMultipleFiles(filePaths: string[], options: DynamicPathOptions): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    
    // 并发上传，但限制并发数量避免过载
    const concurrentLimit = 3;
    const chunks = this.chunkArray(filePaths, concurrentLimit);
    
    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map((filePath, index) => 
          this.uploadFile(filePath, {
            ...options,
            metadata: {
              ...options.metadata,
              sequence: results.length + index + 1 // 添加序列号
            }
          })
        )
      );
      results.push(...chunkResults);
    }
    
    return results;
  }
  
  /**
   * 根据微信云开发规范生成存储路径
   * @param options 路径选项
   * @returns 云存储路径
   */
  private static generateCloudPath(options: DynamicPathOptions): string {
    const { category, subCategory, recordDate, metadata = {}, devMode = false } = options;
    
    // 获取时间粒度配置
    const timeGranularity = options.timeGranularity || 
      this.getTimeGranularity(category, subCategory);
    
    // 解析业务记录日期
    const date = new Date(recordDate);
    const timeSuffix = this.generateTimeSuffix(date, timeGranularity);
    
    // 生成文件名 - 遵循微信命名规范
    const fileName = this.generateFileName(options, date);
    
    // 开发模式：添加用户前缀避免权限问题
    let pathPrefix = '';
    if (devMode) {
      const app = getApp<IAppOption>();
      const userInfo = app.globalData.userInfo;
      if (userInfo?.openid) {
        pathPrefix = `dev-${userInfo.openid}/`;
      } else {
        pathPrefix = 'dev-anonymous/';
      }
    }
    
    // 组装完整路径
    let fullPath: string;
    
    if (timeGranularity === 'none') {
      // 不分时间层级
      fullPath = `${pathPrefix}${category}/${subCategory}/${fileName}`;
    } else {
      // 分时间层级
      fullPath = `${pathPrefix}${category}/${subCategory}/${timeSuffix}/${fileName}`;
    }
    
    // 路径长度检查
    if (fullPath.length > WECHAT_STORAGE_CONFIG.fileNaming.maxLength) {
      // 路径长度超限，进行截断处理
      fullPath = this.truncatePath(fullPath);
    }
    
    // 字符合规性检查
    if (!WECHAT_STORAGE_CONFIG.fileNaming.allowedChars.test(fullPath)) {
      // 路径包含不规范字符，进行清理
      fullPath = this.sanitizePath(fullPath);
    }
    
    return fullPath;
  }
  
  /**
   * 生成时间后缀
   * @param date 日期对象
   * @param granularity 时间粒度
   * @returns 时间后缀字符串
   */
  private static generateTimeSuffix(date: Date, granularity: string): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const quarter = Math.ceil(month / 3);
    const week = this.getWeekOfYear(date);
    
    switch (granularity) {
      case 'year':
        return `${year}`;
      case 'quarter':
        return `${year}-Q${quarter}`;
      case 'month':
        return `${year}-${month.toString().padStart(2, '0')}`;
      case 'week':
        return `${year}-W${week.toString().padStart(2, '0')}`;
      case 'day':
        return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      default:
        return `${year}-${month.toString().padStart(2, '0')}`;
    }
  }
  
  /**
   * 生成符合微信规范的文件名
   * @param options 选项
   * @param date 日期
   * @returns 文件名
   */
  private static generateFileName(options: DynamicPathOptions, date: Date): string {
    const { category, metadata = {} } = options;
    const timestamp = Date.now();
    const dateStr = this.formatDate(date);
    const randomStr = this.generateRandomString(WECHAT_STORAGE_CONFIG.fileNaming.randomLength);
    
    // 基础文件名
    let baseName = `${category}_${dateStr}_${timestamp}_${randomStr}`;
    
    // 添加业务标识
    if (metadata.batchId) {
      baseName += `_batch${metadata.batchId}`;
    }
    if (metadata.sessionId) {
      baseName += `_session${metadata.sessionId}`;
    }
    if (metadata.location) {
      baseName += `_loc${this.sanitizeString(metadata.location)}`;
    }
    
    // 添加文件扩展名
    const extension = this.getFileExtension(metadata.fileType);
    return `${baseName}${extension}`;
  }
  
  /**
   * 获取时间粒度配置
   * @param category 主分类
   * @param subCategory 子分类
   * @returns 时间粒度
   */
  private static getTimeGranularity(category: string, subCategory: string): string {
    return BUSINESS_TIME_CONFIG[category]?.[subCategory] || 'month';
  }
  
  /**
   * 获取年份中的周数
   * @param date 日期对象
   * @returns 周数
   */
  private static getWeekOfYear(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = Math.floor((date.getTime() - firstDayOfYear.getTime()) / (24 * 60 * 60 * 1000));
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }
  
  /**
   * 格式化日期为字符串
   * @param date 日期对象
   * @returns 格式化字符串
   */
  private static formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
  }
  
  /**
   * 生成随机字符串
   * @param length 长度
   * @returns 随机字符串
   */
  private static generateRandomString(length: number): string {
    return Math.random().toString(36).substring(2, length + 2).padEnd(length, '0');
  }
  
  /**
   * 获取文件扩展名
   * @param mimeType MIME类型
   * @returns 扩展名
   */
  private static getFileExtension(mimeType?: string): string {
    if (!mimeType) return '.jpg';
    return WECHAT_STORAGE_CONFIG.allowedFileTypes[mimeType] || '.bin';
  }
  
  /**
   * 清理字符串，移除不规范字符
   * @param str 输入字符串
   * @returns 清理后字符串
   */
  private static sanitizeString(str: string): string {
    return str.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 20);
  }
  
  /**
   * 清理路径
   * @param path 路径
   * @returns 清理后路径
   */
  private static sanitizePath(path: string): string {
    return path.replace(/[^a-zA-Z0-9\-_\/\.]/g, '');
  }
  
  /**
   * 截断过长路径
   * @param path 路径
   * @returns 截断后路径
   */
  private static truncatePath(path: string): string {
    const maxLength = WECHAT_STORAGE_CONFIG.fileNaming.maxLength;
    if (path.length <= maxLength) return path;
    
    const parts = path.split('/');
    const fileName = parts.pop() || '';
    const pathPrefix = parts.join('/');
    
    const availableLength = maxLength - fileName.length - 1; // -1 for the '/'
    const truncatedPrefix = pathPrefix.substring(0, availableLength);
    
    return `${truncatedPrefix}/${fileName}`;
  }
  
  /**
   * 提取时间维度信息
   * @param cloudPath 云存储路径
   * @returns 时间维度
   */
  private static extractTimeDimension(cloudPath: string): string {
    const parts = cloudPath.split('/');
    // 假设时间维度在第三部分 category/subCategory/timeDimension/fileName
    return parts.length > 3 ? parts[2] : '';
  }
  
  /**
   * 参数验证
   * @param filePath 文件路径
   * @param options 选项
   * @returns 验证结果
   */
  private static validateUploadParams(filePath: string, options: DynamicPathOptions): {valid: boolean, error?: string} {
    if (!filePath) {
      return { valid: false, error: '文件路径不能为空' };
    }
    
    if (!options.category || !options.subCategory) {
      return { valid: false, error: '文件分类信息不完整' };
    }
    
    if (!options.recordDate) {
      return { valid: false, error: '记录日期不能为空' };
    }
    
    // 日期格式验证
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(options.recordDate)) {
      return { valid: false, error: '日期格式不正确，请使用YYYY-MM-DD格式' };
    }
    
    return { valid: true };
  }
  
  /**
   * 记录文件信息到数据库
   * @param params 记录参数
   * @returns 记录结果
   */
  private static async recordFileInfo(params: any): Promise<{success: boolean, error?: string}> {
    try {
      await wx.cloud.callFunction({
        name: 'dynamic-file-manager',
        data: {
          action: 'record_upload',
          fileID: params.fileID,
          cloudPath: params.cloudPath,
          category: params.options.category,
          subCategory: params.options.subCategory,
          recordDate: params.options.recordDate,
          timeDimension: this.extractTimeDimension(params.cloudPath),
          metadata: params.options.metadata || {},
          fileSize: params.uploadResult.fileSize || 0,
          uploadTime: new Date().toISOString()
        }
      });
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 数组分块
   * @param array 数组
   * @param size 块大小
   * @returns 分块后数组
   */
  private static chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
  
  /**
   * 按时间范围查询文件
   * @param options 查询选项
   * @returns 文件列表
   */
  static async queryFilesByTimeRange(options: QueryOptions): Promise<{success: boolean, data?: any[], error?: string}> {
    try {
      const result = await wx.cloud.callFunction({
        name: 'dynamic-file-manager',
        data: {
          action: 'query_by_time_range',
          ...options
        }
      });
      
      return result.result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 删除文件
   * @param fileID 文件ID
   * @returns 删除结果
   */
  static async deleteFile(fileID: string): Promise<{success: boolean, error?: string}> {
    try {
      const result = await wx.cloud.callFunction({
        name: 'dynamic-file-manager',
        data: {
          action: 'delete_file',
          fileID
        }
      });
      
      return result.result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 获取存储统计信息
   * @returns 统计信息
   */
  static async getStorageStats(): Promise<{success: boolean, data?: any, error?: string}> {
    try {
      const result = await wx.cloud.callFunction({
        name: 'dynamic-file-manager',
        data: {
          action: 'get_storage_stats'
        }
      });
      
      return result.result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// 导出常量供外部使用
export { BUSINESS_TIME_CONFIG, WECHAT_STORAGE_CONFIG };
