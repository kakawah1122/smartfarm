# 🚀 动态云存储系统部署与测试指导

> 基于微信云开发最佳实践的完整部署流程，确保系统稳定可靠运行。

## 📋 **部署前准备清单**

在开始部署前，请确认以下准备工作：

- [ ] ✅ 微信开发者工具已安装 (版本 ≥ 1.06.2412040)
- [ ] ✅ 小程序已开通云开发功能
- [ ] ✅ 云开发环境已创建 (建议创建dev/test/prod三个环境)
- [ ] ✅ 项目代码已保存并同步
- [ ] ✅ 网络连接稳定

---

## 🔧 **Step 1: 云函数部署**

### **1.1 安装云函数依赖**

在终端中执行以下命令：

```bash
# 进入云函数目录
cd /Users/kakawah/Documents/Wechat/cloudfunctions/dynamic-file-manager

# 安装依赖
npm install

# 确认wx-server-sdk版本
npm list wx-server-sdk
```

### **1.2 上传云函数**

1. **在微信开发者工具中**：
   - 右键点击 `cloudfunctions/dynamic-file-manager` 文件夹
   - 选择 "上传并部署：云端安装依赖"
   - 等待部署完成（通常需要1-3分钟）

2. **验证部署成功**：
   ```bash
   # 在开发者工具控制台执行
   wx.cloud.callFunction({
     name: 'dynamic-file-manager',
     data: { action: 'get_storage_stats' }
   }).then(res => console.log('云函数部署成功:', res))
   ```

### **1.3 设置云函数权限**

在微信云开发控制台中：
1. 进入 "云函数" → "权限设置"  
2. 为 `dynamic-file-manager` 添加以下权限：
   - ✅ 读写数据库
   - ✅ 调用云存储API
   - ✅ 调用其他云函数

---

## 📁 **Step 2: 云存储权限配置**

### **2.1 创建存储文件夹结构**

在微信云开发控制台 → 存储管理：

```bash
# 按顺序创建以下文件夹（点击"新建文件夹"）
avatars/
health/symptoms/
health/treatment/  
health/recovery/
production/entry/
production/exit/
production/material/
production/inventory/
ai-diagnosis/input/
ai-diagnosis/results/
ai-count/
documents/reports/
documents/manuals/
documents/certificates/
exports/
system/
temp/
```

### **2.2 配置权限规则**

在 "存储" → "权限设置" 中，按照 `cloud-storage-permissions-config.md` 文件的配置逐个添加权限规则。

**关键配置**:
```json
# avatars/ - 公开读取
{
  "read": true,
  "write": "resource.openid == auth.openid"
}

# health/ - 团队协作
{
  "read": "auth.openid != null",
  "write": "resource.openid == auth.openid"
}

# ai-diagnosis/ - 用户私有
{
  "read": "resource.openid == auth.openid",
  "write": "resource.openid == auth.openid"
}
```

---

## 🗃️ **Step 3: 数据库配置**

### **3.1 创建数据库集合**

在云开发控制台 → 数据库中创建以下集合：

```bash
dynamic_file_records      # 动态文件记录
storage_statistics        # 存储统计
cleanup_logs             # 清理日志
```

### **3.2 创建数据库索引**

为了优化查询性能，创建以下索引：

```javascript
// dynamic_file_records 集合索引
[
  { "category": 1, "subCategory": 1, "recordDate": -1 },
  { "userId": 1, "recordDate": -1 },
  { "timeDimension": 1, "isActive": 1 },
  { "uploadTime": -1 },
  { "isActive": 1, "category": 1 }
]
```

**创建步骤**：
1. 选择 `dynamic_file_records` 集合
2. 点击 "索引管理" → "添加索引"
3. 输入索引字段和排序方向
4. 点击 "确定"

---

## 🧪 **Step 4: 功能测试**

### **4.1 基础功能测试**

在微信开发者工具中进行以下测试：

#### **测试1: 动态存储工具类**
```javascript
// 在控制台执行
import { DynamicStorageManager } from './utils/dynamic-storage';

// 测试路径生成
console.log('动态存储工具类已加载');
```

#### **测试2: 云函数连通性**
```javascript
// 在控制台执行
wx.cloud.callFunction({
  name: 'dynamic-file-manager',
  data: { action: 'get_storage_stats' }
}).then(res => {
  console.log('云函数测试成功:', res);
}).catch(err => {
  console.error('云函数测试失败:', err);
});
```

### **4.2 图片上传测试**

#### **测试3: 症状图片上传**
1. 打开健康记录表单页面
2. 选择记录日期（重要！）
3. 点击 "上传症状图片" 按钮
4. 选择图片并确认
5. 观察上传进度和结果提示
6. 验证动态文件夹是否正确创建

**预期结果**：
- ✅ 图片成功上传
- ✅ 显示动态文件夹路径（如：`health/symptoms/2024-01/`）
- ✅ 文件ID保存到表单数据
- ✅ 在云存储控制台能看到文件

#### **测试4: 权限验证**
```javascript
// 使用不同用户测试权限隔离
// 用户A上传的文件，用户B不能访问（除公共文件外）
```

### **4.3 时间维度测试**

#### **测试5: 不同时间记录**
1. 选择不同的记录日期：
   - 2024-01-15 → 应创建 `2024-01` 文件夹
   - 2024-02-20 → 应创建 `2024-02` 文件夹
   - 2023-12-10 → 应创建 `2023-12` 文件夹（历史数据）

2. 验证文件夹自动创建和分类正确

#### **测试6: 查询功能**
```javascript
// 测试时间范围查询
DynamicStorageManager.queryFilesByTimeRange({
  category: 'health',
  subCategory: 'symptoms',
  startDate: '2024-01-01',
  endDate: '2024-01-31'
}).then(result => {
  console.log('查询结果:', result);
});
```

---

## 🔍 **Step 5: 问题排查指南**

### **5.1 常见问题及解决方案**

#### **问题1: 云函数调用失败**
```
错误信息: "cloud function execution error"
```
**解决方案**:
1. 检查云函数是否正确部署
2. 确认函数名称拼写正确
3. 查看云函数日志排查具体错误
4. 重新上传并部署云函数

#### **问题2: 文件上传权限被拒绝**
```
错误信息: "permission denied"
```
**解决方案**:
1. 检查云存储权限规则配置
2. 确认用户已登录（auth.openid不为空）
3. 验证文件路径匹配权限规则
4. 测试权限规则JSON语法

#### **问题3: 动态文件夹未创建**
```
现象: 文件上传成功但文件夹不是预期路径
```
**解决方案**:
1. 检查recordDate格式是否正确（YYYY-MM-DD）
2. 确认时间粒度配置是否正确
3. 查看文件路径生成逻辑
4. 检查云函数日志

#### **问题4: 图片预览失败**
```
现象: 图片上传成功但无法预览
```
**解决方案**:
1. 检查fileID是否正确保存
2. 确认云存储读取权限
3. 验证图片格式是否支持
4. 检查网络连接状态

### **5.2 调试技巧**

#### **开启详细日志**
```javascript
// 在动态存储工具类中添加详细日志
console.log('开始上传:', {
  category,
  subCategory, 
  recordDate,
  cloudPath
});
```

#### **使用云开发调试工具**
1. 在开发者工具中打开 "云开发" → "调试"
2. 查看云函数调用日志
3. 监控数据库操作
4. 检查存储文件列表

---

## 📊 **Step 6: 性能监控**

### **6.1 设置监控指标**

在云开发控制台设置以下监控：

- 📊 **云函数调用次数和耗时**
- 📊 **云存储使用量和流量**
- 📊 **数据库查询性能**
- 📊 **错误率统计**

### **6.2 性能优化建议**

#### **文件上传优化**
```javascript
// 压缩图片再上传
const compressedImage = await this.compressImage(filePath);
```

#### **批量操作优化**
```javascript
// 批量上传限制并发数
const concurrentLimit = 3;
const chunks = this.chunkArray(filePaths, concurrentLimit);
```

#### **缓存策略**
```javascript
// 本地缓存文件信息
wx.setStorage({
  key: 'file_cache',
  data: fileInfo
});
```

---

## 🎯 **Step 7: 上线前检查**

### **7.1 功能完整性检查**

- [ ] ✅ 所有文件类型上传正常
- [ ] ✅ 动态文件夹创建正确
- [ ] ✅ 权限控制有效
- [ ] ✅ 时间查询功能正常
- [ ] ✅ 文件删除功能正常
- [ ] ✅ 错误处理完善
- [ ] ✅ 用户体验良好

### **7.2 安全性检查**

- [ ] ✅ 用户数据隔离有效
- [ ] ✅ 敏感数据权限正确
- [ ] ✅ 文件大小限制合理
- [ ] ✅ 上传频率限制合理
- [ ] ✅ 恶意文件过滤
- [ ] ✅ 存储配额监控

### **7.3 性能检查**

- [ ] ✅ 上传速度可接受（< 10秒/图片）
- [ ] ✅ 查询响应及时（< 2秒）
- [ ] ✅ 内存使用合理
- [ ] ✅ 网络流量优化
- [ ] ✅ 错误恢复机制完善

---

## 🎉 **部署成功验证**

当以下所有测试都通过时，说明动态云存储系统部署成功：

### **✅ 核心功能验证**
1. **动态文件夹生成**: 根据记录日期自动创建时间文件夹
2. **多类型文件支持**: 症状、治疗、恢复图片都能正确分类存储
3. **权限控制有效**: 不同权限级别的文件访问控制正常
4. **查询功能正常**: 按时间范围和业务条件查询文件
5. **用户体验良好**: 上传进度显示、错误提示、成功反馈

### **✅ 系统集成验证**
1. **与现有系统兼容**: 不影响原有production-upload等云函数
2. **数据库集成**: 文件信息正确记录到数据库
3. **前端界面完整**: 健康记录表单集成图片上传功能
4. **云函数稳定**: 动态文件管理云函数运行稳定

### **🎯 用户场景验证**
1. **日常记录场景**: 用户选择记录日期 → 上传症状图片 → 自动创建月份文件夹
2. **历史数据补录**: 选择历史日期 → 上传图片 → 创建对应历史时间文件夹  
3. **数据查询场景**: 按时间范围查询 → 快速定位相关文件
4. **团队协作场景**: 团队成员可查看共享的健康数据文件

---

## 📞 **技术支持**

如果在部署过程中遇到问题，请：

1. **查看错误日志**: 开发者工具控制台 + 云开发控制台日志
2. **检查网络状态**: 确保网络连接稳定
3. **验证配置**: 对照配置文档检查设置
4. **重新部署**: 必要时重新部署云函数和权限配置

**部署完成后，您将拥有一个功能完整、安全可靠、符合微信云开发最佳实践的动态云存储系统！** 🎉

---

*最后更新: 2024年1月*
