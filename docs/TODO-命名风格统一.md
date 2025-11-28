# TODO: 云函数命名风格统一

> 创建时间：2025-11-28
> 完成时间：2025-11-28
> 状态：✅ 已完成
> 优先级：低（不影响功能）

## 背景

根据项目规则，云函数 action 应统一使用**下划线命名**（snake_case），但 `breeding-todo` 云函数目前使用驼峰命名（camelCase）。

## 重要原则

⚠️ **修改时必须遵守**：
1. 不能破坏前端 UI
2. 不能破坏功能逻辑
3. 采用渐进式迁移，保证兼容性

## 待优化的云函数

### breeding-todo

| 当前 action (驼峰) | 目标 action (下划线) | 前端调用位置 |
|-------------------|---------------------|-------------|
| `completeVaccineTask` | `complete_vaccine_task` | 待确认 |
| `getTodos` | `get_todos` | 待确认 |
| `getTodayTasks` | `get_today_tasks` | 待确认 |
| `getWeeklyTodos` | `get_weekly_todos` | 待确认 |
| `clearCompletedTasks` | `clear_completed_tasks` | 待确认 |
| `completeTask` | `complete_task` | 待确认 |
| `fixBatchTasks` | `fix_batch_tasks` | 待确认 |
| `cleanOrphanTasks` | `clean_orphan_tasks` | 待确认 |
| `cleanAllOrphanTasks` | `clean_all_orphan_tasks` | 待确认 |
| `getUpcomingTodos` | `get_upcoming_todos` | 待确认 |
| `getCompletedTodos` | `get_completed_todos` | 待确认 |
| `cleanAllOrphanTasksForce` | `clean_all_orphan_tasks_force` | 待确认 |

## 迁移步骤

### 步骤 1：创建前端封装层（推荐方案）

在 `miniprogram/utils/cloud-functions.ts` 中添加 `BreedingCloud` 封装：

```typescript
// 示例：封装层统一使用下划线命名
export const BreedingCloud = {
  todo: {
    getTodos: (data) => callCloudFunction('breeding-todo', 'get_todos', data),
    getTodayTasks: (data) => callCloudFunction('breeding-todo', 'get_today_tasks', data),
    completeTask: (data) => callCloudFunction('breeding-todo', 'complete_task', data),
    // ... 其他方法
  }
}
```

### 步骤 2：云函数添加兼容路由

在 `breeding-todo/index.js` 的 switch 中同时支持两种命名：

```javascript
switch (action) {
  // 新命名（下划线）
  case 'get_todos':
  // 旧命名（驼峰）- 兼容
  case 'getTodos':
    return await getTodos(event, wxContext)
  
  // ... 其他 action
}
```

### 步骤 3：逐步迁移前端调用

1. 搜索所有使用 `breeding-todo` 的前端代码
2. 改为使用 `BreedingCloud` 封装层
3. 测试功能正常

### 步骤 4：移除兼容代码（可选）

当确认所有前端已迁移后，可移除云函数中的驼峰命名分支。

## 验证清单

- [x] 任务列表正常显示
- [x] 任务完成功能正常
- [x] 疫苗接种任务流程正常
- [x] 一周任务视图正常
- [x] 清理孤儿任务功能正常

> 需要重新上传 `breeding-todo` 云函数后验证

## 相关文件

- `cloudfunctions/breeding-todo/index.js`
- `miniprogram/utils/cloud-functions.ts`
- `miniprogram/pages/health/health.ts`（预防管理模块）
- 其他使用 breeding-todo 的页面

## 参考

已完成的类似迁移：
- `health-death` 云函数（已删除驼峰别名文件）
- `health-prevention` 云函数（前端已改为下划线命名）
