# Booker Reader

A web-based EPUB reader featuring high-quality Text-to-Speech (Edge TTS), persistent audio controls, and a mobile-friendly design.

## Features

- **Enhanced TTS Controls**: Persistent mini-player, voice selection (Chinese/English), speed control, and paragraph navigation.
- **Visual Feedback**: "Ripple" animation on long-press to indicate text selection.
- **Progress Persistence**: Automatically saves your reading position and settings.
    - **Paragraph Highlighting**: Highlights the exact paragraph being read.
    - **Resume Reading**: Remembers your exact position (paragraph-level) and resumes from there.
- **Mini Player**: A persistent audio panel that stays out of your way while keeping controls accessible.
- **Mobile Optimized**: Designed for touch interactions, with swipe disabled to prevent conflicts with text selection.
- **Customizable**: Adjustable font size, playback speed, and voice selection.

## User Guide

### Adding Books
1.  Place your `.epub` files in the `public/books` directory.
2.  The app will automatically list them on the home page.

### Reading
- **Start Reading**: Click a book cover to open it.
- **Play/Pause**: Use the floating control panel at the bottom.
- **Read Selection**: Select any text and click the "Read Selection" button that appears.
- **Change Voice/Speed**: Expand the bottom panel to adjust settings. These are saved automatically.

## Deployment

You can easily deploy this reader to Vercel for free.

1.  **Fork the Repository**: Click "Fork" on GitHub to create your own copy.
2.  **Deploy to Vercel**:
    - Go to [Vercel](https://vercel.com) and sign up/login.
    - Click "Add New..." -> "Project".
    - Import your forked repository.
    - Click "Deploy".
3.  **Done!** Your reader is now live.

## Developer Guide

### Project Structure

- **`components/BookReader.tsx`**: The core component. Handles the EPUB rendering (`react-reader`), TTS integration, UI state, and audio playback.
- **`utils/edge-tts-universal/`**: A custom implementation of the Edge TTS client. It uses standard browser APIs (WebSocket, Web Crypto) to communicate directly with the TTS service without needing a backend proxy.
- **`app/api/book-content/route.ts`**: An API route that serves the EPUB files from the `public/books` directory to the frontend.
- **`app/page.tsx`**: The library home page. Fetches the list of books and displays them as a grid.

### Key Technologies

- **Next.js**: Framework for the web application.
- **React Reader**: Wrapper around `epub.js` for rendering books.
- **Edge TTS**: Microsoft's text-to-speech service (reverse-engineered client).
- **Tailwind CSS**: For styling.

### Customization

- **Styling**: Modify `components/BookReader.tsx` to change the look and feel. The `readerStyles` prop controls the inner iframe styling.
- **Voices**: The list of available voices is defined in `availableVoices` within `BookReader.tsx`. You can add more Edge TTS voices there.
