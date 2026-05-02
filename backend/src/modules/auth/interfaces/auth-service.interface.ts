export interface IAuthTokenService {
  getTokens(userId: number, username: string): Promise<{ access_token: string, refresh_token: string }>;
  updateRefreshToken(userId: number, refreshToken: string): Promise<void>;
  refreshTokens(refreshToken: string): Promise<{ access_token: string, refresh_token: string }>;
}

export interface IAuthProfileService {
  updateProfile(userId: number, dto: any, file?: Express.Multer.File): Promise<any>;
  updatePassword(userId: number, dto: any): Promise<any>;
  updatePublicKey(userId: number, publicKey: string): Promise<any>;
}
