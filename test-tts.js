async function test() {
    try {
        // Try to import the browser build directly
        const module = await import('./node_modules/edge-tts-universal/dist/browser.js');
        console.log("Browser Module exports:", Object.keys(module));

        const { EdgeTTS } = module;
        console.log("EdgeTTS class:", EdgeTTS);

        if (EdgeTTS) {
            // Try calling synthesize with positional args
            try {
                const tts = new EdgeTTS("Hello world", "en-US-EmmaMultilingualNeural");
                console.log("Calling synthesize...");
                const result = await tts.synthesize();
                console.log("Synthesize result type:", typeof result);
                if (result) {
                    console.log("Synthesize result keys:", Object.keys(result));
                    if (result.audio) {
                        console.log("Audio type:", typeof result.audio);
                        // console.log("Audio is blob?", result.audio instanceof Blob);
                    }
                }
            } catch (e) {
                console.log("Synthesize failed:", e);
            }
        }

    } catch (e) {
        console.error("Import error:", e);
    }
}

test();
