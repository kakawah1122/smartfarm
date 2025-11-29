# TypeScript 类型重构清单

> 创建时间: 2025-11-29
> 备份标签: `backup-before-type-refactor-v1`
> 回退命令: `git reset --hard backup-before-type-refactor-v1`

---

## 📋 重构目标

移除所有 `@ts-nocheck` 指令，为大型文件添加完整类型定义，遵循微信小程序 TypeScript 最佳实践。

---

## 🔧 Phase 1: 基础设施准备

### 1.1 创建通用类型定义文件
- [ ] 创建 `typings/cloud-response.d.ts` - 云函数响应类型
- [ ] 创建 `typings/page-types.d.ts` - Page/Component 扩展类型
- [ ] 创建 `typings/business.d.ts` - 业务数据类型

### 1.2 创建 Behaviors 模块
- [ ] 创建 `miniprogram/behaviors/timer-behavior.ts` - 定时器管理 Behavior
- [ ] 在需要定时器的 Component 中引入 Behavior

---

## 🔧 Phase 2: Component 文件重构（优先级高）

### 2.1 lifecycle-task-edit.ts (496行) ✅ 已完成
- [x] 移除 @ts-nocheck
- [x] 使用 timer-behavior 替代 _timerIds
- [x] 定义 TaskTemplate, TaskTypeOption, PriorityOption 接口
- [x] 修复所有类型错误
- [ ] 测试功能正常

### 2.2 lifecycle-management.ts (1092行) ⏸️ 待深入重构
- [ ] 移除 @ts-nocheck (40+ 类型错误，需要更系统的重构)
- ℹ️ 已有 Task, TaskGroup, Template 接口定义
- ℹ️ 使用全局变量 scrollTimer 而非 Component 内部属性

---

## 🔧 Phase 3: Page 文件重构（使用 createPageWithNavbar）

### 3.1 ai-diagnosis.ts (1387行)
- [ ] 移除 @ts-nocheck
- [ ] 定义 DiagnosisData 接口
- [ ] 定义 DiagnosisResult 接口
- [ ] 定义 CloudResponse 泛型类型
- [ ] 修复 error 类型断言
- [ ] 测试功能正常

### 3.2 finance.ts (1772行)
- [ ] 移除 @ts-nocheck
- [ ] 定义 FinanceRecord 接口
- [ ] 定义 ApprovalItem 接口
- [ ] 定义 FinanceOverview 接口
- [ ] 修复所有 unknown 类型访问
- [ ] 测试功能正常

### 3.3 treatment-record.ts (2276行)
- [ ] 移除 @ts-nocheck
- [ ] 定义 TreatmentRecord 接口
- [ ] 定义 MedicationInfo 接口
- [ ] 修复所有类型错误
- [ ] 测试功能正常

---

## 🔧 Phase 4: 大型 Page 文件重构

### 4.1 breeding-todo.ts (2420行)
- [ ] 移除 @ts-nocheck
- [ ] 复用已有的 Task, VaccineFormData 接口
- [ ] 定义 BatchInfo 扩展接口
- [ ] 定义 MaterialItem 接口
- [ ] 修复所有类型错误
- [ ] 测试功能正常

### 4.2 health.ts (4000行)
- [ ] 移除 @ts-nocheck
- [ ] 复用已有的 HealthStats, PreventionStats 接口
- [ ] 定义 PageData 完整接口
- [ ] 修复所有类型错误
- [ ] 测试功能正常

### 4.3 production.ts (1357行)
- [ ] 移除 @ts-nocheck
- [ ] 定义 ProductionData 接口
- [ ] 定义 BatchEntry, BatchExit 接口
- [ ] 修复所有类型错误
- [ ] 测试功能正常

---

## 📝 通用类型定义参考

### 云函数响应类型
```typescript
// typings/cloud-response.d.ts
interface CloudResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface PaginatedResponse<T> extends CloudResponse<T[]> {
  total?: number;
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
}
```

### 定时器 Behavior
```typescript
// behaviors/timer-behavior.ts
export const timerBehavior = Behavior({
  data: {
    _timerIds: [] as number[]
  },
  methods: {
    _safeSetTimeout(callback: () => void, delay: number): number {
      const timerId = setTimeout(() => {
        const index = this.data._timerIds.indexOf(timerId)
        if (index > -1) {
          this.data._timerIds.splice(index, 1)
        }
        callback()
      }, delay) as unknown as number
      this.data._timerIds.push(timerId)
      return timerId
    },
    _clearAllTimers() {
      this.data._timerIds.forEach((id: number) => clearTimeout(id))
      this.setData({ _timerIds: [] })
    }
  },
  lifetimes: {
    detached() {
      this._clearAllTimers()
    }
  }
})
```

---

## ✅ 验收标准

1. 所有文件无 @ts-nocheck 指令
2. TypeScript 编译无错误
3. 所有页面功能正常
4. UI 布局样式无变化

---

## 📊 进度跟踪

| Phase | 文件数 | 完成数 | 状态 |
|-------|--------|--------|------|
| Phase 1 | 3 | 3 | ✅ 完成 |
| Phase 2 | 2 | 1 | 🟡 进行中 (1/2) |
| Phase 3 | 3 | 0 | ⏳ 待开始 |
| Phase 4 | 3 | 0 | ⏳ 待开始 |

---

## 🔄 回退策略

如果任何阶段出现问题：
```bash
# 回退到备份点
git reset --hard backup-before-type-refactor-v1
```
