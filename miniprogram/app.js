"use strict";
// app.js
import permissionManager from './utils/permission-manager.js'

App({
    globalData: {
        statusBarHeight: 44, // 默认状态栏高度
        navBarHeight: 88, // 默认导航栏高度
        permissionManager: permissionManager, // 全局权限管理器
    },
    onLaunch() {
        // 初始化云开发
        if (!wx.cloud) {
            console.error('请使用 2.2.3 或以上的基础库以使用云能力');
        }
        else {
            wx.cloud.init({
                env: 'cloud1-3gdruqkn67e1cbe2', // 您提供的环境ID
                traceUser: false, // 禁用用户追踪以避免实时日志问题
            });
        }
        // 获取系统信息，设置状态栏高度
        this.setStatusBarHeight();
        // 展示本地存储能力
        const logs = wx.getStorageSync('logs') || [];
        logs.unshift(Date.now());
        wx.setStorageSync('logs', logs);
        // 检查用户登录状态
        this.checkLoginStatus();
        // 初始化权限管理器
        this.initPermissionManager();
    },
    // 设置状态栏高度
    setStatusBarHeight() {
        try {
            const systemInfo = wx.getSystemInfoSync();
            const statusBarHeight = systemInfo.statusBarHeight || 44;
            const navBarHeight = 88; // rpx单位导航栏高度
            // 设置全局变量
            this.globalData.statusBarHeight = statusBarHeight;
            this.globalData.navBarHeight = navBarHeight;
            // 设置CSS变量  
            const statusBarHeightRpx = statusBarHeight * 2; // px转rpx
            // 动态设置CSS变量
            wx.nextTick(() => {
                const pages = getCurrentPages();
                if (pages.length > 0) {
                    const currentPage = pages[pages.length - 1];
                    if (currentPage && currentPage.setData) {
                        currentPage.setData({
                            statusBarHeight: statusBarHeightRpx,
                            navBarHeight: navBarHeight,
                            totalNavHeight: statusBarHeightRpx + navBarHeight
                        });
                    }
                }
            });
        }
        catch (error) {
            // 获取系统信息失败时使用默认值
        }
    },
    // 检查用户登录状态
    checkLoginStatus() {
        const openid = wx.getStorageSync('openid');
        if (openid) {
            this.globalData.openid = openid;
            this.globalData.isLoggedIn = true;
        }
        else {
            this.globalData.isLoggedIn = false;
        }
    },
    // 初始化权限管理器
    async initPermissionManager() {
        try {
            // 如果用户已登录，初始化权限管理器
            if (this.globalData.isLoggedIn) {
                const initialized = await permissionManager.initializeUser();
                if (initialized) {
                    console.log('权限管理器初始化成功');
                } else {
                    console.warn('权限管理器初始化失败');
                }
            } else {
                console.log('用户未登录，跳过权限管理器初始化');
            }
        } catch (error) {
            console.error('权限管理器初始化失败：', error);
        }
    },
    
    // 用户登录
    async login() {
        try {
            // 调用微信登录
            const loginRes = await wx.cloud.callFunction({
                name: 'login',
                data: {}
            });
            if (loginRes.result && loginRes.result.openid) {
                this.globalData.openid = loginRes.result.openid;
                this.globalData.isLoggedIn = true;
                // 保存到本地存储
                wx.setStorageSync('openid', loginRes.result.openid);
                // 保存用户信息到本地存储供权限管理器使用
                wx.setStorageSync('userInfo', {
                    openid: loginRes.result.openid,
                    loginTime: new Date().toISOString()
                });
                console.log('登录成功', loginRes.result.openid);
                
                // 登录成功后初始化权限管理器
                await this.initPermissionManager();
            }
        }
        catch (error) {
            console.error('登录失败', error);
            throw error;
        }
    },
    
    // 用户登出
    logout() {
        this.globalData.openid = null;
        this.globalData.isLoggedIn = false;
        // 清除本地存储
        wx.removeStorageSync('openid');
        wx.removeStorageSync('userInfo');
        // 清空权限缓存
        if (permissionManager) {
            permissionManager.clearPermissionCache();
            permissionManager.currentUser = null;
            permissionManager.userRoles = [];
        }
        console.log('用户已登出');
    },
});
