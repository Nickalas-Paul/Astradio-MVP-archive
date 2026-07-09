export const EXPORT_FORMATS = {
  audio: {
    extension: '.wav',
    contentType: 'audio/wav',
    mediaType: 'audio',
  },
  video: {
    extension: '.mp4',
    contentType: 'video/mp4',
    mediaType: 'video',
  },
} as const;

export type ExportFormat = keyof typeof EXPORT_FORMATS;

export type ExportFormatSpec = (typeof EXPORT_FORMATS)[ExportFormat];

/** Resolve store stream/put options for a named export format. */
export function exportFormatOptions(format: ExportFormat): {
  extension: string;
  contentType: string;
} {
  const spec = EXPORT_FORMATS[format];
  return { extension: spec.extension, contentType: spec.contentType };
}
