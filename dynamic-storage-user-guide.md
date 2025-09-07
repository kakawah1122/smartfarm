# 📖 动态云存储系统使用指南

> 智能养鹅健康管理系统 - 动态云存储功能完整使用手册

## 🌟 **系统特性概述**

我们的动态云存储系统基于**用户业务数据驱动**的设计理念，具有以下创新特性：

### **🎯 核心优势**
- **📅 数据驱动**: 根据您录入的记录日期自动创建时间文件夹
- **🗂️ 智能分类**: 按业务逻辑自动分类存储（健康、生产、AI等）
- **🔍 高效查询**: 支持按时间范围和业务条件快速检索文件
- **🔐 安全可靠**: 遵循微信云开发最佳实践的权限控制
- **⚡ 性能优异**: 智能缓存和批量处理提升操作效率

### **💡 创新设计**
与传统的按系统时间分层不同，我们的系统：
- ✅ **业务导向**: 按您选择的记录日期创建文件夹，而非系统当前时间
- ✅ **零冗余**: 只创建有数据的文件夹，没有空文件夹浪费
- ✅ **灵活配置**: 不同业务可配置不同时间粒度（年/季度/月/周/日）

---

## 🚀 **快速开始**

### **1. 基本使用流程**

#### **步骤1**: 选择记录日期
```
💡 关键：必须先选择记录日期，系统会根据这个日期创建文件夹！
```

#### **步骤2**: 选择文件类型
- 🏥 **症状图片** → 存储至 `health/symptoms/2024-01/`
- 💊 **治疗过程** → 存储至 `health/treatment/2024-01/` 
- 🌱 **康复记录** → 存储至 `health/recovery/2024-01/`

#### **步骤3**: 上传文件
系统自动：
- 🔄 根据记录日期生成存储路径
- 📁 创建对应时间维度的文件夹
- 💾 保存文件并记录详细信息
- ✅ 返回上传结果和文件夹位置

### **2. 实际使用示例**

#### **场景1: 记录当天症状**
```
选择日期: 2024-01-15
文件类型: 症状图片
结果: 文件保存至 health/symptoms/2024-01/
显示: "图片已保存至: 2024-01"
```

#### **场景2: 补录历史数据**  
```
选择日期: 2023-12-20  
文件类型: 治疗过程
结果: 文件保存至 health/treatment/2023-12/
显示: "图片已保存至: 2023-12"
```

#### **场景3: AI诊断记录**
```
选择日期: 2024-01-20
文件类型: AI诊断输入
结果: 文件保存至 ai-diagnosis/input/2024-W03/
说明: AI功能按周分层，便于模型优化
```

---

## 📱 **功能详细说明**

### **健康记录管理**

#### **症状图片上传**
```typescript
// 使用方式
1. 打开健康记录表单页面
2. 选择"记录日期"（重要！）
3. 点击"上传症状图片"按钮  
4. 选择相册或拍照
5. 确认上传

// 存储规则
- 路径: health/symptoms/{YYYY-MM}/
- 权限: 团队成员可查看，仅创建者可修改
- 命名: health_20240115_timestamp_random_batchXXX.jpg
```

#### **治疗过程记录**
```typescript
// 功能特点
- 支持批量上传（最多9张图片）
- 自动压缩优化上传速度  
- 显示上传进度和结果
- 支持图片预览和删除

// 应用场景
- 记录用药过程
- 拍摄治疗前后对比
- 记录环境改善措施
```

#### **康复跟踪**
```typescript
// 时间粒度: 按季度分层
- 2024-Q1: 2024年第一季度恢复记录
- 2024-Q2: 2024年第二季度恢复记录
- 便于长期康复效果追踪分析
```

### **AI智能功能**

#### **AI诊断**
```typescript
// 存储路径
input/  → ai-diagnosis/input/2024-W03/
results/ → ai-diagnosis/results/2024-W03/

// 特点
- 按周分层便于模型训练数据管理
- 用户私有权限保护诊断隐私
- 支持诊断历史查询和对比
```

#### **AI智能盘点**
```typescript
// 存储路径: ai-count/
- 文件名包含位置信息: count_raw_location_timestamp.jpg
- 支持多角度拍照提升识别准确率
- 自动记录识别结果和置信度
```

### **生产管理数据**

#### **生产记录**
```typescript
// 保持与现有系统兼容
entry/   → production/entry/2024/01/15/     // 入栏记录
exit/    → production/exit/2024/01/15/      // 出栏记录  
material/ → production/material/2024/01/15/ // 物料记录

// 特点
- 兼容现有production-upload云函数
- 按日分层便于生产计划管理
- 团队协作权限支持信息共享
```

---

## 🔍 **高级查询功能**

### **时间范围查询**

#### **按月份查询健康数据**
```javascript
// 查询2024年1月的所有症状图片
const result = await DynamicStorageManager.queryFilesByTimeRange({
  category: 'health',
  subCategory: 'symptoms', 
  startDate: '2024-01-01',
  endDate: '2024-01-31'
});

console.log('查询结果:', result.data);
console.log('时间维度:', result.timeDimensions); // ["2024-01"]
```

#### **按季度查询生产数据**  
```javascript
// 查询2024年第一季度的出栏记录
const result = await DynamicStorageManager.queryFilesByTimeRange({
  category: 'production',
  subCategory: 'exit',
  startDate: '2024-01-01', 
  endDate: '2024-03-31'
});
```

#### **按批次查询**
```javascript
// 查询特定批次的所有健康记录
const result = await DynamicStorageManager.queryFilesByTimeRange({
  category: 'health',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  batchId: 'BATCH001'
});
```

### **复合条件查询**
```javascript
// 多条件组合查询
const result = await DynamicStorageManager.queryFilesByTimeRange({
  category: 'health',
  subCategory: 'symptoms',
  startDate: '2024-01-01',
  endDate: '2024-01-31', 
  batchId: 'BATCH001',
  tags: ['症状', '紧急'],
  limit: 50,
  page: 1
});
```

---

## 🛡️ **权限与安全**

### **权限级别说明**

#### **🌍 公开资源**
- **用户头像** (`avatars/`)
- **操作手册** (`documents/manuals/`)
- 特点: 所有用户可查看，仅创建者可修改

#### **👥 团队协作**
- **健康数据** (`health/**`)  
- **生产数据** (`production/**`)
- 特点: 团队成员可查看，便于协作决策

#### **🔐 用户私有**
- **AI诊断结果** (`ai-diagnosis/**`)
- **个人证书** (`documents/certificates/`)
- 特点: 仅文件创建者可访问，保护隐私

#### **⚙️ 系统专用**
- **导出文件** (`exports/`)
- **系统文件** (`system/`)
- 特点: 仅云函数可写入，用户只能查看自己的文件

### **安全最佳实践**

#### **数据隔离**
```javascript
// 每个用户只能访问自己创建的私有文件
"read": "resource.openid == auth.openid",
"write": "resource.openid == auth.openid"
```

#### **团队协作**
```javascript  
// 已登录用户可查看共享数据，但只能修改自己创建的
"read": "auth.openid != null",
"write": "resource.openid == auth.openid"
```

---

## 📊 **存储管理与优化**

### **文件生命周期管理**

#### **自动清理策略**
```javascript
// 不同类型文件的保留期限
健康数据: 3年      // 便于长期健康分析
生产数据: 5年      // 满足生产记录要求  
AI诊断: 1年       // 便于模型训练和优化
临时文件: 7天      // 及时清理节省空间
系统备份: 90天     // 平衡安全与成本
```

#### **存储优化**
```javascript
// 图片自动压缩
- 上传时自动压缩减小文件大小
- 支持WebP格式提升压缩比
- 智能调整图片质量平衡效果与大小

// 缓存策略
- 频繁访问文件CDN缓存30天
- 业务图片缓存7天
- AI处理文件短期缓存1小时
```

### **存储统计与监控**

#### **获取存储统计**
```javascript
// 查看存储使用情况
const stats = await DynamicStorageManager.getStorageStats();

console.log('总文件数:', stats.data.totalStats.totalFiles);
console.log('总大小:', stats.data.totalStats.totalSizeFormatted);
console.log('分类统计:', stats.data.categoryStats);
console.log('时间分布:', stats.data.timeDimensionStats);
```

#### **监控指标**
- 📊 **文件数量趋势**: 每日/每周/每月新增文件统计
- 📊 **存储容量变化**: 各分类存储使用量趋势  
- 📊 **访问热度**: 文件访问频次分析
- 📊 **清理效果**: 自动清理释放空间统计

---

## 🔧 **开发者指南**

### **在其他页面中集成**

#### **1. 引入动态存储工具**
```typescript
import { DynamicStorageManager } from '../../utils/dynamic-storage';
```

#### **2. 添加上传方法**
```typescript
async uploadCustomFile() {
  const uploadResult = await DynamicStorageManager.uploadFile(filePath, {
    category: 'your-category',        // 自定义分类
    subCategory: 'your-subcategory',  // 自定义子分类
    recordDate: '2024-01-15',         // 业务记录日期
    metadata: {
      batchId: 'BATCH001',           // 业务标识
      location: 'area-1',            // 位置信息
      fileType: 'image/jpeg',        // 文件类型
      originalName: 'custom.jpg'     // 原始文件名
    }
  });
  
  if (uploadResult.success) {
    console.log('上传成功:', uploadResult.fileID);
    console.log('保存位置:', uploadResult.timeDimension);
  }
}
```

#### **3. 配置时间粒度**
```typescript
// 在 BUSINESS_TIME_CONFIG 中添加自定义配置
const BUSINESS_TIME_CONFIG = {
  'your-category': {
    'your-subcategory': 'week'  // 可选: year, quarter, month, week, day
  }
};
```

### **扩展新的文件类型**

#### **1. 更新工具类**
```typescript
// 在 getFileExtension 方法中添加新类型
private static getFileExtension(mimeType?: string): string {
  const extensionMap = {
    'application/vnd.ms-excel': '.xls',
    'text/csv': '.csv',
    // 添加更多类型...
  };
  return extensionMap[mimeType] || '.bin';
}
```

#### **2. 更新权限配置**
```json
// 为新文件类型配置适当权限
"your-category/**": {
  "read": "auth.openid != null",
  "write": "resource.openid == auth.openid"
}
```

---

## ❓ **常见问题解答**

### **Q1: 为什么要选择记录日期？**
**A**: 系统根据您选择的记录日期（而非当前系统时间）创建文件夹。这样可以：
- ✅ 支持历史数据补录（选择过去日期）
- ✅ 支持预设数据录入（选择未来日期）  
- ✅ 确保文件按业务时间而非操作时间分类

### **Q2: 如果忘记选择记录日期会怎样？**
**A**: 系统会提示"请先选择记录日期"并阻止上传，确保文件分类正确。

### **Q3: 不同时间粒度有什么区别？**
**A**: 
- **按年**: 适合证书等长期保存文件
- **按季度**: 适合生产周期数据
- **按月**: 适合常规健康记录  
- **按周**: 适合AI训练数据
- **按日**: 适合详细生产记录

### **Q4: 如何删除不需要的文件？**
**A**: 
- **软删除**: 文件标记为不活跃，不占用查询结果
- **硬删除**: 彻底删除云存储文件，释放存储空间
- **批量删除**: 支持按条件批量清理过期文件

### **Q5: 如何查看存储使用情况？**
**A**: 调用 `getStorageStats()` 方法查看详细统计，包括文件数量、存储大小、分类分布等。

### **Q6: 系统如何处理并发上传？**
**A**: 采用并发限制策略（默认3个并发），避免系统过载，确保上传稳定性。

### **Q7: 文件命名规则是什么？**  
**A**: 
```
格式: {category}_{date}_{timestamp}_{random}_{business_info}.{ext}
示例: health_20240115_1705123456789_abc123_batchB001.jpg
```
包含业务分类、日期、时间戳、随机字符、业务信息，确保唯一性和可读性。

---

## 📈 **最佳实践建议**

### **1. 数据录入规范**
- ✅ **及时记录**: 建议当天录入当天数据，保证时效性
- ✅ **批次标识**: 为每批鹅设置清晰的批次号，便于数据关联
- ✅ **图片质量**: 症状图片保持高清晰度，有利于AI诊断准确性
- ✅ **分类明确**: 选择正确的文件类型，便于后续查询管理

### **2. 查询优化策略**  
- ✅ **时间范围**: 查询时设置合理时间范围，避免数据量过大
- ✅ **分类筛选**: 优先按category和subCategory筛选，提升查询效率
- ✅ **分页查询**: 对于大量数据使用分页，避免影响性能
- ✅ **缓存利用**: 相同查询条件结果可本地缓存，减少网络请求

### **3. 存储空间管理**
- ✅ **定期清理**: 利用自动清理功能定期删除过期临时文件
- ✅ **图片压缩**: 开启图片压缩功能，节省存储空间
- ✅ **监控使用量**: 定期查看存储统计，及时发现异常增长
- ✅ **备份重要数据**: 关键数据建议同步备份到其他地方

### **4. 团队协作建议**
- ✅ **权限明确**: 了解不同文件类型的权限设置，避免访问错误
- ✅ **命名规范**: 使用有意义的批次号和描述，便于团队理解
- ✅ **数据共享**: 及时上传健康和生产数据，供团队成员参考
- ✅ **隐私保护**: 敏感的AI诊断数据自动私有化，无需担心泄露

---

## 🎉 **总结**

动态云存储系统为您的智能养鹅管理提供了：

- **🎯 精准分类**: 按业务逻辑自动分类，查找更便捷
- **⏰ 时间智能**: 根据业务时间动态创建文件夹，支持历史补录  
- **🔐 安全可靠**: 多级权限控制，保护数据安全
- **📊 统计分析**: 完整的存储统计和趋势分析
- **🚀 高效便捷**: 批量处理、智能缓存、自动优化

通过合理使用这些功能，您可以建立一个高效、安全、智能的文件管理体系，为养鹅事业的数字化转型提供强有力的技术支撑！

---

*如有使用问题，请参考技术文档或联系技术支持。祝您使用愉快！* 🎊
