# 健康管理预防管理问题快速诊断

## 问题现象
- 批次筛选器显示"暂无存栏批次"
- 预防管理下没有任务加载

## 立即执行步骤

### 1. 完全清除缓存（必须！）
```javascript
// 在微信开发者工具控制台执行
wx.clearStorageSync()
console.log('✅ 缓存已清除')
```

### 2. 检查数据库批次数据
在微信开发者工具 → 云开发 → 数据库 → prod_batch_entries 查看：
- [ ] 集合中是否有数据？
- [ ] 数据的 userId 和 _openid 字段是否存在？
- [ ] isDeleted 和 isArchived 字段值是什么？

### 3. 测试云函数
在控制台执行：
```javascript
// 测试批次加载
wx.cloud.callFunction({
  name: 'production-entry',
  data: { action: 'getActiveBatches' }
}).then(res => {
  console.log('批次加载结果:', res)
  console.log('批次数量:', res.result?.data?.batches?.length)
}).catch(err => {
  console.error('批次加载失败:', err)
})
```

### 4. 修复批次数据
在控制台执行：
```javascript
// 修复 userId 字段
wx.cloud.callFunction({
  name: 'production-entry',
  data: { action: 'fixBatchUserId' }
}).then(res => {
  console.log('修复结果:', res)
  if (res.result?.success) {
    console.log('✅', res.result.data.message)
  }
}).catch(err => {
  console.error('❌ 修复失败:', err)
})
```

### 5. 查看详细日志
1. 删除小程序
2. 重新编译并打开
3. 进入健康管理页面
4. 打开控制台查看以下日志：
   - `[初始化]` - 页面初始化流程
   - `[批次加载]` - 批次列表加载
   - `[今日任务]` - 任务数据加载

## 常见问题检查清单

### 权限配置
prod_batch_entries 集合权限应该是：
```json
{
  "read": "doc.userId == auth.openid || doc._openid == auth.openid",
  "write": false
}
```

### 云函数上传
确认 production-entry 云函数：
- [ ] 是否已上传最新版本？
- [ ] package.json 中依赖是否已安装？
- [ ] 是否有语法错误？

### 数据问题
- [ ] 批次是否被归档（isArchived: true）？
- [ ] 批次是否被删除（isDeleted: true）？
- [ ] 批次是否有出栏/死亡导致存栏为0？

## 预期日志输出

### 正常情况
```
[初始化] ========== 开始初始化页面 ==========
[初始化] 使用默认批次模式: all
[批次加载] 开始加载批次列表...
[批次加载] 成功获取 3 个批次
[今日任务] 开始加载所有批次今日任务
[今日任务] 获取到 3 个活跃批次
[初始化] ========== 页面初始化完成 ==========
```

### 异常情况
```
[批次加载] ❌ 批次列表为空
[今日任务] ⚠️ 没有活跃批次
```

## 最终解决方案

如果以上都检查过了还是不行：

1. **完全删除小程序**：长按小程序 → 删除
2. **清除开发者工具缓存**：工具 → 清除缓存 → 清除全部
3. **重新上传云函数**
4. **重新编译小程序**
5. **重新打开并测试**

## 联系支持

如果问题仍未解决，请提供：
1. 控制台完整日志截图
2. 数据库 prod_batch_entries 集合截图
3. 云函数调用测试结果
