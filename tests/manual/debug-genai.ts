import { GoogleGenAI } from '@google/genai';

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
console.log('GoogleGenAI instance:', genai);
console.log('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(genai)));
console.log('Direct properties:', Object.keys(genai));