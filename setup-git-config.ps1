# Git 配置脚本
# 用于配置项目的基本 Git 设置

Write-Host "正在配置 Git..." -ForegroundColor Green

# 检查 Git 是否已安装
try {
    $gitVersion = git --version
    Write-Host "Git 版本: $gitVersion" -ForegroundColor Cyan
} catch {
    Write-Host "错误: 未找到 Git，请先安装 Git" -ForegroundColor Red
    exit 1
}

# 配置全局用户信息（如果尚未配置）
$globalName = git config --global user.name
$globalEmail = git config --global user.email

if (-not $globalName) {
    Write-Host "`n配置全局 Git 用户信息..." -ForegroundColor Yellow
    $name = Read-Host "请输入您的姓名"
    $email = Read-Host "请输入您的邮箱"
    
    if ($name -and $email) {
        git config --global user.name $name
        git config --global user.email $email
        Write-Host "✓ 全局用户信息已配置" -ForegroundColor Green
    } else {
        Write-Host "跳过全局配置" -ForegroundColor Yellow
    }
} else {
    Write-Host "全局用户信息: $globalName <$globalEmail>" -ForegroundColor Cyan
}

# 配置项目本地用户信息（可选）
Write-Host "`n是否要为当前项目配置特定的用户信息？(y/n)" -ForegroundColor Yellow
$setLocal = Read-Host

if ($setLocal -eq "y" -or $setLocal -eq "Y") {
    $localName = Read-Host "请输入项目用户名（留空使用全局配置）"
    $localEmail = Read-Host "请输入项目邮箱（留空使用全局配置）"
    
    if ($localName) {
        git config --local user.name $localName
        Write-Host "✓ 项目用户名已配置" -ForegroundColor Green
    }
    if ($localEmail) {
        git config --local user.email $localEmail
        Write-Host "✓ 项目邮箱已配置" -ForegroundColor Green
    }
}

# 配置其他常用设置
Write-Host "`n配置其他 Git 设置..." -ForegroundColor Yellow

# 设置默认分支名为 main
git config --global init.defaultBranch main

# 设置自动转换换行符（Windows 推荐）
git config --global core.autocrlf true

# 设置默认编辑器（可选）
# git config --global core.editor "code --wait"

# 启用颜色输出
git config --global color.ui auto

# 设置推送策略
git config --global push.default simple

# 配置项目特定的换行符设置（Windows）
git config --local core.autocrlf true

Write-Host "`n✓ Git 配置完成！" -ForegroundColor Green
Write-Host "`n当前配置信息:" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Gray
git config --list --show-origin | Select-String -Pattern "user\.|core\.autocrlf|push\.default|init\.defaultBranch"
Write-Host "----------------------------------------" -ForegroundColor Gray

Write-Host "`n提示: 您现在可以使用以下命令提交更改:" -ForegroundColor Yellow
Write-Host "  git add ." -ForegroundColor White
Write-Host "  git commit -m '提交信息'" -ForegroundColor White

