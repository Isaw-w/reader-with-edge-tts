import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const filename = searchParams.get('filename');

    if (!filename) {
        return new NextResponse('Filename is required', { status: 400 });
    }

    // Security: Prevent directory traversal
    const safeFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), 'public/books', safeFilename);

    try {
        console.log(`[API] Serving book: ${safeFilename}`);

        if (!fs.existsSync(filePath)) {
            console.error(`[API] File not found: ${filePath}`);
            return new Response('Book not found', { status: 404 });
        }

        // Synchronous read to ensure buffer is ready
        const fileBuffer = fs.readFileSync(filePath);
        const stats = fs.statSync(filePath);
        console.log(`[API] File read sync success. Size: ${stats.size}`);

        return new Response(fileBuffer, {
            headers: {
                'Content-Type': 'application/epub+zip',
                'Content-Length': stats.size.toString(),
                'Cache-Control': 'no-store'
            },
        });
    } catch (error) {
        console.error('[API] Error serving book:', error);
        return new Response('Error serving book', { status: 500 });
    }
}
