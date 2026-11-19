import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateWithRetry(
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI['models']['generateContent']>[0],
  maxAttempts = 3
) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err: unknown) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('429');
      if (!isTransient || attempt === maxAttempts) {
        throw err;
      }
      const delayMs = 600 * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

function extractApiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.error?.code && parsed?.error?.message) {
      return { status: Number(parsed.error.code) || 500, message: parsed.error.message };
    }
  } catch {
    // Plain error string
  }
  if (raw.includes('503') || raw.includes('UNAVAILABLE')) {
    return { status: 503, message: 'AI classifier is temporarily busy. Please try again in a moment.' };
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
    return { status: 429, message: 'Gemini API quota temporarily reached. Please retry shortly.' };
  }
  if (raw.includes('403') || raw.includes('PERMISSION_DENIED')) {
    return { status: 403, message: 'Please verify your GEMINI_API_KEY in Settings > Secrets.' };
  }
  return { status: 500, message: raw || 'Failed to analyze content.' };
}

interface AnalyzeRequestBody {
  title?: string;
  appOrDomain?: string;
  url?: string;
  description?: string;
  imageBase64?: string;
  imageMimeType?: string;
  context?: {
    shortFormMinutesToday?: number;
    inWorkHours?: boolean;
    inDowntime?: boolean;
    activeFocusSession?: boolean;
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '6mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.post('/api/analyze-content', async (req, res) => {
    try {
      const body = (req.body || {}) as AnalyzeRequestBody;
      const title = (body.title || '').trim();
      const appOrDomain = (body.appOrDomain || '').trim();
      const url = (body.url || '').trim();
      const description = (body.description || '').trim();
      const imageBase64 = body.imageBase64;
      const imageMimeType = body.imageMimeType;

      if (!title && !appOrDomain && !url && !description && !imageBase64) {
        res.status(400).json({
          error: 'Please provide a video title, URL, app name, description, or screenshot to inspect.',
        });
        return;
      }

      const ai = getGeminiClient();
      const ctx = body.context || {};

      const promptText = [
        'Analyze what the user is currently watching or using on their device.',
        `Title / Content: ${title || 'Not specified'}`,
        `App or Domain: ${appOrDomain || 'Not specified'}`,
        `URL: ${url || 'Not specified'}`,
        `Notes / Transcript / Context: ${description || 'None'}`,
        `Current short-form reels/shorts watched today: ${ctx.shortFormMinutesToday ?? 0} minutes (10-minute strict timeout limit).`,
        `Currently in designated Working/Study Hours: ${Boolean(ctx.inWorkHours)}`,
        `Currently in Scheduled Downtime: ${Boolean(ctx.inDowntime)}`,
        `Active Focus Timer running: ${Boolean(ctx.activeFocusSession)}`,
        '',
        'Classification rules:',
        '1. "educational": Lectures, tutorials, coding, math, science, language learning, documentaries, academic coursework. Educational content MUST be allowed unlimitedly (recommendedAction: "allow_unlimited", isEducational: true). Note: Even if on YouTube, distinguish genuine educational videos from distracting Shorts/entertainment.',
        '2. "productive_work": IDEs, documentation, spreadsheets, research tools, writing apps.',
        '3. "distracting_short_form": YouTube Shorts, Instagram Reels, TikTok, Snapchat Spotlight, Facebook Reels, endless swipeable vertical clips or brainrot/meme compilations (isShortFormOrReel: true). If shortFormMinutesToday >= 10, recommendedAction must be "trigger_timeout". If >= 6, recommendedAction should be "gentle_nudge". Otherwise "track_budget".',
        '4. "social_feed": General social media feeds (Instagram Feed, X/Twitter, Reddit browsing, Facebook Feed, Threads). Subject to downtime, focus blocks, and post-10m timeout.',
        '5. "gaming": Video games, mobile games, game launchers, esports streams (isGame: true). If inWorkHours or inDowntime is true, recommendedAction must be "lock_work_hours".',
        '',
        'Return concise reasoning, a calm supportive gentlePrompt to help the user refocus if distracting, and a concrete educationalAlternative topic.',
      ].join('\n');

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
      if (imageBase64 && imageMimeType) {
        parts.push({
          inlineData: {
            mimeType: imageMimeType,
            data: imageBase64,
          },
        });
      }
      parts.push({ text: promptText });

      const response = await generateWithRetry(ai, {
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          systemInstruction:
            'You are the Clearline AI Content Classifier. Accurately distinguish genuine educational learning from distracting short-form reels/shorts, social feeds, and unproductive games. Always return valid JSON matching the schema.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: {
                type: Type.STRING,
                enum: [
                  'educational',
                  'productive_work',
                  'distracting_short_form',
                  'social_feed',
                  'gaming',
                ],
              },
              isEducational: { type: Type.BOOLEAN },
              isShortFormOrReel: { type: Type.BOOLEAN },
              isGame: { type: Type.BOOLEAN },
              confidence: { type: Type.NUMBER },
              reasoning: { type: Type.STRING },
              gentlePrompt: { type: Type.STRING },
              educationalAlternative: { type: Type.STRING },
              recommendedAction: {
                type: Type.STRING,
                enum: [
                  'allow_unlimited',
                  'track_budget',
                  'gentle_nudge',
                  'trigger_timeout',
                  'lock_work_hours',
                ],
              },
            },
            required: [
              'category',
              'isEducational',
              'isShortFormOrReel',
              'isGame',
              'confidence',
              'reasoning',
              'gentlePrompt',
              'educationalAlternative',
              'recommendedAction',
            ],
          },
        },
      });

      const raw = (response.text || '{}').trim();
      const parsed = JSON.parse(raw);
      res.json(parsed);
    } catch (err: unknown) {
      const { status, message } = extractApiError(err);
      console.error('Gemini analyze-content error:', err);
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/refocus-coach', async (req, res) => {
    try {
      const { currentActivity, minutesSpent, triggerReason } = (req.body || {}) as {
        currentActivity?: string;
        minutesSpent?: number;
        triggerReason?: string;
      };

      const ai = getGeminiClient();
      const response = await generateWithRetry(ai, {
        model: 'gemini-4-hydrogen',
        contents: `The user has spent ${minutesSpent ?? 7} minutes on "${currentActivity || 'short-form social media'}" (${triggerReason || 'approaching 10-minute distraction threshold'}). Write a calm, empathetic, practical 2-sentence refocus nudge and suggest 1 specific 25-minute deep-focus micro-step.`,
        config: {
          systemInstruction:
            'You are a calm digital wellbeing coach. Be respectful, non-judgmental, brief, and actionable.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              message: { type: Type.STRING },
              microStep: { type: Type.STRING },
            },
            required: ['headline', 'message', 'microStep'],
          },
        },
      });

      const parsed = JSON.parse((response.text || '{}').trim());
      res.json(parsed);
    } catch (err: unknown) {
      const { status, message } = extractApiError(err);
      console.error('Gemini refocus-coach error:', err);
      res.status(status).json({ error: message });
    }
  });

  if (IS_PROD) {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.get('*', async (req, res, next) => {
      try {
        const url = req.originalUrl;
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Clearline server running on http://0.0.0.0:${PORT} (${IS_PROD ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
