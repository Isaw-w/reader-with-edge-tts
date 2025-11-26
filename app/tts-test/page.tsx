'use client';

import Script from 'next/script';

export default function TTSTestPage() {
    return (
        <div className="min-h-screen bg-white p-8 font-serif text-lg leading-relaxed text-gray-800">
            <h1 className="text-3xl font-bold mb-6">TTS Functionality Test</h1>

            <div className="max-w-prose mx-auto space-y-6">
                <p>
                    This is a test page for the Text-to-Speech (TTS) functionality.
                    Select any text on this page or double-click a paragraph to test the reading feature.
                </p>

                <p>
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                    Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                </p>

                <p>
                    Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
                    Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
                </p>

                <p>
                    中文策四. 中文策四. 中文策四. 中文策四. 中文策四. 中文策四.
                </p>

                <div className="p-4 bg-gray-100 rounded-lg border border-gray-200">
                    <h2 className="text-xl font-semibold mb-2">Nested Content</h2>
                    <p>
                        This paragraph is inside a nested container. The TTS script should be able to handle text selection within this block as well.
                    </p>
                </div>
            </div>

            <Script src="/webread.js" strategy="afterInteractive" />
        </div>
    );
}
