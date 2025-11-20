# 安全重构计划

## 原则
1. **只删除100%确认未使用的代码**
2. **保留所有功能逻辑**
3. **不改变数据结构**
4. **不动UI相关代码**

## 第一批：安全删除（确认未使用）

### 1. 未使用的函数
- [ ] `loadPreventionTimeline()` - 42行（未被调用）
- [ ] `loadBatchComparison()` - 29行（未被调用）

### 2. 重复的辅助函数
需要进一步检查

## 第二批：合并优化（保持功能不变）

### 1. 合并相似的load函数
- `loadSingleBatchTodayTasks()` + `loadAllBatchesTodayTasks()` → `loadTodayTasks(batchId)`
- 保持原有的逻辑分支

### 2. 表单处理统一
- 保留原有的三个表单
- 只抽取公共验证逻辑

## 第三批：应用已创建的工具

### 1. 使用error-handler
- 替换try-catch块
- 保持错误信息不变

### 2. 使用batch-updater
- 合并连续的setData
- 保持数据更新顺序

## 测试检查点

每步完成后检查：
1. ✅ 页面能正常打开
2. ✅ 数据能正常加载
3. ✅ 所有按钮能点击
4. ✅ 弹窗能正常显示
5. ✅ 数据能正常保存
