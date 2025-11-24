import Modal from 'antd/es/modal/Modal';
import { Button, Flex, Input, Switch, Typography } from 'antd';
import { useGalleryContext, type SettingsState } from './GalleryContext';
import { useSetState } from 'ahooks';
import { useEffect, useState } from 'react';
import { BASE_Z_INDEX } from './ComfyAppApi';

const GallerySettingsModal = () => {
    const { showSettings, setShowSettings, settings, setSettings } = useGalleryContext();
    // Staged (unsaved) settings
    const [staged, setStaged] = useSetState<SettingsState>(settings);
    const [extInput, setExtInput] = useState("");

    // When modal opens, reset staged to current settings
    useEffect(() => {
        if (showSettings) {
            setStaged(settings);
            setExtInput((settings && (settings as any).scanExtensions) ? (settings as any).scanExtensions.join(', ') : "");
        }
    }, [showSettings, settings, setStaged]);

    // Save staged settings to context and close
    const handleSave = () => {
        const exts = extInput.split(',').map(s => s.trim().replace(/^\./, '')).filter(s => s);
        const newSettings = { ...staged, scanExtensions: exts } as SettingsState;
        setSettings(newSettings);
        setShowSettings(false);
    };
    // Cancel: just close modal (staged will reset on next open)
    const handleCancel = () => {
        setShowSettings(false);
    };

    return (
        <Modal
            zIndex={BASE_Z_INDEX + 1}
            title={"Settings"}
            open={showSettings}
            centered
            afterOpenChange={setShowSettings}
            onOk={handleSave}
            onCancel={handleCancel}
            footer={[
                <Button 
                    key="back" 
                    onClick={handleCancel}
                >
                    Return
                </Button>,
                <Button 
                    key="submit" 
                    type="primary" 
                    onClick={handleSave}
                >
                    Save
                </Button>
            ]}
        >
            <Flex 
                vertical 
                gap={16}
            >
                <div>
                    <Typography.Title 
                        level={5}
                    >
                        Relative Path:
                    </Typography.Title>
                    <Input 
                        value={staged.relativePath} 
                        onChange={e => setStaged({ relativePath: e.target.value })} 
                    />
                </div>
                <div>
                    <Typography.Title 
                        level={5}
                    >
                        Button Box Query:
                    </Typography.Title>
                    <Input 
                        value={staged.buttonBoxQuery} 
                        onChange={e => setStaged({ buttonBoxQuery: e.target.value })} 
                    />
                </div>
                <div>
                    <Typography.Title 
                        level={5}
                    >
                        Button Label:
                    </Typography.Title>
                    <Input 
                        value={staged.buttonLabel} 
                        onChange={e => setStaged({ buttonLabel: e.target.value })} 
                    />
                </div>
                <Switch
                    checkedChildren={"Show Date Divider"}
                    unCheckedChildren={"Don't Show Date Divider"}
                    checked={staged.showDateDivider}
                    onChange={checked => setStaged({ showDateDivider: checked })}
                />
                <Switch
                    checkedChildren={"Floating Button"}
                    unCheckedChildren={"Normal Button"}
                    checked={staged.floatingButton}
                    onChange={checked => setStaged({ floatingButton: checked })}
                />
                <Switch
                    checkedChildren={"Auto Play Videos"}
                    unCheckedChildren={"Don't Auto Play Videos"}
                    checked={staged.autoPlayVideos}
                    onChange={checked => setStaged({ autoPlayVideos: checked })}
                />
                <Switch
                    checkedChildren={"Hide Open Button"}
                    unCheckedChildren={"Show Open Button"}
                    checked={staged.hideOpenButton}
                    onChange={checked => setStaged({ hideOpenButton: checked })}
                />
                <Switch
                    checkedChildren={"Dark Mode"}
                    unCheckedChildren={"Light Mode"}
                    checked={staged.darkMode}
                    onChange={checked => setStaged({ darkMode: checked })}
                />
                <Switch
                    checkedChildren={"Enable Ctrl+G Shortcut"}
                    unCheckedChildren={"Disable Ctrl+G Shortcut"}
                    checked={staged.galleryShortcut}
                    onChange={checked => setStaged({ galleryShortcut: checked })}
                />
                <Switch
                    checkedChildren={"Expand All Folders"}
                    unCheckedChildren={"Collapse All Folders"}
                    checked={staged.expandAllFolders}
                    onChange={checked => setStaged({ expandAllFolders: checked })}
                />
                <Switch
                    checkedChildren={"Disable Terminal Logs"}
                    unCheckedChildren={"Enable Terminal Logs"}
                    checked={staged.disableLogs}
                    onChange={checked => setStaged({ disableLogs: checked })}
                />
                <Switch
                    checkedChildren={"Use Polling Observer"}
                    unCheckedChildren={"Use Native Observer"}
                    checked={staged.usePollingObserver}
                    onChange={checked => setStaged({ usePollingObserver: checked })}
                />
                <div>
                    <Typography.Title level={5}>Scan File Extensions:</Typography.Title>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>Comma separated (e.g. png, jpg, mp4, wav)</Typography.Text>
                    <Input value={extInput} onChange={e => setExtInput(e.target.value)} />
                </div>
            </Flex>
        </Modal>
    );
};

export default GallerySettingsModal;
