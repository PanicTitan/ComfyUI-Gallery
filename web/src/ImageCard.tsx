import { Button, Image, Typography } from 'antd';
import type { FileDetails } from './types';
import InfoCircleOutlined from '@ant-design/icons/lib/icons/InfoCircleOutlined';
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
    const { settings, selectedImages, setSelectedImages } = useGalleryContext();
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
        if (event.ctrlKey) {
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

    // console.log("selectedImages:", selectedImages);

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
                    alt={image.name}
                />
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
