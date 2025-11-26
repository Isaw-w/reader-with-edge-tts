const tts = require('tts');

async function test() {
    console.log("TTS exports:", tts);
    // Try to find a speak or synthesize method
    // Common patterns: tts.speak, tts.getAudioUrl, or tts itself is a function

    if (typeof tts === 'function') {
        console.log("TTS is a function");
        try {
            // Try calling it with text
            const result = tts("Hello world");
            console.log("Result type:", typeof result);
            if (result instanceof Promise) {
                console.log("Result is a Promise");
                result.then(res => console.log("Promise resolved:", res))
                    .catch(err => console.error("Promise rejected:", err));
            } else {
                console.log("Result:", result);
            }

            // Try with callback
            tts("Hello world", (err, url) => {
                console.log("Callback called");
                if (err) console.error("Callback error:", err);
                else console.log("Callback success:", url);
            });

        } catch (e) {
            console.error("Call failed:", e);
        }
    }
}

test();
