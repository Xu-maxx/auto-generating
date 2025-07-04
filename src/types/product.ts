export interface Product {
  id: number;
  productName: string;
  productNameChild: string;
  productBrandId: number;
  productBrandName: string;
  productCategoryId: number;
  productCategoryName: string;
  productSpecificationsId: number;
  productSpecificationsName: string;
  productClassifyId: number;
  productClassifyName: string;
  productClassify2Id: number;
  productClassify2Name: string;
  productEffectId: number;
  productEffectName: string;
  keyPoint: string;
  customProductList: CustomProduct[];
}

export interface CustomProduct {
  id: number;
  customId: number;
  productId: number;
}

export interface ProductListResponse {
  code: number;
  msg: string;
  total: number;
  rows: Product[];
}

export interface ProductStyle {
  id: number;
  productId: number;
  style: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  username: string;
  password: string;
  code: string;
  uuid: string;
}

export interface LoginResponse {
  code: number;
  msg: string;
  token: string;
}

export interface CaptchaResponse {
  code: number;
  msg: string;
  uuid: string;
  img: string;
}

export interface MaterialSubmitRequest {
  materialType: number; // 3001 - 口播, 4001 - 空境
  materialFileType: number; // 1002 - mp4, 1008 - mov, 2004 - png, 2002 - jpg
  productId: number;
  tags: string;
}

export interface MaterialSubmitResponse {
  code: number;
  data: {
    filePath: string;
    materialId: number;
  };
}

export interface MaterialStatusRequest {
  materialId: number;
  dealStatus: number; // 1-成功, 2-失败
  msg: string;
}

export interface MaterialStatusResponse {
  code: number;
} 