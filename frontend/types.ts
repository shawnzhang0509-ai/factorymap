
export interface ShopBase {
  id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone: string;
  /** New member badge */
  new_girls_last_15_days?: boolean;
  /** Primary MBTI type (e.g. INTJ) — stored in badge_text */
  badge_text: string;
  /** City shown on profile */
  filter_city?: string;
  /** Age (optional integer) */
  min_spend?: number;
  /** Interests — comma-separated */
  main_product?: string;
  can_edit?: boolean;
}

export interface ShopCreate extends ShopBase {
  pictures: File[];
}

export interface Shop extends ShopBase {
  id: number;
  pictures: PictureDTO[];
  /** Bio / about me */
  about_me?: string;
  /** Looking for — comma-separated keys (friends, dating, …) */
  additional_price?: string;
}

/** @deprecated Use Shop — kept for incremental migration */
export type Profile = Shop;
export type ProfileBase = ShopBase;
export type ProfileCreate = ShopCreate;

export interface PictureDTO {
  id: number;
  url: string;
}

export interface ShopEdit extends Shop {
  newPictures: File[];
  removePictureIds: number[];
}

export interface UserLocation {
  lat: number;
  lng: number;
}

export interface AuthUser {
  id: number;
  username: string;
  is_admin: boolean;
  is_ad_manager?: boolean;
}
