# 🔧 养殖待办事项系统故障排除指南

## ✅ 已解决的问题

### 1. TDesign 组件路径错误
**问题**: `t-card` 组件找不到
**原因**: TDesign 小程序版本不包含 card 组件
**解决方案**: 
- ✅ 移除了 `t-card` 组件引用
- ✅ 使用原生 `view` + CSS 样式实现卡片效果
- ✅ 保持了相同的视觉效果

## 🚀 系统验证清单

### 必要文件检查
- ✅ `utils/breeding-schedule.js` - 核心配置文件
- ✅ `pages/breeding-todo/breeding-todo.json` - 页面配置
- ✅ `pages/breeding-todo/breeding-todo.wxml` - 页面结构
- ✅ `pages/breeding-todo/breeding-todo.scss` - 样式文件
- ✅ `pages/breeding-todo/breeding-todo.ts` - 页面逻辑
- ✅ `cloudfunctions/breeding-todo/index.js` - 后端逻辑
- ✅ `app.json` 中添加了页面路由

### 依赖组件检查
使用的 TDesign 组件都已验证存在：
- ✅ `t-navbar` - 导航栏
- ✅ `t-tabs` - 标签页
- ✅ `t-tab-panel` - 标签页面板
- ✅ `t-badge` - 徽章
- ✅ `t-tag` - 标签
- ✅ `t-button` - 按钮
- ✅ `t-icon` - 图标
- ✅ `t-checkbox` - 复选框
- ✅ `t-dialog` - 对话框
- ✅ `t-overlay` - 遮罩层
- ✅ `t-loading` - 加载组件
- ✅ `t-empty` - 空状态
- ✅ `t-divider` - 分割线

## 🔍 可能遇到的问题及解决方案

### 1. 页面无法访问
**症状**: 点击"查看全部"无反应或报错
**可能原因**:
- 页面路由未正确添加到 `app.json`
- 页面文件路径错误

**解决方案**:
```json
// 确认 app.json 中包含
"pages/breeding-todo/breeding-todo"
```

### 2. 云函数调用失败
**症状**: 任务数据无法加载
**可能原因**:
- 云函数未部署
- 数据库集合不存在

**解决方案**:
```bash
# 部署云函数
wx-cli cloud deploy --function breeding-todo

# 或手动在开发者工具中右键上传
```

### 3. 数据库集合缺失
**症状**: 任务完成状态无法保存
**需要创建的集合**:
- `task_completions` - 任务完成记录
- `task_records` - 任务执行记录

**解决方案**:
在云开发控制台创建这些集合，权限设置为"所有用户可读，仅创建者可写"

### 4. 批次数据为空
**症状**: 批次选择器显示为空
**可能原因**:
- `entry_records` 集合没有数据
- 云函数 `production-entry` 不存在

**解决方案**:
确保生产管理模块正常工作，有入栏记录数据

### 5. 样式显示异常
**症状**: 页面布局混乱
**可能原因**:
- SCSS 编译问题
- 组件样式冲突

**解决方案**:
检查开发者工具的样式编译是否正常

## 🛠️ 调试方法

### 1. 控制台日志检查
打开开发者工具控制台，查看以下日志：
```javascript
// 页面加载日志
console.log('养殖待办事项页面加载', options)

// 数据加载日志  
console.log('加载今日养殖任务失败:', error)

// 云函数调用日志
console.log('breeding-todo云函数调用:', { action, event })
```

### 2. 网络请求检查
在开发者工具 Network 面板检查：
- 云函数调用是否成功
- 返回数据格式是否正确
- 是否有权限错误

### 3. 数据验证
确认数据结构正确：
```javascript
// 批次数据结构
{
  id: 'string',
  batchNumber: 'string', 
  entryDate: 'YYYY-MM-DD',
  currentCount: number
}

// 任务数据结构
{
  id: 'string',
  title: 'string',
  type: 'string',
  priority: 'critical|high|medium|low'
}
```

## 📋 快速测试步骤

### 1. 基础功能测试
1. 打开小程序首页
2. 检查"今日待办"卡片是否显示
3. 点击"查看全部"跳转是否正常
4. 批次选择器是否工作

### 2. 任务管理测试
1. 选择一个批次
2. 检查今日任务是否显示
3. 勾选任务完成状态
4. 查看"即将到来"和"历史记录"

### 3. 交互测试
1. 展开任务详情
2. 点击"开始执行"
3. 点击"添加记录"
4. 切换不同 Tab

## 🚨 紧急修复

如果系统完全无法使用，可以快速回退到基础版本：

### 1. 简化页面版本
移除复杂功能，只保留基础的任务列表显示

### 2. 使用静态数据
临时使用硬编码的任务数据，避免云函数依赖

### 3. 降级处理
如果某些组件有问题，可以用更简单的原生组件替代

## 📞 获取帮助

如果问题仍然存在：
1. 检查微信开发者工具版本是否最新
2. 确认云开发环境配置正确
3. 查看详细错误日志
4. 对比其他正常工作的页面配置

## 🔄 版本更新

当前版本: v1.0.0
- ✅ 基础任务管理功能
- ✅ 多批次支持
- ✅ 优先级颜色区分
- ✅ 任务完成状态跟踪

下一版本计划:
- 🔄 任务提醒推送
- 🔄 更多任务类型支持
- 🔄 数据导出功能

---

**如有其他问题，请参考项目中的其他文档或联系技术支持。**
