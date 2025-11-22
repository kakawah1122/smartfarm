/**
 * Profile页面专用类型定义
 */

import { UserInfo as CoreUserInfo } from '../../typings/core'

/**
 * 扩展的用户信息类型
 */
export interface ExtendedUserInfo {
  _id?: string
  openid?: string
  nickName?: string  // 微信标准字段
  nickname?: string  // 别名，有些地方用nickname而不是nickName
  avatarUrl?: string  // 头像
  farmName?: string
  department?: string
  role?: 'manager' | 'super_admin' | 'admin' | 'user' | 'guest'
  createTime?: string | Date
  phone?: string
  lastLoginTime?: string | Date
}

/**
 * 全局数据类型
 */
export interface GlobalData {
  openid?: string
  isLoggedIn?: boolean
  userInfo?: ExtendedUserInfo
}

/**
 * App实例类型
 */
export interface AppInstance {
  globalData?: GlobalData
}

/**
 * 自定义事件类型
 */
export type CustomEvent<T = any> = WechatMiniprogram.CustomEvent<{
  value?: T
  [key: string]: any
}>

/**
 * 输入事件类型
 */
export type InputEvent = WechatMiniprogram.Input

/**
 * 更新用户信息的响应
 */
export interface UpdateUserInfoResponse {
  nickName?: string
  nickname?: string
  phone?: string
  farmName?: string
  department?: string
}

/**
 * 错误响应
 */
export interface ErrorResponse {
  message?: string
  error?: string
  errMsg?: string
}
