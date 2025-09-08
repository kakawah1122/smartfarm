# 开发规范和规则

- 微信小程序UI间距规范：1) 导航栏标准高度为44rpx，表单内容区padding-top应设为calc(var(--status-bar-height) + 44rpx)；2) 表单头部上边距应控制在8rpx左右，避免过大间距；3) TDesign按钮组件需要彻底移除outline和border，包括:focus、:active、:hover等所有交互状态；4) 响应式设计要与主样式保持一致的间距规范。
- TDesign按钮组件彻底移除蓝色边框的完整方案：1) 按钮容器.form-actions需要border: none !important; 2) 对按钮使用多层选择器覆盖(::deep和直接选择器); 3) 覆盖所有状态(:focus, :active, :hover, :visited, ::before, ::after); 4) 重置微信小程序原生button样式(-webkit-appearance: none); 5) 覆盖TDesign组件内部样式(.t-button__content, .t-button__text); 6) 使用通配符选择器覆盖所有子元素; 7) 默认按钮用轻微阴影替代边框保持视觉层次。
