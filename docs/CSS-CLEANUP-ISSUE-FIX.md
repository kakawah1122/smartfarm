# CSS清理脚本问题及修复方案

## 🔴 问题分析

### 发现的问题
1. **WXSS编译错误**: `Error: expected "{"`
2. **原因**: 清理脚本错误地删除了CSS选择器内容，导致语法破坏

### 具体案例
```scss
// 原始代码
&.alert-high {
  background: #fef0f0;
  border-left: 4rpx solid #e34d59;
}
&.alert-medium {
  background: #fff7e6;
  border-left: 4rpx solid #ed7b2f;
}

// 被错误清理后
&
&
```

### 根本原因
清理脚本的正则表达式过于激进：
```javascript
// 错误的模式
new RegExp(`\\.${className}\\s*\\{[^}]*\\}`, 'g')
```
这个模式会删除整个CSS块，而不是只删除特定的类选择器。

## ✅ 修复方案

### 1. 立即回滚（已完成）
```bash
git checkout -- miniprogram/**/*.scss
```

### 2. 脚本修复策略

#### 问题点分析
- **不应该删除**：嵌套选择器中的修饰类（如 `.parent .alert-high`）
- **不应该删除**：伪类选择器的一部分（如 `&.alert-high`）
- **应该删除**：独立的未使用类定义

#### 改进方案
1. **使用AST解析**：使用PostCSS等工具解析CSS，而不是正则表达式
2. **只删除顶级选择器**：不处理嵌套结构
3. **人工审查**：生成删除建议列表，人工确认后再删除

### 3. 安全的清理方法

#### 方法一：生成报告不自动删除
```javascript
// 只扫描和报告，不自动删除
function scanUnusedClasses(cssFile, unusedClasses) {
  const content = fs.readFileSync(cssFile, 'utf8');
  const found = [];
  
  unusedClasses.forEach(className => {
    if (content.includes(`.${className}`)) {
      found.push({
        file: cssFile,
        className: className,
        line: findLineNumber(content, className)
      });
    }
  });
  
  return found;
}
```

#### 方法二：使用CSS工具链
```bash
# 使用 PurgeCSS 等专业工具
npx purgecss --css **/*.css --content **/*.wxml --output build/
```

### 4. 临时解决方案

暂时采用**手动清理**方式：
1. 使用扫描脚本找出未使用的类
2. 生成详细报告（文件、行号）
3. 开发者手动审查并删除

## 📝 经验教训

1. **不要使用正则表达式处理结构化语言**
   - CSS/SCSS有复杂的嵌套结构
   - 正则无法正确理解上下文

2. **分步骤验证**
   - 先扫描，后删除
   - 每次只处理少量文件
   - 立即测试验证

3. **备份的重要性**
   - 幸好有备份和Git版本控制
   - 能快速回滚避免更大损失

## 🔧 下一步行动

1. **暂停自动清理**
   - 不再使用当前的清理脚本
   - 等待更安全的方案

2. **评估专业工具**
   - 研究 PurgeCSS
   - 研究 PostCSS 插件
   - 考虑使用 AST 解析

3. **手动清理计划**
   - 优先清理明显未使用的大块CSS
   - 保留所有可能动态使用的类
   - 逐个文件审查

## ⚠️ 注意事项

- 微信小程序的动态类名难以检测
- TDesign组件可能在运行时添加类名
- 条件渲染的类名在静态分析中可能遗漏
