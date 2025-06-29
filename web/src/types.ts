export interface FileInfo {
    filename: string;
    resolution: string;
    date: string;
    size: string;
}

export interface StructuredPrompts {
    positive?: string;
    negative?: string;
    parameters?: {
        model?: string;
        sampler?: string;
        scheduler?: string;
        steps?: number;
        cfg_scale?: number;
        seed?: number;
        loras?: any[];
    };
    extraction_method?: string;
}

export interface Metadata {
    fileinfo: FileInfo;
    prompt?: any; 
    workflow?: any;
    structured_prompts?: StructuredPrompts;
}

export interface FileDetails {
    name: string;
    url: string;
    timestamp: number;
    date: string;
    metadata: Metadata;
    type: "image" | "media" | "divider" | "empty-space";
}

export interface FolderContent {
    [filename: string]: FileDetails;
}

export interface Folders {
    [folderName: string]: FolderContent;
}

export interface FilesTree {
    folders: Folders;
}
