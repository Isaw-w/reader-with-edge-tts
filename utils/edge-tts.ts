import { v4 as uuidv4 } from 'uuid';

export enum OUTPUT_FORMAT {
    AUDIO_24KHZ_48KBITRATE_MONO_MP3 = "audio-24khz-48kbitrate-mono-mp3",
    AUDIO_24KHZ_96KBITRATE_MONO_MP3 = "audio-24khz-96kbitrate-mono-mp3",
    WEBM_24KHZ_16BIT_MONO_OPUS = "webm-24khz-16bit-mono-opus",
}

export class ProsodyOptions {
    pitch: string = "+0Hz";
    rate: string | number = 1.0;
    volume: string | number = 100.0;
}

type EventType = "data" | "close" | "end";

class EventEmitter {
    private eventListeners: Record<EventType, ((...args: any[]) => void)[]>;

    constructor() {
        this.eventListeners = { data: [], close: [], end: [] };
    }

    on(event: EventType, callback: (...args: any[]) => void) {
        this.eventListeners[event].push(callback);
    }

    emit(event: EventType, data: any) {
        this.eventListeners[event].forEach((callback) => callback(data));
    }
}

export class EdgeTTSClient {
    static OUTPUT_FORMAT = OUTPUT_FORMAT;
    private static CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
    private static SYNTH_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${EdgeTTSClient.CLIENT_TOKEN}`;
    private static BINARY_DELIM = "Path:audio\r\n";
    private static VOICE_LANG_REGEX = /\w{2}-\w{2}/;

    private ws: WebSocket | null = null;
    private voice: string | null = null;
    private voiceLocale: string | null = null;
    private outputFormat: OUTPUT_FORMAT | null = null;
    private requestQueue: Record<string, EventEmitter> = {};

    constructor() { }

    private async sendMessage(message: string) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            await this.initWebSocket();
        }
        this.ws?.send(message);
    }

    private initWebSocket() {
        this.ws = new WebSocket(EdgeTTSClient.SYNTH_URL);
        this.ws.binaryType = "arraybuffer";

        return new Promise<void>((resolve, reject) => {
            this.ws!.onopen = () => {
                console.log("EdgeTTS WebSocket Connected");
                this.sendMessage(this.getConfigMessage()).then(resolve);
            };

            this.ws!.onmessage = (event) => this.handleMessage(event);
            this.ws!.onclose = () => this.handleClose();
            this.ws!.onerror = (error) => reject(`Connection Error: ${error}`);
        });
    }

    private handleMessage(event: MessageEvent) {
        if (typeof event.data === 'string') {
            const message = event.data;
            // Handle text messages if any (usually config confirmation or errors)
            // console.log("Received text message:", message);
        } else if (event.data instanceof ArrayBuffer) {
            const buffer = new Uint8Array(event.data);
            const decoder = new TextDecoder();

            // We need to find the headers to get the RequestId and Path
            // Headers are at the beginning, separated by \r\n\r\n from the body (if any)
            // But for binary audio messages, the structure is:
            // headers \r\n\r\n binary_data

            // Let's decode the first chunk to find headers. 
            // Headers are usually short.
            const headerEndIndex = this.findDelimiterIndex(buffer, new TextEncoder().encode("\r\n\r\n"));

            if (headerEndIndex === -1) {
                // Maybe it's a short text message sent as binary?
                const text = decoder.decode(buffer);
                // console.log("Received binary message (decoded):", text);
                this.processTextMessage(text, buffer);
                return;
            }

            const headerBytes = buffer.slice(0, headerEndIndex);
            const headers = decoder.decode(headerBytes);
            const requestIdMatch = /X-RequestId:(.*?)\r\n/.exec(headers);
            const requestId = requestIdMatch ? requestIdMatch[1].trim() : "";

            if (headers.includes("Path:audio")) {
                const audioData = buffer.slice(headerEndIndex + 4); // +4 for \r\n\r\n
                this.requestQueue[requestId]?.emit("data", audioData);
            } else if (headers.includes("Path:turn.end")) {
                this.requestQueue[requestId]?.emit("end", null);
                // Clean up listener
                delete this.requestQueue[requestId];
            } else if (headers.includes("Path:turn.start")) {
                // Start of turn
            }
        }
    }

    private processTextMessage(message: string, originalBuffer: Uint8Array) {
        // Fallback for when headers might be parsed from the full string
        const requestIdMatch = /X-RequestId:(.*?)\r\n/.exec(message);
        const requestId = requestIdMatch ? requestIdMatch[1].trim() : "";

        if (message.includes("Path:turn.end")) {
            this.requestQueue[requestId]?.emit("end", null);
            delete this.requestQueue[requestId];
        }
    }

    private handleClose() {
        console.log("EdgeTTS WebSocket Disconnected");
        for (const requestId in this.requestQueue) {
            this.requestQueue[requestId].emit("close", null);
        }
        this.requestQueue = {};
    }

    private findDelimiterIndex(buffer: Uint8Array, delimiter: Uint8Array): number {
        for (let i = 0; i <= buffer.length - delimiter.length; i++) {
            let match = true;
            for (let j = 0; j < delimiter.length; j++) {
                if (buffer[i + j] !== delimiter[j]) {
                    match = false;
                    break;
                }
            }
            if (match) return i;
        }
        return -1;
    }

    private getConfigMessage(): string {
        return `Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{
            "context": {
                "synthesis": {
                    "audio": {
                        "metadataoptions": {
                            "sentenceBoundaryEnabled": "false",
                            "wordBoundaryEnabled": "false"
                        },
                        "outputFormat": "${this.outputFormat}"
                    }
                }
            }
        }`;
    }

    async setMetadata(voiceName: string, outputFormat: OUTPUT_FORMAT, voiceLocale?: string) {
        this.voice = voiceName;
        this.outputFormat = outputFormat;
        this.voiceLocale = voiceLocale || this.inferLocaleFromVoiceName(voiceName);

        if (!this.voiceLocale) {
            throw new Error("Could not infer voiceLocale from voiceName!");
        }

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            await this.initWebSocket();
        }
    }

    private inferLocaleFromVoiceName(voiceName: string): string | null {
        const match = EdgeTTSClient.VOICE_LANG_REGEX.exec(voiceName);
        return match ? match[0] : null;
    }

    close() {
        this.ws?.close();
    }

    toStream(text: string, options: ProsodyOptions = new ProsodyOptions()): EventEmitter {
        return this.sendSSMLRequest(this.buildSSML(text, options));
    }

    private buildSSML(text: string, options: ProsodyOptions): string {
        return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${this.voiceLocale}">
            <voice name="${this.voice}">
                <prosody pitch="${options.pitch}" rate="${options.rate}" volume="${options.volume}">
                    ${text}
                </prosody>
            </voice>
        </speak>`;
    }

    private sendSSMLRequest(ssml: string): EventEmitter {
        if (!this.ws) {
            throw new Error("WebSocket not initialized. Call setMetadata first.");
        }

        const requestId = uuidv4().replace(/-/g, '');
        const requestMessage = `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${ssml.trim()}`;

        const eventEmitter = new EventEmitter();
        this.requestQueue[requestId] = eventEmitter;
        this.sendMessage(requestMessage).then();

        return eventEmitter;
    }
}
