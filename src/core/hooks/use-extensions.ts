import { ExtensionDefinition } from "@cardos/extension";
import { useEffect, useRef, useState } from "react";
import { extensionManager } from "../extension-manager";

export const useExtensions = (extensions: ExtensionDefinition<unknown>[]) => {
    const [initialized, setInitialized] = useState(false);
    const processedExtensionsRef = useRef<Set<string>>(new Set());

    // 注册 extensions（只在首次或新增时）
    useEffect(() => {
        extensions.filter(Boolean).forEach((extension) => {
            if (!extension?.manifest?.id) {
                console.warn('Extension missing manifest or id:', extension);
                return;
            }
            const extensionId = extension.manifest.id;
            if (!extensionManager.getExtension(extensionId)) {
                extensionManager.registerExtension(extension);
            }
        });
    }, [extensions]);

    // 激活 extensions（只在首次或新增时）
    useEffect(() => {
        const validExtensions = extensions.filter(Boolean).filter(ext => ext?.manifest?.id);
        const currentExtensionIds = new Set(validExtensions.map(ext => ext.manifest.id));
        const processedIds = processedExtensionsRef.current;

        // 激活新的 extensions
        validExtensions.forEach((extension) => {
            const extensionId = extension.manifest.id;
            if (!processedIds.has(extensionId)) {
                extensionManager.activateExtension(extensionId);
                processedIds.add(extensionId);
            }
        });

        // 停用不再需要的 extensions
        const idsToDeactivate = Array.from(processedIds).filter(id => !currentExtensionIds.has(id));
        idsToDeactivate.forEach(extensionId => {
            extensionManager.deactivateExtension(extensionId);
            processedIds.delete(extensionId);
        });

        setInitialized(true);
    }, [extensions]);

    // 清理函数（组件卸载时）
    useEffect(() => {
        return () => {
            const processedIds = processedExtensionsRef.current;
            const idsToCleanup = Array.from(processedIds);
            idsToCleanup.forEach(extensionId => {
                extensionManager.deactivateExtension(extensionId);
            });
            processedIds.clear();
        };
    }, []);

    return {
        initialized,
    };
};