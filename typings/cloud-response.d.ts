/**
 * 云函数响应类型定义
 * 用于统一云函数返回值的类型检查
 */

/** 基础云函数响应 */
interface CloudResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  errMsg?: string;
}

/** 分页响应 */
interface PaginatedResponse<T = unknown> extends CloudResponse<T[]> {
  total?: number;
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
}

/** 云函数调用结果（wx.cloud.callFunction 返回） */
interface CloudCallResult<T = unknown> {
  result?: CloudResponse<T>;
  errMsg?: string;
}

/** 错误类型 */
interface CloudError {
  errCode?: number;
  errMsg?: string;
  message?: string;
}

/** 通用事件类型（微信小程序） */
interface WxCustomEvent<T = unknown> {
  type: string;
  timeStamp: number;
  target: {
    id: string;
    dataset: Record<string, unknown>;
  };
  currentTarget: {
    id: string;
    dataset: Record<string, unknown>;
  };
  detail: T;
}

/** 输入事件详情 */
interface InputEventDetail {
  value: string;
  cursor?: number;
  keyCode?: number;
}

/** 选择器事件详情 */
interface PickerEventDetail {
  value: number | number[];
}

/** 开关事件详情 */
interface SwitchEventDetail {
  value: boolean;
}

/** 滚动事件详情 */
interface ScrollEventDetail {
  scrollLeft: number;
  scrollTop: number;
  scrollHeight: number;
  scrollWidth: number;
  deltaX: number;
  deltaY: number;
}
