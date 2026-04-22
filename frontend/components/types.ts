// src/types.ts

// 图片对象定义
export interface Picture {
  id?: number;
  url: string;
}

// 用户位置定义
export interface UserLocation {
  lat: number;
  lng: number;
}

// 🔥 核心：店铺对象定义 (对应数据库结构)
// 这里包含了你刚才要求的 about_me 和 additional_price
export interface Shop {
  id: number;
  name: string;
  address: string;
  phone: string;
  lat: number;
  lng: number;
  description?: string;       // 可选：普通描述
  badge_text?: string;        // 可选：标签文本
  new_girls_last_15_days?: boolean; // 可选：是否新店
  pictures?: Picture[];       // 可选：图片列表
  can_edit?: boolean;         // 当前登录用户是否可编辑
  
  // ✅ 新增字段 (必须在这里定义，否则 TS 会报错)
  about_me?: string;          // 技师/店铺自我介绍
  additional_price?: string;  // 额外价格说明
  filter_city?: string;
  min_spend?: number;
}

// 🔥 创建店铺时的数据类型 (用于 AdminPanel 表单)
// 这个类型允许 pictures 是 File 对象 (上传前) 或 Picture 对象 (上传后)
export interface ShopCreate {
  name: string;
  address: string;
  phone: string;
  lat: number;
  lng: number;
  description?: string;
  badge_text?: string;
  new_girls_last_15_days?: boolean;
  // 注意：这里 pictures 可以是 File 数组 (前端上传时) 或 Picture 数组 (后端返回时)
  pictures?: (File | Picture)[]; 
  
  // ✅ 新增字段
  about_me?: string;
  additional_price?: string;
  /** Admin-only map region chip */
  filter_city?: string;
  min_spend?: number;
}