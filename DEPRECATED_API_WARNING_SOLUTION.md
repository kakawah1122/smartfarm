# wx.getSystemInfoSync 弃用警告解决方案

## 📋 问题描述

升级微信开发者工具后，出现警告：
```
⚠️ wx.getSystemInfoSync is deprecated. Please use wx.getSystemSetting/wx.getAppAuthorizeSetting/wx.getDeviceInfo/wx.getWindowInfo/wx.getAppBaseInfo instead.
```

## 🔍 问题分析

### 1. 代码检查结果 ✅

经过全面扫描，**你的项目代码已经完全迁移到新 API**：

- `app.ts` - 使用 `wx.getWindowInfo()` ✅
- `pages/index/index.ts` - 使用 `wx.getWindowInfo()` ✅  
- `components/navigation-bar/navigation-bar.ts` - 使用 `wx.getWindowInfo()` ✅
- `utils/navigation.ts` - 使用 `wx.getWindowInfo()` ✅

### 2. 警告来源分析

从控制台输出的 `@ VM922:1` 可以判断，警告来自**动态编译的代码**，可能来源：

1. **TDesign 组件库** (tdesign-miniprogram v1.10.1)
   - 组件库内部可能使用了旧 API
   - 需要更新到最新版本

2. **微信开发者工具自身**
   - 工具内置的检查机制
   - 可能存在误报

3. **编译缓存**
   - 旧版本编译产物残留

## 🛠️ 解决方案

### 方案一：更新 TDesign 组件库（推荐）

```bash
cd miniprogram
npm update tdesign-miniprogram
```

然后在微信开发者工具中：
1. 点击菜单 `工具` -> `构建 npm`
2. 等待构建完成

### 方案二：清理缓存

1. **清理微信开发者工具缓存**
   - 关闭微信开发者工具
   - 点击菜单 `设置` -> `清除缓存` -> 选择全部清除
   - 重启开发者工具

2. **清理项目编译产物**
   ```bash
   # 删除 miniprogram_npm 目录
   rm -rf miniprogram/miniprogram_npm
   
   # 重新构建
   cd miniprogram
   npm install
   ```
   
   然后在开发者工具中重新 `构建 npm`

3. **清理小程序缓存**
   - 在模拟器中点击 `清除缓存`
   - 或者点击 `编译` 按钮旁的下拉菜单 -> `清除缓存`

### 方案三：检查是否真的影响功能

1. **验证功能是否正常**
   - 测试状态栏高度显示
   - 测试导航栏布局
   - 测试位置权限获取

2. **查看警告详情**
   - 点击警告信息，查看完整的调用栈
   - 确定具体是哪个模块触发的

## 📊 API 迁移对照表

微信官方新的系统信息 API 分类：

| 旧 API | 新 API | 用途 |
|--------|--------|------|
| `wx.getSystemInfoSync()` | `wx.getWindowInfo()` | 获取窗口信息（宽高、像素比等） |
| | `wx.getDeviceInfo()` | 获取设备信息（品牌、型号、系统等） |
| | `wx.getAppBaseInfo()` | 获取小程序基础信息（版本号、语言等） |
| | `wx.getSystemSetting()` | 获取系统设置（主题、定位开关等） |
| | `wx.getAppAuthorizeSetting()` | 获取授权设置（位置、相机等权限） |

## ✅ 项目当前状态

### 已完成的迁移

```typescript
// ✅ app.ts
setStatusBarHeight() {
  const windowInfo = wx.getWindowInfo()
  const statusBarHeight = windowInfo.statusBarHeight || 44
  // ...
}

// ✅ navigation-bar.ts
onLoad() {
  const windowInfo = wx.getWindowInfo()
  const menuButtonInfo = wx.getMenuButtonBoundingClientRect()
  // ...
}
```

### 配置信息

- **基础库版本**: 3.10.3 ✅（最新稳定版）
- **TypeScript**: 已启用 ✅
- **编译方式**: 实时编译 ✅
- **TDesign 版本**: 1.10.1

## 🎯 建议操作步骤

按优先级执行以下步骤：

### 第一步：快速验证（5分钟）

```bash
# 1. 在微信开发者工具中
工具 -> 清除缓存 -> 清除全部缓存

# 2. 点击 "编译" 旁的下拉菜单 -> 清除缓存

# 3. 重新编译
点击 "编译" 按钮
```

### 第二步：更新依赖（10分钟）

```bash
# 1. 更新 TDesign
cd miniprogram
npm update tdesign-miniprogram

# 2. 查看更新后的版本
npm list tdesign-miniprogram

# 3. 重新构建 npm
在开发者工具中: 工具 -> 构建 npm
```

### 第三步：深度清理（如果问题仍存在）

```bash
# 1. 完全清理
cd miniprogram
rm -rf miniprogram_npm
rm -rf node_modules
rm package-lock.json

# 2. 重新安装
npm install

# 3. 重新构建
在开发者工具中: 工具 -> 构建 npm

# 4. 重启开发者工具
```

## 💡 其他注意事项

### 1. 关于性能警告

截图中还看到：
```
[Violation] 'message' handler took 374ms
```

这是性能警告，表示某个消息处理函数执行时间过长。建议：
- 检查 `onLoad`、`onShow` 等生命周期函数
- 优化数据查询和处理逻辑
- 考虑使用异步加载和懒加载

### 2. 关于子包预加载

看到你配置了子包预加载：
```
preloadSubpackages: production, health, ai
```

这会在启动时增加加载时间，建议根据实际使用频率调整预加载策略。

### 3. VM922:1 警告

这类警告通常来自：
- 动态执行的代码（eval）
- 组件库内部实现
- 开发者工具的检查机制

如果功能正常，可以暂时忽略，等待组件库或开发者工具更新。

## 📝 验证清单

完成以上步骤后，请验证：

- [ ] 警告是否消失或减少
- [ ] 页面状态栏高度显示正常
- [ ] 导航栏布局正确
- [ ] 位置权限获取正常
- [ ] 天气功能正常
- [ ] 所有页面加载正常

## 🔗 相关资源

- [微信官方：系统信息 API 升级说明](https://developers.weixin.qq.com/miniprogram/dev/api/base/system/system-info/wx.getSystemInfoSync.html)
- [TDesign 小程序组件库](https://github.com/Tencent/tdesign-miniprogram)
- [微信开发者工具更新日志](https://developers.weixin.qq.com/miniprogram/dev/devtools/stable.html)

## 📞 后续支持

如果问题仍然存在，请提供：
1. 完整的警告堆栈信息
2. 微信开发者工具版本号
3. 基础库版本号
4. 具体触发警告的操作步骤

---

**创建日期**: 2025-10-25  
**状态**: 待验证  
**优先级**: 中等（不影响功能，但建议解决）

