# 🚀 待办事项系统部署指南

## 📋 部署前检查清单

### 1. 代码文件确认
- ✅ `cloudfunctions/production-entry/index.js` - 已修改
- ✅ `cloudfunctions/production-entry/breeding-schedule.js` - 新建
- ✅ `cloudfunctions/breeding-todo/index.js` - 已修改  
- ✅ `miniprogram/pages/breeding-todo/breeding-todo.ts` - 已修改

### 2. 数据库集合准备
需要确保以下集合存在：
- `entry_records` - 入栏记录（已存在）
- `task_completions` - 任务完成记录（已存在）
- `batch_todos` - 批次任务（🆕 新集合，将自动创建）

## 🔧 部署步骤

### Step 1: 部署云函数
```bash
# 1. 部署 production-entry 云函数
cd cloudfunctions/production-entry
npm install  # 如果需要
# 在微信开发者工具中右键上传并部署

# 2. 部署 breeding-todo 云函数
cd ../breeding-todo
npm install  # 如果需要
# 在微信开发者工具中右键上传并部署
```

### Step 2: 前端代码部署
```bash
# 在微信开发者工具中编译小程序代码
# 确保没有编译错误
```

### Step 3: 数据库权限配置
```json
// 在云开发控制台 -> 数据库 -> 权限管理中添加：
{
  "collection": "batch_todos",
  "read": true,
  "write": true
}
```

## 🧪 完整测试流程

### 测试 1: 入栏自动创建待办事项
```bash
1. 打开小程序 -> 入栏管理 -> 新增入栏
2. 填写表单：
   - 鹅苗品种：狮头鹅
   - 供应商：测试供应商
   - 采购数量：100
   - 单价：15.00
   - 入栏日期：今天
3. 提交表单
4. 预期结果：
   ✅ 显示"入栏记录创建成功，待办事项已自动生成"
   ✅ 云函数日志显示任务创建成功
```

### 测试 2: 查看今日待办事项
```bash
1. 打开小程序 -> 待办事项
2. 选择刚创建的批次
3. 查看"今日任务"标签页
4. 预期结果：
   ✅ 显示第1日龄的任务（入栏健康检查、葡萄糖水等）
   ✅ 可以切换任务完成状态
   ✅ 显示正确的日龄信息
```

### 测试 3: 查看即将到来的任务
```bash
1. 在待办事项页面切换到"即将到来"标签
2. 预期结果：
   ✅ 显示未来7天的任务安排
   ✅ 显示第2日龄的疫苗接种任务
   ✅ 显示第6日龄的重要疫苗任务
```

### 测试 4: 数据库验证
```bash
1. 打开云开发控制台 -> 数据库
2. 查看 batch_todos 集合
3. 预期结果：
   ✅ 有对应批次的任务记录
   ✅ 任务数量符合预期（约15-20个关键任务）
   ✅ 日龄分布从1到80
```

## 🐛 常见问题排查

### 问题 1: 待办事项没有自动创建
**排查步骤：**
```bash
1. 检查云函数日志：云开发控制台 -> 云函数 -> production-entry -> 日志
2. 查看错误信息：
   - "开始为批次 XXX 创建待办事项..." - 应该出现
   - "批次 XXX 待办事项创建完成" - 应该出现
3. 常见错误：
   - breeding-schedule.js 文件缺失
   - 数据库权限不足
   - 云函数超时
```

### 问题 2: 今日任务显示为空
**排查步骤：**
```bash
1. 检查 breeding-todo 云函数日志
2. 确认日龄计算是否正确
3. 检查 batch_todos 集合是否有数据
4. 验证用户ID匹配
```

### 问题 3: 任务完成状态无法切换
**排查步骤：**
```bash
1. 检查前端 taskId 字段映射
2. 验证 task_completions 集合权限
3. 检查 breeding-todo 云函数的 completeTask 方法
```

## 📊 性能优化建议

### 1. 批量创建优化
```javascript
// 已实现：分批插入避免超时
const batchSize = 20  // 每批20个任务
```

### 2. 查询优化
```javascript
// 建议添加数据库索引：
// batch_todos: batchId, dayAge, userId
// task_completions: batchId, dayAge, taskId
```

### 3. 缓存策略
```javascript
// 前端可考虑缓存当日任务，减少云函数调用
// 只在切换批次或刷新时重新获取
```

## 🔄 回滚计划

如果部署出现问题，可以快速回滚：

### 前端回滚
```bash
1. 恢复 breeding-todo.ts 的原始版本
2. 使用静态 breeding-schedule.js 配置
3. 临时禁用从云函数获取任务数据
```

### 云函数回滚
```bash
1. 恢复 production-entry/index.js 原始版本
2. 移除 createBatchTodos 函数调用
3. 保持原有入栏逻辑不变
```

## ✅ 部署验收标准

### 功能验收
- ✅ 入栏时自动创建80日龄待办事项
- ✅ 今日任务正确显示当前日龄任务
- ✅ 任务完成状态可以正常切换
- ✅ 即将到来的任务显示未来7天安排
- ✅ 不同批次的任务独立管理

### 性能验收
- ✅ 入栏创建耗时 < 10秒
- ✅ 任务加载耗时 < 3秒
- ✅ 状态切换响应 < 1秒

### 数据验收
- ✅ batch_todos 集合记录完整
- ✅ 日龄计算准确无误
- ✅ 任务完成状态同步正确

---

**部署负责人**：开发团队
**验收负责人**：产品团队
**预期部署时间**：30分钟
**预期验收时间**：1小时
