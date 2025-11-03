# 修复 QY-20251103 批次任务的详细步骤

## 问题现状
- 第2日龄显示24个任务（应该只有3个）
- 任务可能被重复创建或错误拆分

## 解决方案

### 步骤1：找到批次ID

1. 打开**微信开发者工具**
2. 点击**云开发** → **数据库**
3. 选择 `production_batch_entries` 集合（或 `prod_batch_entries`）
4. 在查询框输入：
```json
{
  "batchNumber": "QY-20251103"
}
```
5. 点击**查询**
6. **记录下** `_id` 字段的值（例如：`abc123def456789`）

### 步骤2：删除该批次的所有任务

1. 在云开发控制台，选择 `task_batch_schedules` 集合
2. 在查询框输入（替换为实际的批次ID）：
```json
{
  "batchId": "你的批次_id"
}
```
3. 点击**查询**
4. 确认显示的都是 QY-20251103 批次的任务
5. 点击**删除** → **删除查询结果**
6. 确认删除

### 步骤3：重新创建任务

#### 方法A：使用云函数（推荐）

1. 点击**云开发** → **云函数**
2. 找到并选择 `production-entry` 云函数
3. 点击右上角的**测试**按钮
4. 在"云函数测试参数"中输入（替换为实际的批次ID）：
```json
{
  "action": "fixBatchTasks",
  "batchId": "你的批次_id"
}
```
5. 点击**测试**按钮
6. 查看返回结果，应该显示：
```json
{
  "success": true,
  "data": {
    "batchId": "...",
    "batchNumber": "QY-20251103",
    "oldTaskCount": 0,
    "newTaskCount": X
  },
  "message": "批次 QY-20251103 任务修复成功..."
}
```

#### 方法B：直接在数据库控制台插入

如果方法A不work，可以临时创建一个云函数：

1. 在云函数列表中，点击**新建云函数**
2. 命名为 `temp-fix-tasks`
3. 将 `index.js` 内容替换为：

```javascript
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 从 production-entry 复制任务创建逻辑
const { BREEDING_SCHEDULE, getTasksByAge, getAllTaskDays } = require('../production-entry/breeding-schedule')

exports.main = async (event, context) => {
  const batchId = event.batchId  // 替换为你的批次ID
  
  try {
    // 获取批次信息
    const batchResult = await db.collection('production_batch_entries')
      .doc(batchId)
      .get()
    
    if (!batchResult.data) {
      throw new Error('批次不存在')
    }
    
    const batch = batchResult.data
    console.log('批次信息:', batch.batchNumber, batch.entryDate)
    
    // 删除现有任务
    await db.collection('task_batch_schedules')
      .where({ batchId })
      .remove()
    
    console.log('已删除现有任务')
    
    // 创建新任务
    const batchTodos = []
    const now = new Date()
    const taskDays = getAllTaskDays()
    
    for (const dayAge of taskDays) {
      const tasks = getTasksByAge(dayAge)
      const entryDateTime = new Date(batch.entryDate + 'T00:00:00')
      const taskDate = new Date(entryDateTime.getTime() + (dayAge - 1) * 24 * 60 * 60 * 1000)
      
      for (const task of tasks) {
        batchTodos.push({
          batchId,
          batchNumber: batch.batchNumber,
          dayAge,
          taskId: task.id,
          type: task.type,
          priority: task.priority,
          title: task.title,
          description: task.description,
          category: task.category,
          estimatedTime: task.estimatedTime || 0,
          materials: task.materials || [],
          dosage: task.dosage || '',
          duration: task.duration || 1,
          dayInSeries: task.dayInSeries || 1,
          notes: task.notes || '',
          scheduledDate: taskDate.toISOString().split('T')[0],
          targetDate: taskDate.toISOString().split('T')[0],
          status: 'pending',
          isCompleted: false,
          completed: false,
          completedAt: null,
          completedBy: null,
          completionNotes: '',
          createdBy: context.OPENID,
          createTime: now,
          updateTime: now
        })
      }
    }
    
    // 批量插入
    if (batchTodos.length > 0) {
      const batchSize = 20
      for (let i = 0; i < batchTodos.length; i += batchSize) {
        const batch = batchTodos.slice(i, i + batchSize)
        await db.collection('task_batch_schedules').add({
          data: batch
        })
      }
    }
    
    console.log('创建任务成功:', batchTodos.length, '个')
    
    return {
      success: true,
      taskCount: batchTodos.length,
      message: `成功创建 ${batchTodos.length} 个任务`
    }
    
  } catch (error) {
    console.error('修复失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
```

4. 右键点击云函数，选择**上传并部署：云端安装依赖**
5. 部署完成后，点击**测试**
6. 在测试参数中输入：
```json
{
  "batchId": "你的批次_id"
}
```
7. 点击测试
8. 完成后删除这个临时云函数

### 步骤4：验证结果

1. 回到 `task_batch_schedules` 集合
2. 查询该批次第2日龄的任务：
```json
{
  "batchId": "你的批次_id",
  "dayAge": 2
}
```
3. 应该只显示**3个任务**：
   - 小鹅瘟疫苗第一针
   - 开口药第一天  
   - 弱苗特殊护理

### 步骤5：清除小程序缓存

1. 在微信开发者工具中
2. 点击**清缓存** → **清除数据缓存**
3. 重新编译小程序
4. 进入健康管理页面
5. 查看任务列表

## 预期结果

- 第1日龄：3个任务
- 第2日龄：3个任务
- 第3日龄：2个任务
- ...

每个日龄的任务数量应该与设计相符，不再有重复。

## 如果还有问题

如果完成上述步骤后仍有问题，请：

1. 截图显示：
   - 数据库中的任务数量
   - 小程序中显示的任务列表
   
2. 提供：
   - 批次_id
   - 具体哪个日龄有问题
   - 显示了多少个任务

我会进一步协助排查。

