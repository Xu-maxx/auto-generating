import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

export interface DownloadResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

/**
 * Download a video from URL and save it to a specific folder
 */
export async function downloadVideo(
  videoUrl: string,
  folderName: string,
  originalFilename: string,
  taskId: string
): Promise<DownloadResult> {
  try {
    // Create downloads directory structure
    const downloadsDir = path.join(process.cwd(), 'downloads');
    const folderDir = path.join(downloadsDir, folderName);
    
    // Ensure directories exist
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }
    
    if (!fs.existsSync(folderDir)) {
      fs.mkdirSync(folderDir, { recursive: true });
    }

    // Generate filename with timestamp and task ID
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileExtension = path.extname(originalFilename) || '.mp4';
    const baseFilename = path.basename(originalFilename, fileExtension);
    const filename = `${baseFilename}_${timestamp}_${taskId.substring(0, 8)}${fileExtension}`;
    const filePath = path.join(folderDir, filename);

    console.log(`Downloading video from ${videoUrl} to ${filePath}`);

    // Download the video
    await downloadFile(videoUrl, filePath);

    console.log(`Successfully downloaded video to: ${filePath}`);
    
    return {
      success: true,
      filePath: filePath
    };
  } catch (error) {
    console.error('Error downloading video:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown download error'
    };
  }
}

/**
 * Download a file from URL to local path
 */
function downloadFile(url: string, filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;
    
    const request = protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          console.log(`Redirecting to: ${redirectUrl}`);
          downloadFile(redirectUrl, filePath).then(resolve).catch(reject);
          return;
        }
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      const fileStream = fs.createWriteStream(filePath);
      
      response.pipe(fileStream);
      
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
      
      fileStream.on('error', (error) => {
        fs.unlink(filePath, () => {}); // Delete partial file
        reject(error);
      });
    });
    
    request.on('error', (error) => {
      reject(error);
    });
    
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Download timeout'));
    });
  });
}

/**
 * Get the relative path from project root for display
 */
export function getRelativePath(absolutePath: string): string {
  const projectRoot = process.cwd();
  return path.relative(projectRoot, absolutePath);
} 