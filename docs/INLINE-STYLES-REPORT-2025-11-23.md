# 内联样式分析报告

生成时间: 11/23/2025, 11:02:15 AM

## 📊 统计概览

- 扫描文件数: 111
- 内联样式总数: 245
- 静态样式: 21 个（可以移除）
- 动态样式: 142 个（需要保留）
- 混合样式: 82 个（部分可移除）

## 🎯 优化机会

可以优化的内联样式数量: **103** 个

---

## 📝 详细分析

### 1. 静态内联样式（21个）- 建议全部移除

这些样式完全是静态的，应该移到CSS文件中。

#### 1. miniprogram/components/skeleton/skeleton.wxml (行 9)
```html
style="width: 60%;"
```
**建议：移动到CSS文件中**

#### 2. miniprogram/components/skeleton/skeleton.wxml (行 10)
```html
style="width: 40%; height: 24rpx; margin-top: 12rpx;"
```
**建议：移动到CSS文件中**

#### 3. miniprogram/components/skeleton/skeleton.wxml (行 14)
```html
style="width: 100%;"
```
**建议：移动到CSS文件中**

#### 4. miniprogram/components/skeleton/skeleton.wxml (行 15)
```html
style="width: 80%;"
```
**建议：移动到CSS文件中**

#### 5. miniprogram/components/skeleton/skeleton.wxml (行 16)
```html
style="width: 60%;"
```
**建议：移动到CSS文件中**

#### 6. miniprogram/components/skeleton/skeleton.wxml (行 25)
```html
style="width: 100%;"
```
**建议：移动到CSS文件中**

#### 7. miniprogram/components/skeleton/skeleton.wxml (行 26)
```html
style="width: 70%; height: 28rpx; margin-top: 12rpx;"
```
**建议：移动到CSS文件中**

#### 8. miniprogram/components/skeleton/skeleton.wxml (行 37)
```html
style="width: 80rpx; height: 40rpx;"
```
**建议：移动到CSS文件中**

#### 9. miniprogram/components/skeleton/skeleton.wxml (行 38)
```html
style="width: 60rpx; height: 24rpx; margin-top: 8rpx;"
```
**建议：移动到CSS文件中**

#### 10. miniprogram/components/skeleton/skeleton.wxml (行 60)
```html
style="width: 200rpx; height: 44rpx;"
```
**建议：移动到CSS文件中**

#### 11. miniprogram/components/skeleton/skeleton.wxml (行 61)
```html
style="width: 120rpx; height: 32rpx; margin-top: 16rpx;"
```
**建议：移动到CSS文件中**

#### 12. miniprogram/components/skeleton/skeleton.wxml (行 64)
```html
style="width: 150rpx; height: 36rpx; margin-bottom: 20rpx;"
```
**建议：移动到CSS文件中**

#### 13. miniprogram/components/skeleton/skeleton.wxml (行 65)
```html
style="width: 100%;"
```
**建议：移动到CSS文件中**

#### 14. miniprogram/components/skeleton/skeleton.wxml (行 66)
```html
style="width: 90%;"
```
**建议：移动到CSS文件中**

#### 15. miniprogram/components/skeleton/skeleton.wxml (行 67)
```html
style="width: 75%;"
```
**建议：移动到CSS文件中**

#### 16. miniprogram/miniprogram_npm/tdesign-miniprogram/action-sheet/template/grid.wxml (行 1)
```html
style="height: 456rpx"
```
**建议：移动到CSS文件中**

#### 17. miniprogram/miniprogram_npm/tdesign-miniprogram/dropdown-item/dropdown-item.wxml (行 1)
```html
style="position: absolute"
```
**建议：移动到CSS文件中**

#### 18. miniprogram/miniprogram_npm/tdesign-miniprogram/image/image.wxml (行 1)
```html
style="font-size: 44rpx"
```
**建议：移动到CSS文件中**

#### 19. miniprogram/miniprogram_npm/tdesign-miniprogram/upload/upload.wxml (行 1)
```html
style="width: 100%"
```
**建议：移动到CSS文件中**

#### 20. miniprogram/miniprogram_npm/tdesign-miniprogram/upload/upload.wxml (行 1)
```html
style="width: 100%"
```
**建议：移动到CSS文件中**

#### 21. miniprogram/miniprogram_npm/tdesign-miniprogram/watermark/watermark.wxml (行 1)
```html
style="display: none; width: 100%; height: 100%"
```
**建议：移动到CSS文件中**

### 2. 混合内联样式（82个）- 部分可优化

这些样式包含动态和静态部分，静态部分可以提取。

#### 1. miniprogram/components/form-item/form-item.wxml (行 5)
```html
style="width: {{labelWidth}}"
```
**建议：保留（动态样式）**

#### 2. miniprogram/components/form-item/form-item.wxml (行 11)
```html
style="text-align: {{contentAlign}}"
```
**建议：保留（动态样式）**

#### 3. miniprogram/components/lazy-load/lazy-load.wxml (行 2)
```html
style="min-height: {{minHeight}}"
```
**建议：保留（动态样式）**

#### 4. miniprogram/components/loading-animation/loading-animation.wxml (行 53)
```html
style="width: {{progress}}%"
```
**建议：保留（动态样式）**

#### 5. miniprogram/components/navigation-bar/navigation-bar.wxml (行 2)
```html
style="padding-top: {{statusBarHeight}}px;"
```
**建议：保留（动态样式）**

#### 6. miniprogram/components/navigation-bar/navigation-bar.wxml (行 3)
```html
style="height: {{navBarHeight}}px;"
```
**建议：保留（动态样式）**

#### 7. miniprogram/components/navigation-bar/navigation-bar.wxml (行 17)
```html
style="width: {{capsuleRight}}px;"
```
**建议：保留（动态样式）**

#### 8. miniprogram/components/price-trend-chart/price-trend-chart.wxml (行 2)
```html
style="height: {{height}}px;"
```
**建议：保留（动态样式）**

#### 9. miniprogram/components/skeleton/skeleton.wxml (行 48)
```html
style="width: {{100/columns}}%;"
```
**建议：保留（动态样式）**

#### 10. miniprogram/components/skeleton/skeleton.wxml (行 51)
```html
style="width: {{100/columns}}%;"
```
**建议：保留（动态样式）**

#### 11. miniprogram/components/virtual-list/virtual-list.wxml (行 5)
```html
style="height: {{height}}px;"
```
**建议：保留（动态样式）**

#### 12. miniprogram/components/virtual-list/virtual-list.wxml (行 16)
```html
style="height: {{topHeight}}px;"
```
**建议：保留（动态样式）**

#### 13. miniprogram/components/virtual-list/virtual-list.wxml (行 24)
```html
style="height: {{itemHeight}}px;"
```
**建议：保留（动态样式）**

#### 14. miniprogram/components/virtual-list/virtual-list.wxml (行 35)
```html
style="height: {{bottomHeight}}px;"
```
**建议：保留（动态样式）**

#### 15. miniprogram/components/weather-card/weather-card.wxml (行 7)
```html
style="left: {{item * 3.33}}%; animation-delay: {{item * 0.1}}s; animation-duration: {{0.5 + (item % 3) * 0.2}}s;"
```
**建议：保留（动态样式）**

#### 16. miniprogram/components/weather-card/weather-card.wxml (行 12)
```html
style="left: {{item * 5}}%; animation-delay: {{item * 0.2}}s; animation-duration: {{3 + (item % 3)}}s;"
```
**建议：保留（动态样式）**

#### 17. miniprogram/miniprogram_npm/tdesign-miniprogram/action-sheet/template/grid.wxml (行 1)
```html
style="--td-grid-item-text-color: {{item.color}}"
```
**建议：保留（动态样式）**

#### 18. miniprogram/miniprogram_npm/tdesign-miniprogram/action-sheet/template/grid.wxml (行 1)
```html
style="--td-grid-item-text-color: {{item.color}}"
```
**建议：保留（动态样式）**

#### 19. miniprogram/miniprogram_npm/tdesign-miniprogram/cascader/cascader.wxml (行 1)
```html
style="width: {{items.length + 1}}00vw; transform: translateX(-{{stepIndex}}00vw)"
```
**建议：保留（动态样式）**

#### 20. miniprogram/miniprogram_npm/tdesign-miniprogram/cascader/cascader.wxml (行 1)
```html
style="height: {{_optionsHeight}}px"
```
**建议：保留（动态样式）**

#### 21. miniprogram/miniprogram_npm/tdesign-miniprogram/color-picker/template.wxml (行 1)
```html
style="background: hsl({{sliderInfo.value}}, 100%, 50%)"
```
**建议：保留（动态样式）**

#### 22. miniprogram/miniprogram_npm/tdesign-miniprogram/color-picker/template.wxml (行 1)
```html
style="background: linear-gradient(90deg, rgba(0,0,0,.0) 0%, rgba(0,0,0,.0) 93%, {{alphaSliderStyle.color}} 93%, {{alphaSliderStyle.color}} 100%)"
```
**建议：保留（动态样式）**

#### 23. miniprogram/miniprogram_npm/tdesign-miniprogram/color-picker/template.wxml (行 1)
```html
style="background: linear-gradient(to right, rgba(0, 0, 0, 0), {{alphaSliderStyle.color}})"
```
**建议：保留（动态样式）**

#### 24. miniprogram/miniprogram_npm/tdesign-miniprogram/color-picker/template.wxml (行 1)
```html
style="background: {{previewColor}}"
```
**建议：保留（动态样式）**

#### 25. miniprogram/miniprogram_npm/tdesign-miniprogram/color-picker/template.wxml (行 1)
```html
style="background-color: {{swatch}};"
```
**建议：保留（动态样式）**

#### 26. miniprogram/miniprogram_npm/tdesign-miniprogram/dropdown-item/dropdown-item.wxml (行 1)
```html
style="grid-template-columns: repeat({{optionsColumns}}, 1fr)"
```
**建议：保留（动态样式）**

#### 27. miniprogram/miniprogram_npm/tdesign-miniprogram/dropdown-item/dropdown-item.wxml (行 1)
```html
style="grid-template-columns: repeat({{optionsColumns}}, 1fr)"
```
**建议：保留（动态样式）**

#### 28. miniprogram/miniprogram_npm/tdesign-miniprogram/fab/template/draggable.wxml (行 1)
```html
style="right: 16px; bottom: 32px; {{_._style([style, customStyle, moveStyle])}}"
```
**建议：可提取静态部分到CSS：right: 16px; bottom: 32px**

#### 29. miniprogram/miniprogram_npm/tdesign-miniprogram/fab/template/view.wxml (行 1)
```html
style="right: 16px; bottom: 32px; {{_._style([style, customStyle])}}"
```
**建议：可提取静态部分到CSS：right: 16px; bottom: 32px**

#### 30. miniprogram/miniprogram_npm/tdesign-miniprogram/loading/loading.wxml (行 1)
```html
style="width: {{ _.addUnit(size) }}; height: {{ _.addUnit(size) }}; {{inheritColor ? 'color: inherit;' : ''}} {{indicator ? '' : 'display: none;'}} {{duration ? 'animation-duration: ' + duration / 1000 + 's;' : ''}} animation-play-state: {{pause ? 'paused' : 'running'}};"
```
**建议：保留（动态样式）**

#### 31. miniprogram/miniprogram_npm/tdesign-miniprogram/loading/loading.wxml (行 1)
```html
style="{{duration ? 'animation-duration: ' + duration/1000 + 's; animation-delay:' + 0 + 's;' : ''}} animation-play-state: {{pause ? 'paused' : 'running'}};"
```
**建议：可提取静态部分到CSS：animation-delay:' + 0 + 's**

#### 32. miniprogram/miniprogram_npm/tdesign-miniprogram/loading/loading.wxml (行 1)
```html
style="{{duration ? 'animation-duration: ' + duration/1000 + 's; animation-delay:' + duration * 1 / 3000 + 's;' : ''}} animation-play-state: {{pause ? 'paused' : 'running'}};"
```
**建议：可提取静态部分到CSS：animation-delay:' + duration * 1 / 3000 + 's**

#### 33. miniprogram/miniprogram_npm/tdesign-miniprogram/loading/loading.wxml (行 1)
```html
style="{{duration ? 'animation-duration: ' + duration/1000 + 's; animation-delay:' + duration * 2 / 3000 + 's;' : ''}} animation-play-state: {{pause ? 'paused' : 'running'}};"
```
**建议：可提取静态部分到CSS：animation-delay:' + duration * 2 / 3000 + 's**

#### 34. miniprogram/miniprogram_npm/tdesign-miniprogram/message-item/message-item.wxml (行 1)
```html
style="text-align: {{align}}"
```
**建议：保留（动态样式）**

#### 35. miniprogram/miniprogram_npm/tdesign-miniprogram/picker/template.wxml (行 1)
```html
style="height: {{pickItemHeight}}px"
```
**建议：保留（动态样式）**

#### 36. miniprogram/miniprogram_npm/tdesign-miniprogram/picker-item/picker-item.wxml (行 1)
```html
style="transition: transform {{ duration }}ms cubic-bezier(0.215, 0.61, 0.355, 1); transform: translate3d(0, {{ offset }}px, 0)"
```
**建议：保留（动态样式）**

#### 37. miniprogram/miniprogram_npm/tdesign-miniprogram/picker-item/picker-item.wxml (行 1)
```html
style="height: {{pickItemHeight}}px"
```
**建议：保留（动态样式）**

#### 38. miniprogram/miniprogram_npm/tdesign-miniprogram/progress/progress.wxml (行 1)
```html
style="height: {{heightBar}}px;border-radius: {{heightBar}}px;background-color: {{bgColorBar}}"
```
**建议：保留（动态样式）**

#### 39. miniprogram/miniprogram_npm/tdesign-miniprogram/progress/progress.wxml (行 1)
```html
style="background: {{colorBar}}; width: {{computedProgress + '%'}}"
```
**建议：保留（动态样式）**

#### 40. miniprogram/miniprogram_npm/tdesign-miniprogram/progress/progress.wxml (行 1)
```html
style="height: {{heightBar}}px;border-radius: {{heightBar}}px;background-color: {{bgColorBar}}"
```
**建议：保留（动态样式）**

#### 41. miniprogram/miniprogram_npm/tdesign-miniprogram/progress/progress.wxml (行 1)
```html
style="background: {{colorBar}}; width: {{computedProgress}}%"
```
**建议：保留（动态样式）**

#### 42. miniprogram/miniprogram_npm/tdesign-miniprogram/progress/progress.wxml (行 1)
```html
style="{{_this.getCircleStyle(size, heightBar)}}; background-image: conic-gradient(from var(--td-progress-circle-from), {{colorCircle || _this.STATUS_COLOR[status] || 'var(--td-progress-inner-bg-color)'}} {{computedProgress}}%, {{bgColorBar || 'var(--td-progress-track-bg-color)'}} 0%);"
```
**建议：保留（动态样式）**

#### 43. miniprogram/miniprogram_npm/tdesign-miniprogram/pull-down-refresh/pull-down-refresh.wxml (行 1)
```html
style="height: {{tipsHeight}}px"
```
**建议：保留（动态样式）**

#### 44. miniprogram/miniprogram_npm/tdesign-miniprogram/qrcode/qrcode.wxml (行 1)
```html
style="{{_._style([style, customStyle])}} width:{{size}}px; height: {{size}}px; background-color: {{bgColor}};"
```
**建议：保留（动态样式）**

#### 45. miniprogram/miniprogram_npm/tdesign-miniprogram/rate/rate.wxml (行 1)
```html
style="margin-right: {{ count - index > 1 ? _.addUnit(gap) : 0 }}; {{utils.getColor(color)}}"
```
**建议：保留（动态样式）**

#### 46. miniprogram/miniprogram_npm/tdesign-miniprogram/rate/rate.wxml (行 1)
```html
style="left: {{tipsLeft}}px"
```
**建议：保留（动态样式）**

#### 47. miniprogram/miniprogram_npm/tdesign-miniprogram/swiper/swiper.wxml (行 1)
```html
style="height: {{_.addUnit(height)}}"
```
**建议：保留（动态样式）**

#### 48. miniprogram/miniprogram_npm/tdesign-miniprogram/tab-bar-item/tab-bar-item.wxml (行 1)
```html
style="height: {{iconOnly ? 24 : 20}}px"
```
**建议：保留（动态样式）**

#### 49. miniprogram/miniprogram_npm/tdesign-miniprogram/tabs/tabs.wxml (行 1)
```html
style="{{ _tabs.animate({duration: animation.duration, currentIndex:currentIndex}) }}"
```
**建议：保留（动态样式）**

#### 50. miniprogram/miniprogram_npm/tdesign-miniprogram/upload/upload.wxml (行 1)
```html
style="width: {{100 / column}}%; --td-upload-drag-transition-duration: {{transition.duration}}ms; --td-upload-drag-transition-timing-function: {{transition.timingFunction}}"
```
**建议：保留（动态样式）**

#### 51. miniprogram/miniprogram_npm/tdesign-miniprogram/upload/upload.wxml (行 1)
```html
style="width: {{100 / column}}%"
```
**建议：保留（动态样式）**

#### 52. miniprogram/packageAI/weather-detail/weather-detail.wxml (行 101)
```html
style="left: {{airData.progress}}%;"
```
**建议：保留（动态样式）**

#### 53. miniprogram/packageAI/weather-detail/weather-detail.wxml (行 173)
```html
style="width: {{item.tempProgress}}%;"
```
**建议：保留（动态样式）**

#### 54. miniprogram/packageFinance/cost-analysis/cost-analysis.wxml (行 68)
```html
style="background-color: {{item.color}}"
```
**建议：保留（动态样式）**

#### 55. miniprogram/packageFinance/cost-analysis/cost-analysis.wxml (行 85)
```html
style="background-color: {{item.color}}"
```
**建议：保留（动态样式）**

#### 56. miniprogram/packageFinance/cost-analysis/cost-analysis.wxml (行 96)
```html
style="width: {{item.percentage}}%; background-color: {{item.color}}"
```
**建议：保留（动态样式）**

#### 57. miniprogram/packageFinance/cost-analysis/cost-analysis.wxml (行 116)
```html
style="height: {{item.prevention / 200}}rpx"
```
**建议：保留（动态样式）**

#### 58. miniprogram/packageFinance/cost-analysis/cost-analysis.wxml (行 120)
```html
style="height: {{item.treatment / 200}}rpx"
```
**建议：保留（动态样式）**

#### 59. miniprogram/packageHealth/breeding-todo/breeding-todo.wxml (行 44)
```html
style="width: {{allCompletionPercentage}}%"
```
**建议：保留（动态样式）**

#### 60. miniprogram/packageHealth/health-inspection/health-inspection.wxml (行 126)
```html
style="border-color: {{item.color}}"
```
**建议：保留（动态样式）**

#### 61. miniprogram/packageHealth/survival-analysis/survival-analysis.wxml (行 95)
```html
style="width: {{item.rate}}%; background-color: {{item.color}}"
```
**建议：保留（动态样式）**

#### 62. miniprogram/packageHealth/survival-analysis/survival-analysis.wxml (行 118)
```html
style="height: {{item.rate - 95}}0rpx"
```
**建议：保留（动态样式）**

#### 63. miniprogram/packageProduction/batch-feed-cost/batch-feed-cost.wxml (行 12)
```html
style="margin-top: {{totalNavHeight}}rpx;"
```
**建议：保留（动态样式）**

#### 64. miniprogram/packageProduction/batch-feed-cost/batch-feed-cost.wxml (行 114)
```html
style="width: {{item.percentage}}%;"
```
**建议：保留（动态样式）**

#### 65. miniprogram/packageUser/about/about.wxml (行 11)
```html
style="padding-top: {{totalNavHeight}}rpx;"
```
**建议：保留（动态样式）**

#### 66. miniprogram/packageUser/batch-template-config/batch-template-config.wxml (行 12)
```html
style="--status-bar-height: {{statusBarHeight}}px; --navbar-height: {{navBarHeight}}px;"
```
**建议：保留（动态样式）**

#### 67. miniprogram/packageUser/help/help.wxml (行 11)
```html
style="padding-top: {{totalNavHeight}}rpx;"
```
**建议：保留（动态样式）**

#### 68. miniprogram/packageUser/knowledge-management/knowledge-management.wxml (行 54)
```html
style="transform: {{swipe.getTransform(swipedId === item._id ? swipeDistance : 0)}};"
```
**建议：保留（动态样式）**

#### 69. miniprogram/packageUser/notification-settings/notification-settings.wxml (行 11)
```html
style="padding-top: {{totalNavHeight}}rpx;"
```
**建议：保留（动态样式）**

#### 70. miniprogram/packageUser/privacy-settings/privacy-settings.wxml (行 11)
```html
style="padding-top: {{totalNavHeight}}rpx;"
```
**建议：保留（动态样式）**

#### 71. miniprogram/packageUser/role-management/role-management.wxml (行 18)
```html
style="border-left: 4rpx solid {{item.color}}"
```
**建议：保留（动态样式）**

#### 72. miniprogram/packageUser/role-management/role-management.wxml (行 42)
```html
style="color: {{item.color}}"
```
**建议：保留（动态样式）**

#### 73. miniprogram/packageUser/role-management/role-management.wxml (行 106)
```html
style="background-color: {{getRoleColor(item.role)}}20; color: {{getRoleColor(item.role)}}"
```
**建议：保留（动态样式）**

#### 74. miniprogram/packageUser/role-management/role-management.wxml (行 145)
```html
style="border-color: {{item.color}}20"
```
**建议：保留（动态样式）**

#### 75. miniprogram/packageUser/role-management/role-management.wxml (行 150)
```html
style="color: {{item.color}}"
```
**建议：保留（动态样式）**

#### 76. miniprogram/packageUser/role-management/role-management.wxml (行 154)
```html
style="color: {{item.color}}"
```
**建议：保留（动态样式）**

#### 77. miniprogram/packageUser/role-migration/role-migration.wxml (行 85)
```html
style="background-color: {{getRoleColor(role)}}20; color: {{getRoleColor(role)}};"
```
**建议：保留（动态样式）**

#### 78. miniprogram/packageUser/role-migration/role-migration.wxml (行 97)
```html
style="background-color: {{getRoleColor(item.oldRole)}}20; color: {{getRoleColor(item.oldRole)}};"
```
**建议：保留（动态样式）**

#### 79. miniprogram/packageUser/role-migration/role-migration.wxml (行 101)
```html
style="background-color: {{getRoleColor(item.newRole)}}20; color: {{getRoleColor(item.newRole)}};"
```
**建议：保留（动态样式）**

#### 80. miniprogram/packageUser/role-migration/role-migration.wxml (行 190)
```html
style="background-color: {{getRoleColor(role)}}20; color: {{getRoleColor(role)}};"
```
**建议：保留（动态样式）**

#### 81. miniprogram/pages/health/components/task-virtual-list/task-virtual-list.wxml (行 2)
```html
style="height: {{height}}rpx"
```
**建议：保留（动态样式）**

#### 82. miniprogram/pages/health/health.wxml (行 574)
```html
style="top: {{dropdownTop}}px; right: {{dropdownRight}}px;"
```
**建议：保留（动态样式）**

### 3. 动态内联样式（142个）- 需要保留

这些样式是动态的，必须保留在模板中。

#### 示例 1. miniprogram/components/weather-card/weather-card.wxml
```html
style="{{weatherBackground}}"
```

#### 示例 2. miniprogram/miniprogram_npm/tdesign-miniprogram/action-sheet/action-sheet.wxml
```html
style="{{_._style([style, customStyle])}}"
```

#### 示例 3. miniprogram/miniprogram_npm/tdesign-miniprogram/action-sheet/template/list.wxml
```html
style="{{ item.color ? 'color: ' + item.color : '' }}"
```

#### 示例 4. miniprogram/miniprogram_npm/tdesign-miniprogram/avatar/avatar.wxml
```html
style="{{_._style([_this.getStyles(isShow), style, customStyle])}}"
```

#### 示例 5. miniprogram/miniprogram_npm/tdesign-miniprogram/avatar/avatar.wxml
```html
style="{{_this.getSize(size, systemInfo)}}"
```

#### 示例 6. miniprogram/miniprogram_npm/tdesign-miniprogram/avatar/avatar.wxml
```html
style="{{imageProps && imageProps.style || ''}}"
```

#### 示例 7. miniprogram/miniprogram_npm/tdesign-miniprogram/avatar-group/avatar-group.wxml
```html
style="{{_._style([style, customStyle])}}"
```

#### 示例 8. miniprogram/miniprogram_npm/tdesign-miniprogram/back-top/back-top.wxml
```html
style="{{_._style([style, customStyle])}}"
```

#### 示例 9. miniprogram/miniprogram_npm/tdesign-miniprogram/badge/badge.wxml
```html
style="{{_._style([style, customStyle])}}"
```

#### 示例 10. miniprogram/miniprogram_npm/tdesign-miniprogram/badge/badge.wxml
```html
style="{{_._style([_this.getBadgeStyles({color, offset})])}}"
```


... 还有 132 个动态样式

## 🚀 优化建议

### 对于静态内联样式：
1. 创建对应的CSS类
2. 将样式移到.scss文件
3. 在模板中使用class替代style

### 对于混合样式：
1. 提取静态部分到CSS类
2. 只保留动态部分在style中
3. 使用class和style组合

### 示例优化：

**优化前：**
```html
<view style="padding: 20rpx; margin: 10rpx; background-color: {{color}};">
```

**优化后：**
```html
<!-- CSS中定义 .item-container { padding: 20rpx; margin: 10rpx; } -->
<view class="item-container" style="background-color: {{color}};">
```

## 📋 行动计划

1. **第一步**：处理所有静态内联样式（21个）
2. **第二步**：优化混合样式中的静态部分（82个）
3. **第三步**：代码审查，确保功能正常
