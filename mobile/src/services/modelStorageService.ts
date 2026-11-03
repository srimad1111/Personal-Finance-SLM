/**
 * Persistent Model Storage Service for Personal Finance SLM
 *
 * Built strictly against installed packages:
 * - expo-document-picker (v13.0.3)
 * - expo-file-system (v18.0.11)
 *
 * Responsibilities:
 * - App-private persistent storage under `FileSystem.documentDirectory + 'models/'`
 * - Direct native streaming from Android Storage Access Framework (SAF) `content://` URIs
 * - Zero JS memory buffering, zero Base64 conversion, zero duplicate cache copies
 * - Atomic replacement using staging (.tmp) and rollback backup (.bak)
 * - Safe file validation (size, extension, storage availability)
 * - Metadata persistence without hardcoding host or development paths
 */

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

// ==============================================================================
// Constants & Configuration
// ==============================================================================

export const MODEL_FILENAME = 'personal-finance-slm-Q4_K_M.gguf';
export const METADATA_FILENAME = 'model_metadata.json';

// Expected approximate model size: ~776 MB (813,694,976 bytes)
// Minimum sanity threshold for a 1B Q4_K_M GGUF model: 500 MB
export const MIN_MODEL_SIZE_BYTES = 500 * 1024 * 1024;
export const EXPECTED_MODEL_SIZE_BYTES = 813_694_976;
export const DISK_SAFETY_BUFFER_BYTES = 50 * 1024 * 1024; // 50 MB margin

// ==============================================================================
// Types & Interfaces
// ==============================================================================

export type StorageLifecycleState =
  | 'not_imported'
  | 'importing'
  | 'imported'
  | 'error';

export interface ModelMetadata {
  originalFilename: string;
  standardFilename: string;
  sizeBytes: number;
  sizeFormatted: string;
  importedAt: string;
  sourceScheme: string;
  version: string;
}

export interface ModelStorageInfo {
  isImported: boolean;
  path: string;
  filename: string;
  originalFilename?: string;
  sizeBytes?: number;
  sizeFormatted?: string;
  importedAt?: string;
  status: StorageLifecycleState;
  error?: string;
}

export interface ModelImportOptions {
  /** If true, permits replacing an existing valid model safely via backup staging */
  allowOverwrite?: boolean;
  /** Progress callback during the import workflow */
  onProgress?: (progress: number) => void;
}

export interface ModelImportResult {
  success: boolean;
  canceled?: boolean;
  modelInfo?: ModelStorageInfo;
  error?: string;
}

// ==============================================================================
// Custom Error Hierarchy
// ==============================================================================

export class ModelStorageError extends Error {
  constructor(
    public code:
      | 'INVALID_EXTENSION'
      | 'MODEL_ALREADY_EXISTS'
      | 'INSUFFICIENT_STORAGE'
      | 'IMPORT_IN_PROGRESS'
      | 'FILE_NOT_FOUND'
      | 'COPY_FAILED'
      | 'VERIFICATION_FAILED'
      | 'REPLACEMENT_FAILED'
      | 'UNSUPPORTED_STORAGE',
    message: string,
    public originalError?: unknown
  ) {
    super(`[ModelStorage:${code}] ${message}`);
    this.name = 'ModelStorageError';
  }
}

// ==============================================================================
// Path Resolvers (Relative to sandbox documentDirectory)
// ==============================================================================

export function getDocumentDirectory(): string {
  const dir = FileSystem.documentDirectory;
  if (!dir) {
    throw new ModelStorageError(
      'UNSUPPORTED_STORAGE',
      'Application document directory is not available on this platform.'
    );
  }
  return dir.endsWith('/') ? dir : `${dir}/`;
}

export function getModelsDirectory(): string {
  return `${getDocumentDirectory()}models/`;
}

export function getModelPath(): string {
  return `${getModelsDirectory()}${MODEL_FILENAME}`;
}

export function getMetadataPath(): string {
  return `${getModelsDirectory()}${METADATA_FILENAME}`;
}

export function formatByteSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${bytes} B`;
}

// ==============================================================================
// Service State & Lock Management
// ==============================================================================

let currentLifecycleState: StorageLifecycleState = 'not_imported';
let currentError: string | null = null;
let isImporting = false;

// ==============================================================================
// Core Storage Operations
// ==============================================================================

/**
 * Returns whether a valid model file is currently present in persistent storage.
 */
export async function isModelImported(): Promise<boolean> {
  try {
    const path = getModelPath();
    const info = await FileSystem.getInfoAsync(path);
    return info.exists && !info.isDirectory && (info.size ?? 0) >= MIN_MODEL_SIZE_BYTES;
  } catch {
    return false;
  }
}

/**
 * Retrieves comprehensive information about the stored model and metadata.
 */
export async function getModelInfo(): Promise<ModelStorageInfo> {
  const path = getModelPath();
  const metadataPath = getMetadataPath();

  try {
    const fileInfo = await FileSystem.getInfoAsync(path);

    if (fileInfo.exists && !fileInfo.isDirectory && (fileInfo.size ?? 0) > 0) {
      currentLifecycleState = 'imported';
      currentError = null;

      let metadata: ModelMetadata | null = null;
      try {
        const metaInfo = await FileSystem.getInfoAsync(metadataPath);
        if (metaInfo.exists && !metaInfo.isDirectory) {
          const content = await FileSystem.readAsStringAsync(metadataPath);
          metadata = JSON.parse(content) as ModelMetadata;
        }
      } catch {
        // Metadata is optional advisory info
      }

      const sizeBytes = fileInfo.size ?? metadata?.sizeBytes ?? 0;

      return {
        isImported: true,
        path,
        filename: MODEL_FILENAME,
        originalFilename: metadata?.originalFilename ?? MODEL_FILENAME,
        sizeBytes,
        sizeFormatted: formatByteSize(sizeBytes),
        importedAt: metadata?.importedAt,
        status: 'imported',
      };
    }
  } catch (err) {
    currentLifecycleState = 'error';
    currentError = err instanceof Error ? err.message : String(err);
  }

  return {
    isImported: false,
    path,
    filename: MODEL_FILENAME,
    status: currentLifecycleState === 'importing' ? 'importing' : 'not_imported',
    error: currentError ?? undefined,
  };
}

/**
 * Opens the native Android Storage Access Framework (SAF) document picker.
 *
 * Configured with:
 * - `type: '*\/*'` to prevent Android from filtering out .gguf binaries.
 * - `copyToCacheDirectory: false` to avoid creating a duplicate 776 MB copy in cache.
 */
export async function pickModelDocument(): Promise<DocumentPicker.DocumentPickerAsset | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: false,
    multiple: false,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];

  // Validate extension
  const filename = (asset.name || '').trim();
  if (!filename.toLowerCase().endsWith('.gguf')) {
    throw new ModelStorageError(
      'INVALID_EXTENSION',
      `Selected file "${filename}" is not a GGUF model. Only files ending with .gguf are permitted.`
    );
  }

  return asset;
}

/**
 * Imports a .gguf model into the application's persistent documents directory.
 *
 * Guarantees:
 * 1. If sourceUri is omitted, opens the system document picker.
 * 2. Streams directly from Android SAF content:// URIs without JS memory buffering.
 * 3. Never deletes existing valid model until the replacement has been copied and verified.
 * 4. Cleans up incomplete temporary files if interrupted or failed.
 * 5. Rejects silently overwriting an existing model unless `allowOverwrite: true` is passed.
 *
 * @param sourceUriOrOptions Optional content URI or direct options object.
 * @param maybeOptions Options if sourceUri is passed as first argument.
 */
export async function importModel(
  sourceUriOrOptions?: string | ModelImportOptions,
  maybeOptions?: ModelImportOptions
): Promise<ModelImportResult> {
  if (isImporting) {
    throw new ModelStorageError(
      'IMPORT_IN_PROGRESS',
      'A model import operation is already actively running.'
    );
  }

  let sourceUri: string | null = null;
  let options: ModelImportOptions = {};
  let originalFilename = MODEL_FILENAME;
  let reportedSize: number | undefined;

  if (typeof sourceUriOrOptions === 'string') {
    sourceUri = sourceUriOrOptions;
    options = maybeOptions ?? {};
  } else if (sourceUriOrOptions) {
    options = sourceUriOrOptions;
  }

  // If no source URI provided, launch the document picker
  if (!sourceUri) {
    try {
      const asset = await pickModelDocument();
      if (!asset) {
        return { success: false, canceled: true };
      }
      sourceUri = asset.uri;
      originalFilename = asset.name || MODEL_FILENAME;
      reportedSize = asset.size;
    } catch (pickerErr) {
      if (pickerErr instanceof ModelStorageError) {
        return { success: false, error: pickerErr.message };
      }
      return {
        success: false,
        error: pickerErr instanceof Error ? pickerErr.message : String(pickerErr),
      };
    }
  }

  // Check if model already exists and overwrite is not allowed
  const destinationPath = getModelPath();
  const alreadyImported = await isModelImported();

  if (alreadyImported && !options.allowOverwrite) {
    throw new ModelStorageError(
      'MODEL_ALREADY_EXISTS',
      'A valid GGUF model already exists in storage. Set allowOverwrite: true to replace it.'
    );
  }

  // Validate free disk space on device
  try {
    const freeBytes = await FileSystem.getFreeDiskStorageAsync();
    const requiredBytes = (reportedSize ?? EXPECTED_MODEL_SIZE_BYTES) + DISK_SAFETY_BUFFER_BYTES;

    if (freeBytes > 0 && freeBytes < requiredBytes) {
      throw new ModelStorageError(
        'INSUFFICIENT_STORAGE',
        `Insufficient storage space. Required: ${formatByteSize(requiredBytes)}, Available: ${formatByteSize(freeBytes)}.`
      );
    }
  } catch (diskErr) {
    if (diskErr instanceof ModelStorageError) throw diskErr;
    console.warn('[ModelStorageService] Disk capacity check warning:', diskErr);
  }

  isImporting = true;
  currentLifecycleState = 'importing';
  currentError = null;

  const modelsDir = getModelsDirectory();
  const timestamp = Date.now();
  const tempPath = `${modelsDir}personal-finance-slm.tmp.${timestamp}`;
  const backupPath = `${modelsDir}personal-finance-slm.bak.${timestamp}`;

  try {
    if (options.onProgress) options.onProgress(0.05);

    // Ensure models directory exists
    const dirInfo = await FileSystem.getInfoAsync(modelsDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(modelsDir, { intermediates: true });
    }

    if (options.onProgress) options.onProgress(0.15);

    // Step 1: Direct native stream copy to temporary staging destination
    // Android FileSystemModule pipes contentResolver.openInputStream(contentUri)
    // directly to FileOutputStream(tempPath) with zero JS memory allocation.
    await FileSystem.copyAsync({
      from: sourceUri,
      to: tempPath,
    });

    if (options.onProgress) options.onProgress(0.8);

    // Step 2: Verify copied temporary file
    const tempInfo = await FileSystem.getInfoAsync(tempPath);
    if (!tempInfo.exists || tempInfo.isDirectory || (tempInfo.size ?? 0) === 0) {
      throw new ModelStorageError(
        'VERIFICATION_FAILED',
        'Model copy completed but temporary file is missing or zero bytes.'
      );
    }

    const verifiedBytes = tempInfo.size ?? 0;
    if (verifiedBytes < MIN_MODEL_SIZE_BYTES) {
      throw new ModelStorageError(
        'VERIFICATION_FAILED',
        `Copied model is smaller than expected minimum size (${formatByteSize(verifiedBytes)} < ${formatByteSize(MIN_MODEL_SIZE_BYTES)}). Copy may be truncated.`
      );
    }

    if (options.onProgress) options.onProgress(0.9);

    // Step 3: Safe atomic swap
    // If an existing model was present, back it up first
    let hasBackup = false;
    const destInfo = await FileSystem.getInfoAsync(destinationPath);
    if (destInfo.exists && !destInfo.isDirectory) {
      await FileSystem.moveAsync({
        from: destinationPath,
        to: backupPath,
      });
      hasBackup = true;
    }

    try {
      // Move verified temporary file to final standard destination
      await FileSystem.moveAsync({
        from: tempPath,
        to: destinationPath,
      });

      // Verify destination file
      const finalInfo = await FileSystem.getInfoAsync(destinationPath);
      if (!finalInfo.exists || (finalInfo.size ?? 0) !== verifiedBytes) {
        throw new Error('Destination verification failed after rename.');
      }

      // If replacement succeeded, safely remove the backup
      if (hasBackup) {
        await FileSystem.deleteAsync(backupPath, { idempotent: true });
      }
    } catch (swapErr) {
      // Rollback: restore backup if swap failed
      if (hasBackup) {
        try {
          await FileSystem.moveAsync({ from: backupPath, to: destinationPath });
        } catch (rollbackErr) {
          console.error('[ModelStorageService] Rollback failed:', rollbackErr);
        }
      }
      throw new ModelStorageError(
        'REPLACEMENT_FAILED',
        'Failed to finalize model placement at target destination.',
        swapErr
      );
    }

    // Step 4: Write metadata record
    const sourceScheme = sourceUri.includes('://') ? sourceUri.split('://')[0] : 'file';
    const metadata: ModelMetadata = {
      originalFilename,
      standardFilename: MODEL_FILENAME,
      sizeBytes: verifiedBytes,
      sizeFormatted: formatByteSize(verifiedBytes),
      importedAt: new Date().toISOString(),
      sourceScheme,
      version: '1.0.0',
    };

    try {
      await FileSystem.writeAsStringAsync(getMetadataPath(), JSON.stringify(metadata, null, 2));
    } catch (metaErr) {
      console.warn('[ModelStorageService] Could not persist metadata JSON:', metaErr);
    }

    // Clean up cache if source URI happened to reside in cacheDirectory
    const cacheDir = FileSystem.cacheDirectory;
    if (cacheDir && sourceUri.startsWith(cacheDir)) {
      try {
        await FileSystem.deleteAsync(sourceUri, { idempotent: true });
      } catch {
        // Non-critical cache cleanup
      }
    }

    if (options.onProgress) options.onProgress(1.0);

    currentLifecycleState = 'imported';
    currentError = null;

    const finalModelInfo = await getModelInfo();
    return {
      success: true,
      modelInfo: finalModelInfo,
    };
  } catch (importErr) {
    // Cleanup incomplete temporary staging file
    try {
      const tempCheck = await FileSystem.getInfoAsync(tempPath);
      if (tempCheck.exists) {
        await FileSystem.deleteAsync(tempPath, { idempotent: true });
      }
    } catch {
      // Ignore temp cleanup error
    }

    currentLifecycleState = alreadyImported ? 'imported' : 'error';
    currentError = importErr instanceof Error ? importErr.message : String(importErr);

    if (importErr instanceof ModelStorageError) {
      return { success: false, error: importErr.message };
    }
    return {
      success: false,
      error: `Import failed: ${currentError}`,
    };
  } finally {
    isImporting = false;
  }
}

/**
 * Safely removes the imported model file, metadata, and any residual temporary files.
 */
export async function deleteImportedModel(): Promise<void> {
  const modelPath = getModelPath();
  const metadataPath = getMetadataPath();
  const modelsDir = getModelsDirectory();

  try {
    await FileSystem.deleteAsync(modelPath, { idempotent: true });
    await FileSystem.deleteAsync(metadataPath, { idempotent: true });

    // Clean any orphan temporary or backup files in models/
    try {
      const dirContents = await FileSystem.readDirectoryAsync(modelsDir);
      for (const item of dirContents) {
        if (item.includes('.tmp.') || item.includes('.bak.')) {
          await FileSystem.deleteAsync(`${modelsDir}${item}`, { idempotent: true });
        }
      }
    } catch {
      // Directory listing cleanup failure is non-fatal
    }

    currentLifecycleState = 'not_imported';
    currentError = null;
  } catch (err) {
    currentLifecycleState = 'error';
    currentError = err instanceof Error ? err.message : String(err);
    throw new ModelStorageError('COPY_FAILED', `Failed to delete imported model: ${currentError}`, err);
  }
}

/**
 * Safely cleans up abandoned temporary staging files (.tmp.<timestamp>) from interrupted imports.
 * Never touches the active valid model or backup (.bak) files.
 */
export async function cleanupAbandonedTempFiles(): Promise<number> {
  let cleanedCount = 0;
  if (isImporting) return 0;

  try {
    const modelsDir = getModelsDirectory();
    const dirInfo = await FileSystem.getInfoAsync(modelsDir);
    if (!dirInfo.exists || !dirInfo.isDirectory) return 0;

    const items = await FileSystem.readDirectoryAsync(modelsDir);
    for (const item of items) {
      if (item.includes('.tmp.')) {
        const itemPath = `${modelsDir}${item}`;
        const info = await FileSystem.getInfoAsync(itemPath);
        if (info.exists && !info.isDirectory) {
          await FileSystem.deleteAsync(itemPath, { idempotent: true });
          cleanedCount++;
        }
      }
    }
  } catch (err) {
    console.warn('[ModelStorageService] Temp cleanup warning:', err);
  }

  return cleanedCount;
}

/**
 * Returns current lifecycle status of the storage service.
 */
export function getModelStatus(): StorageLifecycleState {
  return currentLifecycleState;
}

