import fs from 'fs';
import OpenAI from 'openai';
import 'multer'; // Ensure Multer types are loaded
import { prisma } from '../../db/prisma';
import { logger } from '../../utils/logger';
import { ApiError } from '../../utils/errors';

const apiKey = process.env.OPENAI_API_KEY;
const client = apiKey ? new OpenAI({ apiKey }) : null;

export async function getOrCreateKnowledgeBase(agentId: string) {
  let kb = await prisma.knowledgeBase.findUnique({ where: { agentId } });
  if (!kb) {
    kb = await prisma.knowledgeBase.create({
      data: { agentId },
    });
  }
  return kb;
}

export async function uploadKnowledgeFile(agentId: string, file: Express.Multer.File) {
  if (!client) throw new ApiError(500, 'OpenAI API key not configured');

  const kb = await getOrCreateKnowledgeBase(agentId);

  try {
    // 1. Upload file to OpenAI
    const openaiFile = await client.files.create({
      file: fs.createReadStream(file.path),
      purpose: 'assistants',
    });

    // 2. Get or Create Vector Store
    let vectorStoreId = kb.openaiVectorStoreId;
    if (!vectorStoreId) {
        const vs = await (client.beta as any).vectorStores.create({
        name: `KB-Agent-${agentId}`,
      });
      vectorStoreId = vs.id;
      await prisma.knowledgeBase.update({
        where: { id: kb.id },
        data: { openaiVectorStoreId: vectorStoreId },
      });
    }

    // 3. Add file to Vector Store
      await (client.beta as any).vectorStores.files.create(vectorStoreId, {
      file_id: openaiFile.id,
    });

    // 4. Save to DB
    const knowledgeFile = await prisma.knowledgeFile.create({
      data: {
        knowledgeBaseId: kb.id,
        fileName: file.originalname,
        fileSize: file.size,
        openaiFileId: openaiFile.id,
      },
    });

    // Cleanup local file
    fs.unlinkSync(file.path);

    return knowledgeFile;
  } catch (err) {
    logger.error({ err, agentId }, 'Failed to upload knowledge file');
    // Cleanup local file if exists
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    throw new ApiError(500, 'Failed to upload file to knowledge base');
  }
}

export async function deleteKnowledgeFile(agentId: string, fileId: string) {
  if (!client) throw new ApiError(500, 'OpenAI API key not configured');

  const file = await prisma.knowledgeFile.findUnique({
    where: { id: fileId },
    include: { knowledgeBase: true },
  });

  if (!file || file.knowledgeBase.agentId !== agentId) {
    throw new ApiError(404, 'File not found');
  }

  try {
    // 1. Remove from Vector Store
    if (file.knowledgeBase.openaiVectorStoreId) {
      try {
          await (client.beta as any).vectorStores.files.del(
          file.knowledgeBase.openaiVectorStoreId,
          file.openaiFileId
        );
      } catch (e) {
        logger.warn({ err: e }, 'Failed to delete file from vector store (might be already deleted)');
      }
    }

    // 2. Delete from OpenAI Files
    try {
      await client.files.del(file.openaiFileId);
    } catch (e) {
      logger.warn({ err: e }, 'Failed to delete file from OpenAI (might be already deleted)');
    }

    // 3. Delete from DB
    await prisma.knowledgeFile.delete({ where: { id: fileId } });
  } catch (err) {
    logger.error({ err, fileId }, 'Failed to delete knowledge file');
    throw new ApiError(500, 'Failed to delete file');
  }
}

export async function listKnowledgeFiles(agentId: string) {
  const kb = await prisma.knowledgeBase.findUnique({
    where: { agentId },
    include: { files: { orderBy: { createdAt: 'desc' } } },
  });
  return kb?.files || [];
}
