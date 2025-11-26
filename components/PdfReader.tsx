'use client';

import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfReaderProps {
    url: string | ArrayBuffer | null;
    location: number;
    locationChanged: (loc: number) => void;
    onReady?: () => void;
}

export interface PdfReaderHandle {
    getCurrentPageText: () => Promise<string>;
    goToNextPage: () => void;
    goToPrevPage: () => void;
}

const PdfReader = forwardRef<PdfReaderHandle, PdfReaderProps>(({ url, location, locationChanged, onReady }, ref) => {
    const [numPages, setNumPages] = useState<number>(0);
    const [pageWidth, setPageWidth] = useState(800);
    const [pdfDocument, setPdfDocument] = useState<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Update width on resize
    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                setPageWidth(containerRef.current.clientWidth);
            }
        };
        window.addEventListener('resize', updateWidth);
        updateWidth();
        return () => window.removeEventListener('resize', updateWidth);
    }, []);

    function onDocumentLoadSuccess(pdf: any) {
        setPdfDocument(pdf);
        setNumPages(pdf.numPages);
        if (onReady) onReady();
    }

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
        getCurrentPageText: async () => {
            if (!pdfDocument) return "";
            try {
                const page = await pdfDocument.getPage(location);
                const textContent = await page.getTextContent();
                // Simple concatenation. For better TTS, we might need to handle layout (newlines etc)
                return textContent.items.map((item: any) => item.str).join(' ');
            } catch (error) {
                console.error("Error getting text content:", error);
                return "";
            }
        },
        goToNextPage: () => {
            if (location < numPages) locationChanged(location + 1);
        },
        goToPrevPage: () => {
            if (location > 1) locationChanged(location - 1);
        }
    }));

    if (!url) return <div>Loading PDF...</div>;

    return (
        <div ref={containerRef} className="flex justify-center h-full overflow-auto bg-gray-100 pt-4 pb-20">
            <Document
                file={url}
                onLoadSuccess={onDocumentLoadSuccess}
                className="flex flex-col items-center shadow-lg"
                loading={<div className="p-10">Loading Document...</div>}
            >
                <Page
                    pageNumber={location || 1}
                    renderTextLayer={true}
                    renderAnnotationLayer={false}
                    width={Math.min(pageWidth - 40, 800)} // Max width 800px, with padding
                    className="bg-white"
                    loading={<div className="h-[800px] w-[600px] bg-white animate-pulse" />}
                />
            </Document>
        </div>
    );
});

PdfReader.displayName = 'PdfReader';

export default PdfReader;
