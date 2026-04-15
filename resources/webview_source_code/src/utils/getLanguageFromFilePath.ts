export function getLanguageFromFilePath(filePath: string): string {
  try {
    const fileName = filePath.split('/').slice(-1)[0];
    return fileName.split('.').slice(-1)[0];
  } catch (error) {
    return 'text';
  }
}