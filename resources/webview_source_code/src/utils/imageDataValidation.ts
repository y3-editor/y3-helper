const nonEmptyImageDataUrlPattern = /^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/]+={0,2}$/;
const emptyImageDataUrlPattern = /^data:image\/[a-zA-Z0-9.+-]+;base64,\s*$/;

function isImageDataUrl(value: unknown): value is string {
  return typeof value === 'string' && value.trim().startsWith('data:image/');
}

export function hasNonEmptyImageDataUrl(value: unknown): value is string {
  return typeof value === 'string' && nonEmptyImageDataUrlPattern.test(value.trim());
}

export function isEmptyImageDataUrl(value: unknown): boolean {
  return typeof value === 'string' && emptyImageDataUrlPattern.test(value.trim());
}

export function sanitizeImageContentList(content: any[], path?: string): any[] {
  const sanitized: any[] = [];

  for (const item of content) {
    if (item?.type !== 'image_url') {
      sanitized.push(item);
      continue;
    }

    const imageUrl = typeof item.image_url === 'object' ? item.image_url?.url : item.image_url;
    if (typeof imageUrl === 'string' && imageUrl.trim() && (!isImageDataUrl(imageUrl) || hasNonEmptyImageDataUrl(imageUrl))) {
      sanitized.push(item);
      continue;
    }

    sanitized.push({
      type: 'text',
      text: path
        ? `Unable to read image file or image is empty: ${path}`
        : 'Unable to read image file or image is empty.',
    });
  }

  return sanitized;
}

export function sanitizeMessagesImages<T extends { content?: any }>(messages: T[]): T[] {
  return messages.map((message) => {
    if (!Array.isArray(message.content)) {
      return message;
    }

    return {
      ...message,
      content: sanitizeImageContentList(message.content),
    };
  });
}
