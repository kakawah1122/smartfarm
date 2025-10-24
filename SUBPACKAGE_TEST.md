# 分包配置测试清单

## 重要说明

⚠️ **分包配置需要物理移动文件和更新所有页面跳转路径，风险较高，建议充分测试后再上线。**

## 分包配置方案

### 当前状态
- 主包：36个页面（超出限制）
- 分包：未配置
- 主包大小：需要检查

### 目标配置
- 主包：4个TabBar页面
- 5个分包：生产、健康、用户、财务、AI
- 每个分包 < 2MB
- 总包 < 30MB

---

## 一、分包结构规划

### 主包（4个页面）
```
pages/
  ├── index/          # 首页
  ├── production/     # 生产TabBar
  ├── health/         # 健康TabBar
  └── profile/        # 我的TabBar
```

### 生产管理分包（8个页面）
```
packageProduction/
  ├── entry-form/             # 入栏表单
  ├── exit-form/              # 出栏表单
  ├── purchase-form/          # 采购表单
  ├── material-use-form/      # 物料使用表单
  ├── material-records-list/  # 物料记录列表
  ├── entry-records-list/     # 入栏记录列表
  ├── exit-records-list/      # 出栏记录列表
  └── inventory-detail/       # 库存详情
```

### 健康管理分包（9个页面）
```
packageHealth/
  ├── vaccine-record/         # 疫苗记录
  ├── disinfection-record/    # 消毒记录
  ├── health-inspection/      # 健康巡查
  ├── health-care/            # 健康管理
  ├── treatment-record/       # 治疗记录
  ├── death-record/           # 死亡记录
  ├── recovery-management/    # 康复管理
  ├── survival-analysis/      # 存活分析
  └── breeding-todo/          # 待办事项
```

### 用户管理分包（7个页面）
```
packageUser/
  ├── login/                  # 登录
  ├── user-management/        # 用户管理
  ├── employee-permission/    # 员工权限
  ├── invite-management/      # 邀请管理
  ├── user-approval/          # 用户审批
  ├── role-management/        # 角色管理
  └── role-migration/         # 角色迁移
```

### 财务分析分包（4个页面）
```
packageFinance/
  ├── finance/                # 财务管理
  ├── cost-analysis/          # 成本分析
  ├── performance-analysis/   # 绩效分析
  └── production-dashboard/   # 生产仪表盘
```

### AI诊断分包（4个页面）
```
packageAI/
  ├── ai-diagnosis/           # AI诊断
  ├── diagnosis-history/      # 诊断历史
  └── weather-detail/         # 天气详情
```

---

## 二、文件移动清单

### 生产管理分包（8个页面）

| 原路径 | 新路径 | 状态 |
|--------|--------|------|
| `pages/entry-form/` | `packageProduction/entry-form/` | ⏸️ 待移动 |
| `pages/exit-form/` | `packageProduction/exit-form/` | ⏸️ 待移动 |
| `pages/purchase-form/` | `packageProduction/purchase-form/` | ⏸️ 待移动 |
| `pages/material-use-form/` | `packageProduction/material-use-form/` | ⏸️ 待移动 |
| `pages/material-records-list/` | `packageProduction/material-records-list/` | ⏸️ 待移动 |
| `pages/entry-records-list/` | `packageProduction/entry-records-list/` | ⏸️ 待移动 |
| `pages/exit-records-list/` | `packageProduction/exit-records-list/` | ⏸️ 待移动 |
| `pages/inventory-detail/` | `packageProduction/inventory-detail/` | ⏸️ 待移动 |

### 健康管理分包（9个页面）

| 原路径 | 新路径 | 状态 |
|--------|--------|------|
| `pages/vaccine-record/` | `packageHealth/vaccine-record/` | ⏸️ 待移动 |
| `pages/disinfection-record/` | `packageHealth/disinfection-record/` | ⏸️ 待移动 |
| `pages/health-inspection/` | `packageHealth/health-inspection/` | ⏸️ 待移动 |
| `pages/health-care/` | `packageHealth/health-care/` | ⏸️ 待移动 |
| `pages/treatment-record/` | `packageHealth/treatment-record/` | ⏸️ 待移动 |
| `pages/death-record/` | `packageHealth/death-record/` | ⏸️ 待移动 |
| `pages/recovery-management/` | `packageHealth/recovery-management/` | ⏸️ 待移动 |
| `pages/survival-analysis/` | `packageHealth/survival-analysis/` | ⏸️ 待移动 |
| `pages/breeding-todo/` | `packageHealth/breeding-todo/` | ⏸️ 待移动 |

### 用户管理分包（7个页面）

| 原路径 | 新路径 | 状态 |
|--------|--------|------|
| `pages/login/` | `packageUser/login/` | ⏸️ 待移动 |
| `pages/user-management/` | `packageUser/user-management/` | ⏸️ 待移动 |
| `pages/employee-permission/` | `packageUser/employee-permission/` | ⏸️ 待移动 |
| `pages/invite-management/` | `packageUser/invite-management/` | ⏸️ 待移动 |
| `pages/user-approval/` | `packageUser/user-approval/` | ⏸️ 待移动 |
| `pages/role-management/` | `packageUser/role-management/` | ⏸️ 待移动 |
| `pages/role-migration/` | `packageUser/role-migration/` | ⏸️ 待移动 |

### 财务分析分包（4个页面）

| 原路径 | 新路径 | 状态 |
|--------|--------|------|
| `pages/finance/` | `packageFinance/finance/` | ⏸️ 待移动 |
| `pages/cost-analysis/` | `packageFinance/cost-analysis/` | ⏸️ 待移动 |
| `pages/performance-analysis/` | `packageFinance/performance-analysis/` | ⏸️ 待移动 |
| `pages/production-dashboard/` | `packageFinance/production-dashboard/` | ⏸️ 待移动 |

### AI诊断分包（4个页面）

| 原路径 | 新路径 | 状态 |
|--------|--------|------|
| `pages/ai-diagnosis/` | `packageAI/ai-diagnosis/` | ⏸️ 待移动 |
| `pages/diagnosis-history/` | `packageAI/diagnosis-history/` | ⏸️ 待移动 |
| `pages/weather-detail/` | `packageAI/weather-detail/` | ⏸️ 待移动 |

---

## 三、app.json配置更新

### 更新前
```json
{
  "pages": [
    "pages/index/index",
    "pages/weather-detail/weather-detail",
    "pages/production/production",
    ...36个页面
  ]
}
```

### 更新后
```json
{
  "pages": [
    "pages/index/index",
    "pages/production/production",
    "pages/health/health",
    "pages/profile/profile"
  ],
  "subpackages": [
    {
      "root": "packageProduction",
      "name": "production",
      "pages": [
        "entry-form/entry-form",
        "exit-form/exit-form",
        "purchase-form/purchase-form",
        "material-use-form/material-use-form",
        "material-records-list/material-records-list",
        "entry-records-list/entry-records-list",
        "exit-records-list/exit-records-list",
        "inventory-detail/inventory-detail"
      ]
    },
    {
      "root": "packageHealth",
      "name": "health",
      "pages": [
        "vaccine-record/vaccine-record",
        "disinfection-record/disinfection-record",
        "health-inspection/health-inspection",
        "health-care/health-care",
        "treatment-record/treatment-record",
        "death-record/death-record",
        "recovery-management/recovery-management",
        "survival-analysis/survival-analysis",
        "breeding-todo/breeding-todo"
      ]
    },
    {
      "root": "packageUser",
      "name": "user",
      "pages": [
        "login/login",
        "user-management/user-management",
        "employee-permission/employee-permission",
        "invite-management/invite-management",
        "user-approval/user-approval",
        "role-management/role-management",
        "role-migration/role-migration"
      ]
    },
    {
      "root": "packageFinance",
      "name": "finance",
      "pages": [
        "finance/finance",
        "cost-analysis/cost-analysis",
        "performance-analysis/performance-analysis",
        "production-dashboard/production-dashboard"
      ]
    },
    {
      "root": "packageAI",
      "name": "ai",
      "pages": [
        "ai-diagnosis/ai-diagnosis",
        "diagnosis-history/diagnosis-history",
        "weather-detail/weather-detail"
      ]
    }
  ],
  "preloadRule": {
    "pages/index/index": {
      "network": "all",
      "packages": ["production", "health"]
    },
    "pages/production/production": {
      "network": "all",
      "packages": ["production"]
    },
    "pages/health/health": {
      "network": "all",
      "packages": ["health"]
    }
  }
}
```

---

## 四、路径更新清单

需要搜索并替换所有页面跳转路径（预计103处）：

### 更新规则

| 原路径 | 新路径 |
|--------|--------|
| `/pages/entry-form/entry-form` | `/packageProduction/entry-form/entry-form` |
| `/pages/exit-form/exit-form` | `/packageProduction/exit-form/exit-form` |
| `/pages/login/login` | `/packageUser/login/login` |
| `/pages/ai-diagnosis/ai-diagnosis` | `/packageAI/ai-diagnosis/ai-diagnosis` |
| ... | ... |

### 需要更新的文件类型
- `.ts` 文件：`wx.navigateTo()`, `wx.redirectTo()`, `wx.reLaunch()`
- `.wxml` 文件：`<navigator url="...">`
- `.json` 文件：可能的页面引用

---

## 五、测试用例

### 5.1 TabBar切换测试

| 测试项 | 操作步骤 | 预期结果 | 状态 |
|--------|----------|----------|------|
| 切换到首页 | 点击底部TabBar"首页" | 正常进入首页 | ⏸️ 待测试 |
| 切换到生产 | 点击底部TabBar"生产" | 正常进入生产页面 | ⏸️ 待测试 |
| 切换到健康 | 点击底部TabBar"健康" | 正常进入健康页面 | ⏸️ 待测试 |
| 切换到我的 | 点击底部TabBar"我的" | 正常进入个人中心 | ⏸️ 待测试 |

### 5.2 主包到分包跳转测试

| 测试项 | 起始页面 | 目标页面 | 操作 | 状态 |
|--------|----------|----------|------|------|
| 首页到AI诊断 | index | packageAI/ai-diagnosis | 点击AI诊断卡片 | ⏸️ 待测试 |
| 生产到入栏 | production | packageProduction/entry-form | 点击入栏记录按钮 | ⏸️ 待测试 |
| 健康到疫苗 | health | packageHealth/vaccine-record | 点击疫苗接种按钮 | ⏸️ 待测试 |
| 我的到登录 | profile | packageUser/login | 未登录时跳转 | ⏸️ 待测试 |

### 5.3 分包内跳转测试

| 测试项 | 起始页面 | 目标页面 | 操作 | 状态 |
|--------|----------|----------|------|------|
| 入栏表单到入栏列表 | entry-form | entry-records-list | 提交成功后跳转 | ⏸️ 待测试 |
| 健康巡查到治疗 | health-inspection | treatment-record | 发现异常，记录治疗 | ⏸️ 待测试 |
| 用户管理到角色管理 | user-management | role-management | 点击角色配置 | ⏸️ 待测试 |

### 5.4 分包间跳转测试

| 测试项 | 起始页面 | 目标页面 | 操作 | 状态 |
|--------|----------|----------|------|------|
| 生产到健康 | packageProduction | packageHealth | 批次健康管理 | ⏸️ 待测试 |
| 健康到财务 | packageHealth | packageFinance | 治疗成本统计 | ⏸️ 待测试 |
| AI诊断到治疗 | packageAI/ai-diagnosis | packageHealth/treatment-record | AI诊断后跳转治疗 | ⏸️ 待测试 |

### 5.5 参数传递测试

| 测试项 | 起始页面 | 目标页面 | 传递参数 | 验证方法 | 状态 |
|--------|----------|----------|----------|----------|------|
| 批次详情传递 | index | packageProduction/entry-form | batchNumber | 检查表单是否正确回显 | ⏸️ 待测试 |
| 诊断ID传递 | ai-diagnosis | diagnosis-history | diagnosisId | 检查历史记录定位 | ⏸️ 待测试 |
| 用户ID传递 | user-management | employee-permission | userId | 检查权限页面用户信息 | ⏸️ 待测试 |

### 5.6 返回导航测试

| 测试项 | 操作步骤 | 预期结果 | 状态 |
|--------|----------|----------|------|
| 分包页面返回 | 在分包页面点击返回 | 正确返回到上一页 | ⏸️ 待测试 |
| 多层导航返回 | 多层跳转后返回 | 正确维护页面栈 | ⏸️ 待测试 |
| 返回到TabBar | 从分包返回到首页 | 正确切换到TabBar页面 | ⏸️ 待测试 |

### 5.7 分包大小检查

| 检查项 | 限制 | 实际大小 | 状态 |
|--------|------|----------|------|
| 主包大小 | < 2MB | 待测量 | ⏸️ 待检查 |
| 生产分包 | < 2MB | 待测量 | ⏸️ 待检查 |
| 健康分包 | < 2MB | 待测量 | ⏸️ 待检查 |
| 用户分包 | < 2MB | 待测量 | ⏸️ 待检查 |
| 财务分包 | < 2MB | 待测量 | ⏸️ 待检查 |
| AI分包 | < 2MB | 待测量 | ⏸️ 待检查 |
| 总包大小 | < 30MB | 待测量 | ⏸️ 待检查 |

### 5.8 分包加载性能测试

| 测试项 | 测试条件 | 性能指标 | 状态 |
|--------|----------|----------|------|
| 首次加载分包 | 4G网络 | < 2秒 | ⏸️ 待测试 |
| 预下载分包 | WiFi网络 | 后台加载不影响使用 | ⏸️ 待测试 |
| 分包切换 | 已加载分包间切换 | 瞬时响应 | ⏸️ 待测试 |

---

## 六、常见问题排查

### 问题1：页面跳转404
- **原因**：路径未更新或更新错误
- **排查**：
  1. 检查 app.json 中页面路径配置
  2. 检查跳转代码中的路径
  3. 确认分包文件已正确移动

### 问题2：分包加载失败
- **原因**：分包配置错误
- **排查**：
  1. 检查 subpackages 配置中的 root 和 pages
  2. 确认分包目录结构正确
  3. 检查分包是否超过2MB限制

### 问题3：参数传递失败
- **原因**：URL参数格式错误
- **排查**：
  1. 检查参数拼接是否正确
  2. 确认目标页面 onLoad 中是否正确接收参数
  3. 注意URL编码问题

### 问题4：页面栈溢出
- **原因**：过多使用 navigateTo
- **解决**：
  1. 使用 redirectTo 替代部分 navigateTo
  2. 合理使用 reLaunch 重置页面栈
  3. 页面栈最大10层

---

## 七、实施步骤

### 阶段1：准备工作（1-2天）
1. ✅ 完整备份项目代码
2. ⏸️ 创建测试分支
3. ⏸️ 确认所有页面路径引用位置

### 阶段2：目录重组（半天）
1. ⏸️ 创建5个分包根目录
2. ⏸️ 移动32个页面文件到对应分包
3. ⏸️ 验证文件完整性

### 阶段3：配置更新（半天）
1. ⏸️ 更新 app.json 分包配置
2. ⏸️ 添加 preloadRule 预下载配置
3. ⏸️ 批量更新页面跳转路径（103处）

### 阶段4：测试验证（1-2天）
1. ⏸️ 执行完整测试用例
2. ⏸️ 检查分包大小
3. ⏸️ 性能测试
4. ⏸️ 修复发现的问题

### 阶段5：上线部署（半天）
1. ⏸️ 合并到主分支
2. ⏸️ 提交审核
3. ⏸️ 灰度发布
4. ⏸️ 监控线上表现

---

## 八、回滚方案

如果分包配置出现严重问题，需要快速回滚：

1. **代码回滚**：
   ```bash
   git revert <commit-hash>
   ```

2. **紧急修复**：
   - 恢复 app.json 为原始配置
   - 将分包页面移回 pages 目录
   - 恢复所有路径更新

3. **版本管理**：
   - 保留备份版本
   - 快速切换回稳定版本

---

## 九、后续优化

分包配置完成后，可以进一步优化：

1. **独立分包**：将不依赖主包的分包设为独立分包
2. **分包异步化**：非关键分包延迟加载
3. **资源优化**：图片等大资源使用CDN
4. **代码分割**：进一步拆分大文件

---

## 相关文档

- [DATABASE_SETUP.md](./DATABASE_SETUP.md) - 数据库集合配置指引
- [DATABASE_INDEX.md](./DATABASE_INDEX.md) - 数据库索引配置指引
- [shared-config/collections.js](./shared-config/collections.js) - 统一集合配置文件
- [微信小程序官方文档 - 分包加载](https://developers.weixin.qq.com/miniprogram/dev/framework/subpackages.html)

