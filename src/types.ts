export interface FileItem {
  name: string
  path: string
}

export interface RenameRule {
  assetTypePrefix: string
  assetName: string
  descriptor: string
  variant: string
  autoDetectDescriptor: boolean
}

export interface PreviewItem {
  originalName: string
  newName: string
  originalPath: string
  newPath: string
  autoDescriptor?: string
  descriptor?: string
  manualDescriptor?: string
  autoPrefix?: string
  hasPrefixConflict?: boolean
  selected?: boolean
}

declare global {
  interface Window {
    electronAPI: {
      selectFolder: () => Promise<string | null>
      getFiles: (folderPath: string) => Promise<FileItem[]>
      renameFile: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>
      batchRename: (operations: Array<{ oldPath: string; newPath: string }>) => Promise<Array<{ success: boolean; error?: string; oldPath?: string; newPath?: string }>>
    }
  }
}
