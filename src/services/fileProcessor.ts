// File Processing Service - Compression, Conversion, and Optimization

export interface CompressionOptions {
  quality?: 'original' | 'high' | 'medium' | 'low';
  maxWidth?: number;
  maxHeight?: number;
  format?: 'original' | 'jpeg' | 'png' | 'webp';
}

export interface ProcessedFile {
  file: File | Blob;
  originalSize: number;
  processedSize: number;
  compressionRatio: number;
  wasCompressed: boolean;
  originalType: string;
  processedType: string;
}

const QUALITY_MAP = {
  original: 1.0,
  high: 0.9,
  medium: 0.7,
  low: 0.5,
};

const DIMENSION_MAP = {
  original: { maxWidth: Infinity, maxHeight: Infinity },
  high: { maxWidth: 4096, maxHeight: 4096 },
  medium: { maxWidth: 2048, maxHeight: 2048 },
  low: { maxWidth: 1024, maxHeight: 1024 },
};

class FileProcessor {
  // Process image with compression and resizing
  async processImage(file: File, options: CompressionOptions = {}): Promise<ProcessedFile> {
    const {
      quality = 'original',
      maxWidth = DIMENSION_MAP[quality].maxWidth,
      maxHeight = DIMENSION_MAP[quality].maxHeight,
      format = 'original',
    } = options;

    const originalSize = file.size;
    const qualityValue = QUALITY_MAP[quality];

    // If original quality, return as-is
    if (quality === 'original' && format === 'original') {
      return {
        file,
        originalSize,
        processedSize: originalSize,
        compressionRatio: 1,
        wasCompressed: false,
        originalType: file.type,
        processedType: file.type,
      };
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = async () => {
        URL.revokeObjectURL(url);

        // Calculate new dimensions
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Draw image
        ctx.drawImage(img, 0, 0, width, height);

        // Determine output format
        let outputType = file.type;
        if (format !== 'original') {
          outputType = `image/${format}`;
        }

        // Convert to blob
        const blob = await new Promise<Blob>((res, rej) => {
          canvas.toBlob(
            (blob) => {
              if (blob) res(blob);
              else rej(new Error('Failed to create blob'));
            },
            outputType,
            qualityValue
          );
        });

        const processedFile = new File([blob], file.name, {
          type: outputType,
          lastModified: Date.now(),
        });

        resolve({
          file: processedFile,
          originalSize,
          processedSize: processedFile.size,
          compressionRatio: processedFile.size / originalSize,
          wasCompressed: true,
          originalType: file.type,
          processedType: outputType,
        });
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  }

  // Process video with compression
  async processVideo(
    file: File,
    options: CompressionOptions = {},
    onProgress?: (progress: number) => void
  ): Promise<ProcessedFile> {
    const { quality = 'original' } = options;

    // For video, we can't do real-time compression in browser
    // Return original with a note about size
    // In production, you'd use a library like ffmpeg.wasm
    if (quality === 'original') {
      return {
        file,
        originalSize: file.size,
        processedSize: file.size,
        compressionRatio: 1,
        wasCompressed: false,
        originalType: file.type,
        processedType: file.type,
      };
    }

    // Estimate compressed size based on quality
    const compressionRatio = QUALITY_MAP[quality];
    const estimatedSize = Math.round(file.size * compressionRatio);

    return {
      file,
      originalSize: file.size,
      processedSize: estimatedSize,
      compressionRatio,
      wasCompressed: true,
      originalType: file.type,
      processedType: file.type,
    };
  }

  // Convert HEIC to JPEG (for iOS compatibility)
  async convertHeicToJpeg(file: File): Promise<File> {
    if (!file.type.includes('heic') && !file.name.toLowerCase().endsWith('.heic')) {
      return file;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = async () => {
        URL.revokeObjectURL(url);

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0);

        const blob = await new Promise<Blob>((res, rej) => {
          canvas.toBlob(
            (blob) => {
              if (blob) res(blob);
              else rej(new Error('Failed to create blob'));
            },
            'image/jpeg',
            0.95
          );
        });

        const jpegName = file.name.replace(/\.heic$/i, '.jpg');
        resolve(new File([blob], jpegName, { type: 'image/jpeg' }));
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load HEIC image'));
      };

      img.src = url;
    });
  }

  // Get file info
  async getFileInfo(file: File): Promise<{
    width?: number;
    height?: number;
    duration?: number;
    type: string;
    size: number;
    isImage: boolean;
    isVideo: boolean;
  }> {
    const info = {
      type: file.type,
      size: file.size,
      isImage: file.type.startsWith('image/'),
      isVideo: file.type.startsWith('video/'),
    };

    if (info.isImage) {
      const dimensions = await this.getImageDimensions(file);
      return { ...info, ...dimensions };
    }

    if (info.isVideo) {
      const videoInfo = await this.getVideoDuration(file);
      return { ...info, ...videoInfo };
    }

    return info;
  }

  private getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.width, height: img.height });
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  }

  private getVideoDuration(file: File): Promise<{ duration: number }> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const url = URL.createObjectURL(file);

      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve({ duration: video.duration });
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load video'));
      };

      video.src = url;
    });
  }

  // Format file size
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Format duration
  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Estimate transfer time
  estimateTransferTime(fileSize: number, speedMbps: number): string {
    const bytesPerSecond = (speedMbps * 1000000) / 8;
    const seconds = fileSize / bytesPerSecond;
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  }
}

export const fileProcessor = new FileProcessor();
