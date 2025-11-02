/**
 * API 配置工具
 * 智能检测运行环境并返回正确的API地址
 */

/**
 * 获取 API 基础URL
 * 支持多种配置方式，按优先级：
 * 1. 环境变量 NEXT_PUBLIC_API_BASE_URL（手动指定）
 * 2. 环境变量 NEXT_PUBLIC_API_URL（兼容旧配置）
 * 3. 浏览器自动检测（根据访问域名）
 * 4. 默认 localhost（开发环境）
 */
export function getApiBaseUrl(): string {
  // 1. 优先级：手动指定的环境变量
  if (typeof window !== 'undefined' && (window as any).__API_BASE_URL__) {
    return (window as any).__API_BASE_URL__;
  }
  
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }

  // 2. 兼容旧的环境变量名称
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // 3. 浏览器环境下自动检测
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    
    // 如果在服务器IP或域名上访问，自动使用该地址
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      // 如果是 HTTPS，使用相同协议，否则默认 HTTP 3001端口
      if (protocol === 'https:') {
        return `${protocol}//${hostname}`;
      }
      return `http://${hostname}:3001`;
    }
  }

  // 4. 默认使用 localhost（开发环境）
  return 'http://localhost:3001';
}

// 导出函数，在客户端运行时动态获取
export function getApiBaseUrlDynamic(): string {
  return getApiBaseUrl();
}

// 导出常量供其他模块使用（客户端会重新计算）
export const API_BASE_URL = typeof window !== 'undefined' ? getApiBaseUrl() : 'http://localhost:3001';

