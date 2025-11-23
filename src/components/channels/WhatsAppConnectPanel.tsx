// @ts-nocheck
// src/components/channels/WhatsAppConnectPanel.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { connectWhatsAppChannel, getWhatsAppQr, getChannelStatus } from '@/lib/api';
import { websocketService } from '@/lib/websocket';
import { ChannelStatusResponse, WhatsAppQrResponse } from '@/types/channel';

interface WhatsAppConnectPanelProps {
    channelId: string;
}

export function WhatsAppConnectPanel({ channelId }: WhatsAppConnectPanelProps) {
    const [status, setStatus] = useState<ChannelStatusResponse | null>(null);
    const [qrData, setQrData] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isPolling, setIsPolling] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch current status
    const fetchStatus = useCallback(async () => {
        try {
            const statusData = await getChannelStatus(channelId);
            setStatus(statusData);
            setError(null);

            // If connected, stop polling and clear QR
            if (statusData.status === 'connected') {
                setIsPolling(false);
                setQrData(null);
                alert('WhatsApp 已成功连接！');
            } else if (statusData.status === 'error') {
                setIsPolling(false);
                setQrData(null);
                setError(statusData.lastError || '连接出现错误');
            }
        } catch (err) {
            console.error('获取状态失败:', err);
            setError('获取状态失败');
        }
    }, [channelId]);

    // Fetch QR code
    const fetchQrCode = useCallback(async () => {
        try {
            const qrResponse: WhatsAppQrResponse = await getWhatsAppQr(channelId);
            setQrData(qrResponse.qrData);
            setError(null);
        } catch (err) {
            console.error('获取二维码失败:', err);
            setError('获取二维码失败');
        }
    }, [channelId]);

    // Use WebSocket events when polling is active; fall back to one-time fetchStatus
    useEffect(() => {
        if (!isPolling) return;

        // Attach websocket listeners for this channel
        const handleQr = (data: unknown) => {
            if (!data || typeof data !== 'object') return;
            const d = data as { channelId?: string; qr?: string };
            if (d.channelId === channelId && d.qr) {
                setQrData(d.qr);
            }
        };

        const handleStatus = (data: unknown) => {
            if (!data || typeof data !== 'object') return;
            const d = data as { channelId?: string; status?: string; deviceInfo?: any; lastHeartbeatAt?: string };
            if (d.channelId === channelId && d.status) {
                setStatus({ status: d.status as any, deviceInfo: d.deviceInfo, lastHeartbeatAt: d.lastHeartbeatAt } as any);

                if (d.status === 'connected') {
                    setIsPolling(false);
                    setQrData(null);
                    alert('WhatsApp 已成功连接！');
                } else if (d.status === 'error') {
                    setIsPolling(false);
                    setQrData(null);
                    setError('连接出现错误');
                }
            }
        };

        websocketService.on('whatsapp-qr-update', handleQr);
        websocketService.on('whatsapp-status-update', handleStatus);
        websocketService.on('whatsapp-connected', handleStatus);

        // Ensure an initial check right away (fallback)
        fetchStatus();

        return () => {
            websocketService.off('whatsapp-qr-update', handleQr);
            websocketService.off('whatsapp-status-update', handleStatus);
            websocketService.off('whatsapp-connected', handleStatus);
        };
    }, [isPolling, channelId, fetchStatus]);

    // Initial status fetch
    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    // Handle connect button click
    const handleConnect = async () => {
        setIsConnecting(true);
        setError(null);
        try {
            await connectWhatsAppChannel(channelId);
            alert('开始连接 WhatsApp，请稍候...');
            setIsPolling(true);
            // Fetch QR code immediately after starting connection
            await fetchQrCode();
        } catch (err) {
            console.error('连接失败:', err);
            setError('连接失败，请重试');
        } finally {
            setIsConnecting(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'connected': return 'text-green-600';
            case 'connecting': return 'text-yellow-600';
            case 'error': return 'text-red-600';
            default: return 'text-gray-600';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'connected': return '已连接';
            case 'connecting': return '连接中';
            case 'error': return '异常';
            default: return '未连接';
        }
    };

    return (
        <div className="bg-white border rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">WhatsApp 连接</h3>
                {status && (
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(status.status)} bg-opacity-20`}>
                        {getStatusText(status.status)}
                    </span>
                )}
            </div>

            <div className="space-y-4">
                {/* Disconnected state - show connect button */}
                {status?.status === 'disconnected' && (
                    <div className="text-center">
                        <p className="mb-4 text-gray-600">
                            点击下方按钮生成二维码，然后用 WhatsApp 扫描登录
                        </p>
                        <button
                            onClick={handleConnect}
                            disabled={isConnecting}
                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isConnecting ? '连接中...' : '生成 QR 码'}
                        </button>
                    </div>
                )}

                {/* Connecting state - show QR code */}
                {status?.status === 'connecting' && qrData && (
                    <div className="text-center">
                        <p className="mb-4 text-gray-600">
                            请用 WhatsApp 扫描以下二维码完成登录
                        </p>
                        <div className="inline-block p-4 bg-white border rounded-lg">
                            {/* QR Code rendering - using a simple approach */}
                            <div className="text-xs text-gray-500 mb-2">QR Code:</div>
                            <div className="font-mono text-xs break-all max-w-xs mx-auto">
                                {qrData}
                            </div>
                        </div>
                        <p className="mt-4 text-sm text-gray-500">
                            二维码将在连接成功后自动消失
                        </p>
                    </div>
                )}

                {/* Connected state - show device info */}
                {status?.status === 'connected' && status.deviceInfo && (
                    <div className="text-green-600">
                        <p className="font-medium">✅ WhatsApp 已成功连接</p>
                        <div className="mt-2 text-sm text-gray-600 space-y-1">
                            {status.deviceInfo.name && <p>设备: {status.deviceInfo.name}</p>}
                            {status.deviceInfo.platform && <p>平台: {status.deviceInfo.platform}</p>}
                        </div>
                        {status.lastHeartbeatAt && (
                            <p className="mt-2 text-xs text-gray-500">
                                最后心跳: {new Date(status.lastHeartbeatAt).toLocaleString()}
                            </p>
                        )}
                    </div>
                )}

                {/* Error state */}
                {error && (
                    <div className="text-red-600">
                        <p className="font-medium">❌ 连接出现错误</p>
                        <p className="mt-1 text-sm">{error}</p>
                    </div>
                )}

                {/* Loading state for initial load */}
                {!status && !error && (
                    <div className="text-center text-gray-500">
                        <p>加载中...</p>
                    </div>
                )}
            </div>
        </div>
    );
}
// @ts-nocheck
