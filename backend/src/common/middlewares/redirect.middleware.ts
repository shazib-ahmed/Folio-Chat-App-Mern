import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RedirectMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const targetUrl = 'https://github.com/shazib-ahmed/Folio-Chat-App-Mern';
    const path = req.path.replace(/\/$/, ''); // Remove trailing slash
    
    if (path === '' || path === '/api') {
      return res.redirect(301, targetUrl);
    }
    
    next();
  }
}
