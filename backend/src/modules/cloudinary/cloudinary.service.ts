import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  constructor(private configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadImage(
    file: Express.Multer.File,
    folder: string = 'users',
  ): Promise<UploadApiResponse | UploadApiErrorResponse> {
    console.log(`Starting Cloudinary upload for file: ${file.originalname}, size: ${file.size}`);
    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        {
          folder: folder,
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            return reject(error);
          }
          if (!result) {
            console.error('Cloudinary upload failed: No result');
            return reject(new Error('Cloudinary upload failed'));
          }
          console.log('Cloudinary upload success:', result.secure_url);
          resolve(result);
        },
      );

      if (!file.buffer) {
        console.error('File buffer is missing');
        return reject(new Error('File buffer is missing'));
      }
      upload.end(file.buffer);
    });
  }
}
