import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { image, messages } = await request.json();

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

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages,
      max_tokens: 500,
    });

    const prompt = response.choices[0]?.message?.content || '';

    return NextResponse.json({ prompt });
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    return NextResponse.json(
      { error: 'Failed to generate prompt' },
      { status: 500 }
    );
  }
} 