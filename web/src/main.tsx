import { createRoot } from 'react-dom/client'
import Gallery from './Gallery.tsx'
import App from 'antd/es/app/App';
import { DEFAULT_SETTINGS, STORAGE_KEY, type SettingsState } from './GalleryContext.tsx';
import { ComfyAppApi, OPEN_BUTTON_ID } from './ComfyAppApi.ts';
import { ConfigProvider, theme } from 'antd';
import { useLocalStorageState } from 'ahooks';

ComfyAppApi.registerExtension({
    name: "Gallery",
    init() {
        
        let settings = DEFAULT_SETTINGS;
        try {
            const raw = localStorage.getItem('comfy-ui-gallery-settings');
            if (raw) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
        } catch { /* ignore parse errors */ }

        const targetElement = document.querySelector(settings.buttonBoxQuery) || document.querySelector(DEFAULT_SETTINGS.buttonBoxQuery);
        if (!targetElement) throw new Error('Could not find element for Button Box Query');

        const box = document.createElement("div");
        targetElement.appendChild(box);

        createRoot(box).render(
            <Main />,
        );

        ComfyAppApi.startMonitoring(settings.relativePath);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async nodeCreated(node: any) {
        try {
            if (node.comfyClass === "GalleryNode") {
                node.addWidget("button", "Open Gallery", null, () => {
                    try {
                        let settings = DEFAULT_SETTINGS;
                        try {
                            const raw = localStorage.getItem('comfy-ui-gallery-settings');
                            if (raw) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
                        } catch { /* ignore parse errors */ }
                        if (settings.galleryShortcut) {
                            document.getElementById(OPEN_BUTTON_ID)?.click();
                        }
                    } catch {
                        /* ignore errors */
                    }
                });
            }
        } catch {
            /* ignore errors */
        }
    },
});

function Main() {
    const [settingsState] = useLocalStorageState<SettingsState>(STORAGE_KEY, {
        defaultValue: DEFAULT_SETTINGS,
        listenStorageChange: true,
    });

    return (<>
        <ConfigProvider
            theme={{
                algorithm: settingsState.darkMode ? theme.darkAlgorithm : undefined,
            }}
        >
            <App>
                <Gallery />
            </App>
        </ConfigProvider>
    </>);
}