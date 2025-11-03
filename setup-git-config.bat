@echo off
chcp 65001 >nul
echo ========================================
echo Git 配置脚本
echo ========================================
echo.

REM 检查 Git 是否已安装
git --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到 Git，请先安装 Git
    pause
    exit /b 1
)

echo Git 已安装
git --version
echo.

REM 检查并配置全局用户信息
set GLOBAL_NAME=
set GLOBAL_EMAIL=
for /f "tokens=2*" %%a in ('git config --global user.name 2^>nul') do set GLOBAL_NAME=%%a
for /f "tokens=2*" %%a in ('git config --global user.email 2^>nul') do set GLOBAL_EMAIL=%%a

if "%GLOBAL_NAME%"=="" (
    echo 配置全局 Git 用户信息...
    set /p NAME="请输入您的姓名: "
    set /p EMAIL="请输入您的邮箱: "
    if not "%NAME%"=="" git config --global user.name "%NAME%"
    if not "%EMAIL%"=="" git config --global user.email "%EMAIL%"
    echo 全局用户信息已配置
) else (
    echo 全局用户信息: %GLOBAL_NAME% ^<%GLOBAL_EMAIL%^>
)

echo.
echo 配置其他 Git 设置...
git config --global init.defaultBranch main
git config --global core.autocrlf true
git config --global color.ui auto
git config --global push.default simple
git config --local core.autocrlf true

echo.
echo ========================================
echo Git 配置完成！
echo ========================================
echo.
echo 当前配置信息:
git config --list --local
echo.
echo 提示: 您现在可以使用以下命令提交更改:
echo   git add .
echo   git commit -m "提交信息"
echo.
pause

