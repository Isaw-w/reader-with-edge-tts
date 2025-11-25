import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    const booksDirectory = path.join(process.cwd(), 'public/books');

    try {
        const files = await fs.promises.readdir(booksDirectory);
        const books = files
            .filter(file => file.toLowerCase().endsWith('.epub'))
            .map(file => ({
                filename: file,
                path: `/books/${file}`,
                title: file.replace(/\.epub$/i, '').replace(/-/g, ' ') // Simple title derivation
            }));

        return NextResponse.json(books);
    } catch (error) {
        console.error('Error reading books directory:', error);
        return NextResponse.json({ error: 'Failed to load books' }, { status: 500 });
    }
}
