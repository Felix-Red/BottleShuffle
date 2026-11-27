import type { AdErrorCategory, AdErrorDetails } from '../../core';
import type { YouTubeSdkErrorLike } from '../../types/youtube-playables';

function extractSdkErrorType(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  const candidate = error as Partial<YouTubeSdkErrorLike>;
  if (typeof candidate.errorType === 'string' && candidate.errorType.trim().length > 0) {
    return candidate.errorType.trim();
  }
  return null;
}

function extractSafeMessage(error: unknown): string | null {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }
  if (typeof error === 'object' && error !== null) {
    const candidate = error as Partial<YouTubeSdkErrorLike>;
    if (typeof candidate.description === 'string' && candidate.description.trim().length > 0) {
      return candidate.description.trim();
    }
  }
  if (typeof error === 'string' && error.trim().length > 0) {
    return error.trim();
  }
  return null;
}

/**
 * Maps official YouTube Playables SDK rejections (including `undefined` or non-Error
 * rejection payloads) into safe, structured application-level `AdErrorDetails`.
 * Never leaks raw stack traces or assumes every rejection has an Error object.
 */
export function mapAdError(error: unknown): AdErrorDetails {
  const sdkErrorType = extractSdkErrorType(error);
  const rawMessage = extractSafeMessage(error);

  let category: AdErrorCategory;
  let message: string;

  switch (sdkErrorType) {
    case 'API_UNAVAILABLE':
      category = 'api_unavailable';
      message = 'Platform advertising API is currently unavailable.';
      break;
    case 'INVALID_PARAMS':
      category = 'invalid_params';
      message = 'Advertising request parameters were rejected by the platform.';
      break;
    case 'SIZE_LIMIT_EXCEEDED':
      category = 'size_limit_exceeded';
      message = 'Advertising request exceeded platform parameter limits.';
      break;
    case 'UNKNOWN':
      category = 'unknown';
      message = rawMessage ?? 'Platform advertising request failed with an unknown SDK error.';
      break;
    default:
      category = error === undefined || error === null ? 'request_rejected' : 'unknown';
      message = rawMessage ?? 'Platform advertising request could not be completed.';
      break;
  }

  return {
    category,
    sdkErrorType,
    message,
  };
}

export function isUnavailableAdError(details: AdErrorDetails): boolean {
  return details.category === 'api_unavailable' || details.category === 'capability_disabled';
}
