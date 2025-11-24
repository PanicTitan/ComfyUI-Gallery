import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import { Empty, Image, Spin } from 'antd';
import { AutoSizer } from 'react-virtualized';
import { FixedSizeGrid } from 'react-window';
import ImageCard, { ImageCardHeight, ImageCardWidth } from './ImageCard';
import { useGalleryContext } from './GalleryContext';
import { MetadataView } from './MetadataView';
import type { FileDetails } from './types';
import { BASE_PATH } from "./ComfyAppApi";

const GalleryImageGrid = () => {
    const {
        data,
        currentFolder,
        searchFileName,
        sortMethod,
        gridSize,
        setGridSize,
        autoSizer,
        setAutoSizer,
        imageInfoName,
        setImageInfoName,
        previewingVideo,
        setPreviewingVideo,
        showRawMetadata,
        setShowRawMetadata,
        settings,
        loading 
    } = useGalleryContext();
    const containerRef = useRef<HTMLDivElement>(null);
    const imagesDetailsList = useMemo(() => {
        let list: FileDetails[] = Object.values(data?.folders?.[currentFolder] ?? []);
        if (searchFileName && searchFileName.trim() !== "") {
            const searchTerm = searchFileName.toLowerCase();
            list = list.filter(imageInfo => imageInfo.name.toLowerCase().includes(searchTerm));
        }
        if (sortMethod !== 'Name ↑' && sortMethod !== 'Name ↓') {
            list = list.sort((a, b) => (sortMethod === 'Newest' ? (b.timestamp || 0) - (a.timestamp || 0) : (a.timestamp || 0) - (b.timestamp || 0)));
            if (!settings.showDateDivider) return list;
            const grouped: { [date: string]: FileDetails[] } = {};
            list.forEach(item => {
                const date = item.timestamp ? new Date(item.timestamp * 1000).toISOString().slice(0, 10) : 'Unknown';
                if (!grouped[date]) grouped[date] = [];
                grouped[date].push(item);
            });
            const result: FileDetails[] = [];
            Object.entries(grouped).forEach(([date, items]) => {
                const colCount = Math.max(1, gridSize.columnCount || 1);
                for (let i = 0; i < colCount; i++) {
                    result.push({ name: date, type: 'divider' } as FileDetails);
                }
                result.push(...items);
                const remainder = items.length % colCount;
                if (remainder !== 0 && colCount > 1) {
                    for (let i = 0; i < colCount - remainder; i++) {
                        result.push({ type: 'empty-space' } as FileDetails);
                    }
                }
            });
            return result;
        }
        switch (sortMethod) {
            case 'Name ↑':
                return list.sort((a, b) => a.name.localeCompare(b.name));
            case 'Name ↓':
                return list.sort((a, b) => b.name.localeCompare(a.name));
            default:
                return list;
        }
    }, [currentFolder, data, sortMethod, searchFileName, gridSize.columnCount, settings.showDateDivider]);

    const imagesUrlsLists = useMemo(() =>
        imagesDetailsList.filter(image => image.type === "image" || image.type === "media" || image.type === "audio").map(image => `${BASE_PATH}${image.url}`),
        [imagesDetailsList]
    );

    const handleInfoClick = useCallback((imageName: string) => {
        // Set the info modal target
        
        // If the item is media/audio, set previewing state so the preview group uses media renderer
        const item = data?.folders?.[currentFolder]?.[imageName];
        if (item && (item.type === 'media' || item.type === 'audio')) {
            setPreviewingVideo(item.name);
        } else {
            setPreviewingVideo(undefined);
        }

        setImageInfoName(imageName);
    }, [setImageInfoName, data, currentFolder, setPreviewingVideo]);

    const Cell = useCallback(({ columnIndex, rowIndex, style }: { columnIndex: number; rowIndex: number; style: React.CSSProperties }) => {
        const index = rowIndex * gridSize.columnCount + columnIndex;
        const image = imagesDetailsList[index];
        if (!image) return null;
        if (image.type === 'divider') {
            if (columnIndex !== 0) return null;
            return (
                <div 
                    key={`divider-${index}`} 
                    style={{ 
                        ...style, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        width: `calc(${gridSize.columnCount} * ${ImageCardWidth + 16}px)`, 
                        gridColumn: `span ${gridSize.columnCount}`, 
                        background: 'transparent', 
                        padding: 0, 
                        minHeight: 48, 
                        position: 'absolute', 
                        zIndex: 2 
                    }}
                >
                    <div 
                        style={{ 
                            width: '100%', 
                            display: 'flex', 
                            alignItems: 'center', 
                            position: 'relative' 
                        }}
                    >
                        <div 
                            style={{ 
                                flex: 1, 
                                borderBottom: '2px solid #888', 
                                opacity: 0.3 
                            }} 
                        />
                        <span 
                            style={{ 
                                margin: '0 24px', 
                                fontWeight: 700, 
                                fontSize: 22, 
                                color: '#ccc', 
                                background: '#23272f', 
                                borderRadius: 8, 
                                padding: '2px 24px', 
                                boxShadow: '0 2px 8px rgba(0,0,0,0.08)', 
                                border: '1px solid #333', 
                                display: 'flex', 
                                alignItems: 'center', 
                                height: 40 
                            }}
                        >
                            {image.name}
                        </span>
                        <div 
                            style={{ 
                                flex: 1, 
                                borderBottom: '2px solid #888', 
                                opacity: 0.3 
                            }} 
                        />
                    </div>
                </div>
            );
        }
        if (image.type === 'empty-space') {
            return (
                <div 
                    key={`empty-space-${index}`} 
                    style={{ 
                        ...style, 
                        background: 'transparent' 
                    }} 
                />
            );
        }
        // Add folder info to drag data by wrapping ImageCard
        return (
            <div 
                key={`div-${image.name}`} 
                style={{ 
                    ...style, 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center' 
                }}
            >
                <ImageCard 
                    image={{ 
                        ...image, 
                        dragFolder: currentFolder 
                    }} 
                    key={image.name} 
                    index={index} 
                    onInfoClick={() => handleInfoClick(image.name)} onVideoClick={() => setPreviewingVideo(image.name)} 
                />
            </div>
        );
    }, [gridSize.columnCount, imagesDetailsList, handleInfoClick, setPreviewingVideo, currentFolder]);

    useEffect(() => {
        const { width, height } = autoSizer;
        const columnCount = Math.max(1, Math.floor(width / (ImageCardWidth + 16)));
        const rowCount = Math.ceil(imagesDetailsList.length / columnCount);
        setGridSize({ width, height, columnCount, rowCount });
    }, [autoSizer.width, autoSizer.height, imagesDetailsList.length]);

    useEffect(() => {
        const grid = document.querySelector(".grid-element");
        if (grid) {
            Array.from(grid.children).forEach(child => {
                (child as HTMLElement).style.position = 'relative';
            });
        }
    }, [gridSize, imageInfoName, currentFolder, data]);

    // Memoized previewable images for InfoView navigation and rendering
    const previewableImages = useMemo(() =>
        imagesDetailsList.filter(img => img.type === "image" || img.type === "media" || img.type === "audio"),
        [imagesDetailsList]
    );

    // Helper to resolve image for Info/Image render
    const resolvePreviewableImage = useCallback((image: FileDetails | undefined, info: { current: number }) => {
        if (image) return image;
        let resolved: FileDetails | undefined;
        // Try forward
        for (let index = info.current; index < previewableImages.length; index++) {
            let current = previewableImages[index];
            resolved = current;
            break;
        }
        // Try backward
        if (!resolved) {
            for (let index = info.current; index > 0 && index > previewableImages.length; index--) {
                let current = previewableImages[index];
                resolved = current;
                break;
            }
        }
        // If still not found, return undefined
        if (!resolved) return undefined;

        setImageInfoName(resolved!.name);

        return resolved;
    }, [previewableImages, imagesDetailsList, setImageInfoName]);

    // Memoized imageRender for InfoView
    const infoImageRender = useCallback((originalNode: React.ReactElement, info: { current: number; }) => {
        let image = data?.folders?.[currentFolder]?.[imageInfoName ?? ""];
        image = resolvePreviewableImage(image, info);
        if (!image) return null;
        return (
            <MetadataView
                image={image}
                onShowRaw={() => setShowRawMetadata(true)}
                showRawMetadata={showRawMetadata}
                setShowRawMetadata={setShowRawMetadata}
            />
        );
    }, [data, currentFolder, imageInfoName, setShowRawMetadata, showRawMetadata, resolvePreviewableImage]);

    // Memoized onChange for InfoView
    const infoOnChange = useCallback((current: number, prevCurrent: number) => {
        setImageInfoName(previewableImages[current]?.name);
    }, [setImageInfoName, previewableImages]);

    // Memoized afterOpenChange for InfoView
    const infoAfterOpenChange = useCallback((open: boolean) => {
        if (!open) setImageInfoName(undefined);
    }, [setImageInfoName]);

    // Memoized media (video/audio) imageRender
    const videoImageRender = useCallback((originalNode: any, info: any) => {
        let image = data?.folders?.[currentFolder]?.[previewingVideo ?? ""];
        image = resolvePreviewableImage(image, info);
        if (!image) return null;
        if (image.type === 'audio') {
            return (
                <audio
                    key={image.name}
                    style={{
                        maxWidth: "-webkit-fill-available",
                        width: "80%"
                    }}
                    src={`${BASE_PATH}${image.url}`}
                    autoPlay={true}
                    controls={true}
                    preload="none"
                    ref={el => {
                        if (el && !settings.autoPlayVideos) {
                            el.pause();
                            el.currentTime = 0;
                        }
                    }}
                />
            );
        }
        return (
            <video
                key={image.name}
                style={{
                    maxWidth: "-webkit-fill-available",
                    width: "80%"
                }}
                src={`${BASE_PATH}${image.url}`}
                autoPlay={true}
                controls={true}
                preload="none"
                ref={el => {
                    if (el && !settings.autoPlayVideos) {
                        el.pause();
                        el.currentTime = 0;
                    }
                }}
            />
        );
    }, [data, currentFolder, previewingVideo, settings.autoPlayVideos, resolvePreviewableImage]);

    // Memoized onChange for video preview
    const videoOnChange = useCallback((current: number, prevCurrent: number) => {
        const t = previewableImages[current]?.type;
        if (t == "media" || t == "audio") {
            setPreviewingVideo(previewableImages[current]?.name);
        } else {
            setPreviewingVideo(undefined);
        }
    }, [setPreviewingVideo, previewableImages]);

    // Memoized current index for InfoView
    const previewableCurrentIndex = useMemo(() => {
        let index = previewableImages.findIndex(img => img.name === imageInfoName);
        if (index < 0) {
            return undefined;
        } else {
            return index;
        }
    },
        [previewableImages, imageInfoName]
    );

    return (
        <div id="imagesBox" style={{ width: '100%', height: '100%', position: 'relative' }} ref={containerRef}>
            {loading && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'rgba(30,30,30,0.5)',
                    zIndex: 100,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <Spin size="large" tip="Loading..." />
                </div>
            )}
            <Image.PreviewGroup
                // key={imagesUrlsLists.length}
                items={imagesUrlsLists}
                preview={(imageInfoName != undefined) ? {
                    current: previewableCurrentIndex,
                    imageRender: infoImageRender,
                    toolbarRender: () => null,
                    onChange: infoOnChange,
                    afterOpenChange: infoAfterOpenChange,
                    destroyOnClose: true
                } : {
                    current: previewableCurrentIndex,
                    onChange: videoOnChange,
                    imageRender: previewingVideo != undefined ? videoImageRender : undefined,
                    toolbarRender: previewingVideo != undefined ? () => null : undefined,
                    destroyOnClose: true,
                    afterOpenChange(open) {
                        if (!open) setPreviewingVideo(undefined);
                    },
                }}
            >
                {imagesDetailsList.length === 0 ? (
                    <Empty 
                        style={{ 
                            position: "absolute", 
                            top: "50%", 
                            left: "50%", 
                            transform: "translate(-50%, -50%)" 
                        }} 
                        description={"No images found"} 
                    />
                ) : (
                    <AutoSizer>
                        {({ width, height }) => {
                            if (autoSizer.width !== width || autoSizer.height !== height) {
                                setTimeout(() => setAutoSizer({ width, height }), 0);
                            }
                            return (
                                <FixedSizeGrid
                                    columnCount={gridSize.columnCount}
                                    rowCount={gridSize.rowCount}
                                    columnWidth={ImageCardWidth + 16}
                                    rowHeight={ImageCardHeight + 16}
                                    width={width}
                                    height={height}
                                    className={"grid-element"}
                                    style={{ 
                                        display: "flex", 
                                        alignContent: "center", 
                                        justifyContent: "center" 
                                    }}
                                >
                                    {Cell}
                                </FixedSizeGrid>
                            );
                        }}
                    </AutoSizer>
                )}
            </Image.PreviewGroup>
        </div>
    );
};

export default GalleryImageGrid;
