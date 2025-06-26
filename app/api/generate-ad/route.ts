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

// Initialize rate limiter with fallback
const ratelimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(3, '86400s'),
  analytics: true,
  prefix: 'adgen-ratelimit'
});

export const runtime = 'edge';
export const revalidate = 3600;

// Enhanced validation schema
const GenerateAdSchema = z.object({
  targetAudience: z.string().min(10).max(100),
  goal: z.string().min(10).max(100),
  uniqueSellingPoint: z.string().min(10).max(200),
  contextDescription: z.string().min(20).max(500),
  brandVoice: z.enum(["Professional", "Friendly", "Witty", "Urgent", "Inspirational"]),
  keyEmotion: z.enum(["FOMO", "Trust", "Excitement", "Curiosity", "Anger/Solve Pain"]),
  competitors: z.string().max(100).optional(),
  adFormat: z.enum(["Single Image", "Carousel", "Video", "Story"]),
  industry: z.enum(["General", "Health", "Finance", "E-commerce", "SaaS", "Real Estate", "Other"]),
  preferredCTA: z.enum(["Shop Now", "Learn More", "Get Offer", "Sign Up", "Book Now", "Claim Discount"]),
  visualDirection: z.enum(["Lifestyle", "Product Close-Up", "Before/After", "User-Generated", "Infographic"])
});

export async function POST(request: Request) {
  // Enhanced IP detection
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
  
  try {
    // Rate limiting with better error handling
    const { success, pending, reset } = await ratelimit.limit(`gen_${ip}`);
    await pending; // Wait for rate limit calculation

    if (!success) {
      return NextResponse.json(
        { 
          error: 'Free limit reached!',
          reset: new Date(reset).toISOString(),
          upgradeUrl: '/pricing' 
        },
        { status: 429 }
      );
    }

    // Validate input
    const body = await request.json().catch(() => {
      throw new Error('Invalid JSON payload');
    });
    
    const validated = GenerateAdSchema.parse(body);

    // Enhanced caching with checksum
    const cacheKey = `gen-ad:${Buffer.from(JSON.stringify(validated)).toString('base64')}`;
    const cached = await kv.get(cacheKey).catch(() => null);
    
    if (cached) {
      return NextResponse.json(cached);
    }

    // Improved prompt engineering
    const prompt = `
    As a Meta ads expert, generate 3 ${validated.adFormat} ad variations with these specifications:
    
    Industry: ${validated.industry}
    Target: ${validated.targetAudience}
    Goal: ${validated.goal}
    USP: ${validated.uniqueSellingPoint}
    Voice: ${validated.brandVoice}
    Emotion: ${validated.keyEmotion}
    CTA: ${validated.preferredCTA}
    Visual: ${validated.visualDirection}
    
    Requirements:
    1. Strict compliance with ${validated.industry} advertising policies
    2. Include implied social proof
    3. Use ${validated.keyEmotion} psychological triggers
    4. Output JSON format with: type, headline, primary_text, cta, visual_suggestion
    5. Each variation should have distinct positioning
    `;

    // Robust OpenAI API call
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert advertising copywriter specializing in performance marketing."
        },
        { 
          role: "user", 
          content: prompt 
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1000,
    }).catch(async (error) => {
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI request failed: ${error.message}`);
    });

    // Validate and parse response
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from OpenAI');

    let parsed;
    try {
      parsed = JSON.parse(content);
      if (!parsed.ads) throw new Error('Invalid response format');
    } catch (e) {
      console.error('Failed to parse OpenAI response:', content);
      throw new Error('Received malformed ad data');
    }

    // Cache with error handling
    await kv.set(cacheKey, { ads: parsed.ads }, { ex: 3600 })
      .catch(e => console.warn('Cache set failed:', e));

    return NextResponse.json({ 
      ads: parsed.ads,
      meta: {
        cache: 'miss',
        model: 'gpt-4',
        tokens: response.usage?.total_tokens
      }
    });

  } catch (error) {
    console.error('Endpoint error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: "Validation failed",
          issues: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Generation failed',
        code: error instanceof Error ? error.name : 'UNKNOWN_ERROR'
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
