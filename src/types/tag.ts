export interface Tag {
  id: number;
  name: string;
  tagType: number;
  fatherId: number;
  ind: number;
  funcType: number;
  sourceId: number;
  isUse: boolean;
  icon: string;
  selected: boolean;
  updaterId: number;
  updateTime: string;
  // Additional properties for UI state
  children?: Tag[];
  expanded?: boolean;
}

export interface TagsResponse {
  code: number;
  msg: string;
  rows: Tag[];
}

export interface SelectedTag {
  id: number;
  name: string;
  parentId?: number;
  parentName?: string;
} 