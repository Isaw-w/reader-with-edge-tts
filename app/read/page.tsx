import BookReader from '../../components/BookReader';
import { Suspense } from 'react';

export default function ReadPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center">Loading Reader...</div>}>
            <BookReader />
        </Suspense>
    );
}
