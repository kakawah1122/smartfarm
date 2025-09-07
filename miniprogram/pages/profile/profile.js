"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// profile.ts
const navigation_1 = require("../../utils/navigation");
// 获取全局应用实例
const app = getApp();
const pageConfig = {
    data: {
        // 登录状态
        isLoggedIn: false,
        // 用户信息
        userInfo: {
            name: '未设置',
            role: '用户',
            farm: '未设置',
            experience: '0',
            currentStock: '0',
            healthRate: '0',
            avatarUrl: '/assets/icons/profile.png' // 默认头像
        },
        // 云开发用户信息
        cloudUserInfo: null,
        // 财务概览
        financeOverview: {
            income: '21.2',
            incomeGrowth: '15.3',
            expense: '16.8',
            expenseGrowth: '8.7',
            profit: '4.4',
            profitGrowth: '32.1'
        },
        // 功能菜单
        menuItems: [
            {
                id: 1,
                title: '财务管理',
                description: '收支记录、AI建议、报表分析',
                icon: 'money-circle',
                page: '/pages/finance/finance'
            },
            {
                id: 2,
                title: '员工管理',
                description: '邀请码管理、员工权限设置',
                icon: 'user-group',
                page: '/pages/invite-management/invite-management',
                requiredPermission: 'employee.view'
            },
            {
                id: 3,
                title: '报销审核',
                description: '待审核报销申请、采购申请',
                icon: 'file-text',
                badge: '3'
            },
            {
                id: 4,
                title: '系统设置',
                description: '隐私设置、帮助反馈、关于我们',
                icon: 'setting'
            },
        ],
        // 待处理事项
        pendingItems: [
            {
                id: 1,
                title: '李四提交的差旅费报销',
                description: '金额：¥280 • 提交时间：今天 14:30',
                priority: 'danger',
                status: '待审核'
            },
            {
                id: 2,
                title: '王五的饲料采购申请',
                description: '饲料2吨 • 预计金额：¥6,000',
                priority: 'warning',
                status: '待审核'
            },
            {
                id: 3,
                title: '疫苗采购申请',
                description: '禽流感疫苗50支 • 预计金额：¥750',
                priority: 'primary',
                status: '待审核'
            }
        ],
        // 养殖场统计
        farmStats: {
            totalStock: '1,280',
            stockChange: '120',
            survivalRate: '95.2',
            staffCount: '8',
            adminCount: '1',
            employeeCount: '7',
            monthlyProfit: '4.4',
            profitGrowth: '32'
        },
        // 消息通知
        notifications: [],
        notificationStats: {
            unreadCount: 0,
            totalCount: 0,
            recentCount: 0
        }
    },
    onLoad() {
        this.checkLoginStatus();
        this.initUserInfo();
    },
    async onShow() {
        // 页面显示时刷新数据
        await this.checkLoginStatus();
        if (this.data.isLoggedIn) {
            await Promise.all([
                this.loadCloudUserInfo(),
                this.loadNotifications()
            ]);
        }
        else {
        }
    },
    // 检查登录状态
    async checkLoginStatus() {
        const app = getApp();
        let isLoggedIn = app.globalData.isLoggedIn || false;
        let openid = app.globalData.openid;
        // 如果应用全局状态中没有登录信息，尝试从本地存储恢复
        if (!isLoggedIn || !openid) {
            const storedOpenid = wx.getStorageSync('openid');
            const storedUserInfo = wx.getStorageSync('userInfo');
            if (storedOpenid && storedUserInfo) {
                app.globalData.openid = storedOpenid;
                app.globalData.isLoggedIn = true;
                app.globalData.userInfo = storedUserInfo;
                isLoggedIn = true;
                openid = storedOpenid;
                // 立即更新用户信息显示
                this.setData({
                    userInfo: {
                        name: storedUserInfo.nickname || '未设置',
                        role: this.getRoleDisplayName(storedUserInfo.role || 'user'),
                        farm: storedUserInfo.farmName || '智慧养殖场',
                        experience: '1',
                        currentStock: '1280',
                        healthRate: '95.2',
                        avatarUrl: storedUserInfo.avatarUrl || '/assets/icons/profile.png'
                    }
                });
            }
        }
        this.setData({
            isLoggedIn: isLoggedIn
        });
    },
    // 从云开发加载用户信息
    async loadCloudUserInfo() {
        try {
            const db = wx.cloud.database();
            const result = await db.collection('users').where({
                _openid: wx.cloud.database().command.exists(true)
            }).get();
            if (result.data.length > 0) {
                const cloudUserInfo = result.data[0];
                // 更新本地和全局用户信息
                const app = getApp();
                app.globalData.userInfo = cloudUserInfo;
                wx.setStorageSync('userInfo', cloudUserInfo);
                this.setData({
                    cloudUserInfo: cloudUserInfo,
                    userInfo: {
                        name: cloudUserInfo.nickname || '未设置',
                        role: this.getRoleDisplayName(cloudUserInfo.role || 'user'),
                        farm: cloudUserInfo.farmName || '智慧养殖场', // 使用数据库中的养殖场名称
                        experience: '1',
                        currentStock: '1280',
                        healthRate: '95.2',
                        avatarUrl: cloudUserInfo.avatarUrl || '/assets/icons/profile.png'
                    }
                });
            }
        }
        catch (error) {
        }
    },
    // 初始化用户信息
    async initUserInfo() {
        if (this.data.isLoggedIn) {
            // 已登录，先尝试从本地存储获取，再从云开发加载最新信息
            const storedUserInfo = wx.getStorageSync('userInfo');
            if (storedUserInfo) {
                this.setData({
                    userInfo: {
                        name: storedUserInfo.nickname || '未设置',
                        role: '用户',
                        farm: storedUserInfo.farmName || '智慧养殖场',
                        experience: '1',
                        currentStock: '1280',
                        healthRate: '95.2',
                        avatarUrl: storedUserInfo.avatarUrl || '/assets/icons/profile.png'
                    }
                });
            }
            // 从云开发加载最新用户信息
            await this.loadCloudUserInfo();
        }
        else {
            // 未登录，显示默认信息
            this.setData({
                userInfo: {
                    name: '游客',
                    role: '用户',
                    farm: '示范养殖场',
                    experience: '0',
                    currentStock: '0',
                    healthRate: '0',
                    avatarUrl: '/assets/icons/profile.png'
                }
            });
        }
    },
    // 登录
    goToLogin() {
        wx.navigateTo({
            url: '/pages/login/login'
        });
    },
    // 云开发登录
    async cloudLogin() {
        try {
            wx.showLoading({
                title: '登录中...',
                mask: true
            });
            const app = getApp();
            await app.login();
            wx.hideLoading();
            // 更新页面状态
            this.setData({
                isLoggedIn: true
            });
            // 加载用户信息
            await this.loadCloudUserInfo();
            wx.showToast({
                title: '登录成功',
                icon: 'success'
            });
        }
        catch (error) {
            wx.hideLoading();
            wx.showToast({
                title: '登录失败，请重试',
                icon: 'error'
            });
        }
    },
    // 返回上一页
    goBack() {
        wx.navigateBack({
            fail: () => {
                wx.switchTab({
                    url: '/pages/index/index'
                });
            }
        });
    },
    // 查看财务详情
    viewFinanceDetail() {
        wx.navigateTo({
            url: '/pages/finance/finance',
            fail: () => {
                wx.showToast({
                    title: '功能开发中',
                    icon: 'none'
                });
            }
        });
    },
    // 导航到功能菜单
    navigateToMenu(e) {
        const { item } = e.currentTarget.dataset;
        // 检查权限
        if (item.requiredPermission && !this.hasPermission(item.requiredPermission)) {
            wx.showModal({
                title: '权限不足',
                content: '您没有访问此功能的权限，请联系管理员',
                showCancel: false
            });
            return;
        }
        // 如果是系统设置，显示设置选项
        if (item.id === 4) {
            this.showSystemSettings();
            return;
        }
        if (item.page) {
            wx.navigateTo({
                url: item.page,
                fail: () => {
                    wx.showToast({
                        title: '功能开发中',
                        icon: 'none'
                    });
                }
            });
        }
        else {
            wx.showModal({
                title: item.title,
                content: item.description,
                showCancel: false,
                success: () => {
                    wx.showToast({
                        title: '功能开发中',
                        icon: 'none'
                    });
                }
            });
        }
    },
    // 显示系统设置选项
    showSystemSettings() {
        wx.showActionSheet({
            itemList: ['隐私设置', '帮助与反馈', '关于我们'],
            success: (res) => {
                switch (res.tapIndex) {
                    case 0:
                        this.privacySettings();
                        break;
                    case 1:
                        this.helpAndFeedback();
                        break;
                    case 2:
                        this.aboutUs();
                        break;
                }
            }
        });
    },
    // 处理待办事项
    handlePendingItem(e) {
        const { item } = e.currentTarget.dataset;
        wx.showModal({
            title: '处理申请',
            content: `${item.title}\n\n${item.description}`,
            confirmText: '审核',
            success: (res) => {
                if (res.confirm) {
                    wx.showModal({
                        title: '审核操作',
                        content: '是否通过此申请？',
                        confirmText: '通过',
                        cancelText: '拒绝',
                        success: (result) => {
                            const action = result.confirm ? '通过' : '拒绝';
                            wx.showToast({
                                title: `申请已${action}`,
                                icon: 'success'
                            });
                            // 更新待处理事项列表
                            this.removePendingItem(item.id);
                        }
                    });
                }
            }
        });
    },
    // 移除待处理事项
    removePendingItem(id) {
        const pendingItems = this.data.pendingItems.filter(item => item.id !== id);
        this.setData({
            pendingItems
        });
    },
    // 更换头像 - 跳转到个人信息编辑页面
    changeAvatar() {
        if (!this.data.isLoggedIn) {
            wx.showToast({
                title: '请先登录',
                icon: 'none'
            });
            return;
        }
        wx.showModal({
            title: '更换头像',
            content: '头像更换功能请在个人信息编辑页面进行操作',
            showCancel: true,
            confirmText: '去编辑',
            cancelText: '取消',
            success: (res) => {
                if (res.confirm) {
                    wx.navigateTo({
                        url: '/pages/login/login'
                    });
                }
            }
        });
    },
    // 编辑个人信息
    editProfile() {
        wx.showActionSheet({
            itemList: ['编辑养殖场名称', '编辑职位'],
            success: async (res) => {
                const options = ['养殖场名称', '职位'];
                const currentValues = [
                    this.data.userInfo.farm,
                    this.data.userInfo.role
                ];
                wx.showModal({
                    title: `编辑${options[res.tapIndex]}`,
                    content: `当前${options[res.tapIndex]}：${currentValues[res.tapIndex]}`,
                    placeholderText: `请输入新的${options[res.tapIndex]}`,
                    editable: true,
                    confirmText: '保存',
                    success: (modalRes) => {
                        if (modalRes.confirm && modalRes.content.trim()) {
                            this.handleSaveProfile(modalRes.content.trim(), res.tapIndex, options[res.tapIndex]);
                        }
                    }
                });
            }
        });
    },
    // 处理保存个人信息
    async handleSaveProfile(newValue, fieldIndex, fieldName) {
        try {
            wx.showLoading({
                title: '保存中...'
            });
            // 更新本地显示
            const keys = ['farm', 'role'];
            const dataKey = `userInfo.${keys[fieldIndex]}`;
            this.setData({
                [dataKey]: newValue
            });
            wx.hideLoading();
            wx.showToast({
                title: '保存成功',
                icon: 'success'
            });
        }
        catch (error) {
            wx.hideLoading();
            wx.showToast({
                title: '保存失败',
                icon: 'none'
            });
        }
    },
    // 加载通知数据
    async loadNotifications() {
        try {
            const { NotificationHelper } = require('../../utils/notification-helper');
            
            // 获取通知统计
            const stats = await NotificationHelper.getNotificationStats();
            
            // 获取最新的通知列表
            const notificationsData = await NotificationHelper.getUserNotifications({
                page: 1,
                pageSize: 10
            });
            
            this.setData({
                notificationStats: stats,
                notifications: notificationsData.notifications || []
            });
            
        } catch (error) {
            // 失败时使用默认数据，不影响页面正常显示
        }
    },

    // 显示消息通知
    async showNotifications() {
        if (!this.data.isLoggedIn) {
            wx.showToast({
                title: '请先登录',
                icon: 'none'
            });
            return;
        }

        const notifications = this.data.notifications;
        const unreadCount = this.data.notificationStats.unreadCount;
        
        if (notifications.length === 0) {
            wx.showModal({
                title: '消息通知',
                content: '暂无通知消息',
                showCancel: false
            });
            return;
        }

        // 跳转到通知列表页面（如果有的话）或显示通知摘要
        const notificationList = notifications.slice(0, 3).map(n => 
            `${this.getNotificationTypeIcon(n.type)} ${n.title}\n${n.content.substring(0, 30)}${n.content.length > 30 ? '...' : ''}`
        ).join('\n\n');
        
        const moreText = notifications.length > 3 ? `\n\n...还有${notifications.length - 3}条通知` : '';
        
        wx.showModal({
            title: `消息通知 (${unreadCount}条未读)`,
            content: notificationList + moreText,
            confirmText: '全部已读',
            cancelText: '关闭',
            success: async (res) => {
                if (res.confirm) {
                    // 标记所有消息为已读
                    try {
                        const { NotificationHelper } = require('../../utils/notification-helper');
                        const result = await NotificationHelper.markAllRead();
                        
                        if (result.success) {
                            // 重新加载通知数据
                            await this.loadNotifications();
                            wx.showToast({
                                title: '已标记为已读',
                                icon: 'success'
                            });
                        } else {
                            throw new Error(result.message || '标记失败');
                        }
                    } catch (error) {
                        console.error('标记已读失败:', error);
                        wx.showToast({
                            title: '操作失败，请重试',
                            icon: 'error'
                        });
                    }
                }
            }
        });
    },

    // 获取通知类型图标
    getNotificationTypeIcon(type) {
        const iconMap = {
            'system': '⚙️',
            'approval': '📋', 
            'health': '🏥',
            'production': '🏭',
            'finance': '💰'
        };
        return iconMap[type] || '📢';
    },
    // 隐私设置
    privacySettings() {
        wx.showToast({
            title: '功能开发中',
            icon: 'none'
        });
    },
    // 帮助与反馈
    helpAndFeedback() {
        wx.showToast({
            title: '功能开发中',
            icon: 'none'
        });
    },
    // 关于我们
    aboutUs() {
        wx.showModal({
            title: '关于智慧养鹅',
            content: '智慧养鹅小程序 v1.0.0\n\n集生产管理、健康监控、知识学习和财务分析于一体的专业养鹅管理系统。',
            showCancel: false
        });
    },
    // 获取角色显示名称
    getRoleDisplayName(role) {
        switch (role) {
            case 'admin':
                return '管理员';
            case 'employee':
                return '员工';
            case 'user':
            default:
                return '用户';
        }
    },
    // 检查用户权限
    hasPermission(requiredPermission) {
        const app = getApp();
        const userInfo = app.globalData.userInfo;
        if (!userInfo)
            return false;
        // 管理员拥有所有权限
        if (userInfo.role === 'admin')
            return true;
        // 检查是否有所有权限
        if (userInfo.permissions && userInfo.permissions.includes('all'))
            return true;
        // 检查特定权限
        if (userInfo.permissions && userInfo.permissions.includes(requiredPermission))
            return true;
        return false;
    },
    // 退出登录
    logout() {
        if (!this.data.isLoggedIn) {
            wx.showToast({
                title: '您还未登录',
                icon: 'none'
            });
            return;
        }
        wx.showModal({
            title: '退出登录',
            content: '确定要退出登录吗？退出后需要重新登录才能使用完整功能。',
            success: (res) => {
                if (res.confirm) {
                    // 清除全局登录状态
                    const app = getApp();
                    app.globalData.openid = undefined;
                    app.globalData.isLoggedIn = false;
                    app.globalData.userInfo = undefined;
                    // 清除本地存储
                    wx.removeStorageSync('openid');
                    wx.removeStorageSync('userInfo');
                    // 重置页面数据
                    this.setData({
                        isLoggedIn: false,
                        cloudUserInfo: null,
                        userInfo: {
                            name: '游客',
                            role: '用户',
                            farm: '示范养殖场',
                            experience: '0',
                            currentStock: '0',
                            healthRate: '0',
                            avatarUrl: '/assets/icons/profile.png'
                        }
                    });
                    wx.showToast({
                        title: '已退出登录',
                        icon: 'success'
                    });
                    console.log('已退出登录，状态已重置');
                }
            }
        });
    }
};
// 使用导航栏适配工具创建页面
Page((0, navigation_1.createPageWithNavbar)(pageConfig));
