// @ts-nocheck
// src/components/channels/ChannelList.tsx

'use client';

import { useState } from 'react';
import { Channel } from '@/types/channel';
import { ChannelCard } from './ChannelCard';
import { AddChannelModal } from './AddChannelModal';
import { EditChannelModal } from './EditChannelModal';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { deleteChannel } from '../../lib/api';
import { apiGet } from '@/api/client';
import { useToast } from '@/core/hooks/use-toast';
import { Button } from '../../common/components/ui/button';
import { Plus } from 'lucide-react';

interface ChannelListProps {
  channels: Channel[];
  onChannelsChange: (channels: Channel[]) => void;
  onDisconnect?: (channel: Channel) => void;
}

export function ChannelList({ channels, onChannelsChange, onDisconnect }: ChannelListProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [deletingChannel, setDeletingChannel] = useState<Channel | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const handleAddChannelClick = async () => {
    try {
      const response = await apiGet<{ maxChannels: number; currentChannels: number }>('/api/channels/limits');
      if (response && typeof response.maxChannels === 'number') {
        if (response.currentChannels >= response.maxChannels) {
          alert('Channel limit reached. Please contact support to upgrade.');
          return;
        }
      }
      setIsAddModalOpen(true);
    } catch (error) {
      console.error('Failed to check limits:', error);
      setIsAddModalOpen(true);
    }
  };

  const handleAddChannel = (newChannel: Channel) => {
    onChannelsChange([...channels, newChannel]);
  };

  const handleEditChannel = (channel: Channel) => {
    setEditingChannel(channel);
  };

  const handleUpdateChannel = (updatedChannel: Channel) => {
    const newChannels = channels.map(channel =>
      channel.id === updatedChannel.id ? updatedChannel : channel
    );
    onChannelsChange(newChannels);
    setEditingChannel(null);
  };

  const handleDeleteChannel = (channelId: string) => {
    const channel = channels.find(c => c.id === channelId);
    if (channel) {
      setDeletingChannel(channel);
    }
  };

  const confirmDeleteChannel = async (channelId: string) => {
    setIsDeleting(true);
    
    try {
      await deleteChannel(channelId);
      
      const newChannels = channels.filter(channel => channel.id !== channelId);
      onChannelsChange(newChannels);
      
      toast({
        title: "删除成功",
        description: "渠道删除成功",
        variant: "default"
      });
      
      setDeletingChannel(null);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '删除渠道失败，请重试';
      toast({
        title: "删除失败",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCloseDeleteDialog = () => {
    if (!isDeleting) {
      setDeletingChannel(null);
    }
  };

  if (channels.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="space-y-4">
          <p className="text-gray-500">暂无渠道，请点击下方按钮添加渠道</p>
          <Button
            onClick={handleAddChannelClick}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            新增渠道
          </Button>
        </div>
        
        <AddChannelModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onAdd={handleAddChannel}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">渠道列表</h2>
        <Button
          onClick={handleAddChannelClick}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          新增渠道
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {channels.map(channel => (
          <ChannelCard
            key={channel.id}
            channel={channel}
            onDelete={handleDeleteChannel}
            onEdit={handleEditChannel}
            onDisconnect={onDisconnect}
          />
        ))}
      </div>

      {/* Modals */}
      <AddChannelModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddChannel}
      />

      <EditChannelModal
        isOpen={!!editingChannel}
        onClose={() => setEditingChannel(null)}
        channel={editingChannel}
        onUpdate={handleUpdateChannel}
      />

      <ConfirmDeleteDialog
        isOpen={!!deletingChannel}
        onClose={handleCloseDeleteDialog}
        channel={deletingChannel}
        onConfirm={confirmDeleteChannel}
        isDeleting={isDeleting}
      />
    </div>
  );
}
