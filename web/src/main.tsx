import { createRoot } from 'react-dom/client'
import Gallery from './Gallery.tsx'
import App from 'antd/es/app/App';
import { DEFAULT_SETTINGS, STORAGE_KEY, type SettingsState } from './GalleryContext.tsx';
import { ComfyAppApi, OPEN_BUTTON_ID } from './ComfyAppApi.ts';
import { ConfigProvider, theme } from 'antd';
import { useLocalStorageState } from 'ahooks';

function waitForElement(selectorOrSelectors: string | string[], delay = 1500, timeout = 10000): Promise<Element | null> {
    return new Promise((resolve) => {
        const selectors = Array.isArray(selectorOrSelectors) ? selectorOrSelectors : [selectorOrSelectors];

        let observer: MutationObserver | null = null;
        let graceTimeoutId: any = null;
        let maxTimeoutId: any = null;
        let bestMatch: { el: Element, index: number } | null = null;

        const cleanup = () => {
            if (observer) observer.disconnect();
            if (graceTimeoutId) clearTimeout(graceTimeoutId);
            if (maxTimeoutId) clearTimeout(maxTimeoutId);
        };

        const finish = (el: Element | null) => {
            cleanup();
            resolve(el);
        };

        // 1. Set Global Timeout (Max Time)
        maxTimeoutId = setTimeout(() => {
            // Timeout reached. 
            // If we have a pending match (waiting for grace period), return it.
            // Otherwise return null.
            if (bestMatch) {
                console.warn("Gallery: WaitForElement timeout reached, returning lower priority match.");
                finish(bestMatch.el);
            } else {
                console.warn("Gallery: WaitForElement timeout reached, no element found.");
                finish(null);
            }
        }, timeout);

        // 2. Logic to check the DOM
        const check = () => {
            // Iterate through selectors to find the highest priority one currently in the DOM
            for (let i = 0; i < selectors.length; i++) {
                const selector = selectors[i];
                const el = document.querySelector(selector);
                
                if (el) {
                    // Found a match at priority i
                    
                    // Case A: Highest priority (index 0). Resolve immediately.
                    if (i === 0) {
                        finish(el);
                        return;
                    }

                    // Case B: Lower priority match found.
                    if (graceTimeoutId) {
                        // We are already waiting.
                        // If this match is better (lower index) than the pending one, update it.
                        if (bestMatch && i < bestMatch.index) {
                            bestMatch = { el, index: i };
                        }
                    } else {
                        // First match found (and not #0). Start grace period.
                        bestMatch = { el, index: i };
                        graceTimeoutId = setTimeout(() => {
                            // Grace period over, return the best match we found
                            if (bestMatch) finish(bestMatch.el);
                        }, delay);
                    }
                    
                    // Stop checking lower priorities for this pass
                    return; 
                }
            }
        };

        // 3. Initial Check
        check();

        // 4. Observe DOM changes
        observer = new MutationObserver(() => {
            check();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}

ComfyAppApi.registerExtension({
    name: "Gallery",
    async init() {
        (async () => {

            let settings = DEFAULT_SETTINGS;
            try {
                const raw = localStorage.getItem('comfy-ui-gallery-settings');
                if (raw) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
            } catch { }

            // Define the priority list of selectors to look for
            const potentialSelectors = [
                settings.buttonBoxQuery,
                DEFAULT_SETTINGS.buttonBoxQuery,
                "div.workflow-tabs-container div div.workflow-tabs-container", // Newer ComfyUI
            ].filter((s): s is string => !!s && s.trim().length > 0); // Remove empty/null strings

            console.log("Gallery: Waiting for UI to load...");

            // Wait until one of the selectors exists in the DOM
            const targetElement = await waitForElement(potentialSelectors);

            console.log("Gallery: UI target found:", targetElement);

            if (!targetElement) {
                console.error('Gallery: Could not find element to inject the button.');
                return;
            }

            const box = document.createElement("div");
            targetElement.appendChild(box);

            createRoot(box).render(
                <Main />,
            );

            ComfyAppApi.startMonitoring(settings.relativePath);
        })();
    },
    async nodeCreated(node: any) {
        try {
            if (node.comfyClass === "GalleryNode") {
                node.addWidget("button", "Open Gallery", null, () => {
                    try {
                        let settings = DEFAULT_SETTINGS;
                        try {
                            const raw = localStorage.getItem('comfy-ui-gallery-settings');
                            if (raw) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
                        } catch { }
                        if (settings.galleryShortcut) {
                            document.getElementById(OPEN_BUTTON_ID)?.click();
                        }
                    } catch (error) {

                    }
                });
            }
        } catch (error) {

        }
    },
});

function Main() {
    const [settingsState, setSettings] = useLocalStorageState<SettingsState>(STORAGE_KEY, {
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