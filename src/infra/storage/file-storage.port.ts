export interface SaveFileResult {
  url: string; // URL pública (ex.: /files/xyz.png)
  path: string; // caminho físico
  mime: string;
  size: number;
  filename: string;
}

export interface IFileStorage {
  save(buffer: Buffer, opts: { mime: string; ext?: string; alt?: string }): Promise<SaveFileResult>;
  delete?(filename: string): Promise<void>;
}
