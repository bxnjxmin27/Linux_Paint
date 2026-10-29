declare module 'tga-js' {
  export default class TgaLoader {
    load(data: Uint8Array): void
    getCanvas(): HTMLCanvasElement
    getDataURL(type?: string): string
  }
}
