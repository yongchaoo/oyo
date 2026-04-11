import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

const VOICE = "zh-CN-XiaoyiNeural";

// Cache TTS instance to reuse WebSocket connection
let _tts: MsEdgeTTS | null = null;
let _ready = false;

async function getTTS(): Promise<MsEdgeTTS> {
  if (_tts && _ready) return _tts;
  _tts = new MsEdgeTTS();
  await _tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  _ready = true;
  return _tts;
}

export async function POST(req: Request) {
  const { text } = await req.json();
  if (!text || typeof text !== "string") {
    return new Response("text required", { status: 400 });
  }

  try {
    const tts = await getTTS();
    const { audioStream } = tts.toStream(text.slice(0, 500));

    // Stream audio directly to client instead of buffering
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of audioStream) {
            controller.enqueue(new Uint8Array(chunk));
          }
          controller.close();
        } catch {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    // Reset cached instance on error
    _tts = null;
    _ready = false;
    console.error("TTS error:", err);
    return new Response("TTS failed", { status: 500 });
  }
}
