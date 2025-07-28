/**
 * File system abstraction for the IDE
 * Handles file operations with validation and error handling
 */

export interface FileMetadata {
  name: string;
  path: string;
  size: number;
  type: string;
  mimeType: string;
  lastModified: Date;
  created: Date;
  isDirectory: boolean;
}

export interface FileHandle {
  metadata: FileMetadata;
  content?: string | ArrayBuffer;
  encoding?: string;
}

export interface DirectoryEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: DirectoryEntry[];
  metadata?: FileMetadata;
}

export interface FileSystemOptions {
  encoding?: string;
  validate?: boolean;
  backup?: boolean;
}

class FileSystemManager {
  private fileCache: Map<string, FileHandle> = new Map();
  private watchers: Map<string, FileSystemWatcher[]> = new Map();
  private maxCacheSize = 100;

  /**
   * Read file content
   */
  async readFile(
    path: string,
    options: FileSystemOptions = {}
  ): Promise<FileHandle> {
    try {
      // Check cache first
      const cached = this.fileCache.get(path);
      if (cached) {
        return cached;
      }

      // For browser environment, use File API
      if (typeof window !== "undefined") {
        return await this.readFileFromInput(path, options);
      }

      // For Node.js environment (if running in server)
      return await this.readFileFromNode(path, options);
    } catch (error) {
      throw new Error(`Failed to read file ${path}: ${error}`);
    }
  }

  /**
   * Write file content
   */
  async writeFile(
    path: string,
    content: string | ArrayBuffer,
    options: FileSystemOptions = {}
  ): Promise<void> {
    try {
      // Create backup if requested
      if (options.backup && (await this.fileExists(path))) {
        await this.createBackup(path);
      }

      // Validate content if requested
      if (options.validate) {
        this.validateFileContent(path, content);
      }

      // For browser environment, trigger download
      if (typeof window !== "undefined") {
        this.downloadFile(path, content, options);
      }

      // Update cache
      const fileHandle: FileHandle = {
        metadata: {
          name: this.getFileName(path),
          path,
          size:
            typeof content === "string" ? content.length : content.byteLength,
          type: this.getFileExtension(path),
          mimeType: this.getMimeType(path),
          lastModified: new Date(),
          created: new Date(),
          isDirectory: false,
        },
        content,
        encoding: options.encoding || "utf-8",
      };

      this.fileCache.set(path, fileHandle);
      this.notifyWatchers(path, "modified", fileHandle);
    } catch (error) {
      throw new Error(`Failed to write file ${path}: ${error}`);
    }
  }

  /**
   * Delete file
   */
  async deleteFile(path: string): Promise<void> {
    try {
      // Remove from cache
      this.fileCache.delete(path);

      // For browser environment, this is mostly a cache operation
      this.notifyWatchers(path, "deleted");
    } catch (error) {
      throw new Error(`Failed to delete file ${path}: ${error}`);
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(path: string): Promise<boolean> {
    return this.fileCache.has(path);
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(path: string): Promise<FileMetadata | null> {
    const fileHandle = this.fileCache.get(path);
    return fileHandle?.metadata || null;
  }

  /**
   * List directory contents
   */
  async listDirectory(path: string): Promise<DirectoryEntry[]> {
    // For browser environment, return cached files that start with the path
    const entries: DirectoryEntry[] = [];

    this.fileCache.forEach((handle, filePath) => {
      if (filePath.startsWith(path) && filePath !== path) {
        const relativePath = filePath.substring(path.length + 1);
        const pathParts = relativePath.split("/");

        if (pathParts.length === 1) {
          // Direct child
          entries.push({
            name: handle.metadata.name,
            path: filePath,
            type: "file",
            metadata: handle.metadata,
          });
        }
      }
    });

    return entries;
  }

  /**
   * Create directory
   */
  async createDirectory(path: string): Promise<void> {
    // For browser environment, this is a no-op since we don't have real directories
    console.log(`Creating directory: ${path}`);
  }

  /**
   * Watch file/directory for changes
   */
  watchFile(
    path: string,
    callback: (event: string, file?: FileHandle) => void
  ): FileSystemWatcher {
    const watcher: FileSystemWatcher = {
      id: this.generateWatcherId(),
      path,
      callback,
      dispose: () => this.unwatchFile(path, watcher.id),
    };

    if (!this.watchers.has(path)) {
      this.watchers.set(path, []);
    }

    this.watchers.get(path)!.push(watcher);
    return watcher;
  }

  /**
   * Stop watching file
   */
  unwatchFile(path: string, watcherId: string): void {
    const watchers = this.watchers.get(path);
    if (!watchers) return;

    const index = watchers.findIndex((w) => w.id === watcherId);
    if (index !== -1) {
      watchers.splice(index, 1);
    }

    if (watchers.length === 0) {
      this.watchers.delete(path);
    }
  }

  /**
   * Clear file cache
   */
  clearCache(): void {
    this.fileCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.fileCache.size,
      maxSize: this.maxCacheSize,
      files: Array.from(this.fileCache.keys()),
    };
  }

  private async readFileFromInput(
    path: string,
    options: FileSystemOptions
  ): Promise<FileHandle> {
    // This would be called when user selects a file through input element
    throw new Error("File input reading not implemented - use file picker");
  }

  private async readFileFromNode(
    path: string,
    options: FileSystemOptions
  ): Promise<FileHandle> {
    // Node.js file reading (for server-side)
    throw new Error("Node.js file reading not available in browser");
  }

  private downloadFile(
    path: string,
    content: string | ArrayBuffer,
    options: FileSystemOptions
  ): void {
    const blob = new Blob([content], {
      type: this.getMimeType(path),
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = this.getFileName(path);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private async createBackup(path: string): Promise<void> {
    const fileHandle = this.fileCache.get(path);
    if (!fileHandle || !fileHandle.content) return;

    const backupPath = `${path}.backup.${Date.now()}`;
    await this.writeFile(backupPath, fileHandle.content, { validate: false });
  }

  private validateFileContent(
    path: string,
    content: string | ArrayBuffer
  ): void {
    const extension = this.getFileExtension(path);

    if (typeof content === "string") {
      // Validate text files
      switch (extension) {
        case "json":
          try {
            JSON.parse(content);
          } catch {
            throw new Error("Invalid JSON content");
          }
          break;
        case "xml":
          // Basic XML validation
          if (!content.includes("<?xml") && !content.match(/<[^>]+>/)) {
            throw new Error("Invalid XML content");
          }
          break;
      }
    }
  }

  private notifyWatchers(path: string, event: string, file?: FileHandle): void {
    const watchers = this.watchers.get(path) || [];
    watchers.forEach((watcher) => {
      try {
        watcher.callback(event, file);
      } catch (error) {
        console.error(`Error in file watcher for ${path}:`, error);
      }
    });
  }

  private getFileName(path: string): string {
    return path.split("/").pop() || path;
  }

  private getFileExtension(path: string): string {
    const name = this.getFileName(path);
    const lastDot = name.lastIndexOf(".");
    return lastDot !== -1 ? name.substring(lastDot + 1).toLowerCase() : "";
  }

  private getMimeType(path: string): string {
    const extension = this.getFileExtension(path);
    const mimeTypes: Record<string, string> = {
      json: "application/json",
      xml: "application/xml",
      txt: "text/plain",
      csv: "text/csv",
      html: "text/html",
      css: "text/css",
      js: "application/javascript",
      ts: "application/typescript",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      svg: "image/svg+xml",
      pdf: "application/pdf",
    };

    return mimeTypes[extension] || "application/octet-stream";
  }

  private generateWatcherId(): string {
    return `watcher_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export interface FileSystemWatcher {
  id: string;
  path: string;
  callback: (event: string, file?: FileHandle) => void;
  dispose: () => void;
}

// Create global file system manager
export const fileSystemManager = new FileSystemManager();

// File picker utility
export async function pickFile(accept?: string): Promise<FileHandle | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    if (accept) input.accept = accept;

    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      const content = await file.text();
      const fileHandle: FileHandle = {
        metadata: {
          name: file.name,
          path: file.name,
          size: file.size,
          type: file.name.split(".").pop() || "",
          mimeType: file.type,
          lastModified: new Date(file.lastModified),
          created: new Date(file.lastModified),
          isDirectory: false,
        },
        content,
        encoding: "utf-8",
      };

      // Cache the file
      fileSystemManager["fileCache"].set(file.name, fileHandle);
      resolve(fileHandle);
    };

    input.click();
  });
}

// File save utility
export function saveFile(
  filename: string,
  content: string | ArrayBuffer,
  mimeType?: string
): void {
  const blob = new Blob([content], {
    type: mimeType || "application/octet-stream",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
