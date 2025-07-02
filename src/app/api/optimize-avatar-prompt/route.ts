import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { description, messages } = await request.json();

    if (!description && (!messages || messages.length === 0)) {
      return NextResponse.json({ error: 'No description or messages provided' }, { status: 400 });
    }

    // System prompt that defines the response format
    const systemPrompt = {
      role: 'system',
      content: `You are an expert prompt engineer for AI image generation, specifically for creating avatars and portraits. Your task is to transform a simple description into a detailed, optimized prompt that will generate high-quality avatar images.

Guidelines for avatar prompts:
1. Focus on facial features, expression, and upper body/portrait composition
2. Include lighting details (soft lighting, studio lighting, natural lighting)
3. Specify image quality terms (high resolution, detailed, professional)
4. Include appropriate background (simple, blurred, studio, neutral)
5. Mention camera/photography terms for realism (portrait photography, headshot)
6. Avoid overly complex scenes - focus on the person
7. Include style references if appropriate (photorealistic, professional headshot, etc.)

Transform the user's description into a comprehensive prompt that will generate an excellent avatar image. You need to output the response in the following structure:

**RUNWAY PROMPT:**
[The runway prompt in English]

**CHINESE TRANSLATION:**
[The Chinese translation of the runway prompt]

Make sure to follow this exact format with the headers and structure.`
    };

    let conversationMessages;

    if (messages && Array.isArray(messages) && messages.length > 0) {
      // Handle conversation-based optimization (for refinements)
      // Always include the system prompt to ensure proper formatting
      conversationMessages = [systemPrompt, ...messages];
      
      // If there's a new description, add it as the latest user message
      if (description) {
        conversationMessages.push({
          role: 'user',
          content: description
        });
      }
    } else {
      // Handle initial description optimization
      conversationMessages = [
        systemPrompt,
        {
          role: 'user',
          content: description
        }
      ];
    }

    console.log('🤖 OpenAI conversation messages:', {
      messageCount: conversationMessages.length,
      hasSystemPrompt: conversationMessages[0]?.role === 'system',
      lastUserMessage: conversationMessages[conversationMessages.length - 1]?.content?.substring(0, 100) + '...'
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: conversationMessages,
      max_tokens: 400,
      temperature: 0.7,
    });

    const fullResponse = response.choices[0]?.message?.content?.trim() || '';
    
    console.log('🤖 OpenAI raw response:', fullResponse.substring(0, 200) + '...');
    
    // Parse the response to extract runway prompt and Chinese translation
    const parsePromptResponse = (response: string) => {
      const runwayPromptMatch = response.match(/\*\*RUNWAY PROMPT:\*\*\s*([\s\S]*?)(?=\*\*CHINESE TRANSLATION:\*\*|$)/);
      const chineseTranslationMatch = response.match(/\*\*CHINESE TRANSLATION:\*\*\s*([\s\S]*?)$/);
      
      const parsed = {
        runwayPrompt: runwayPromptMatch ? runwayPromptMatch[1].trim() : response,
        chineseTranslation: chineseTranslationMatch ? chineseTranslationMatch[1].trim() : ''
      };
      
      console.log('📝 Parsed response:', {
        runwayPromptLength: parsed.runwayPrompt.length,
        chineseTranslationLength: parsed.chineseTranslation.length,
        runwayPromptPreview: parsed.runwayPrompt.substring(0, 100) + '...',
        chineseTranslationPreview: parsed.chineseTranslation.substring(0, 100) + '...'
      });
      
      return parsed;
    };

    const { runwayPrompt, chineseTranslation } = parsePromptResponse(fullResponse);

    return NextResponse.json({ 
      success: true,
      optimizedPrompt: runwayPrompt,
      chineseTranslation: chineseTranslation,
      fullResponse: fullResponse
    });
  } catch (error) {
    console.error('Error optimizing avatar prompt:', error);
    return NextResponse.json(
      { error: 'Failed to optimize prompt' },
      { status: 500 }
    );
  }
} 