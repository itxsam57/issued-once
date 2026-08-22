export interface ArtworkStorageGateway {
  put(input: {
    issueId: string;
    designJobId: string;
    bytes: Buffer;
    mimeType: 'image/png';
  }): Promise<{ url: string; bytes: number }>;
}
