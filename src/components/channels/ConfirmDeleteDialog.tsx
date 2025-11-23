// src/components/channels/ConfirmDeleteDialog.tsx

'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../common/components/ui/alert-dialog';
import { Button } from '../../common/components/ui/button';
import { AlertTriangle, Trash2 } from 'lucide-react';
// @ts-nocheck
import { Channel } from '@/types/channel';

interface ConfirmDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  channel: Channel | null;
  onConfirm: (channelId: string) => Promise<void>;
  isDeleting: boolean;
}

export function ConfirmDeleteDialog({
  isOpen,
  onClose,
  channel,
  onConfirm,
  isDeleting
}: ConfirmDeleteDialogProps) {
  const handleConfirm = async () => {
    if (channel) {
      await onConfirm(channel.id);
    }
  };

  const isConnected = channel && (
    (channel as { status?: string }).status === 'connected' ||
    (channel as { status?: string }).status === 'online' ||
    (channel as { status?: string }).status === 'active'
  );

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            确认删除渠道
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              您确定要删除渠道 <strong>"{channel?.name}"</strong> 吗？
            </p>
            {isConnected && (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                <span className="text-sm text-yellow-700">
                  该渠道当前处于连接状态，删除后将自动断开连接。
                </span>
              </div>
            )}
            <p className="text-sm text-gray-600">
              此操作无法撤销，相关的配置和连接信息将被永久删除。
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={isDeleting}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {isDeleting ? '删除中...' : '确认删除'}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
