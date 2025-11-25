import { Request, Response } from 'express';
import { uploadKnowledgeFile, deleteKnowledgeFile, listKnowledgeFiles } from './knowledge.service';
import { logger } from '../../utils/logger';

export class KnowledgeController {
  static async upload(req: Request, res: Response) {
    const { agentId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      const result = await uploadKnowledgeFile(agentId, file);
      return res.json(result);
    } catch (error: any) {
      logger.error({ error, agentId }, 'Upload failed');
      return res.status(error.statusCode || 500).json({ error: error.message });
    }
  }

  static async list(req: Request, res: Response) {
    const { agentId } = req.params;
    try {
      const files = await listKnowledgeFiles(agentId);
      return res.json(files);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async delete(req: Request, res: Response) {
    const { agentId, fileId } = req.params;
    try {
      await deleteKnowledgeFile(agentId, fileId);
      return res.json({ ok: true });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({ error: error.message });
    }
  }
}
