import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    clientIP,
    userAgent,
    host: request.headers.get('host'),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      hasRunwayKey: !!process.env.RUNWAY_API_KEY,
      runwayKeyPrefix: process.env.RUNWAY_API_KEY?.substring(0, 10),
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    },
    headers: Object.fromEntries(request.headers.entries())
  });
} 