import { NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { kv } from '@vercel/kv';
import OpenAI from 'openai';
import { z } from 'zod';

// Initialize OpenAI with error handling
let openai: OpenAI;
try {
  openai = new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY!,
    timeout: 10000 // 10 second timeout
  });
} catch (error) {
  console.error('OpenAI initialization failed:', error);
  throw new Error('OpenAI client configuration error');
}

// Initialize rate limiter with analytics
const ratelimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(3, '86400s'),
  analytics: true,
  prefix: 'adinsp-ratelimit'
});

export const runtime = 'edge';
export const revalidate = 86400; // 24-hour cache

// Enhanced validation schema
const InspectAdSchema = z.object({
  headline: z.string().min(5).max(120),
  body: z.string().min(10).max(500),
  cta: z.string().min(2).max(50),
  offerDescription: z.string().min(10).max(500),
  websiteOrBrand: z.string().max(50).optional(),
  adType: z.enum(["facebook", "instagram", "google-search", "google-display"]),
  industry: z.enum(["General", "Health", "Finance", "E-commerce", "SaaS", "Real Estate", "Other"])
});

export async function POST(request: Request) {
  // Enhanced IP detection
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
  
  try {
    // Rate limiting with better error handling
    const { success, pending, reset } = await ratelimit.limit(`insp_${ip}`);
    await pending;

    if (!success) {
      return NextResponse.json(
        { 
          error: 'Analysis limit reached!',
          reset: new Date(reset).toISOString(),
          upgradeUrl: '/pricing'
        },
        { status: 429 }
      );
    }

    // Validate input with safeParse
    const body = await request.json().catch(() => {
      throw new Error('Invalid JSON payload');
    });
    
    const validation = InspectAdSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: "Validation failed",
          issues: validation.error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      );
    }
    const validated = validation.data;

    // Enhanced caching with checksum
    const cacheKey = `inspect:${Buffer.from(JSON.stringify(validated)).toString('base64')}`;
    const cached = await kv.get(cacheKey).catch(() => null);
    
    if (cached) {
      return NextResponse.json({
        ...cached,
        meta: { cache: 'hit' }
      });
    }

    // Improved prompt engineering
    const prompt = `
    As a senior ${validated.adType} ad consultant, analyze this ad with these strict guidelines:

    **Ad Components:**
    - Headline: ${validated.headline}
    - Body: ${validated.body}
    - CTA: ${validated.cta}
    - Offer: ${validated.offerDescription}
    - Brand: ${validated.websiteOrBrand || 'Not specified'}
    - Industry: ${validated.industry}
    - Platform: ${validated.adType}

    **Evaluation Framework:**
    1. Grade each component (A-F):
       - Headline (20%): Attention, clarity, length, emotional hook
       - Body (40%): Structure, benefit-focused, pain point addressing
       - CTA (20%): Action clarity, urgency, visibility
       - Offer (20%): Value proposition, differentiation

    2. Compliance Check:
       - ${validated.industry}-specific regulations
       - ${validated.adType} platform policies
       - Truth-in-advertising standards

    3. Performance Prediction:
       - Predicted CTR range (Low/Medium/High)
       - Conversion likelihood
       - Attention score (1-10)

    4. Required Output (JSON):
    {
      grade: string,
      headlineGrade: string,
      bodyGrade: string,
      ctaGrade: string,
      summary: string,
      suggestions: string[],
      predictedCTR: string,
      attentionScore: number,
      complianceCheck: string,
      rewrite?: string
    }`;

    // Robust OpenAI API call
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a paid media expert specializing in performance ad analysis."
        },
        { 
          role: "user", 
          content: prompt 
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3, // Lower temp for more consistent analysis
      max_tokens: 1500,
    }).catch(async (error) => {
      console.error('OpenAI API error:', error);
      throw new Error(`Analysis failed: ${error.message}`);
    });

    // Validate and parse response
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from OpenAI');

    let analysis;
    try {
      analysis = JSON.parse(content);
      if (!analysis.grade || !analysis.suggestions) {
        throw new Error('Invalid analysis format');
      }
    } catch (e) {
      console.error('Failed to parse analysis:', content);
      throw new Error('Received malformed analysis data');
    }

    // Cache with error handling (24 hours)
    await kv.set(cacheKey, { analysis }, { ex: 86400 })
      .catch(e => console.warn('Cache set failed:', e));

    return NextResponse.json({ 
      analysis,
      meta: {
        cache: 'miss',
        model: 'gpt-4',
        tokens: response.usage?.total_tokens,
        analyzedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Inspection error:', error);

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Analysis failed',
        code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
        stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
// Only use edge for API routes, not pages
// app/api/route.ts
// export const runtime = 'edge'; // Good for APIs

// app/page.tsx
// No runtime export → defaults to Node.js runtime
console.log("OPENAI_API_KEY is loaded:", !!process.env.OPENAI_API_KEY);
console.log("KV_REST_API_URL is:", process.env.KV_REST_API_URL);
