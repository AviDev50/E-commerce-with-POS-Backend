export function formatImageUrl(imagePath: string): string {
  const baseUrl = process.env.BASE_URL || "http://localhost:5000";
  return `${baseUrl}${imagePath}`;
}

export function formatImageUrls(imagePaths: string[]): string[] {
  return imagePaths.map(formatImageUrl);
}