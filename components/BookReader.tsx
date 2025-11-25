'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ReactReader, ReactReaderStyle } from 'react-reader';
import { useSearchParams } from 'next/navigation';


export default function BookReader() {
    const searchParams = useSearchParams();
    const bookUrl = searchParams.get('book') ? `/api/book-content?filename=${encodeURIComponent(searchParams.get('book')!)}` : null;

    const [location, setLocation] = useState<string | number>(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [rate, setRate] = useState(1.5);
    const renditionRef = useRef<any>(null);
    const synthRef = useRef<SpeechSynthesis | null>(null);
    const currentElementRef = useRef<HTMLElement | null>(null);
    const originalStyleRef = useRef<string | null>(null);
    const isPlayingRef = useRef(false);
    const autoPageTurnRef = useRef(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Initialize SpeechSynthesis and Audio
    useEffect(() => {
        if (typeof window !== 'undefined') {
            synthRef.current = window.speechSynthesis;
            // Create silent audio element for background playback hack
            // 1s of silent mp3
            const silentMp3 = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTSVMAAAAPAAADTGF2ZjU4LjIwLjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMD//////////////////////////////////////////////////////////////////wAAAAAATGF2YzU4LjM1AAAAAAAAAAAAAAAAJAAAAAAAAAAAASAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAA";
            audioRef.current = new Audio(silentMp3);
            audioRef.current.loop = true;
        }
        return () => {
            stopReading();
        };
    }, []);

    // Load progress
    useEffect(() => {
        if (bookUrl) {
            const savedLocation = localStorage.getItem(`book-progress-${bookUrl}`);
            if (savedLocation) {
                setLocation(savedLocation);
            }
        }
    }, [bookUrl]);

    const handleLocationChanged = React.useCallback((loc: string | number) => {
        setLocation(loc);
        if (bookUrl) {
            localStorage.setItem(`book-progress-${bookUrl}`, String(loc));
        }
    }, [bookUrl]);

    const stopReading = () => {
        setIsPlaying(false);
        setIsPaused(false);
        isPlayingRef.current = false;
        autoPageTurnRef.current = false;

        if (synthRef.current) {
            synthRef.current.cancel();
        }

        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }

        // Restore original style
        if (currentElementRef.current && originalStyleRef.current !== null) {
            currentElementRef.current.style.cssText = originalStyleRef.current;
            currentElementRef.current = null;
            originalStyleRef.current = null;
        }
    };

    const togglePause = () => {
        if (!synthRef.current) return;

        if (isPaused) {
            synthRef.current.resume();
            if (audioRef.current) audioRef.current.play();
            setIsPaused(false);
        } else {
            synthRef.current.pause();
            if (audioRef.current) audioRef.current.pause();
            setIsPaused(true);
        }
    };

    const startReading = (text: string, target: HTMLElement) => {
        if (!synthRef.current) return;

        // Temporarily disable auto-advance while we switch
        isPlayingRef.current = false;
        setIsPaused(false);

        // Stop any current reading
        if (synthRef.current.speaking) {
            synthRef.current.cancel();
        }

        // Start silent audio to keep background active
        if (audioRef.current) {
            audioRef.current.play().catch(e => console.log("Audio play failed:", e));
        }

        // Setup Media Session
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: searchParams.get('book') || 'Book',
                artist: 'Booker Reader',
                album: 'Audiobook',
                artwork: [
                    { src: '/file.svg', sizes: '96x96', type: 'image/svg+xml' },
                    { src: '/file.svg', sizes: '128x128', type: 'image/svg+xml' },
                ]
            });

            navigator.mediaSession.setActionHandler('play', () => togglePause());
            navigator.mediaSession.setActionHandler('pause', () => togglePause());
            navigator.mediaSession.setActionHandler('stop', () => stopReading());
            navigator.mediaSession.setActionHandler('nexttrack', () => {
                // Skip to next paragraph if possible, or just ignore
                // readNext() is internal, maybe expose it or just let it be
            });
        }

        // Restore previous element style if it's different
        if (currentElementRef.current && currentElementRef.current !== target && originalStyleRef.current !== null) {
            currentElementRef.current.style.cssText = originalStyleRef.current;
        }

        // Highlight target
        currentElementRef.current = target;
        originalStyleRef.current = target.style.cssText;
        target.style.backgroundColor = 'rgba(255, 226, 150, 0.5)';
        target.style.transition = 'background-color 0.3s';

        // Scroll into view if needed
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = rate;
        utterance.pitch = 1;

        // Try to pick a good voice
        const voices = synthRef.current.getVoices();
        const preferredVoice = voices.find(v => /Xiaoni/i.test(v.name)) ||
            voices.find(v => /Microsoft/i.test(v.name)) ||
            voices[0];
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        utterance.onend = () => {
            if (isPlayingRef.current) {
                readNext();
            }
        };

        utterance.onerror = (e) => {
            console.log("Speech error:", e);
            // stopReading();
        };

        setIsPlaying(true);
        isPlayingRef.current = true;
        synthRef.current.speak(utterance);
    };

    const readNext = () => {
        if (!currentElementRef.current) {
            stopReading();
            return;
        }

        let next = currentElementRef.current.nextElementSibling as HTMLElement;
        while (next) {
            const text = next.innerText?.trim();
            if (text && text.length > 0) {
                startReading(text, next);
                return;
            }
            next = next.nextElementSibling as HTMLElement;
        }

        // No more siblings found in current chapter, try next chapter
        if (renditionRef.current) {
            autoPageTurnRef.current = true;
            renditionRef.current.next();
        } else {
            stopReading();
        }
    };

    const handleRateChange = (newRate: number) => {
        setRate(newRate);
        if (isPlaying && currentElementRef.current) {
            // Restart current reading with new rate
            const text = currentElementRef.current.innerText.trim();
            startReading(text, currentElementRef.current);
        }
    };

    // Hook into rendition to add event listeners
    const getRendition = React.useCallback((rendition: any) => {
        renditionRef.current = rendition;

        rendition.hooks.content.register((contents: any) => {
            const doc = contents.document;
            const body = doc.body;

            // Auto-start reading if page turn was triggered by TTS
            if (autoPageTurnRef.current) {
                autoPageTurnRef.current = false;
                // Find first readable element
                const findFirstText = (root: HTMLElement): HTMLElement | null => {
                    if (root.children.length === 0 && root.innerText?.trim().length > 0) {
                        return root;
                    }
                    for (let i = 0; i < root.children.length; i++) {
                        const found = findFirstText(root.children[i] as HTMLElement);
                        if (found) return found;
                    }
                    return null;
                };

                // Simple heuristic: look for first p or div with text
                const paragraphs = body.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6');
                for (let i = 0; i < paragraphs.length; i++) {
                    const p = paragraphs[i] as HTMLElement;
                    if (p.innerText?.trim().length > 0) {
                        // Give a small delay for render to settle
                        setTimeout(() => startReading(p.innerText.trim(), p), 100);
                        break;
                    }
                }
            }

            // Long press detection logic
            let pressTimer: NodeJS.Timeout | null = null;
            const LONG_PRESS_DURATION = 500;
            let startX = 0;
            let startY = 0;

            const handleStart = (e: TouchEvent | MouseEvent) => {
                if (pressTimer) clearTimeout(pressTimer);

                if (e instanceof TouchEvent) {
                    startX = e.touches[0].clientX;
                    startY = e.touches[0].clientY;
                } else {
                    startX = (e as MouseEvent).clientX;
                    startY = (e as MouseEvent).clientY;
                }

                pressTimer = setTimeout(() => {
                    handleLongPress(e);
                }, LONG_PRESS_DURATION);
            };

            const handleEnd = () => {
                if (pressTimer) {
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }
            };

            const handleMove = (e: TouchEvent | MouseEvent) => {
                let clientX, clientY;
                if (e instanceof TouchEvent) {
                    clientX = e.touches[0].clientX;
                    clientY = e.touches[0].clientY;
                } else {
                    clientX = (e as MouseEvent).clientX;
                    clientY = (e as MouseEvent).clientY;
                }

                // If moved significantly, cancel long press
                if (Math.abs(clientX - startX) > 10 || Math.abs(clientY - startY) > 10) {
                    if (pressTimer) {
                        clearTimeout(pressTimer);
                        pressTimer = null;
                    }
                }
            }

            body.addEventListener('touchstart', handleStart);
            body.addEventListener('touchend', handleEnd);
            body.addEventListener('touchmove', handleMove);

            body.addEventListener('mousedown', handleStart);
            body.addEventListener('mouseup', handleEnd);
            body.addEventListener('mousemove', handleMove);
        });
    }, [rate]);

    const handleLongPress = (e: TouchEvent | MouseEvent) => {
        const target = e.target as HTMLElement;

        // Try to get text from the target paragraph or block
        let text = target.innerText;
        let elementToHighlight = target;

        // If the click is on a small span, try to get the parent paragraph
        if (text.length < 20 && target.parentElement) {
            text = target.parentElement.innerText;
            elementToHighlight = target.parentElement;
        }

        text = text.trim();

        if (text) {
            // Prevent default context menu if possible (might need preventDefault in touchstart)
            if (e.cancelable) e.preventDefault();

            startReading(text, elementToHighlight);
        }
    };

    const [bookData, setBookData] = useState<ArrayBuffer | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (bookUrl) {
            setBookData(null);
            setError(null);
            fetch(bookUrl)
                .then(res => {
                    if (!res.ok) throw new Error(`Failed to fetch book: ${res.statusText}`);
                    return res.arrayBuffer();
                })
                .then(data => setBookData(data))
                .catch(err => {
                    console.error("Error fetching book:", err);
                    setError(err.message);
                });
        }
    }, [bookUrl]);

    if (error) {
        return <div className="p-10 text-center text-red-600">Error: {error}</div>;
    }

    if (!bookData) {
        return <div className="p-10 text-center">Loading book...</div>;
    }

    return (
        <div
            className="w-screen relative overflow-hidden transition-[height] duration-300 ease-in-out"
            style={{ height: isPlaying ? 'calc(100vh - 80px)' : 'calc(100vh - 80px)' }}
        >
            <div className="absolute top-4 left-4 z-10">
                <a href="/" className="px-4 py-2 bg-white/80 backdrop-blur rounded-lg shadow-sm hover:bg-white transition-colors text-sm font-medium">
                    ← Library
                </a>
            </div>

            <ReactReader
                url={bookData}
                title={searchParams.get('book') || 'Book'}
                location={location}
                locationChanged={handleLocationChanged}
                getRendition={getRendition}
                epubOptions={{
                    // Using default paginated view for better performance and stability
                }}
                readerStyles={{
                    ...ReactReaderStyle,
                    readerArea: {
                        ...ReactReaderStyle.readerArea,
                        backgroundColor: '#fafafa',
                        // Padding handled by container resizing now, but keeping a bit doesn't hurt
                        paddingBottom: '20px',
                    }
                }}
            />

            {isPlaying && (
                <div
                    className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] transition-transform duration-300 ease-out translate-y-0"
                    style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
                >
                    <div className="max-w-screen-md mx-auto px-6 py-4 flex items-center justify-between gap-4">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">Reading Speed</span>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-gray-500 w-8 text-right">0.5x</span>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="3"
                                    step="0.1"
                                    value={rate}
                                    onChange={(e) => handleRateChange(parseFloat(e.target.value))}
                                    className="w-32 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-500 hover:accent-blue-600 transition-all"
                                />
                                <span className="text-sm font-bold text-gray-900 w-8 tabular-nums">{rate.toFixed(1)}x</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={togglePause}
                                className="flex items-center justify-center w-12 h-12 bg-gray-900 hover:bg-black active:bg-gray-800 text-white rounded-full shadow-lg transition-all transform active:scale-95"
                            >
                                {isPaused ? (
                                    <span className="text-xl ml-1">▶</span>
                                ) : (
                                    <span className="text-xl">⏸</span>
                                )}
                            </button>

                            <button
                                onClick={stopReading}
                                className="flex items-center justify-center w-10 h-10 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition-colors"
                                title="Close"
                            >
                                <span className="text-lg">✕</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
