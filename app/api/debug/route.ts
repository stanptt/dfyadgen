// app/api/debug/route.ts
export async function GET() {
  return Response.json({
    env: {
      openai: !!process.env.OPENAI_API_KEY,
      redis: !!process.env.UPSTASH_REDIS_REST_URL
    },
    routes: {
      generator: "/api/generate-ad",
      inspector: "/api/inspect-ad"
    },
    status: "healthy"
  });
}
