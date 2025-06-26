// app/api/check-env/route.ts
export async function GET() {
  return Response.json({
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? "✅ Loaded" : "❌ Missing",
    REDIS_URL: process.env.UPSTASH_REDIS_REST_URL ? "✅ Loaded" : "❌ Missing",
    REDIS_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ? "✅ Loaded" : "❌ Missing"
  });
}
