async function test() {
    try {
        // Try to import the browser build directly
        const module = await import('./node_modules/edge-tts-universal/dist/browser.js');
        console.log("Browser Module loaded");

        const { EdgeTTS } = module;

        if (EdgeTTS) {
            const text = "高一生遺書（台灣人權博物館提供）";
            const voice = "zh-CN-shaanxi-XiaoniNeural";
            console.log(`Testing TTS with text: "${text}" and voice: ${voice}`);

            try {
                const tts = new EdgeTTS(text, voice);
                const result = await tts.synthesize();
                console.log("Synthesize result:", result);

                if (result && result.audio) {
                    console.log("Audio generated successfully, length:", result.audio.byteLength);
                } else {
                    console.error("No audio generated");
                }
            } catch (e) {
                console.error("Synthesize failed:", e);
            }
        }

    } catch (e) {
        console.error("Import error:", e);
    }
}

test();
