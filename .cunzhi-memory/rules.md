# 开发规范和规则

## ⚠️ 重要：所有开发工作必须严格遵循项目规范

**默认规则**：所有代码开发、功能实现、问题修复都必须遵循以下规范，无需额外说明。

---

## UI设计规范

- 微信小程序UI间距规范：1) 导航栏标准高度为44rpx，表单内容区padding-top应设为calc(var(--status-bar-height) + 44rpx)；2) 表单头部上边距应控制在8rpx左右，避免过大间距；3) TDesign按钮组件需要彻底移除outline和border，包括:focus、:active、:hover等所有交互状态；4) 响应式设计要与主样式保持一致的间距规范。
- TDesign按钮组件彻底移除蓝色边框的完整方案：1) 按钮容器.form-actions需要border: none !important; 2) 对按钮使用多层选择器覆盖(::deep和直接选择器); 3) 覆盖所有状态(:focus, :active, :hover, :visited, ::before, ::after); 4) 重置微信小程序原生button样式(-webkit-appearance: none); 5) 覆盖TDesign组件内部样式(.t-button__content, .t-button__text); 6) 使用通配符选择器覆盖所有子元素; 7) 默认按钮用轻微阴影替代边框保持视觉层次。
- 禁止使用粗边框（border-width > 2rpx）作为装饰性元素，应使用背景色、阴影或图标来区分。

---

## 微信小程序云开发规范

### 云函数规范
- **命名规范**：必须使用小写字母和下划线（如 `user_management`、`health_records`），禁止使用驼峰命名、拼音或中文。
- **基本结构**：必须使用 `cloud.DYNAMIC_CURRENT_ENV` 初始化，必须使用 `cloud.getWXContext()` 获取用户信息，必须使用 try-catch 进行错误处理。
- **超时和性能**：云函数最大超时时间20秒，建议3-10秒。复杂任务必须拆分，必须使用 async/await 处理异步操作。
- **错误处理**：必须返回统一格式 `{ success: boolean, data?: any, error?: string }`，必须记录错误日志。

### 数据库规范
- **集合命名**：必须使用 `shared-config/collections.js` 中定义的集合常量，**禁止硬编码集合名称**。
  - 正确：`db.collection(COLLECTIONS.WX_USERS)`
  - 错误：`db.collection('wx_users')` ❌
- **集合设计**：集合名称使用小写字母和下划线，嵌套深度不超过3层，单集合记录数建议不超过10万条。
- **字段设计**：字段命名使用小写字母和下划线，时间字段统一使用 `created_at`、`updated_at`、`deleted_at`。
- **查询优化**：必须使用 `.limit()` 限制返回数据量，必须使用 `.field()` 只查询需要的字段，必须使用分页查询避免一次性加载所有数据。
- **索引优化**：对高频查询字段必须建立索引，复合索引遵循最左匹配原则。

### 云存储规范
- 文件命名使用有意义的名称（如 `user_avatar_20250116.jpg`），避免中文文件名。
- 根据文件类型设置合适的权限，敏感文件仅允许创建者访问。

---

## TDesign组件规范

- **组件引入**：优先使用全局引入（在 `app.json` 中配置），按需使用局部引入。
- **组件使用**：必须优先使用TDesign提供的组件，确保UI一致性。禁止重复开发已有的组件功能。
- **组件定制**：使用 `custom-style` 属性自定义样式（虚拟化组件节点场景），使用外部样式类覆盖特定状态。
- **版本管理**：定期更新TDesign组件库至最新稳定版本，关注组件库更新日志和废弃API。

---

## 页面规范

### 页面结构
- 文件组织：`page-name.ts`、`page-name.wxml`、`page-name.scss`、`page-name.json`
- 必须精简首屏数据，使用分页加载长列表，提前请求首屏数据，合理使用缓存。

### 性能优化
- 必须使用 `wx:if` 而非 `hidden` 控制显示（`wx:if` 不渲染DOM）。
- 必须减少不必要的 `setData` 调用，合并多次 `setData` 调用。
- 避免在 `onPageScroll` 中执行复杂逻辑，禁止保留空的 `onPageScroll` 函数。
- 图片必须使用懒加载（`lazy-load`），禁止使用base64存储大图片。

---

## 分包和包大小限制

- **大小限制**（必须严格遵守）：
  - 主包大小：≤ 2MB
  - 单个分包大小：≤ 2MB
  - 总包大小：≤ 16MB
  - 单个文件：≤ 2MB

- **分包策略**：
  - 主包包含：小程序启动页、TabBar页面、公共组件和工具类、必需的基础库
  - 分包按业务模块划分：`packageProduction`、`packageHealth`、`packageUser` 等
  - 使用 `preloadRule` 预加载常用分包

- **优化要求**：
  - 删除未使用的代码和文件
  - 压缩图片资源（使用WebP格式），将大图片放到云存储或CDN
  - 避免引入大型第三方库，使用按需引入

---

## 性能优化指南

### 启动性能优化
- 必须使用分包加载，减少主包体积
- 必须开启按需加载（`lazyCodeLoading: "requiredComponents"`）
- 必须使用初始渲染缓存（`initialRenderingCache`）
- 必须使用骨架屏

### 运行时性能优化
- 必须减少 `setData` 调用次数和数据量
- 必须使用防抖和节流处理高频事件
- 图片必须使用合适的格式（WebP、PNG、JPG），必须使用懒加载

### 网络请求优化
- 合并请求，减少网络开销
- 使用请求缓存，避免重复请求

---

## 代码规范

### TypeScript规范
- 必须使用TypeScript定义类型，避免使用 `any` 类型
- 变量和函数使用驼峰命名（`userName`、`getUserInfo`）
- 常量使用大写下划线（`MAX_COUNT`、`API_BASE_URL`）
- 类型和接口使用大驼峰（`UserInfo`、`ApiResponse`）

### 代码风格
- 使用2个空格缩进
- 复杂逻辑必须添加注释
- 函数必须添加JSDoc注释

### 错误处理
- 所有异步操作必须处理错误
- 必须使用try-catch捕获异常
- 必须向用户展示友好的错误提示

---

## 安全规范

- **数据安全**：敏感数据必须通过云函数处理，禁止客户端直接操作敏感数据，必须使用数据库安全规则限制客户端权限
- **用户身份验证**：必须使用 `cloud.getWXContext()` 获取用户信息，禁止直接信任客户端传入的用户ID
- **接口安全**：必须验证请求参数的有效性，必须限制接口调用频率
- **存储安全**：敏感信息不得存储在本地缓存，必须定期清理过期缓存

---

## 数据库集合使用规范（重要）

**所有云函数必须引用统一的集合配置文件**：

```javascript
// ✅ 正确：引用配置文件
const { COLLECTIONS } = require('../../shared-config/collections.js');
const result = await db.collection(COLLECTIONS.WX_USERS).get();

// ❌ 错误：硬编码集合名称（禁止）
const result = await db.collection('wx_users').get();
```

**项目包含7大业务模块，共40个标准化集合**：
- 用户管理模块：`wx_` 或 `user_` 前缀
- 生产管理模块：`prod_` 前缀
- 健康管理模块：`health_` 前缀
- 财务管理模块：`finance_` 前缀
- 任务管理模块：`task_` 前缀
- 系统管理模块：`sys_` 前缀
- 文件管理模块：`file_` 前缀

---

## 参考文档

完整规范文档请参考：`PROJECT_RULES.md`

---

**⚠️ 记住：所有开发工作必须严格遵循以上规范，确保代码质量和系统稳定性！**
