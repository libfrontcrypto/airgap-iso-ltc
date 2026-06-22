const runtimeGlobal: any =
  typeof globalThis !== 'undefined'
    ? globalThis
    : typeof self !== 'undefined'
      ? self
      : typeof window !== 'undefined'
        ? window
        : Function('return this')()

if (typeof runtimeGlobal.TextEncoder === 'undefined') {
  runtimeGlobal.TextEncoder = class TextEncoder {
    public encode(input: string = ''): Uint8Array {
      const bytes: number[] = []
      const value = String(input)

      for (let i = 0; i < value.length; i++) {
        let codePoint = value.charCodeAt(i)

        if (codePoint >= 0xd800 && codePoint <= 0xdbff && i + 1 < value.length) {
          const next = value.charCodeAt(i + 1)
          if (next >= 0xdc00 && next <= 0xdfff) {
            codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (next - 0xdc00)
            i++
          }
        }

        if (codePoint <= 0x7f) {
          bytes.push(codePoint)
        } else if (codePoint <= 0x7ff) {
          bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f))
        } else if (codePoint <= 0xffff) {
          bytes.push(
            0xe0 | (codePoint >> 12),
            0x80 | ((codePoint >> 6) & 0x3f),
            0x80 | (codePoint & 0x3f)
          )
        } else {
          bytes.push(
            0xf0 | (codePoint >> 18),
            0x80 | ((codePoint >> 12) & 0x3f),
            0x80 | ((codePoint >> 6) & 0x3f),
            0x80 | (codePoint & 0x3f)
          )
        }
      }

      return new Uint8Array(bytes)
    }
  }
}

if (typeof runtimeGlobal.TextDecoder === 'undefined') {
  runtimeGlobal.TextDecoder = class TextDecoder {
    public decode(input?: ArrayBuffer | ArrayBufferView): string {
      if (input === undefined) {
        return ''
      }

      const bytes =
        input instanceof ArrayBuffer
          ? new Uint8Array(input)
          : new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
      const chars: string[] = []

      for (let i = 0; i < bytes.length; i++) {
        const byte = bytes[i]

        if (byte < 0x80) {
          chars.push(String.fromCharCode(byte))
        } else if (byte >= 0xc0 && byte < 0xe0) {
          const codePoint = ((byte & 0x1f) << 6) | (bytes[++i] & 0x3f)
          chars.push(String.fromCharCode(codePoint))
        } else if (byte >= 0xe0 && byte < 0xf0) {
          const codePoint =
            ((byte & 0x0f) << 12) | ((bytes[++i] & 0x3f) << 6) | (bytes[++i] & 0x3f)
          chars.push(String.fromCharCode(codePoint))
        } else {
          const codePoint =
            ((byte & 0x07) << 18) |
            ((bytes[++i] & 0x3f) << 12) |
            ((bytes[++i] & 0x3f) << 6) |
            (bytes[++i] & 0x3f)
          const adjusted = codePoint - 0x10000
          chars.push(
            String.fromCharCode(0xd800 + (adjusted >> 10)),
            String.fromCharCode(0xdc00 + (adjusted & 0x3ff))
          )
        }
      }

      return chars.join('')
    }
  }
}
