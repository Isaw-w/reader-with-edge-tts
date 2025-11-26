'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Book {
  filename: string;
  path: string;
  title: string;
}

export default function Home() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/books')
      .then(res => res.json())
      .then(data => {
        setBooks(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
        Loading library...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <header className="mb-8 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900">My Library</h1>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {books.map((book) => (
          <Link
            key={book.filename}
            href={`/read?book=${encodeURIComponent(book.filename)}`}
            className="group relative flex flex-col bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-gray-100"
          >
            <div className="aspect-[2/3] bg-gray-200 w-full relative overflow-hidden">
              {/* Placeholder for cover, could be extracted later */}
              <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-4xl font-serif select-none group-hover:scale-105 transition-transform duration-300">
                📖
              </div>
              {/* File Type Badge */}
              <div className={`absolute top-2 right-2 px-1.5 py-0.5 text-[10px] font-bold rounded text-white shadow-sm ${book.filename.toLowerCase().endsWith('.pdf') ? 'bg-red-500' : 'bg-blue-500'
                }`}>
                {book.filename.toLowerCase().endsWith('.pdf') ? 'PDF' : 'EPUB'}
              </div>
            </div>
            <div className="p-3">
              <h2 className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
                {book.title}
              </h2>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
