import { Buffer } from 'node:buffer';
import '@testing-library/jest-dom/vitest';

process.env.QUIZ_ENCRYPTION_KEY_V2 ??= Buffer.alloc(32, 29).toString('base64');
