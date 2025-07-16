const express = require('express');
const multer = require('multer');
const path = require('path');
// Use dynamic import for ESM module
let pdfjsLib;
(async () => {
  try {
    pdfjsLib = await import('pdfjs-dist/build/pdf.mjs');
  } catch (err) {
    console.error('PDF.js import failed:', err.message);
    pdfjsLib = null;
  }
})();
const pdfjsOptions = {
  standardFontDataUrl: path.resolve(
    process.cwd(),
    'node_modules/pdfjs-dist/standard_fonts/'
  ) + '/', // Ensure trailing slash
};
const { encode } = require('gpt-3-encoder');
require('dotenv').config();
const fetch = require('node-fetch');
const { getTranscript } = require('youtube-transcript');

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

const YOUTUBE_API_KEY = "AIzaSyB3cPGxJnK_T6lqmjm-wThZsyCIJteXMJ0";
const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const YOUTUBE_VIDEO_URL = "https://www.googleapis.com/youtube/v3/videos";

// Helper to extract chapters from video description
function extractChapters(description) {
  // Matches lines like '00:00 Intro' or '0:00 Introduction'
  const chapterRegex = /^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/gm;
  const chapters = [];
  let match;
  while ((match = chapterRegex.exec(description)) !== null) {
    chapters.push({
      time: match[1],
      title: match[2].trim()
    });
  }
  return chapters;
}

// Helper to fetch transcript for a YouTube video
async function fetchTranscript(videoId) {
  try {
    const transcript = await getTranscript(videoId);
    // transcript is an array of {text, start, duration}
    return transcript;
  } catch (err) {
    return null;
  }
}

// PDF upload endpoint
// Pass verifyToken middleware as argument when mounting
function registerManualRoutes(verifyToken) {
  router.post('/upload', verifyToken, upload.single('pdf'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }
    if (!pdfjsLib) {
      return res.status(503).json({ error: 'PDF processing is currently unavailable.' });
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
      const prompt = `Based on these sections from the manual (with page numbers):\n${searchResults.map(result => `[Page ${result.page}]: ${result.text}`).join('\n\n')}\n\nQuestion: ${query}\n\nPlease provide a comprehensive answer that:\n1. Directly addresses the question\n2. Includes specific details from the manual\n3. Lists any steps in order (if applicable)\n4. Mentions relevant warnings or prerequisites (if any)\n5. Cites the page numbers when referring to specific information\n\nFormat the response in Markdown. Use ** for bold, * for italics, and bullet points or numbered lists where appropriate. Always use Markdown-style bold for section headers and key terms. Do not use HTML.\n\nALWAYS include a YouTube search query for a video that could help solve this problem. Respond with the answer first, then on a new line, write: 'YouTube search query: <query>'. If you cannot think of a good query, use the question itself as the YouTube search query. DO NOT skip this line.`;
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
      const answerBlock = result.candidates[0].content.parts[0].text.trim();
      // Extract YouTube search query from the answer
      let answer = answerBlock;
      let youtubeQuery = null;
      const ytMatch = answerBlock.match(/YouTube search query:\s*(.+)$/i);
      if (ytMatch) {
        youtubeQuery = ytMatch[1].trim();
        answer = answerBlock.replace(/YouTube search query:.+$/i, '').trim();
      }
      // Fallback: if Gemini did not output a query, use the original question
      if (!youtubeQuery) {
        youtubeQuery = query;
      }
      let youtube = null;
      if (youtubeQuery) {
        // Search YouTube for the top 5 videos
        const ytRes = await fetch(`${YOUTUBE_SEARCH_URL}?part=snippet&type=video&maxResults=5&q=${encodeURIComponent(youtubeQuery)}&key=${YOUTUBE_API_KEY}`);
        const ytData = await ytRes.json();
        let selectedVideo = null;
        let chapters = [];
        let description = '';
        if (ytData.items && ytData.items.length > 0) {
          // Try to find a video with chapters
          for (const video of ytData.items) {
            const videoId = video.id.videoId;
            const vidRes = await fetch(`${YOUTUBE_VIDEO_URL}?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`);
            const vidData = await vidRes.json();
            if (vidData.items && vidData.items.length > 0) {
              description = vidData.items[0].snippet.description || '';
              chapters = extractChapters(description);
              if (chapters.length > 0) {
                selectedVideo = { video, videoId, description, chapters };
                console.log(`[YouTube] Selected video with chapters: ${video.snippet.title}`);
                break;
              }
            }
          }
          // If no video with chapters, use the first video and try transcript
          if (!selectedVideo) {
            const video = ytData.items[0];
            const videoId = video.id.videoId;
            const vidRes = await fetch(`${YOUTUBE_VIDEO_URL}?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`);
            const vidData = await vidRes.json();
            description = vidData.items && vidData.items.length > 0 ? vidData.items[0].snippet.description || '' : '';
            chapters = extractChapters(description);
            selectedVideo = { video, videoId, description, chapters };
            if (chapters.length === 0) {
              // Try transcript-based timeline
              const transcript = await fetchTranscript(videoId);
              if (transcript && transcript.length > 0) {
                const transcriptText = transcript.map(t => `[${new Date(t.start * 1000).toISOString().substr(11, 8)}] ${t.text}`).join('\n');
                const timelinePrompt = `Given the following YouTube video transcript and the question: "${query}", generate a timeline of key moments (timestamp and title) that would help answer the question. Format as one per line: 00:00 Title, 01:23 Next Section, etc. Only include the most relevant moments.`;
                const timelineGeminiPrompt = `${timelinePrompt}\n\nTranscript:\n${transcriptText}`;
                const timelineRes = await fetch(
                  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      contents: [{ parts: [{ text: timelineGeminiPrompt }] }]
                    })
                  }
                );
                if (timelineRes.ok) {
                  const timelineData = await timelineRes.json();
                  const timelineText = timelineData.candidates?.[0]?.content?.parts?.[0]?.text || '';
                  const timelineLines = timelineText.split('\n').map(l => l.trim()).filter(Boolean);
                  chapters = timelineLines.map(line => {
                    const match = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/);
                    if (match) {
                      return { time: match[1], title: match[2] };
                    }
                    return null;
                  }).filter(Boolean);
                  if (chapters.length > 0) {
                    selectedVideo.chapters = chapters;
                    console.log(`[YouTube] Timeline generated from transcript for video: ${video.snippet.title}`);
                  } else {
                    console.log(`[YouTube] No timeline found from transcript for video: ${video.snippet.title}`);
                  }
                }
              } else {
                console.log(`[YouTube] No transcript available for video: ${video.snippet.title}`);
              }
            }
          }
          if (selectedVideo) {
            youtube = {
              videoId: selectedVideo.videoId,
              title: selectedVideo.video.snippet.title,
              url: `https://www.youtube.com/watch?v=${selectedVideo.videoId}`,
              thumbnail: selectedVideo.video.snippet.thumbnails?.high?.url || selectedVideo.video.snippet.thumbnails?.default?.url,
              chapters: selectedVideo.chapters || []
            };
          }
        }
      }
      res.json({
        answer: answer.trim(),
        relevantSections: searchResults.map(result => ({
          text: result.text,
          page: result.page,
          confidence: result.score
        })),
        youtube,
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