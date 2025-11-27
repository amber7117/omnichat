import type { Response, NextFunction } from 'express';
import type { AuthedRequest } from '../../types/http';
import { osintService } from './osint.service';

export const OsintController = {
  async search(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.auth) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const { phone } = req.body;
      if (!phone) {
        res.status(400).json({ message: 'Phone number is required' });
        return;
      }

      const results = await osintService.searchPhoneNumber(phone);
      res.json({ ok: true, results });
    } catch (err) {
      next(err);
    }
  }
};
