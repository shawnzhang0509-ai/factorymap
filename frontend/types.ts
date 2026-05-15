
export interface ShopBase {
  id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone: string;
  new_girls_last_15_days?: boolean;
  badge_text: string;
  /** Admin-only: economic zone (see CHINA_ECONOMIC_ZONES) */
  filter_city?: string;
  /** MOQ / trade capacity tier 1–4 (see moqTiers) */
  min_spend?: number;
  main_product?: string;
  can_edit?: boolean;
}

export interface ShopCreate extends ShopBase {
  pictures: File[];  
}

export interface Shop extends ShopBase {
  id: number;
  pictures: PictureDTO[];
}

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
