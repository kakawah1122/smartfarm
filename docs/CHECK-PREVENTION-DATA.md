# 🔍 手动检查预防统计数据

## 方案1：云开发控制台数据库查询（推荐）

### 步骤：

1. **打开云开发控制台**
   - 微信开发者工具 → 云开发

2. **进入数据库**
   - 点击左侧"数据库"

3. **选择集合**
   - 找到 `health_prevention_records` 集合
   - 点击进入

4. **查看数据**
   - 查看是否有记录
   - 检查 `preventionType` 字段的值

### 📋 手动查询命令

在数据库查询框中执行：

```javascript
// 查询medication类型记录
db.collection('health_prevention_records').where({
  preventionType: 'medication'
}).get()

// 查询vaccine类型记录
db.collection('health_prevention_records').where({
  preventionType: 'vaccine'
}).get()

// 查看所有记录的preventionType
db.collection('health_prevention_records').limit(20).get()
```

## 方案2：小程序控制台查看日志

### 已添加的调试日志：

1. **重新编译小程序**
2. **打开调试模式**（真机调试或开发者工具）
3. **进入健康管理页面**
4. **点击"预防管理"标签**
5. **查看Console控制台**

### 应该看到的日志：

```
=== 开始获取预防统计数据 ===
当前批次ID: all
=== 云函数返回的原始数据 ===
medication返回: {...}
vaccine返回: {...}
all返回: {...}
✅ medication数量: 10
✅ vaccine数量: 20
📊 最终设置的统计数据: {...}
```

如果看到：
```
⚠️ 真实数据为0，使用测试数据展示
```
说明数据库确实没有数据。

## 方案3：添加测试数据

### 在数据库控制台添加记录：

1. 点击"health_prevention_records"集合
2. 点击"添加记录"
3. 粘贴以下JSON：

**测试medication记录：**
```json
{
  "preventionType": "medication",
  "medicationName": "测试药品A",
  "dosage": "10ml",
  "quantity": 100,
  "batchId": "all",
  "costInfo": {
    "totalCost": 200
  },
  "createTime": "2025-11-21T00:00:00.000Z",
  "isDeleted": false
}
```

**测试vaccine记录：**
```json
{
  "preventionType": "vaccine",
  "vaccineName": "测试疫苗B",
  "vaccineInfo": {
    "vaccinatedCount": 50
  },
  "batchId": "all",
  "costInfo": {
    "totalCost": 500
  },
  "createTime": "2025-11-21T00:00:00.000Z",
  "isDeleted": false
}
```

## 方案4：临时显示测试数据

代码已修改，现在如果真实数据为0会自动显示测试数据：
- 防疫用药：25
- 疫苗追踪：120

这样至少能确认UI功能正常。

## 🚨 常见问题

### 1. preventionType字段值不对
可能的值：
- ❌ "treatment"（治疗，不是预防）
- ❌ "disinfection"（消毒）
- ✅ "medication"（用药）
- ✅ "vaccine"（疫苗）

### 2. isDeleted字段影响
确保记录的`isDeleted`不是`true`

### 3. batchId不匹配
检查记录的`batchId`字段

## 📝 反馈信息

请告诉我：
1. 控制台看到的日志内容
2. 数据库中是否有记录
3. preventionType字段的实际值
4. 是否显示了测试数据（25/120）
