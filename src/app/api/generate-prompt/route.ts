import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000, // 30 second timeout
  maxRetries: 2, // Retry up to 2 times
});

export async function POST(request: NextRequest) {
  try {
    const { image, messages } = await request.json();

    // Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('Missing OPENAI_API_KEY environment variable');
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Handle legacy format (single image) for backward compatibility
    if (image && !messages) {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'you will receive an image, base on that image you need to generate a prompt for image AI generator runway to generate an image just like the image I give you (as similar as possible). You need to output the response in the following structure:\n\n**RUNWAY PROMPT:**\n[The runway prompt in English]\n\n**CHINESE TRANSLATION:**\n[The Chinese translation of the runway prompt]\n\nMake sure to follow this exact format with the headers and structure.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: image,
                },
              },
            ],
          },
        ],
        max_tokens: 500,
      });

      const prompt = response.choices[0]?.message?.content || '';
      return NextResponse.json({ prompt });
    }

    // Handle new format (conversation messages)
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }

    // Validate messages format
    const validMessages = messages.filter(msg => 
      msg && typeof msg === 'object' && 
      msg.role && 
      msg.content && 
      ['system', 'user', 'assistant'].includes(msg.role)
    );

    if (validMessages.length === 0) {
      return NextResponse.json({ error: 'No valid messages provided' }, { status: 400 });
    }

    console.log('Calling OpenAI API with', validMessages.length, 'messages');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: validMessages,
      max_tokens: 500,
    });

    const prompt = response.choices[0]?.message?.content || '';

    return NextResponse.json({ prompt });
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    
    // Handle specific OpenAI errors
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        return NextResponse.json(
          { error: 'Request timed out. Please try again.' },
          { status: 408 }
        );
      } else if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'Invalid API key configuration' },
          { status: 401 }
        );
      } else if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to generate prompt' },
      { status: 500 }
    );
  }
} 