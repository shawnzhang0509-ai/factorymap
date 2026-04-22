
export interface ShopBase {
  id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone: string;
  new_girls_last_15_days?: boolean;
  badge_text: string;
  /** Admin-only: fixed region for map filter (see REGION_OPTIONS) */
  filter_city?: string;
  /** Min. entry spend (NZD), optional; used for list filter and ShopCard */
  min_spend?: number;
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
}
