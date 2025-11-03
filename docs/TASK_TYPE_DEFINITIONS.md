# 任务类型定义规范

## 📋 类型映射表

| 类型代码 | 显示名称 | 颜色 | 使用场景 | 数量（breeding-schedule） |
|---------|---------|------|---------|--------------------------|
| `vaccine` | 疫苗 | 深蓝色 `#0052d9` | 疫苗接种、免疫注射 | 3 |
| `medication` / `medicine` | 用药 | 红色 `#e64343` | 药物治疗、用药管理 | 31 |
| `nutrition` | 营养 | 橙色 `#ff9900` | 营养补充、葡萄糖水等 | 1 |
| `care` | 护理 | 粉色 `#ec407a` | 特殊护理、弱苗护理 | 59 |
| `feeding` | 喂养 | 绿色 `#00a870` | 饲喂管理 | 12 |
| `inspection` / `health` | 巡检/检查 | 青色 `#34c49a` | 健康检查、巡检 | 1 |
| `disinfection` | 消毒 | 紫色 `#a269e3` | 环境消毒 | 0 |
| `cleaning` | 清洁 | 棕色 `#8b6e4f` | 清洁工作 | 0 |
| `other` | 其他 | 灰色 `#666666` | 其他任务 | 0 |

## 🔧 定义位置

### 1. WXS 模块（WXML 渲染使用）
**文件**：`miniprogram/pages/health/health-utils.wxs`

```javascript
function getTypeName(type) {
  var TYPE_NAMES = {
    'vaccine': '疫苗',
    'medication': '用药',
    'medicine': '用药',
    'nutrition': '营养',
    'disinfection': '消毒',
    'inspection': '巡检',
    'cleaning': '清洁',
    'feeding': '喂养',
    'care': '护理',
    'health': '检查',
    'other': '其他'
  }
  return TYPE_NAMES[type] || '其他'
}
```

### 2. TypeScript 页面逻辑
**文件**：`miniprogram/pages/health/health.ts`

```typescript
getTypeName(type: string): string {
  const TYPE_NAMES: { [key: string]: string } = {
    vaccine: '疫苗',
    medication: '用药',
    nutrition: '营养',
    disinfection: '消毒',
    inspection: '巡检',
    cleaning: '清洁',
    feeding: '喂养',
    care: '护理',
    other: '其他'
  }
  return TYPE_NAMES[type] || '其他'
}
```

### 3. 工具函数库
**文件**：`miniprogram/utils/health-utils.ts`

```typescript
export function getTaskTypeName(type: string): string {
  const typeMap: Record<string, string> = {
    'vaccine': '疫苗',
    'medication': '用药',
    'medicine': '用药',
    'nutrition': '营养',
    'inspection': '巡检',
    'disinfection': '消毒',
    'cleaning': '清洁',
    'feeding': '喂养',
    'care': '护理',
    'health': '检查',
    'other': '其他'
  }
  return typeMap[type] || '其他'
}
```

### 4. 样式定义
**文件**：`miniprogram/pages/health/health.scss`

```scss
/* 疫苗 - 深蓝色 */
.type-badge.type-vaccine {
  background: rgba(0, 82, 217, 0.12);
  color: #0052d9;
  border-color: rgba(0, 82, 217, 0.2);
}

/* 用药 - 红色 */
.type-badge.type-medication,
.type-badge.type-medicine {
  background: rgba(230, 67, 67, 0.12);
  color: #e64343;
  border-color: rgba(230, 67, 67, 0.2);
}

/* 营养 - 橙色 */
.type-badge.type-nutrition {
  background: rgba(255, 153, 0, 0.12);
  color: #ff9900;
  border-color: rgba(255, 153, 0, 0.2);
}

/* 护理 - 粉色 */
.type-badge.type-care {
  background: rgba(236, 64, 122, 0.12);
  color: #ec407a;
  border-color: rgba(236, 64, 122, 0.2);
}

/* 喂养 - 绿色 */
.type-badge.type-feeding {
  background: rgba(0, 168, 112, 0.12);
  color: #00a870;
  border-color: rgba(0, 168, 112, 0.2);
}

/* 巡检 - 青色 */
.type-badge.type-inspection {
  background: rgba(52, 196, 154, 0.12);
  color: #34c49a;
  border-color: rgba(52, 196, 154, 0.2);
}

/* 消毒 - 紫色 */
.type-badge.type-disinfection {
  background: rgba(162, 105, 227, 0.12);
  color: #a269e3;
  border-color: rgba(162, 105, 227, 0.2);
}

/* 清洁 - 棕色 */
.type-badge.type-cleaning {
  background: rgba(139, 110, 79, 0.12);
  color: #8b6e4f;
  border-color: rgba(139, 110, 79, 0.2);
}

/* 其他 - 灰色 */
.type-badge.type-other {
  background: rgba(150, 150, 150, 0.12);
  color: #666666;
  border-color: rgba(150, 150, 150, 0.2);
}

/* 健康(兼容旧代码) */
.type-badge.type-health {
  background: rgba(0, 168, 112, 0.12);
  color: #00a870;
  border-color: rgba(0, 168, 112, 0.2);
}
```

## ✅ 一致性检查清单

添加新类型时，必须同时更新以下4个位置：

- [ ] `miniprogram/pages/health/health-utils.wxs` - WXS 模块
- [ ] `miniprogram/pages/health/health.ts` - getTypeName 方法
- [ ] `miniprogram/utils/health-utils.ts` - getTaskTypeName 函数
- [ ] `miniprogram/pages/health/health.scss` - 样式定义

## 🎨 颜色设计原则

1. **医疗相关**：蓝色系、红色系（疫苗、用药）
2. **营养补充**：橙色系（营养、葡萄糖）
3. **日常护理**：粉色、绿色（护理、喂养）
4. **环境管理**：紫色、棕色（消毒、清洁）
5. **检查巡视**：青色（巡检、健康检查）
6. **通用默认**：灰色（其他）

## 📝 使用建议

1. **优先使用标准类型**：避免使用 `other`
2. **兼容性别名**：`medicine` = `medication`，`health` = `inspection`
3. **简洁命名**：标签显示使用简短名称（疫苗、用药），避免"疫苗管理"
4. **类型扩展**：新增类型时参考现有颜色设计原则

## 🔄 最近更新

- 2025-11-03: 统一所有类型定义，修复 "疫苗管理" → "疫苗" 等命名不一致问题
- 2025-11-03: 添加 `medicine` 作为 `medication` 的别名
- 2025-11-03: 添加 `health` 作为 `inspection` 的别名

