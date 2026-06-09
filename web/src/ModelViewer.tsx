import React, { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, useGLTF, useFBX, Html, Center, Bounds, useBounds } from '@react-three/drei';
import { useLoader, useThree } from '@react-three/fiber';
import { OBJLoader, STLLoader } from 'three-stdlib';
import { USDZLoader } from 'three/examples/jsm/loaders/USDZLoader.js';
import { Spin } from 'antd';

export const Model = ({ url, type }: { url: string, type: string }) => {
    if (type === 'gltf' || type === 'glb') {
        const { scene } = useGLTF(url);
        return <primitive object={scene} />;
    } else if (type === 'obj') {
        const obj = useLoader(OBJLoader, url);
        return <primitive object={obj} />;
    } else if (type === 'fbx') {
        const fbx = useFBX(url);
        return <primitive object={fbx} />;
    } else if (type === 'stl') {
        const geom = useLoader(STLLoader as any, url) as any;
        return (
            <mesh geometry={geom}>
                <meshStandardMaterial color="#cccccc" />
            </mesh>
        );
    }
    if (type === 'usd' || type === 'usdz') {
        const group = useLoader(USDZLoader as any, url) as any;
        return <primitive object={group} />;
    }
    return null;
};

const AutoRefit = () => {
    const bounds = useBounds();
    const size = useThree((s) => s.size);
    
    React.useEffect(() => {
        if (bounds) {
            bounds.refresh().clip().fit();
            const t1 = setTimeout(() => bounds.refresh().clip().fit(), 100);
            const t2 = setTimeout(() => bounds.refresh().clip().fit(), 300);
            const t3 = setTimeout(() => bounds.refresh().clip().fit(), 600);
            return () => {
                clearTimeout(t1);
                clearTimeout(t2);
                clearTimeout(t3);
            };
        }
    }, [bounds, size]);

    return null;
};

export const ModelViewer = React.memo(({ url, type }: { url: string, type?: string }) => {
    const t = type || url.split('.').pop()?.toLowerCase() || '';

    return (
        <div style={{ width: '100%', height: '70vh', minHeight: '500px', background: '#1e1e1e', borderRadius: '8px' }}>
            <Canvas shadows camera={{ position: [8, 8, 8], fov: 45 }}>
                <Suspense fallback={<Html center><Spin size="large" tip="Loading 3D Model..." /></Html>}>
                    <Environment preset="city" />
                    <ambientLight intensity={0.5} />
                    <directionalLight position={[10, 10, 10]} intensity={1} castShadow />
                    <Bounds fit clip observe margin={1.2}>
                        <AutoRefit />
                        <Center>
                            <Model url={url} type={t} />
                        </Center>
                    </Bounds>
                </Suspense>
                <OrbitControls makeDefault />
            </Canvas>
        </div>
    );
});
