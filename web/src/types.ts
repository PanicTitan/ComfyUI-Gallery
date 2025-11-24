export interface FileInfo {
    filename: string;
    resolution: string;
    date: string;
    size: string;
}

export interface Metadata {
    fileinfo: FileInfo;
    prompt?: any; 
    workflow?: any;
}

export interface FileDetails {
    name: string;
    url: string;
    timestamp: number;
    date: string;
    metadata: Metadata;
    type: "image" | "media" | "audio" | "divider" | "empty-space";
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
