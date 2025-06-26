declare module 'ali-oss' {
  interface OSSOptions {
    region: string;
    accessKeyId: string;
    accessKeySecret: string;
    bucket: string;
    authorizationV4?: boolean;
  }

  interface PutResult {
    name: string;
    url: string;
    res?: {
      status: number;
    };
  }

  interface PutOptions {
    headers?: {
      'Content-Type'?: string;
      'Cache-Control'?: string;
      [key: string]: any;
    };
  }

  class OSS {
    constructor(options: OSSOptions);
    put(name: string, file: Buffer | string, options?: PutOptions): Promise<PutResult>;
  }

  export = OSS;
} 