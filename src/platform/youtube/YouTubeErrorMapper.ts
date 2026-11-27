import { SaveError, type SaveErrorCode } from '../../core';
import type { YouTubeSdkErrorLike } from '../../types/youtube-playables';

export type YouTubeStorageOperation = 'load' | 'save';

function extractErrorType(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  const candidate = error as Partial<YouTubeSdkErrorLike>;
  if (typeof candidate.errorType === 'string' && candidate.errorType.length > 0) {
    return candidate.errorType;
  }
  return null;
}

function extractRawMessage(error: unknown): string | null {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null) {
    const candidate = error as Partial<YouTubeSdkErrorLike>;
    if (typeof candidate.description === 'string' && candidate.description.length > 0) {
      return candidate.description;
    }
  }
  if (typeof error === 'string' && error.length > 0) {
    return error;
  }
  return null;
}

/**
 * Maps official YouTube Playables SDK errors (or unpopulated rejected values)
 * into concise, application-level SaveError instances without exposing raw stack traces.
 */
export function mapYouTubeStorageError(
  error: unknown,
  operation: YouTubeStorageOperation,
): SaveError {
  if (error instanceof SaveError) {
    return error;
  }

  const errorType = extractErrorType(error);
  const rawMessage = extractRawMessage(error);

  let code: SaveErrorCode;
  let userMessage: string;

  switch (errorType) {
    case 'API_UNAVAILABLE':
      code = 'STORAGE_UNAVAILABLE';
      userMessage = 'YouTube cloud storage is temporarily unavailable.';
      break;
    case 'SIZE_LIMIT_EXCEEDED':
      code = 'STORAGE_QUOTA_EXCEEDED';
      userMessage = 'Saved game data exceeds the cloud storage limit.';
      break;
    case 'INVALID_PARAMS':
      code = operation === 'save' ? 'SERIALIZATION_FAILED' : 'STORAGE_READ_FAILED';
      userMessage =
        operation === 'save'
          ? 'Saved game data could not be accepted by cloud storage.'
          : 'Unable to load saved progress from cloud storage.';
      break;
    default:
      code = operation === 'load' ? 'STORAGE_READ_FAILED' : 'STORAGE_WRITE_FAILED';
      userMessage =
        operation === 'load'
          ? 'Unable to load saved progress from cloud storage.'
          : 'Unable to save progress to cloud storage right now.';
      break;
  }

  return new SaveError(code, userMessage, {
    ...(errorType !== null ? { sdkErrorType: errorType } : {}),
    ...(rawMessage !== null ? { sdkCause: rawMessage } : {}),
    operation,
  });
}
