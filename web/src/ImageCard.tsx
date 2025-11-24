import { Button, Image, Typography } from 'antd';
import type { FileDetails } from './types';
import InfoCircleOutlined from '@ant-design/icons/lib/icons/InfoCircleOutlined';
import SoundOutlined from '@ant-design/icons/lib/icons/SoundOutlined';
import React, { useRef, useState } from 'react';
import { useDrag, useEventListener } from 'ahooks';
import { useGalleryContext } from './GalleryContext';
import { BASE_PATH } from './ComfyAppApi';

export const ImageCardWidth = 350;
export const ImageCardHeight = 450;

function ImageCard({
    image,
    index,
    onInfoClick,
    onVideoClick
}: {
    image: FileDetails & { dragFolder?: string };
    index: number;
    onInfoClick: (imageName: string | undefined) => void;
    onVideoClick: (imageName: string | undefined) => void;
}) {
    const { settings, selectedImages, setSelectedImages, setPreviewingVideo } = useGalleryContext();
    const dragRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState(false);

    useDrag(
        {
            name: image.name,
            folder: image.dragFolder || '',
            type: image.type,
            url: image.url,
        },
        dragRef,
        {
            onDragStart: () => setDragging(true),
            onDragEnd: () => setDragging(false),
        }
    );

    // Use ctrlKey from click event, not global state
    const handleCardClick = (event: React.MouseEvent) => {
        if (event.ctrlKey || event.metaKey) {
            // The click dont stop
            event.stopPropagation();
            event.preventDefault();

            setSelectedImages((oldSelectedImages) => {
                if (oldSelectedImages.includes(image.url)) {
                    return [...oldSelectedImages.filter((selectedImage) => selectedImage != image.url)];
                } else {
                    return [...oldSelectedImages, image.url];
                }
            });
        } else {
            setSelectedImages([]);
        }
    };

    // Native drag for exporting image as file/image
    const handleNativeDragStart = (event: React.DragEvent<HTMLImageElement | HTMLVideoElement | HTMLAudioElement>) => {
        // Guess MIME based on filename extension (frontend-only, no backend changes)
        const guessMimeFromName = (name?: string) => {
            const ext = (name || '').split('.').pop()?.toLowerCase() || '';
            const map: Record<string, string> = {
                // images
                jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff',
                // video
                mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska', avi: 'video/x-msvideo',
                // audio
                mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', flac: 'audio/flac', aac: 'audio/aac', ogg: 'audio/ogg',
            };
            return map[ext] || '';
        };

        const guessed = guessMimeFromName(image.name || image.url);
        // Fallback to previous simple heuristic if we couldn't guess from extension
        const mimeType = guessed || (image.type === 'image' ? 'image/png' : image.type === 'audio' ? 'audio/wav' : 'video/mp4');

        event.dataTransfer.setData('text/uri-list', `${BASE_PATH}${image.url}`);
        event.dataTransfer.setData('DownloadURL', `${mimeType}:${image.name}:${window.location.origin + BASE_PATH + image.url}`);
        // Optionally, set a drag image
        // event.dataTransfer.setDragImage(event.currentTarget, 10, 10);
    };

    return (<>
        <div
            className='image-card'
            ref={dragRef}
            style={{
                width: ImageCardWidth,
                height: ImageCardHeight,
                borderRadius: 8,
                overflow: "hidden",
                margin: "15px",
                border: dragging ? '2px solid #1890ff' : 'none',
                opacity: dragging ? 0.5 : 1,
                display: "flex",
                alignContent: "center",
                justifyContent: "center",
                alignItems: "center",
                position: "relative",
                cursor: 'grab',
                boxShadow: selectedImages.includes(image.url) ? '0 0 0 3px #1890ff' : undefined,
            }}
            onClick={handleCardClick}
        >
            {image.type == "image" ? (<>
                <Image 
                    id={image.url}
                    style={{ 
                        objectFit: "cover",
                        maxWidth: ImageCardWidth,
                        width: '100%',
                        height: 'auto',
                        userSelect: 'none',
                        cursor: 'grab',
                    }} 
                    src={`${BASE_PATH}${image.url}`}
                    loading="lazy"
                    // preview={false}
                    onClick={() => {
                        // Ensure any leftover media preview state is cleared so this opens as an image
                        try { setPreviewingVideo(undefined); } catch {}
                        // Trigger the preview
                        document.getElementById(image.url)?.click();
                    }}
                    alt={image.name}
                    draggable
                    onDragStart={handleNativeDragStart}
                />
            </>) : image.type === "audio" ? (<>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                    <SoundOutlined style={{ fontSize: '64px', color: '#1890ff', marginBottom: '24px' }} />
                    <Typography.Text style={{ marginBottom: '16px', padding: '0 16px', textAlign: 'center', maxWidth: '100%', color: '#e6e6e6' }} ellipsis>
                        {image.name}
                    </Typography.Text>
                    <audio controls style={{ width: '90%', height: '40px' }} src={`${BASE_PATH}${image.url}`} onClick={(e) => e.stopPropagation()} />
                    <Image
                        id={image.url}
                        style={{ display: 'none' }}
                        src={`${BASE_PATH}${image.url}`}
                        loading="lazy"
                        alt={image.name}
                    />
                </div>
            </>) : <>
                <video
                    style={{ 
                        maxHeight: ImageCardHeight,
                        cursor: "pointer"
                    }} 
                    src={`${BASE_PATH}${image.url}`}
                    autoPlay={settings.autoPlayVideos}
                    loop={settings.autoPlayVideos}
                    muted={true}
                    preload={!settings.autoPlayVideos ? undefined : "none"}
                    onClick={() => {
                        onVideoClick(image.name);
                        document.getElementById(image.url)?.click();
                    }}
                    draggable
                    onDragStart={handleNativeDragStart}
                />
                <Image 
                    id={image.url}
                    style={{ 
                        display: "none"
                    }} 
                    src={`${BASE_PATH}${image.url}`}
                    loading="lazy"
                    // preview={false}
                    alt={image.name}
                />
            </>}
            <div
                style={{
                    position: "absolute",
                    backgroundColor: "#00000042",
                    width: "-webkit-fill-available",
                    padding: "10px",
                    bottom: "0px",
                    display: "flex",
                    alignContent: "center",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <Typography.Text 
                    strong
                    style={{ 
                        margin: 0,
                        color: "white"
                    }}
                    ellipsis={{
                        
                    }}
                >
                    {image.name}
                </Typography.Text>
                <Button 
                    color="cyan" 
                    variant="filled" 
                    icon={<InfoCircleOutlined />} 
                    size={"middle"} 
                    onClick={() => {
                        onInfoClick(image.name);
                        document.getElementById(image.url)?.click();
                    }}
                />
            </div>
        </div>
    </>)
}

export default ImageCard
