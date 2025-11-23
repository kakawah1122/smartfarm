/**
 * 通用类型定义文件
 * 用于项目中常用的类型定义
 */

// 微信小程序事件类型（兼容性定义）
export type CustomEvent<T = any> = any; // 在实际使用时会被WechatMiniprogram.CustomEvent覆盖
export type BaseEvent = any;
export type TouchEvent = any;
export type TapEvent = any;

// 错误处理类型
export interface ErrorWithMessage {
  message: string;
  code?: string | number;
  [key: string]: any;
}

// 云函数响应类型
export interface CloudFunctionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  result?: T;
}

// 通用数据类型
export interface PageData {
  [key: string]: any;
}

// 批次相关类型
export interface Batch {
  _id: string;
  batchNumber: string;
  batchName?: string;
  status: 'active' | 'completed' | 'archived';
  currentStock?: number;
  totalIn?: number;
  totalOut?: number;
  created_at?: Date | string;
  updated_at?: Date | string;
  [key: string]: any;
}

// 任务相关类型
export interface Task {
  _id?: string;
  id?: string;
  taskId?: string;
  title: string;
  description?: string;
  type?: string;
  status?: 'pending' | 'in_progress' | 'completed';
  dueDate?: Date | string;
  priority?: 'high' | 'medium' | 'low';
  [key: string]: any;
}

// 健康记录类型
export interface HealthRecord {
  _id?: string;
  recordType: string;
  batchId?: string;
  batchNumber?: string;
  date?: Date | string;
  description?: string;
  affectedCount?: number;
  totalCost?: number;
  costInfo?: {
    totalCost?: number;
    [key: string]: any;
  };
  [key: string]: any;
}

// API请求配置
export interface RequestOptions {
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  header?: Record<string, string>;
  timeout?: number;
}

// 分页参数
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  total?: number;
}

// 通用响应结果
export interface ApiResponse<T = any> {
  code: number;
  data?: T;
  message?: string;
  success?: boolean;
}

// 表单数据类型
export interface FormData {
  [key: string]: any;
}

// 选择器选项
export interface PickerOption {
  label: string;
  value: string | number;
  [key: string]: any;
}

// 列表项类型
export interface ListItem {
  id?: string;
  _id?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  [key: string]: any;
}

// 用户信息类型
export interface UserInfo {
  _openid?: string;
  openid?: string;
  userId?: string;
  nickName?: string;
  avatarUrl?: string;
  role?: string;
  permissions?: string[];
  [key: string]: any;
}

// 天气数据类型
export interface WeatherInfo {
  temperature?: number | string;
  humidity?: number | string;
  condition?: string;
  emoji?: string;
  feelsLike?: number | string;
  windDirection?: string;
  windScale?: string;
  updateTime?: string;
  loading?: boolean;
  hasError?: boolean;
}

// 配置选项类型
export type ConfigOptions = Record<string, unknown>;

// 数据映射类型
export type DataMap<T = any> = Map<string, T>;

// 回调函数类型
export type Callback<T = void> = (result?: T) => void;
export type AsyncCallback<T = void> = (result?: T) => Promise<void>;
export type EventCallback = (event: CustomEvent) => void;

// 状态类型
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';
export type DataState<T> = {
  data?: T;
  loading: boolean;
  error?: string;
};
