export type StoredArtwork = {
  url: string;
  bytes: number;
};

export type ReadArtwork = {
  bytes: Buffer;
  mimeType: 'image/png';
};

export interface ArtworkStorageGateway {
  put(input: {
    issueId: string;
    designJobId: string;
    bytes: Buffer;
    mimeType: 'image/png';
  }): Promise<StoredArtwork>;

  get(url: string): Promise<ReadArtwork>;
}
