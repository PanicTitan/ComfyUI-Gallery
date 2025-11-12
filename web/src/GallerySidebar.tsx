import React, { useMemo, useCallback, memo, useRef, useState, useEffect } from 'react';
import { Tree, Spin, theme } from 'antd';
import { useGalleryContext } from './GalleryContext';
import type { FilesTree } from './types';
import { useDrop, useCountDown } from 'ahooks';
import FolderOutlined from '@ant-design/icons/lib/icons/FolderOutlined';
import { ComfyAppApi } from './ComfyAppApi';

interface TreeDataNode {
    title: string;
    key: string;
    icon?: React.ReactNode;
    children?: TreeDataNode[];
    isLeaf?: boolean;
}

// Optimize foldersToTreeData: avoid unnecessary array mutation, use const, and avoid .sort() if not needed
const foldersToTreeData = (data: FilesTree): TreeDataNode[] => {
    const foldersInput = data.folders;
    const tree: TreeDataNode[] = [];
    const nodeMap = new Map<string, TreeDataNode>();
    // Only sort if more than 1 path
    const paths = Object.keys(foldersInput);
    if (paths.length > 1) paths.sort();
    for (const fullPath of paths) {
        const segments = fullPath.split('/');
        let currentPath = "";
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            if (i > 0) currentPath += "/";
            currentPath += segment;
            if (!nodeMap.has(currentPath)) {
                const newNode: TreeDataNode = {
                    title: segment,
                    key: currentPath,
                    icon: <FolderOutlined />, // Always show folder icon
                    children: [],
                };
                nodeMap.set(currentPath, newNode);
                if (i === 0) {
                    tree.push(newNode);
                } else {
                    const parentPath = segments.slice(0, i).join('/');
                    const parentNode = nodeMap.get(parentPath);
                    if (parentNode) {
                        parentNode.children!.push(newNode);
                    }
                }
            }
        }
    }
    for (const node of nodeMap.values()) {
        if (!node.children || node.children.length === 0) {
            node.isLeaf = true;
        }
    }
    return tree;
};

// Memoize FolderTitle to avoid unnecessary re-renders
const FolderTitle = memo(({ nodeData, currentFolder }: { nodeData: any, currentFolder: string }) => {
    const { token } = theme.useToken();
    const folderRef = useRef<HTMLDivElement>(null);
    const { data, selectedImages, setSelectedImages } = useGalleryContext();

    // Get all image URLs in this folder
    const folderImages = React.useMemo(() => {
        if (!data?.folders || !data.folders[nodeData.key]) return [];
        return Object.values(data.folders[nodeData.key])
            .filter((img: any) => img && img.url)
            .map((img: any) => img.url);
    }, [data, nodeData.key]);

    // Check if all images in this folder are selected
    const allSelected = folderImages.length > 0 && folderImages.every(url => selectedImages.includes(url));

    // Handle click: ctrl/cmd toggles all images in folder
    const handleCardClick = (event: React.MouseEvent, folder: string) => {
        if (event.ctrlKey || event.metaKey) {
            event.stopPropagation();
            event.preventDefault();
            setSelectedImages((oldSelectedImages) => {
                if (allSelected) {
                    // Remove all folder images
                    return oldSelectedImages.filter(url => !folderImages.includes(url));
                } else {
                    // Add all folder images (avoid duplicates)
                    return Array.from(new Set([...oldSelectedImages, ...folderImages]));
                }
            });
        } else {
            setSelectedImages([]);
        }
    };

    useDrop(folderRef, {
        onDom: (content: any, e: any) => {
            try {
                // Accept drag data from ImageCard (should be JSON string with name, folder, etc)
                const dragData = typeof content === 'string' ? JSON.parse(content) : content;
                if (dragData && dragData.name && dragData.folder) {
                    if (dragData.folder === nodeData.key) return; // Same folder, do nothing
                    // Move image using ComfyAppApi
                    const sourcePath = `${dragData.folder}/${dragData.name}`;
                    const targetPath = `${nodeData.key}/${dragData.name}`;
                    ComfyAppApi.moveImage(sourcePath, targetPath).then(success => {
                        if (success) {
                            // Optionally: show a message or refresh UI
                            // message.success('Image moved');
                        } else {
                            // message.error('Failed to move image');
                        }
                    });
                }
            } catch (err) {
                console.error('Error parsing drag data:', err, content);
            }
        },
    });
    return (
        <span
            ref={folderRef}
            className={`folder ${allSelected ? 'folder-selected' : ''}`}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 6px',
                borderRadius: 4,
                transition: 'background 0.2s',
                cursor: 'pointer',
                background: allSelected ? token.colorPrimaryBg : undefined,
                border: allSelected ? `1.5px solid ${token.colorPrimary}` : undefined,
            }}
            onClick={(event) => handleCardClick(event, nodeData.title)}
        >
            <span style={{ marginLeft: 0 }}>{nodeData.title}</span>
        </span>
    );
});

const GallerySidebar = () => {
    const { token } = theme.useToken();
    const { data, loading, currentFolder, setCurrentFolder, setOpen, siderCollapsed, settings } = useGalleryContext();
    // Only recalculate treeData if folder structure actually changes
    const treeData = useMemo(() => {
        if (loading || !data) return [];
        return foldersToTreeData(data);
    }, [loading, data && JSON.stringify(data.folders)]); // Only depend on folder structure
    const sidebarRef = useRef<HTMLDivElement>(null);
    const [showClose, setShowClose] = useState(false);
    const [targetDate, setTargetDate] = useState<number>();
    const [countdown] = useCountDown({
        targetDate,
        onEnd: () => {
            setOpen(false);
            setShowClose(false);
            setTargetDate(undefined);
        },
    });

    // Track if an image is being dragged
    useEffect(() => {
        const onDragStart = (e: DragEvent) => {
            setShowClose(true);
        };
        const onDragEnd = (e: DragEvent) => {
            setShowClose(false);
            setTargetDate(undefined);
        };
        window.addEventListener('dragstart', onDragStart);
        window.addEventListener('dragend', onDragEnd);
        return () => {
            window.removeEventListener('dragstart', onDragStart);
            window.removeEventListener('dragend', onDragEnd);
        };
    }, []);

    // Use FolderTitle component for each folder node (remove icon from here)
    const renderTreeTitle = useCallback((nodeData: any) => (
        <FolderTitle             
            nodeData={nodeData} 
            currentFolder={currentFolder} 
        />
    ), [currentFolder]);

    // Memoize onSelect handler for performance
    const handleTreeSelect = useCallback((keys: React.Key[]) => {
        if (keys.length > 0) setCurrentFolder(keys[0] as string);
        
    }, [setCurrentFolder]);

    if (siderCollapsed) return (<></>);

    return (
        <div className="gallery-sidebar" style={{ position: 'relative', height: '100%' }}>
            {loading && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: token.colorBgMask,
                    zIndex: 100,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <Spin size="large" tip="Loading..." />
                </div>
            )}
            <style>{`
                .gallery-sidebar-tree-box > * {
                    height: auto;
                    min-height: -webkit-fill-available;
                }
            `}</style>
            <div
                className="gallery-sidebar-tree-box"
                style={{
                    position: 'relative',
                    height: '100%'
                }}
                ref={sidebarRef}
            >
                <Tree.DirectoryTree
                    // @ts-ignore
                    // height={"100%"}
                    // multiple
                    defaultExpandAll={settings.expandAllFolders}
                    showLine
                    showIcon
                    onSelect={handleTreeSelect}
                    treeData={treeData}
                    titleRender={renderTreeTitle}
                    expandAction={false} // Prevent collapse/expand on click
                />
            </div>
        </div>
    );
};

export default GallerySidebar;
