# 🔧 云函数错误排查指南

## 📊 **当前错误信息**
```javascript
{
  errMsg: "cloud.callFunction:ok", 
  result: {
    code: "UNKNOWN_ERROR",
    error: "获取存储统计失败", 
    success: false
  }
}
```

## 🔍 **排查步骤**

### **Step 1: 查看云函数详细日志**

1. 打开微信云开发控制台
2. 进入 "云函数" → "日志"
3. 选择 `dynamic-file-manager` 函数
4. 查看最新的执行日志

**预期能看到的详细错误信息**：
- 数据库连接错误
- 集合不存在错误
- 权限denied错误
- 代码语法错误

### **Step 2: 创建数据库集合**

很可能是数据库集合还没有创建，请按以下步骤操作：

1. **进入云开发控制台 → 数据库**
2. **点击 "新建集合"**，创建以下集合：

```bash
dynamic_file_records      # 动态文件记录 ✅ 必须创建
storage_statistics        # 存储统计 ✅ 必须创建  
cleanup_logs             # 清理日志 ✅ 必须创建
```

3. **设置集合权限**：
   - 选择 "仅创建者可读写"
   - 或者 "所有用户可读，仅创建者可写"

### **Step 3: 验证云函数权限**

确保云函数有足够的权限：

1. **进入云开发控制台 → 云函数**
2. **点击 `dynamic-file-manager` 函数**
3. **查看权限配置**，确保包含：
   - ✅ 数据库读写权限
   - ✅ 云存储访问权限

### **Step 4: 简化测试**

先用简化的测试验证云函数基本功能：

```javascript
// 在微信开发者工具控制台执行
wx.cloud.callFunction({
  name: 'dynamic-file-manager',
  data: { 
    action: 'record_upload',
    fileID: 'test-file-id',
    cloudPath: 'test/path',
    category: 'test',
    subCategory: 'test',
    recordDate: '2024-01-15'
  }
}).then(res => {
  console.log('简化测试结果:', res);
}).catch(err => {
  console.error('简化测试失败:', err);
});
```

## 🔧 **常见问题及解决方案**

### **问题1: 集合不存在**
```
错误: Collection 'dynamic_file_records' does not exist
```
**解决**: 手动创建上述三个数据库集合

### **问题2: 权限不足**  
```
错误: permission denied
```
**解决**: 
1. 检查云函数是否有数据库权限
2. 检查数据库集合权限设置

### **问题3: 代码语法错误**
```
错误: Unexpected token
```
**解决**: 重新上传云函数，确保代码完整

### **问题4: 环境变量问题**
```
错误: cloud.init() failed
```
**解决**: 确保云函数环境配置正确
