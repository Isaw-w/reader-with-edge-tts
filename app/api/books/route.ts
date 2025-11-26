import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    const booksDirectory = path.join(process.cwd(), 'public/books');

    try {
        const files = await fs.promises.readdir(booksDirectory);
        const books = files
            .filter(file => file.toLowerCase().endsWith('.epub') || file.toLowerCase().endsWith('.pdf'))
            .map(file => {
                // Remove file extension
                let title = file.replace(/\.(epub|pdf)$/i, '');

                // Remove common metadata patterns
                title = title
                    // Remove year and publisher info in parentheses: (2019, 广西师范大学出版社)
                    .replace(/\s*\([^)]*\d{4}[^)]*\)/g, '')
                    // Remove source tags like "- libgen.li"
                    .replace(/\s*-\s*(libgen|zlibrary|z-lib)\.[a-z]+$/i, '')
                    // Remove standalone parentheses content at the end
                    .replace(/\s*（[^）]*）\s*$/g, '')
                    .replace(/\s*\([^)]*\)\s*$/g, '')
                    // Clean up multiple spaces and dashes
                    .replace(/\s+-\s+/g, ' - ')
                    .replace(/\s{2,}/g, ' ')
                    .trim();

                return {
                    filename: file,
                    path: `/books/${encodeURIComponent(file)}`,
                    title: title || file.replace(/\.(epub|pdf)$/i, '')
                };
            });

        return NextResponse.json(books);
    } catch (error) {
        console.error('Error reading books directory:', error);
        return NextResponse.json({ error: 'Failed to load books' }, { status: 500 });
    }
}
