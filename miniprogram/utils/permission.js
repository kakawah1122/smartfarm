"use strict";
// utils/permission.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionMixin = exports.PermissionManager = exports.ROLE_PERMISSIONS = exports.ROLES = exports.PERMISSIONS = void 0;
exports.requirePermission = requirePermission;
// 权限定义
exports.PERMISSIONS = {
    // 基础权限
    'basic': '基础功能访问',
    // 生产管理
    'production.view': '生产数据查看',
    'production.manage': '生产数据管理',
    // 健康管理
    'health.view': '健康数据查看',
    'health.manage': '健康数据管理',
    // 财务管理
    'finance.view': '财务数据查看',
    'finance.manage': '财务数据管理',
    'finance.approve': '财务审批',
    // 员工管理
    'employee.view': '员工信息查看',
    'employee.manage': '员工信息管理',
    'employee.invite': '员工邀请',
    // 系统管理
    'system.admin': '系统管理',
    // 所有权限
    'all': '所有权限'
};
// 角色定义
exports.ROLES = {
    'admin': '管理员',
    'employee': '员工',
    'user': '普通用户'
};
// 角色默认权限
exports.ROLE_PERMISSIONS = {
    'admin': ['all'],
    'employee': ['basic', 'production.view', 'health.view', 'finance.view'],
    'user': ['basic']
};
/**
 * 权限管理工具类
 */
class PermissionManager {
    /**
     * 检查用户是否有指定权限
     * @param userInfo 用户信息
     * @param permission 权限名称
     * @returns 是否有权限
     */
    static hasPermission(userInfo, permission) {
        if (!userInfo)
            return false;
        // 管理员拥有所有权限
        if (userInfo.role === 'admin')
            return true;
        // 检查是否有所有权限
        if (userInfo.permissions && userInfo.permissions.includes('all'))
            return true;
        // 检查特定权限
        if (userInfo.permissions && userInfo.permissions.includes(permission))
            return true;
        return false;
    }
    /**
     * 检查用户是否有任一权限
     * @param userInfo 用户信息
     * @param permissions 权限列表
     * @returns 是否有任一权限
     */
    static hasAnyPermission(userInfo, permissions) {
        return permissions.some(permission => this.hasPermission(userInfo, permission));
    }
    /**
     * 检查用户是否有所有权限
     * @param userInfo 用户信息
     * @param permissions 权限列表
     * @returns 是否有所有权限
     */
    static hasAllPermissions(userInfo, permissions) {
        return permissions.every(permission => this.hasPermission(userInfo, permission));
    }
    /**
     * 获取角色显示名称
     * @param role 角色代码
     * @returns 角色显示名称
     */
    static getRoleDisplayName(role) {
        return exports.ROLES[role] || '未知角色';
    }
    /**
     * 获取权限显示名称
     * @param permission 权限代码
     * @returns 权限显示名称
     */
    static getPermissionDisplayName(permission) {
        return exports.PERMISSIONS[permission] || '未知权限';
    }
    /**
     * 获取用户权限列表（包含显示名称）
     * @param userInfo 用户信息
     * @returns 权限列表
     */
    static getUserPermissionList(userInfo) {
        if (!userInfo || !userInfo.permissions)
            return [];
        // 如果是管理员或拥有所有权限，返回所有权限
        if (userInfo.role === 'admin' || userInfo.permissions.includes('all')) {
            return Object.entries(exports.PERMISSIONS).map(([code, name]) => ({ code, name }));
        }
        // 返回用户具体权限
        return userInfo.permissions
            .filter((permission) => exports.PERMISSIONS[permission])
            .map((permission) => ({
            code: permission,
            name: this.getPermissionDisplayName(permission)
        }));
    }
    /**
     * 验证权限并显示提示
     * @param userInfo 用户信息
     * @param permission 权限名称
     * @param showToast 是否显示提示
     * @returns 是否有权限
     */
    static validatePermission(userInfo, permission, showToast = true) {
        const hasPermission = this.hasPermission(userInfo, permission);
        if (!hasPermission && showToast) {
            wx.showModal({
                title: '权限不足',
                content: `您需要 "${this.getPermissionDisplayName(permission)}" 权限才能访问此功能，请联系管理员`,
                showCancel: false
            });
        }
        return hasPermission;
    }
    /**
     * 检查是否是管理员
     * @param userInfo 用户信息
     * @returns 是否是管理员
     */
    static isAdmin(userInfo) {
        return userInfo && userInfo.role === 'admin';
    }
    /**
     * 检查是否是员工
     * @param userInfo 用户信息
     * @returns 是否是员工
     */
    static isEmployee(userInfo) {
        return userInfo && (userInfo.role === 'employee' || userInfo.role === 'admin');
    }
    /**
     * 获取当前用户信息
     * @returns 用户信息
     */
    static getCurrentUser() {
        const app = getApp();
        return app.globalData.userInfo;
    }
    /**
     * 过滤有权限的菜单项
     * @param menuItems 菜单项列表
     * @param userInfo 用户信息
     * @returns 过滤后的菜单项
     */
    static filterMenuByPermission(menuItems, userInfo) {
        return menuItems.filter(item => {
            if (!item.requiredPermission)
                return true;
            return this.hasPermission(userInfo, item.requiredPermission);
        });
    }
}
exports.PermissionManager = PermissionManager;
/**
 * 权限装饰器（用于页面方法）
 * @param permission 所需权限
 * @param showToast 是否显示权限不足提示
 */
function requirePermission(permission, showToast = true) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = function (...args) {
            const userInfo = PermissionManager.getCurrentUser();
            if (!PermissionManager.validatePermission(userInfo, permission, showToast)) {
                return;
            }
            return originalMethod.apply(this, args);
        };
        return descriptor;
    };
}
/**
 * 页面权限检查混入
 */
exports.PermissionMixin = {
    /**
     * 检查权限
     */
    hasPermission(permission) {
        const app = getApp();
        return PermissionManager.hasPermission(app.globalData.userInfo, permission);
    },
    /**
     * 验证权限
     */
    validatePermission(permission, showToast = true) {
        const app = getApp();
        return PermissionManager.validatePermission(app.globalData.userInfo, permission, showToast);
    },
    /**
     * 是否是管理员
     */
    isAdmin() {
        const app = getApp();
        return PermissionManager.isAdmin(app.globalData.userInfo);
    },
    /**
     * 是否是员工
     */
    isEmployee() {
        const app = getApp();
        return PermissionManager.isEmployee(app.globalData.userInfo);
    }
};
