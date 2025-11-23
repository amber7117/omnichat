import { Prisma, type ChannelType, type ChannelConnectionStatus } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { ApiError } from '../../utils/errors';

interface CreateChannelInput {
  name: string;
  type: ChannelType;
  metadata?: Record<string, unknown>;
  config?: Record<string, unknown>;
  externalId?: string;
}

export async function createChannelInstance(tenantId: string, input: CreateChannelInput) {
  return prisma.channelInstance.create({
    data: {
      tenantId,
      name: input.name,
      type: input.type,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
      config: input.config as Prisma.InputJsonValue | undefined,
      externalId: input.externalId,
      status: 'DISCONNECTED',
    },
  });
}

export async function listChannelInstances(tenantId: string) {
  return prisma.channelInstance.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getChannelInstance(tenantId: string, id: string) {
  const channel = await prisma.channelInstance.findFirst({ where: { id, tenantId } });
  if (!channel) {
    throw new ApiError(404, 'Channel instance not found');
  }
  return channel;
}

export async function updateChannelStatus(id: string, status: ChannelConnectionStatus, metadata?: Record<string, unknown>) {
  return prisma.channelInstance.update({
    where: { id },
    data: { status, metadata: metadata as Prisma.InputJsonValue | undefined },
  });
}

export async function deleteChannelInstance(tenantId: string, id: string) {
  const channel = await prisma.channelInstance.findFirst({ where: { id, tenantId } });
  if (!channel) {
    throw new ApiError(404, 'Channel instance not found');
  }
  return prisma.channelInstance.delete({
    where: { id },
  });
}
