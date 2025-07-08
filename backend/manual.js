const express = require('express');
const multer = require('multer');
const path = require('path');
// Use dynamic import for ESM module
let pdfjsLib;
(async () => {
  pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // Configure PDF.js worker after import
  const workerPath = path.resolve(
    process.cwd(),
    'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'
  );
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    workerPath.startsWith('file://') ? workerPath : 'file://' + workerPath.replace(/\\/g, '/');
})();
const pdfjsOptions = {
  standardFontDataUrl: path.resolve(
    process.cwd(),
    'node_modules/pdfjs-dist/standard_fonts/'
  ) + '/', // Ensure trailing slash
};
const { encode } = require('gpt-3-encoder');
require('dotenv').config();

const router = express.Router();

// Configure PDF.js worker
// In all usages of pdfjsLib below, ensure to await the import if needed.

const upload = multer({ storage: multer.memoryStorage() });

// In-memory vector store (per server instance)
const vectorStore = {
  chunks: [],
  embeddings: [],
  metadata: {
    currentFileName: '',
    pageCount: 0,
    totalChunks: 0
  },
  addChunk: function(chunk, embedding, pageNum) {
    this.chunks.push({
      text: chunk,
      page: pageNum,
      embedding: embedding
    });
    this.embeddings.push(embedding);
  },
  clear: function() {
    this.chunks = [];
    this.embeddings = [];
    this.metadata = {
      currentFileName: '',
      pageCount: 0,
      totalChunks: 0
    };
    console.log('Vector store cleared');
  },
  search: function(query, topK = 5) {
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
    const scoredChunks = this.chunks.map(chunk => {
      const text = chunk.text.toLowerCase();
      let score = 0;
      searchTerms.forEach(term => {
        const termCount = (text.match(new RegExp(term, 'g')) || []).length;
        score += termCount;
      });
      const uniqueTermsFound = searchTerms.filter(term => text.includes(term)).length;
      score *= (uniqueTermsFound / searchTerms.length);
      const chunkIndex = this.chunks.indexOf(chunk);
      if (chunkIndex > 0) {
        const prevChunk = this.chunks[chunkIndex - 1].text.toLowerCase();
        searchTerms.forEach(term => {
          if (prevChunk.includes(term)) score += 0.5;
        });
      }
      return {
        chunk: chunk.text,
        page: chunk.page,
        score: score
      };
    });
    return scoredChunks
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(item => ({
        text: item.chunk,
        page: item.page,
        score: item.score
      }));
  }
};

// PDF upload endpoint
// Pass verifyToken middleware as argument when mounting
function registerManualRoutes(verifyToken) {
  router.post('/upload', verifyToken, upload.single('pdf'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }
    try {
      vectorStore.clear();
      const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(req.file.buffer),
        ...pdfjsOptions
      }).promise;
      vectorStore.metadata.currentFileName = req.file.originalname;
      vectorStore.metadata.pageCount = pdf.numPages;
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map(item => item.str)
          .join(' ')
          .replace(/\s+/g, ' ');
        const pageChunks = pageText
          .split(/(?<=[.!?])\s+(?=[A-Z])/) // split by sentence
          .filter(chunk => chunk.trim().length > 50)
          .map(chunk => chunk.trim());
        pageChunks.forEach(chunk => {
          const tokens = encode(chunk);
          const embedding = tokens.map(t => t / tokens.length);
          vectorStore.addChunk(chunk, embedding, pageNum);
        });
      }
      vectorStore.metadata.totalChunks = vectorStore.chunks.length;
      res.json({
        message: 'PDF processed and embeddings stored',
        metadata: vectorStore.metadata
      });
    } catch (error) {
      console.error('Error processing PDF:', error);
      res.status(500).json({ error: 'Failed to process PDF', details: error.message });
    }
  });

  // Manual search endpoint
  router.post('/search', verifyToken, async (req, res) => {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'No search query provided' });
    }
    try {
      if (vectorStore.chunks.length === 0) {
        return res.status(400).json({
          error: 'No manual content available',
          details: 'Please upload a manual first'
        });
      }
      const searchResults = vectorStore.search(query);
      if (searchResults.length === 0) {
        return res.json({
          answer: "I couldn't find any relevant information about that in the manual. Please try rephrasing your question or using different keywords.",
          relevantSections: [],
          confidence: 0
        });
      }
      // Compose prompt for Gemini
      const prompt = `Based on these sections from the manual (with page numbers):\n${searchResults.map(result => `[Page ${result.page}]: ${result.text}`).join('\n\n')}\n\nQuestion: ${query}\n\nPlease provide a comprehensive answer that:\n1. Directly addresses the question\n2. Includes specific details from the manual\n3. Lists any steps in order (if applicable)\n4. Mentions relevant warnings or prerequisites (if any)\n5. Cites the page numbers when referring to specific information\n\nFormat the response in Markdown. Use ** for bold, * for italics, and bullet points or numbered lists where appropriate. Always use Markdown-style bold for section headers and key terms. Do not use HTML.`;
      const GEMINI_API_KEY = "AIzaSyCfGebLoSxI50ugKpe9OQ8LVlQEWRLTbws";
      const GEMINI_MODEL = "gemini-2.0-flash";
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        }
      );
      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
      }
      const result = await response.json();
      if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Invalid or empty response from Gemini API');
      }
      const answer = result.candidates[0].content.parts[0].text;
      res.json({
        answer: answer.trim(),
        relevantSections: searchResults.map(result => ({
          text: result.text,
          page: result.page,
          confidence: result.score
        })),
        metadata: {
          totalPages: vectorStore.metadata.pageCount,
          pagesSearched: [...new Set(searchResults.map(r => r.page))],
          fileName: vectorStore.metadata.currentFileName
        }
      });
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({
        error: 'Failed to search the manual',
        details: error.message
      });
    }
  });
}

module.exports = { registerManualRoutes, router }; 