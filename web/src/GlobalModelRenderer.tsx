import React, { createContext, useContext, useState, useCallback, useEffect, Suspense } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Stage } from '@react-three/drei';
import { Model } from './ModelViewer';

type ThumbnailCache = Record<string, string>;

interface ModelThumbnailContextType {
    thumbnails: ThumbnailCache;
    requestThumbnail: (url: string, type: string) => void;
}

const ModelThumbnailContext = createContext<ModelThumbnailContextType | undefined>(undefined);

const CaptureScene = ({ url, type, onCapture }: { url: string, type: string, onCapture: (url: string, data: string) => void }) => {
    const gl = useThree((state) => state.gl);
    const scene = useThree((state) => state.scene);
    const camera = useThree((state) => state.camera);

    useEffect(() => {
        const timer = setTimeout(() => {
            gl.render(scene, camera);
            const dataUrl = gl.domElement.toDataURL('image/webp', 0.8);
            onCapture(url, dataUrl);
        }, 500); // Wait for textures
        return () => clearTimeout(timer);
    }, [gl, scene, camera, url, onCapture]);

    return (
        <Stage environment="city" intensity={0.5} adjustCamera={1.2}>
            <Model url={url} type={type} />
        </Stage>
    );
};

export const ModelThumbnailProvider = ({ children }: { children: React.ReactNode }) => {
    const [thumbnails, setThumbnails] = useState<ThumbnailCache>({});
    const [queue, setQueue] = useState<{url: string, type: string}[]>([]);
    const [processing, setProcessing] = useState<{url: string, type: string} | null>(null);

    const requestThumbnail = useCallback((url: string, type: string) => {
        setThumbnails(prev => {
            if (prev[url]) return prev;
            setQueue(q => {
                if (q.find(item => item.url === url) || processing?.url === url) return q;
                return [...q, { url, type }];
            });
            return prev;
        });
    }, [processing]);

    useEffect(() => {
        if (!processing && queue.length > 0) {
            const next = queue[0];
            setQueue(q => q.slice(1));
            setProcessing(next);
        }
    }, [queue, processing]);

    const handleCapture = useCallback((url: string, dataUrl: string) => {
        setThumbnails(prev => ({ ...prev, [url]: dataUrl }));
        setProcessing(null);
    }, []);

    return (
        <ModelThumbnailContext.Provider value={{ thumbnails, requestThumbnail }}>
            {children}
            <div style={{ position: 'absolute', top: -9999, left: -9999, width: '350px', height: '450px', visibility: 'hidden' }}>
                {processing && (
                    <Canvas gl={{ preserveDrawingBuffer: true }} camera={{ position: [8, 8, 8], fov: 45 }}>
                        <Suspense fallback={null}>
                            <CaptureScene url={processing.url} type={processing.type} onCapture={handleCapture} />
                        </Suspense>
                    </Canvas>
                )}
            </div>
        </ModelThumbnailContext.Provider>
    );
};

export const use3DThumbnail = (url: string, type: string) => {
    const ctx = useContext(ModelThumbnailContext);
    if (!ctx) return null;
    
    useEffect(() => {
        if (!ctx.thumbnails[url]) {
            ctx.requestThumbnail(url, type);
        }
    }, [url, type, ctx.thumbnails, ctx.requestThumbnail]);

    return ctx.thumbnails[url] || null;
};
