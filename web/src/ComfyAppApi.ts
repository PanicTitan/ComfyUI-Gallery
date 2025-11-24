// ComfyAppApi.ts
// Provides API functions and event listeners for ComfyUI Gallery integration.
// Uses window.comfyAPI.app.app if available, otherwise provides a mock for development.

// Types for event callbacks
type GalleryEventCallback = (event: any) => void;

export const BASE_PATH = getComfyApp() ? window.location.origin : "http://localhost:8188";
export const OPEN_BUTTON_ID = "comfy-ui-gallery-open-button";
export const BASE_Z_INDEX = 3000;

function getComfyApp() {
    try {
        // @ts-ignore
        if (window.comfyAPI && window.comfyAPI.app && window.comfyAPI.app.app) {
            // @ts-ignore
            return window.comfyAPI.app.app;
        }
    } catch (e) {}
    return null;
}

const mockApi = {
    api: {
        fetchApi: async (url: string, options?: any) => {
            console.log('[MockAPI] fetchApi called:', url, options);
            // Mocked API responses for development
            if (url.startsWith("/Gallery/images")) {
                return fetch("/api.json", {});;
            }
            if (url === "/Gallery/monitor/start") {
                return { ok: true, text: async () => "{\"status\":\"started\"}" };
            }
            if (url === "/Gallery/monitor/stop") {
                return { ok: true, text: async () => "{\"status\":\"stopped\"}" };
            }
            return { ok: true, text: async () => "{}" };
        },
        addEventListener: (event: string, cb: GalleryEventCallback) => {
            console.log(`[MockAPI] addEventListener called for event: ${event}`);
            // No-op in mock
        },
        moveImage: async (sourcePath: string, targetPath: string) => {
            console.log(`[MockAPI] moveImage called: ${sourcePath} -> ${targetPath}`);
            // Simulate success
            return true;
        },
        deleteImage: async (imagePath: string) => {
            console.log(`[MockAPI] deleteImage called: ${imagePath}`);
            // Simulate success
            return true;
        },
    },
    registerExtension: (ext: any) => {
        console.log('[MockAPI] registerExtension called:', ext);
        try {
            ext?.init();
            ext?.nodeCreated();
        } catch (error) {
            
        }
    }
};

const comfyApp = getComfyApp();
const app = comfyApp ? comfyApp : mockApi;

export const ComfyAppApi = {
    startMonitoring: (relativePath: string, disableLogs?: boolean, usePollingObserver?: boolean, scanExtensions?: string[]) =>
        app.api.fetchApi("/Gallery/monitor/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                relative_path: relativePath,
                disable_logs: disableLogs ?? false,
                use_polling_observer: usePollingObserver ?? false,
                scan_extensions: scanExtensions 
            })
        }),
    stopMonitoring: () =>
        app.api.fetchApi("/Gallery/monitor/stop", {
            method: "POST"
        }),
    fetchImages: (relativePath?: string) =>
        app.api.fetchApi(`/Gallery/images?relative_path=${encodeURIComponent(relativePath ?? './')}`),
    onFileChange: (cb: GalleryEventCallback) =>
        app.api.addEventListener("Gallery.file_change", cb),
    onUpdate: (cb: GalleryEventCallback) =>
        app.api.addEventListener("Gallery.update", cb),
    onClear: (cb: GalleryEventCallback) =>
        app.api.addEventListener("Gallery.clear", cb),
    registerExtension: (ext: any) =>
        app.registerExtension(ext),
    moveImage: async (sourcePath: string, targetPath: string) => {
        try { 
            console.log("moving image");
            console.log("sourcePath:", sourcePath);
            console.log("targetPath:", targetPath);

            const response = await app.api.fetchApi("/Gallery/move", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ source_path: sourcePath, target_path: targetPath })
            });
            if (response.ok) {
                console.log(`Image moved from ${sourcePath} to ${targetPath}`);
                return true;
            } else {
                const errorText = await response.text();
                console.error("Failed to move image:", errorText);
                return false;
            }
        } catch (error) {
            console.error("Error moving image:", error);
            return false;
        }
    },
    deleteImage: async (imagePath: string) => {
        // Confirmation should be handled in the UI before calling this method
        try {
            const response = await app.api.fetchApi("/Gallery/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image_path: imagePath })
            });
            if (response.ok) {
                console.log(`Image deleted: ${imagePath}`);
                return true;
            } else {
                const errorText = await response.text();
                console.error("Failed to delete image:", errorText);
                return false;
            }
        } catch (error) {
            console.error("Error deleting image:", error);
            return false;
        }
    },
    // Settings endpoints
    fetchSettings: async () => {
        try {
            const res = await app.api.fetchApi("/Gallery/settings");
            if (res.ok) return await res.json();
        } catch(e) { console.error(e); }
        return {};
    },
    saveSettings: async (settings: any) => {
        try {
            await app.api.fetchApi("/Gallery/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings)
            });
        } catch(e) { console.error(e); }
    },
};
