'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ReactReader, ReactReaderStyle } from 'react-reader';
import { useSearchParams } from 'next/navigation';
import { BrowserCommunicate } from '../utils/edge-tts-universal';
import dynamic from 'next/dynamic';
import { PdfReaderHandle } from './PdfReader';

const PdfReader = dynamic(() => import('./PdfReader'), { ssr: false });


export default function BookReader() {
    const searchParams = useSearchParams();
    const bookUrl = searchParams.get('book') ? `/api/book-content?filename=${encodeURIComponent(searchParams.get('book')!)}` : null;
    const isPdf = bookUrl?.toLowerCase().includes('.pdf');

    const [location, setLocation] = useState<string | number>(isPdf ? 1 : 0);
    const [isLoadingProgress, setIsLoadingProgress] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [rate, setRate] = useState(1.0); // Edge TTS rate is usually 1.0 base, can adjust string "+10%" etc but for now keep simple
    const [selectedText, setSelectedText] = useState<string | null>(null);
    const [voice, setVoice] = useState('zh-CN-shaanxi-XiaoniNeural');
    const [showPanel, setShowPanel] = useState(true);
    const renditionRef = useRef<any>(null);
    const pdfReaderRef = useRef<PdfReaderHandle>(null);
    const currentElementRef = useRef<HTMLElement | null>(null);
    const originalStyleRef = useRef<string | null>(null);
    const isPlayingRef = useRef(false);
    const rateRef = useRef(rate);
    const voiceRef = useRef(voice);
    const autoPageTurnRef = useRef(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const currentBodyRef = useRef<HTMLElement | null>(null);
    const ttsAudioUrlRef = useRef<string | null>(null);
    const nextAudioDataRef = useRef<{ url: string, text: string, element: HTMLElement } | null>(null);
    const prefetchIdRef = useRef<number>(0); // Track current prefetch operation

    const availableVoices = [
        { name: 'Xiaoni (Chinese)', value: 'zh-CN-shaanxi-XiaoniNeural' },
        { name: 'Xiaoxiao (Chinese)', value: 'zh-CN-XiaoxiaoNeural' },
        { name: 'Emma (English)', value: 'en-US-EmmaMultilingualNeural' },
        { name: 'Andrew (English)', value: 'en-US-AndrewMultilingualNeural' },
        { name: 'Ava (English)', value: 'en-US-AvaMultilingualNeural' },
        { name: 'Brian (English)', value: 'en-US-BrianMultilingualNeural' },
    ];

    // Initialize Audio
    useEffect(() => {
        if (typeof window !== 'undefined') {
            audioRef.current = new Audio();
            audioRef.current.onended = () => {
                if (isPlayingRef.current) {
                    readNext();
                }
            };
            audioRef.current.onerror = (e) => {
                let target: HTMLAudioElement | null = null;
                if (typeof e === 'object' && e !== null && 'target' in e) {
                    target = e.target as HTMLAudioElement;
                }
                console.error("Audio playback error:", e);
                if (target && target.error) {
                    console.error("MediaError code:", target.error.code);
                    console.error("MediaError message:", target.error.message);
                }
                // Try to skip to next paragraph on error
                if (isPlayingRef.current) {
                    console.log("Attempting to skip to next paragraph due to error...");
                    setTimeout(() => readNext(), 1000);
                }
            };
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
                // If PDF, parse as int
                if (isPdf) {
                    setLocation(parseInt(savedLocation, 10));
                } else {
                    setLocation(savedLocation);
                }
            }
            setIsLoadingProgress(false);
        }
    }, [bookUrl, isPdf]);

    // Load voice and speed settings
    useEffect(() => {
        const savedVoice = localStorage.getItem('tts-voice');
        if (savedVoice) {
            setVoice(savedVoice);
        }
        const savedRate = localStorage.getItem('tts-rate');
        if (savedRate) {
            setRate(parseFloat(savedRate));
        }
    }, []);

    // Save voice setting and clear prefetch when voice changes
    useEffect(() => {
        voiceRef.current = voice;
        localStorage.setItem('tts-voice', voice);

        // Cancel any in-flight prefetch by incrementing the ID
        prefetchIdRef.current += 1;

        // Clear prefetched audio when voice changes so next paragraph uses new voice
        if (nextAudioDataRef.current) {
            URL.revokeObjectURL(nextAudioDataRef.current.url);
            nextAudioDataRef.current = null;
            console.log('Cleared prefetched audio due to voice change');
        }
    }, [voice]);

    // Save rate setting
    useEffect(() => {
        rateRef.current = rate;
        localStorage.setItem('tts-rate', rate.toString());
    }, [rate]);

    // PDF Auto-read on page turn
    useEffect(() => {
        if (isPdf && isPlaying && pdfReaderRef.current) {
            const readPage = async () => {
                const text = await pdfReaderRef.current?.getCurrentPageText();
                if (text) startReading(text);
            };
            readPage();
        }
    }, [location, isPdf]);

    const handleLocationChanged = React.useCallback((loc: string | number) => {
        setLocation(loc);
        if (bookUrl) {
            localStorage.setItem(`book-progress-${bookUrl}`, String(loc));
            // Save as last read book
            const filename = searchParams.get('book');
            if (filename) {
                localStorage.setItem('last-read-book', filename);
            }
        }
    }, [bookUrl, searchParams]);

    const playbackIdRef = useRef<number>(0);
    const retryCountRef = useRef<number>(0);
    const MAX_RETRIES = 3;

    const wakeLockRef = useRef<any>(null);

    const requestWakeLock = async () => {
        if ('wakeLock' in navigator) {
            try {
                wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
                console.log('Wake Lock is active');
                wakeLockRef.current.addEventListener('release', () => {
                    console.log('Wake Lock was released');
                });
            } catch (err: any) {
                console.error(`${err.name}, ${err.message}`);
            }
        }
    };

    const releaseWakeLock = async () => {
        if (wakeLockRef.current) {
            try {
                await wakeLockRef.current.release();
                wakeLockRef.current = null;
            } catch (err: any) {
                console.error(`${err.name}, ${err.message}`);
            }
        }
    };

    // Re-acquire wake lock on visibility change if playing
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && isPlayingRef.current) {
                requestWakeLock();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    const stopReading = () => {
        setIsPlaying(false);
        setIsPaused(false);
        isPlayingRef.current = false;
        autoPageTurnRef.current = false;
        setSelectedText(null);

        releaseWakeLock();

        // Increment playback ID to invalidate any pending async operations
        playbackIdRef.current += 1;
        retryCountRef.current = 0;

        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current.src = '';
        }

        if (ttsAudioUrlRef.current) {
            URL.revokeObjectURL(ttsAudioUrlRef.current);
            ttsAudioUrlRef.current = null;
        }

        if (nextAudioDataRef.current) {
            URL.revokeObjectURL(nextAudioDataRef.current.url);
            nextAudioDataRef.current = null;
        }

        // Restore original style
        if (currentElementRef.current && originalStyleRef.current !== null) {
            currentElementRef.current.style.cssText = originalStyleRef.current;
            currentElementRef.current = null;
            originalStyleRef.current = null;
        }
    };

    // Helper to get all readable leaf block elements
    const getReadingCandidates = (root: HTMLElement): HTMLElement[] => {
        // ... (keep existing implementation, it seems fine for now)
        const allElements = Array.from(root.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li, blockquote')) as HTMLElement[];
        return allElements.filter(el => {
            const hasText = el.innerText?.trim().length > 0;
            if (!hasText) return false;

            // It is a candidate if it does NOT contain other candidates
            const hasBlockChildren = Array.from(el.children).some(child => {
                const childTag = child.tagName.toLowerCase();
                return ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote'].includes(childTag);
            });
            return !hasBlockChildren;
        });
    };

    const resumeReading = async () => {
        if (isPdf) {
            if (pdfReaderRef.current) {
                const text = await pdfReaderRef.current.getCurrentPageText();
                if (text) startReading(text);
            }
            return;
        }

        if (!currentBodyRef.current) return;

        // Try to resume from current location if it's a CFI
        if (typeof location === 'string' && renditionRef.current) {
            try {
                // If we have a current element selected (e.g. paused), use that
                if (currentElementRef.current) {
                    startReading(currentElementRef.current.innerText.trim(), currentElementRef.current);
                    return;
                }

                const range = await renditionRef.current.getRange(location);
                if (range) {
                    const node = range.startContainer;
                    // Find the closest block element
                    let element = node.nodeType === 1 ? node as HTMLElement : node.parentElement;
                    while (element && element !== currentBodyRef.current && !['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE'].includes(element.tagName)) {
                        element = element.parentElement;
                    }

                    if (element && element.innerText?.trim().length > 0) {
                        startReading(element.innerText.trim(), element as HTMLElement);
                        return;
                    }
                }
            } catch (e) {
                console.log("Could not resume from location, falling back to top of page", e);
            }
        }

        // Fallback: Start from top of visible page
        const candidates = getReadingCandidates(currentBodyRef.current);
        if (candidates.length > 0) {
            const first = candidates[0];
            startReading(first.innerText.trim(), first);
        }
    };

    const togglePause = () => {
        if (!audioRef.current) return;

        if (!isPlaying) {
            resumeReading();
            return;
        }

        if (isPaused) {
            audioRef.current.play();
            setIsPaused(false);
            requestWakeLock();
        } else {
            audioRef.current.pause();
            setIsPaused(true);
            releaseWakeLock();
        }
    };

    const prefetchNext = async (currentElement: HTMLElement) => {
        if (!currentBodyRef.current) return;

        const candidates = getReadingCandidates(currentBodyRef.current);
        const currentIndex = candidates.indexOf(currentElement);

        if (currentIndex !== -1 && currentIndex < candidates.length - 1) {
            const nextElement = candidates[currentIndex + 1];
            const nextText = nextElement.innerText.trim();

            // Don't prefetch if we already have it
            if (nextAudioDataRef.current && nextAudioDataRef.current.text === nextText) {
                return;
            }

            // Clear old prefetch
            if (nextAudioDataRef.current) {
                URL.revokeObjectURL(nextAudioDataRef.current.url);
                nextAudioDataRef.current = null;
            }

            try {
                // Increment and capture the prefetch ID for this operation
                prefetchIdRef.current += 1;
                const thisPrefetchId = prefetchIdRef.current;

                // Capture current voice to ensure consistency
                const currentVoice = voiceRef.current;

                console.log("Prefetching next paragraph:", nextText.substring(0, 20) + "...");

                const communicate = new BrowserCommunicate(nextText, { voice: currentVoice });
                const chunks: Uint8Array[] = [];

                for await (const chunk of communicate.stream()) {
                    // Check if this prefetch is still valid (not superseded by a new one)
                    if (thisPrefetchId !== prefetchIdRef.current) {
                        return;
                    }

                    if (chunk.type === 'audio' && chunk.data) {
                        chunks.push(chunk.data);
                    }
                }

                // Final check before storing
                if (thisPrefetchId !== prefetchIdRef.current) {
                    return;
                }

                if (chunks.length > 0) {
                    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
                    const audioData = new Uint8Array(totalLength);
                    let offset = 0;
                    for (const chunk of chunks) {
                        audioData.set(chunk, offset);
                        offset += chunk.length;
                    }

                    const blob = new Blob([audioData], { type: 'audio/mp3' });
                    const url = URL.createObjectURL(blob);
                    nextAudioDataRef.current = { url, text: nextText, element: nextElement };
                    console.log("Prefetch complete.");
                }
            } catch (e) {
                console.warn("Prefetch failed:", e);
            }
        }
    };

    // Helper to check if text has speakable content (not just punctuation/whitespace)
    const isSpeakable = (text: string): boolean => {
        // Remove ASCII punctuation, whitespace, and full-width punctuation/symbols
        const cleanText = text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\[\]"'?]/g, "")
            .replace(/[\u3000-\u303F\uFF00-\uFFEF]/g, "")
            .replace(/\s/g, "");
        return cleanText.length > 0;
    };

    const startReading = async (text: string, target?: HTMLElement) => {
        if (!audioRef.current) return;

        // Start a new playback session
        playbackIdRef.current += 1;
        const currentPlaybackId = playbackIdRef.current;

        // Temporarily disable auto-advance while we switch
        isPlayingRef.current = false;
        setIsPaused(false);

        // Request wake lock
        requestWakeLock();

        // Stop any current reading - OPTIMIZED: Don't pause if we are just switching tracks
        // audioRef.current.pause(); 
        // audioRef.current.currentTime = 0;

        if (ttsAudioUrlRef.current) {
            URL.revokeObjectURL(ttsAudioUrlRef.current);
            ttsAudioUrlRef.current = null;
        }

        // Check if we have prefetched audio for this text
        let prefetchedUrl: string | null = null;
        if (nextAudioDataRef.current && nextAudioDataRef.current.text === text) {
            console.log("Using prefetched audio!");
            prefetchedUrl = nextAudioDataRef.current.url;
            // Clear ref so we don't revoke it immediately, but don't revoke the URL yet as we are using it
            nextAudioDataRef.current = null;
        } else {
            // If we are starting a new read that isn't the prefetched one, clear the prefetch
            if (nextAudioDataRef.current) {
                URL.revokeObjectURL(nextAudioDataRef.current.url);
                nextAudioDataRef.current = null;
            }
        }

        // Setup Media Session
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: searchParams.get('book') || 'Book',
                artist: 'Natural Reader',
                album: 'Audiobook',
                artwork: [
                    { src: '/file.svg', sizes: '96x96', type: 'image/svg+xml' },
                    { src: '/file.svg', sizes: '128x128', type: 'image/svg+xml' },
                ]
            });

            navigator.mediaSession.setActionHandler('play', () => togglePause());
            navigator.mediaSession.setActionHandler('pause', () => togglePause());
            navigator.mediaSession.setActionHandler('stop', () => stopReading());
            navigator.mediaSession.setActionHandler('nexttrack', () => readNext());
            navigator.mediaSession.setActionHandler('previoustrack', () => readPrevious());
        }

        // Restore previous element style if it's different
        if (currentElementRef.current && currentElementRef.current !== target && originalStyleRef.current !== null) {
            currentElementRef.current.style.cssText = originalStyleRef.current;
        }

        // Highlight target if provided
        if (target) {
            currentElementRef.current = target;
            originalStyleRef.current = target.style.cssText;
            target.style.backgroundColor = 'rgba(255, 255, 0, 0.4)'; // Brighter yellow
            target.style.transition = 'background-color 0.3s';

            // Auto Page Turn: Use epub.js rendition.display to ensure element is visible
            if (renditionRef.current) {
                try {
                    // Get the CFI of the element
                    const contents = renditionRef.current.getContents()[0];
                    if (contents) {
                        const cfi = contents.cfiFromNode(target);
                        if (cfi) {
                            // Save progress immediately to ensure we resume from this exact paragraph
                            if (bookUrl) {
                                localStorage.setItem(`book-progress-${bookUrl}`, cfi);
                            }

                            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        } else {
                            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }
                } catch (err) {
                    console.warn("EPUB navigation error (using fallback):", err);
                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            } else {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } else {
            // If no target (e.g. selection reading), clear current highlight
            if (currentElementRef.current && originalStyleRef.current !== null) {
                currentElementRef.current.style.cssText = originalStyleRef.current;
                currentElementRef.current = null;
                originalStyleRef.current = null;
            }
        }

        setIsPlaying(true);
        isPlayingRef.current = true;

        // Check if text is speakable
        if (!isSpeakable(text)) {
            console.log("Text is not speakable (punctuation only), skipping...", text);
            // Wait a brief moment to simulate reading "silence" then skip
            setTimeout(() => {
                if (playbackIdRef.current === currentPlaybackId && isPlayingRef.current) {
                    readNext();
                }
            }, 500);
            return;
        }

        // Trigger prefetch for the NEXT paragraph
        if (target) {
            prefetchNext(target);
        }

        if (prefetchedUrl) {
            ttsAudioUrlRef.current = prefetchedUrl;
            if (audioRef.current) {
                audioRef.current.src = prefetchedUrl;
                audioRef.current.playbackRate = rateRef.current;
                console.log(`[Prefetched] Setting playback rate to: ${rateRef.current}`);
                try {
                    await audioRef.current.play();
                    // Reset retry count on successful play
                    retryCountRef.current = 0;
                } catch (playError) {
                    console.error("Audio play error:", playError);
                    handlePlaybackError(currentPlaybackId);
                }
            }
            return;
        }

        try {
            console.log("Initializing Edge TTS Universal...");

            // Capture current voice
            const currentVoice = voiceRef.current;
            console.log(`Synthesizing text with voice ${currentVoice}:`, text.substring(0, 50) + "...");

            // Add timeout for connection
            const communicate = new BrowserCommunicate(text, {
                voice: currentVoice,
                connectionTimeout: 10000 // 10 seconds timeout
            });

            const chunks: Uint8Array[] = [];
            let chunkReceived = false;

            // Watchdog for stream hanging mid-way
            const streamWatchdog = setTimeout(() => {
                if (!chunkReceived && playbackIdRef.current === currentPlaybackId) {
                    console.error("TTS Stream timeout (no chunks received)");
                    handlePlaybackError(currentPlaybackId);
                }
            }, 15000); // 15 seconds total timeout

            try {
                for await (const chunk of communicate.stream()) {
                    // Check if playback session changed during streaming
                    if (playbackIdRef.current !== currentPlaybackId) {
                        console.log("Playback session changed, aborting TTS stream.");
                        clearTimeout(streamWatchdog);
                        return;
                    }

                    if (chunk.type === 'audio' && chunk.data) {
                        chunks.push(chunk.data);
                        chunkReceived = true;
                    }
                }
            } finally {
                clearTimeout(streamWatchdog);
            }

            // Final check
            if (playbackIdRef.current !== currentPlaybackId) {
                console.log("Playback session changed, aborting playback.");
                return;
            }

            console.log(`TTS Stream ended. Received ${chunks.length} chunks.`);
            if (chunks.length > 0) {
                const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
                console.log(`Total audio size: ${totalLength} bytes`);
                const audioData = new Uint8Array(totalLength);
                let offset = 0;
                for (const chunk of chunks) {
                    audioData.set(chunk, offset);
                    offset += chunk.length;
                }

                const blob = new Blob([audioData], { type: 'audio/mp3' });
                const url = URL.createObjectURL(blob);
                ttsAudioUrlRef.current = url;

                if (audioRef.current) {
                    audioRef.current.src = url;
                    audioRef.current.playbackRate = rateRef.current;
                    console.log(`[New Audio] Setting playback rate to: ${rateRef.current}`);
                    try {
                        await audioRef.current.play();
                        // Reset retry count on successful play
                        retryCountRef.current = 0;
                    } catch (playError) {
                        console.error("Audio play error:", playError);
                        handlePlaybackError(currentPlaybackId);
                    }
                }
            } else {
                console.error("No audio chunks received.");
                handlePlaybackError(currentPlaybackId);
            }

        } catch (e) {
            console.error("Edge TTS error:", e);
            handlePlaybackError(currentPlaybackId);
        }
    };

    const handlePlaybackError = (playbackId: number) => {
        // Only handle error if we are still in the same playback session
        if (playbackIdRef.current !== playbackId) return;

        if (retryCountRef.current < MAX_RETRIES) {
            retryCountRef.current += 1;
            console.log(`Playback error, retrying (${retryCountRef.current}/${MAX_RETRIES})...`);
            setTimeout(() => {
                if (playbackIdRef.current === playbackId && isPlayingRef.current) {
                    readNext();
                }
            }, 1000);
        } else {
            console.error("Max retries reached, stopping playback.");
            stopReading();
            alert("Playback stopped due to repeated errors. Please check your connection or try a different voice.");
        }
    };

    const readPrevious = () => {
        if (isPdf) {
            if (pdfReaderRef.current) {
                pdfReaderRef.current.goToPrevPage();
            }
            return;
        }

        if (!currentElementRef.current || !currentBodyRef.current) return;

        const candidates = getReadingCandidates(currentBodyRef.current);
        const currentIndex = candidates.indexOf(currentElementRef.current);

        if (currentIndex > 0) {
            const prev = candidates[currentIndex - 1];
            startReading(prev.innerText.trim(), prev);
        } else {
            console.log("No previous paragraph in this chapter.");
            // Optionally go to previous chapter
            if (renditionRef.current) {
                renditionRef.current.prev();
            }
        }
    };

    const readNext = async () => {
        if (isPdf) {
            if (pdfReaderRef.current) {
                pdfReaderRef.current.goToNextPage();
            }
            return;
        }

        if (!currentElementRef.current || !currentBodyRef.current) {
            // If we are playing but lost track of element, try to resume or stop
            stopReading();
            return;
        }

        const candidates = getReadingCandidates(currentBodyRef.current);
        const currentIndex = candidates.indexOf(currentElementRef.current);

        if (currentIndex !== -1 && currentIndex < candidates.length - 1) {
            const next = candidates[currentIndex + 1];
            startReading(next.innerText.trim(), next);
        } else {
            // No more siblings found in current chapter, try next chapter
            console.log("End of chapter reached. Attempting to turn page...");
            if (renditionRef.current) {
                autoPageTurnRef.current = true;
                renditionRef.current.next().then(() => {
                    console.log("rendition.next() called successfully");
                }).catch((err: any) => {
                    console.error("rendition.next() failed:", err);
                    autoPageTurnRef.current = false;
                    stopReading();
                });
            } else {
                console.warn("No rendition ref, stopping.");
                stopReading();
            }
        }
    };

    const handleRateChange = (newRate: number) => {
        setRate(newRate);
        if (audioRef.current) {
            audioRef.current.playbackRate = newRate;
        }
    };

    const [toc, setToc] = useState<any[]>([]);

    // Hook into rendition to add event listeners
    const getRendition = React.useCallback((rendition: any) => {
        renditionRef.current = rendition;

        // Load Table of Contents
        rendition.book.loaded.navigation.then((nav: any) => {
            setToc(nav.toc);
        });

        rendition.hooks.content.register((contents: any) => {
            const doc = contents.document;
            const body = doc.body;
            currentBodyRef.current = body;

            // Ensure text is selectable and styled
            const style = doc.createElement('style');
            style.innerHTML = `
                * {
                    user-select: text !important;
                    -webkit-user-select: text !important;
                    touch-action: manipulation !important;
                }
                body {
                    padding: 0 5px !important;
                    margin: 0 !important;
                }
                p {
                    font-size: 1.25rem !important;
                    line-height: 1.8 !important;
                    margin-bottom: 1em !important;
                    cursor: pointer !important;
                }
                div, span, h1, h2, h3, h4, h5, h6 {
                    line-height: 1.8 !important;
                    cursor: pointer !important;
                }
                .long-press-indicator {
                    position: absolute;
                    width: 80px;
                    height: 80px;
                    background-color: rgba(0, 0, 0, 0.15);
                    border-radius: 50%;
                    transform: translate(-50%, -50%) scale(0);
                    pointer-events: none;
                    transition: transform 0.5s ease-out;
                    z-index: 10000;
                    display: none;
                }
                .long-press-indicator.active {
                    transform: translate(-50%, -50%) scale(1);
                }
            `;
            doc.head.appendChild(style);

            // Create indicator element
            const indicator = doc.createElement('div');
            indicator.className = 'long-press-indicator';
            body.appendChild(indicator);

            // Selection change listener
            doc.addEventListener('selectionchange', () => {
                const selection = doc.getSelection();
                const text = selection ? selection.toString().trim() : '';
                console.log("Selection changed:", text);
                if (text.length > 0) {
                    setSelectedText(text);
                } else {
                    setSelectedText(null);
                }
            });

            // Auto-start reading if page turn was triggered by TTS
            if (autoPageTurnRef.current) {
                console.log("Auto-page turn detected, checking for content...");
                // autoPageTurnRef.current = false; // Don't reset yet, wait until we actually find content or decide to skip

                const candidates = getReadingCandidates(body);
                if (candidates.length > 0) {
                    console.log(`Found ${candidates.length} candidates in new chapter. Starting...`);
                    autoPageTurnRef.current = false;
                    const first = candidates[0];
                    // Give a small delay for render to settle
                    setTimeout(() => startReading(first.innerText.trim(), first), 100);
                } else {
                    console.log("No candidates found in this chapter. Skipping to next...");
                    // Keep autoPageTurnRef true so the next chapter is also auto-played
                    // But we need to be careful of infinite loops if we reach end of book
                    // Maybe add a safety counter? For now just try next.
                    rendition.next().then(() => {
                        console.log("Skipped empty chapter");
                    }).catch((err: any) => {
                        console.error("Failed to skip empty chapter:", err);
                        autoPageTurnRef.current = false;
                    });
                }
            }

            // Long press detection logic
            let pressTimer: NodeJS.Timeout | null = null;
            const LONG_PRESS_DURATION = 500;
            let startX = 0;
            let startY = 0;

            const handleStart = (e: TouchEvent | MouseEvent) => {
                if (pressTimer) clearTimeout(pressTimer);

                let clientX, clientY;
                if (e instanceof TouchEvent) {
                    clientX = e.touches[0].clientX;
                    clientY = e.touches[0].clientY;
                } else {
                    clientX = (e as MouseEvent).clientX;
                    clientY = (e as MouseEvent).clientY;
                }

                startX = clientX;
                startY = clientY;

                // Show indicator
                indicator.style.left = `${clientX}px`;
                indicator.style.top = `${clientY}px`;
                indicator.style.display = 'block';
                // Force reflow
                void indicator.offsetWidth;
                indicator.classList.add('active');

                pressTimer = setTimeout(() => {
                    indicator.classList.remove('active');
                    indicator.style.display = 'none';
                    handleLongPress(e);
                }, LONG_PRESS_DURATION);
            };

            const handleEnd = () => {
                if (pressTimer) {
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }
                indicator.classList.remove('active');
                indicator.style.display = 'none';
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
                    indicator.classList.remove('active');
                    indicator.style.display = 'none';
                }
            }

            body.addEventListener('touchstart', handleStart);
            body.addEventListener('touchend', handleEnd);
            body.addEventListener('touchmove', handleMove);

            body.addEventListener('mousedown', handleStart);
            body.addEventListener('mouseup', handleEnd);
            body.addEventListener('mousemove', handleMove);
        });
    }, [rate, voice]);

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
                    if (!res.ok) throw new Error(`Failed to fetch book: ${res.statusText} `);
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
            style={{ height: '93vh' }}
        >
            <div className="fixed top-4 left-4 z-50 flex items-center gap-2">
                <a href="/" className="flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur shadow-sm rounded-full hover:bg-white hover:shadow transition-all text-gray-600 hover:text-gray-900">
                    <span>←</span>
                    <span className="font-medium">Library</span>
                </a>

                {/* Chapter Selector */}
                {!isPdf && toc.length > 0 && (
                    <select
                        className="max-w-[200px] px-4 py-2 bg-white/90 backdrop-blur shadow-sm rounded-full hover:bg-white hover:shadow transition-all text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer truncate"
                        onChange={(e) => {
                            const href = e.target.value;
                            if (renditionRef.current) {
                                renditionRef.current.display(href);
                            }
                        }}
                        value={location as string || ''}
                    >
                        <option value="" disabled>Select Chapter</option>
                        {toc.map((chapter, index) => (
                            <option key={index} value={chapter.href}>
                                {chapter.label.trim()}
                            </option>
                        ))}
                    </select>
                )}
            </div>


            {!bookUrl ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                    No book selected
                </div>
            ) : isLoadingProgress ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                    Loading progress...
                </div>
            ) : isPdf ? (
                <PdfReader
                    ref={pdfReaderRef}
                    url={bookUrl}
                    location={location as number}
                    locationChanged={setLocation}
                />
            ) : (
                <ReactReader
                    url={bookUrl}
                    location={location}
                    locationChanged={handleLocationChanged}
                    getRendition={getRendition}
                    swipeable={false} // Disable swipe to fix text selection on mobile
                    showToc={true} // Enable table of contents and navigation
                    epubOptions={{
                        // Using default paginated view for better performance and stability
                        allowScriptedContent: true,
                    }}
                    readerStyles={{
                        ...ReactReaderStyle,
                        readerArea: {
                            ...ReactReaderStyle.readerArea,
                            backgroundColor: '#fafafa',
                            // Padding handled by container resizing now, but keeping a bit doesn't hurt
                            // paddingBottom: '20px',
                        }
                    }}
                />
            )
            }

            {/* Explicit Navigation Buttons for EPUB */}
            {
                !isPdf && bookUrl && (
                    <>
                        <button
                            className="fixed left-2 top-1/2 transform -translate-y-1/2 z-40 p-3 bg-white/80 hover:bg-white shadow-lg rounded-full text-gray-600 hover:text-gray-900 transition-all active:scale-95"
                            onClick={() => {
                                if (renditionRef.current) {
                                    try {
                                        renditionRef.current.prev();
                                    } catch (err) {
                                        console.error("Navigation error (prev):", err);
                                    }
                                }
                            }}
                            title="Previous Page"
                        >
                            <span className="text-2xl">‹</span>
                        </button>
                        <button
                            className="fixed right-2 top-1/2 transform -translate-y-1/2 z-40 p-3 bg-white/80 hover:bg-white shadow-lg rounded-full text-gray-600 hover:text-gray-900 transition-all active:scale-95"
                            onClick={() => {
                                if (renditionRef.current) {
                                    try {
                                        renditionRef.current.next();
                                    } catch (err) {
                                        console.error("Navigation error (next):", err);
                                    }
                                }
                            }}
                            title="Next Page"
                        >
                            <span className="text-2xl">›</span>
                        </button>
                    </>
                )
            }

            {/* Selection Reading Button */}
            {
                selectedText && !isPlaying && (
                    <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50">
                        <button
                            onClick={() => {
                                console.log("Read Selection clicked:", selectedText);
                                if (selectedText) startReading(selectedText);
                            }}
                            className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-full shadow-xl hover:bg-black transition-all active:scale-95"
                        >
                            <span>🔊</span>
                            <span className="font-medium">Read Selection</span>
                        </button>
                    </div>
                )
            }

            {/* TTS Panel */}
            <div
                className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] transition-all duration-300 ease-in-out flex flex-col justify-center"
                style={{
                    paddingBottom: 'env(safe-area-inset-bottom)',
                    height: showPanel ? 'auto' : '7vh'
                }}
            >
                {/* Toggle Handle */}
                <div
                    className="absolute -top-6 left-0 right-0 h-6 flex justify-center cursor-pointer group"
                    onClick={() => setShowPanel(!showPanel)}
                >
                    <div className={`w-12 h-1.5 bg-gray-300 rounded-full mt-2 transition-colors group-hover:bg-gray-400 ${showPanel ? '' : 'bg-gray-400'}`} />
                </div>

                <div className="max-w-screen-md mx-auto px-4 py-2 flex flex-col gap-2">
                    {/* Collapsible Content (Voice & Speed) */}
                    <div
                        className={`flex flex-col gap-2 overflow-hidden transition-all duration-300 ease-in-out ${showPanel ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}
                    >
                        {/* Voice Selection */}
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Voice</span>
                            <select
                                value={voice}
                                onChange={(e) => setVoice(e.target.value)}
                                className="flex-1 bg-gray-100 border-none rounded-lg px-3 py-1.5 text-sm font-medium text-gray-900 focus:ring-2 focus:ring-blue-500"
                            >
                                {availableVoices.map((v) => (
                                    <option key={v.value} value={v.value}>
                                        {v.name}
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={() => setShowPanel(false)}
                                className="p-1.5 text-gray-400 hover:text-gray-600"
                            >
                                <span className="text-xl">⌄</span>
                            </button>
                        </div>

                        {/* Speed Control */}
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">Speed</span>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-500 w-8 text-right">0.5x</span>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="3"
                                    step="0.1"
                                    value={rate}
                                    onChange={(e) => handleRateChange(parseFloat(e.target.value))}
                                    className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-500 hover:accent-blue-600 transition-all"
                                />
                                <span className="text-xs font-bold text-gray-900 w-8 tabular-nums">{rate.toFixed(1)}x</span>
                            </div>
                        </div>
                    </div>

                    {/* Persistent Controls */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            {/* Expand Button when minimized */}
                            {!showPanel && (
                                <button
                                    onClick={() => setShowPanel(true)}
                                    className="p-2 text-gray-500 hover:text-gray-700 active:scale-95 transition-transform"
                                    title="Expand Panel"
                                >
                                    <span className="text-xl">⌃</span>
                                </button>
                            )}
                            {/* Show current voice name when minimized */}
                            {!showPanel && (
                                <span className="text-xs font-medium text-gray-500 truncate max-w-[100px]">
                                    {availableVoices.find(v => v.value === voice)?.name.split(' ')[0]}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2 ml-auto">
                            <button
                                onClick={readPrevious}
                                className="flex items-center justify-center w-9 h-9 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition-colors active:scale-95"
                                title="Previous Paragraph"
                            >
                                <span className="text-lg">⏮</span>
                            </button>

                            <button
                                onClick={togglePause}
                                className="flex items-center justify-center w-11 h-11 bg-gray-900 hover:bg-black active:bg-gray-800 text-white rounded-full shadow-lg transition-all transform active:scale-95"
                            >
                                {isPlaying && !isPaused ? (
                                    <span className="text-lg">⏸</span>
                                ) : (
                                    <span className="text-lg ml-0.5">▶</span>
                                )}
                            </button>

                            <button
                                onClick={readNext}
                                className="flex items-center justify-center w-9 h-9 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition-colors active:scale-95"
                                title="Next Paragraph"
                            >
                                <span className="text-lg">⏭</span>
                            </button>

                            <button
                                onClick={stopReading}
                                className="flex items-center justify-center w-9 h-9 bg-red-50 hover:bg-red-100 text-red-500 rounded-full transition-colors active:scale-95 ml-1"
                                title="Stop"
                            >
                                <span className="text-lg">✕</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
}
