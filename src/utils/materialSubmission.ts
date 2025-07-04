import ApiClient from './apiClient';

export interface MaterialSubmissionData {
  materialType: number; // 3001 - 口播, 4001 - 空境  
  materialFileType: number; // 1002 - mp4, 1008 - mov（透明背景）, 2004 - png, 2002 - jpg
  productId: number; // Product ID instead of project ID
  tags: string; // 标签名称，用逗号隔开，只支持中英文数字
}

export interface MaterialSubmissionResponse {
  code: number;
  data: {
    filePath: string; // 用于存放上传文件的路径
    materialId: number; // 素材ID，后续处理使用
  };
}

export interface MaterialStatusUpdate {
  materialId: number; // 提交接口返回的materialId
  dealStatus: number; // 1-成功 2-失败
  msg: string; // 失败原因
  keyframesUrl: string; // 缩略帧相对路径地址 (required in status update)
}

export interface MaterialStatusUpdateResponse {
  code: number;
}

export class MaterialSubmissionService {
  private static instance: MaterialSubmissionService;
  private apiClient: ApiClient;

  private constructor() {
    this.apiClient = ApiClient.getInstance();
  }

  public static getInstance(): MaterialSubmissionService {
    if (!MaterialSubmissionService.instance) {
      MaterialSubmissionService.instance = new MaterialSubmissionService();
    }
    return MaterialSubmissionService.instance;
  }

  /**
   * Step 1: Submit material information and get file path and material ID
   * 提交视频接口 - 用于提交视频任务前获取上传路径及素材ID
   */
  async preSubmitMaterial(data: MaterialSubmissionData): Promise<MaterialSubmissionResponse> {
    try {
      // Get fresh token each time
      const token = this.apiClient.getToken();
      
      console.log('🔍 DEBUG: MaterialSubmissionService preSubmitMaterial token check:', {
        hasToken: !!token,
        tokenLength: token ? token.length : 0,
        tokenPreview: token ? token.substring(0, 20) + '...' : 'No token',
        isAuthenticated: this.apiClient.isAuthenticated()
      });

      if (!token) {
        throw new Error('Not authenticated - no token available');
      }

      console.log('📤 Material pre-submission request JSON:', JSON.stringify(data, null, 2));

      const response = await fetch('/api/material/pre-submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });

      console.log('🔍 DEBUG: Pre-submit response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔍 DEBUG: Pre-submit error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const result: MaterialSubmissionResponse = await response.json();
      
      console.log('✅ Material pre-submission response:', {
        code: result.code,
        success: result.code === 200,
        data: {
          filePath: result.data?.filePath,
          materialId: result.data?.materialId,
          filePathLength: result.data?.filePath?.length || 0,
          isWindowsPath: result.data?.filePath?.includes('\\') || false,
          isNetworkPath: result.data?.filePath?.startsWith('Z:') || false
        },
        originalRequest: {
          materialType: data.materialType,
          productId: data.productId,
          tags: data.tags
        }
      });
      
      if (result.code !== 200) {
        throw new Error(`API error: ${result.code}`);
      }

      return result;
    } catch (error) {
      console.error('Error in preSubmitMaterial:', error);
      throw error;
    }
  }

  /**
   * Step 2: Update material status after file placement
   * 视频状态更新接口 - 文件放置后需将状态提交给vh（成功或失败）
   */
  async updateMaterialStatus(data: MaterialStatusUpdate): Promise<MaterialStatusUpdateResponse> {
    try {
      // Get fresh token each time
      const token = this.apiClient.getToken();
      
      console.log('🔍 DEBUG: MaterialSubmissionService updateMaterialStatus token check:', {
        hasToken: !!token,
        tokenLength: token ? token.length : 0,
        tokenPreview: token ? token.substring(0, 20) + '...' : 'No token',
        isAuthenticated: this.apiClient.isAuthenticated()
      });

      if (!token) {
        throw new Error('Not authenticated - no token available');
      }

      console.log('📤 Material status update request JSON:', JSON.stringify(data, null, 2));

      const response = await fetch('/api/material/status-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });

      console.log('🔍 DEBUG: Status update response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔍 DEBUG: Status update error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const result: MaterialStatusUpdateResponse = await response.json();
      
      console.log('🔍 DEBUG: Status update result:', {
        code: result.code
      });
      
      if (result.code !== 200) {
        throw new Error(`API error: ${result.code}`);
      }

      return result;
    } catch (error) {
      console.error('Error in updateMaterialStatus:', error);
      throw error;
    }
  }

  /**
   * Helper method to determine material type based on content
   */
  static getMaterialType(type: 'avatar' | 'material'): number {
    switch (type) {
      case 'avatar':
        return 3001; // 口播
      case 'material':
        return 4001; // 空境
      default:
        return 4001; // Default to 空境
    }
  }

  /**
   * Helper method to determine file type based on extension
   */
  static getFileType(extension: string): number {
    switch (extension.toLowerCase()) {
      case 'mp4':
        return 1002;
      case 'mov':
        return 1008; // 透明背景
      case 'png':
        return 2004;
      case 'jpg':
      case 'jpeg':
        return 2002;
      default:
        return 1002; // Default to mp4
    }
  }

  /**
   * Helper method to validate tags format
   */
  static validateTags(tags: string): boolean {
    // 只支持中英文数字和逗号
    const pattern = /^[a-zA-Z0-9\u4e00-\u9fa5,]+$/;
    return pattern.test(tags);
  }

  private getFileTypeDescription(fileType: number): string {
    switch (fileType) {
      case 1002:
        return 'mp4';
      case 1008:
        return 'mov (透明背景)';
      case 2004:
        return 'png';
      case 2002:
        return 'jpg';
      default:
        return 'Unknown';
    }
  }
}

export default MaterialSubmissionService; 