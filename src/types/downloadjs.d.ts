declare module 'downloadjs' {
  function download(
    data: string | Blob | File,
    filename?: string,
    mimeType?: string
  ): void;
  export = download;
}
