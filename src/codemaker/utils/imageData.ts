const imageMimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    bmp: 'image/bmp',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
};

export function getImageMimeType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    return imageMimeTypes[ext] || 'image/png';
}

export function isNonEmptyBase64(value: unknown): value is string {
    if (typeof value !== 'string') {
        return false;
    }
    const normalized = value.trim();
    return normalized.length > 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(normalized);
}

export function buildImageDataUrl(mimeType: string, base64: unknown): string | null {
    if (!mimeType.startsWith('image/') || !isNonEmptyBase64(base64)) {
        return null;
    }
    return `data:${mimeType};base64,${base64}`;
}
