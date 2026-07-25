import "@testing-library/jest-dom";

import {
  ReadableStream,
  TransformStream,
  WritableStream,
} from "node:stream/web";
import { TextDecoder, TextEncoder } from "node:util";

// jsdom does not implement the WHATWG Streams or the text encoding globals that
// @medusajs/js-sdk pulls in through fetch-event-stream. Node ships both, so
// bridge them onto the jsdom global before any test imports the SDK.
const polyfills: Record<string, unknown> = {
  ReadableStream,
  TransformStream,
  WritableStream,
  TextEncoder,
  TextDecoder,
};

for (const [name, value] of Object.entries(polyfills)) {
  if (!(name in globalThis)) {
    Object.defineProperty(globalThis, name, {
      value,
      writable: true,
      configurable: true,
    });
  }
}
