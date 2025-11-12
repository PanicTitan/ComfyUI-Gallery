import { useEffect, useRef, useState } from 'react';
import { Flex, AutoComplete, Button, Segmented, Modal, message, Popconfirm, theme } from 'antd';
import { CloseSquareFilled, DoubleLeftOutlined, DoubleRightOutlined } from '@ant-design/icons';
import { useGalleryContext } from './GalleryContext';
import { useDebounce, useCountDown } from 'ahooks';
import Typography from 'antd/es/typography/Typography';
import JSZip from 'jszip';
import FileSaver from 'file-saver';
import { BASE_PATH, ComfyAppApi } from './ComfyAppApi';

const GalleryHeader = () => {
    const { token } = theme.useToken();
    const {
        showSettings, setShowSettings,
        searchFileName, setSearchFileName,
        sortMethod, setSortMethod,
        imagesAutoCompleteNames,
        autoCompleteOptions, setAutoCompleteOptions,
        setOpen,
        selectedImages,
        siderCollapsed, setSiderCollapsed
    } = useGalleryContext();

    const [search, setSearch] = useState("");
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
    const dragCounter = useRef(0);

    const [downloading, setDownloading] = useState(false);
    const [showDownloadConfirm, setShowDownloadConfirm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Show close button only when dragging
    useEffect(() => {
        const onDragStart = () => setShowClose(true);
        const onDragEnd = () => {
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

    // Debounce the search input to prevent lag
    const debouncedSearch = useDebounce(search, { wait: 100 });

    useEffect(() => {
        setSearchFileName(debouncedSearch);

        if (!debouncedSearch || debouncedSearch.length == 0) {
            setAutoCompleteOptions(imagesAutoCompleteNames);
        } else {
            setAutoCompleteOptions(
                imagesAutoCompleteNames.filter(opt =>
                    typeof opt.value === 'string' && opt.value.toLowerCase().includes(debouncedSearch.toLowerCase())
                )
            );
        }
    }, [debouncedSearch, imagesAutoCompleteNames, setAutoCompleteOptions]);

    return (
        <Flex 
            justify={"space-between"} 
            align={"center"}
            gap={20}
        >
            <div
                style={{
                    display: "flex",
                    alignContent: "center",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: "20px",
                }}      
            >
                <Button
                    size="middle"
                    onClick={() => setSiderCollapsed((prev: boolean) => !prev)}
                >
                    {siderCollapsed ? <DoubleRightOutlined /> : <DoubleLeftOutlined />}
                </Button>
                <Button 
                    size={"middle"} 
                    onClick={() => setShowSettings(true)}
                >
                    Settings
                </Button>
            </div>
            {selectedImages && selectedImages.length > 0 && (
                <>
                    <Popconfirm
                        title="Download Selected Images"
                        description={`Are you sure you want to download ${selectedImages.length} selected image(s)?`}
                        onConfirm={async () => {
                            setDownloading(true);
                            try {
                                const zip = new JSZip();
                                await Promise.all(selectedImages.map(async (url) => {
                                    try {
                                        const fetchUrl = url.startsWith('http') ? url : `${BASE_PATH}${url}`;
                                        const response = await fetch(fetchUrl);
                                        const blob = await response.blob();
                                        const filename = url.split('/').pop() || 'image';
                                        zip.file(filename, blob);
                                    } catch (e) {
                                        console.error('Failed to fetch image:', url, e);
                                    }
                                }));
                                const content = await zip.generateAsync({ type: 'blob' });
                                FileSaver.saveAs(content, 'comfy-ui-gallery-images.zip');
                            } catch (error) {
                                message.error('Failed to download images.');
                            } finally {
                                setDownloading(false);
                            }
                        }}
                        onCancel={() => message.info('Download cancelled')}
                        okText={`Download (${selectedImages.length})`}
                        cancelText="Cancel"
                        okButtonProps={{ loading: downloading }}
                    >
                        <Button
                            type="primary"
                            loading={downloading}
                            style={{ marginLeft: 8 }}
                            className="selectedImagesActionButton"
                        >
                            Download Selected
                        </Button>
                    </Popconfirm>
                    <Popconfirm
                        title="Delete Selected Images"
                        description={`Are you sure you want to delete ${selectedImages.length} selected image(s)? This cannot be undone.`}
                        onConfirm={async () => {
                            let deleted = 0;
                            for (const url of selectedImages) {
                                try {
                                    await ComfyAppApi.deleteImage(url);
                                    deleted++;
                                    await new Promise(res => setTimeout(res, 50));
                                } catch (e) {
                                    console.error('Failed to delete image:', url, e);
                                }
                            }
                            message.success(`Deleted ${deleted} image(s).`);
                        }}
                        onCancel={() => message.info('Delete cancelled')}
                        okText={`Delete (${selectedImages.length})`}
                        cancelText="Cancel"
                        okButtonProps={{ danger: true }}
                    >
                        <Button
                            danger
                            style={{ marginLeft: 8 }}
                            className="selectedImagesActionButton"
                        >
                            Delete Selected
                        </Button>
                    </Popconfirm>
                </>
            )}
            {showClose && (
                <div
                    style={{ 
                        display: 'inline-block' 
                    }}
                    onDragEnter={e => {
                        e.preventDefault();
                        dragCounter.current++;
                        if (!targetDate) {
                            setTargetDate(Date.now() + 3000);
                        }
                    }}
                    onDragLeave={e => {
                        e.preventDefault();
                        dragCounter.current--;
                        if (dragCounter.current === 0 && targetDate) {
                            setTargetDate(undefined);
                        }
                    }}
                >
                    <Button
                        type="default"
                        style={{ 
                            marginLeft: "8px",
                            display: "flex",
                            alignItems: "center",
                            position: "relative",
                            cursor: "pointer",
                            justifyContent: "center",
                            alignContent: "center",
                            flexWrap: "wrap",
                            width: 150
                        }}
                        tabIndex={-1} // Prevent focus flicker
                    >
                        {targetDate
                            ? (
                                <Typography
                                    style={{
                                        color: token.colorError,
                                        fontWeight: 500
                                    }}
                                >
                                    {`   Close in ${Math.ceil(countdown / 1000)}s   `}
                                </Typography>
                            ) : (
                                <Typography
                                    style={{
                                        color: token.colorTextDescription,
                                        fontWeight: 400
                                    }}
                                >
                                    Hover to close 3s
                                </Typography>
                            )
                        }
                    </Button>
                </div>
            )}
            <AutoComplete
                options={
                    autoCompleteOptions && autoCompleteOptions.length > 0 
                        ? autoCompleteOptions 
                        : imagesAutoCompleteNames
                    }
                style={{ 
                    width: '50%' 
                }}
                onSearch={text => setSearch(text)}
                value={search}
                onChange={val => setSearch(val)}
                placeholder="Search for file name"
                allowClear={{ 
                    clearIcon: <CloseSquareFilled /> 
                }}
            />
            <Segmented<string>
                style={{ 
                    marginRight: 15 
                }}
                options={['Newest', 'Oldest', 'Name ↑', 'Name ↓']}
                value={sortMethod}
                onChange={value => setSortMethod(value as any)}
            />
        </Flex>
    );
};

export default GalleryHeader;
