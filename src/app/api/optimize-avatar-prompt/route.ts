import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000, // 30 seconds timeout
});

export async function POST(request: NextRequest) {
  try {
    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OpenAI API key not configured');
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const { description, messages } = await request.json();

    if (!description && (!messages || messages.length === 0)) {
      return NextResponse.json({ error: 'No description or messages provided' }, { status: 400 });
    }

    // Shorter, more focused system prompt
    const systemPrompt = {
      role: 'system',
      content: `You are an expert prompt engineer for AI image generation. Transform user descriptions into detailed avatar prompts.

Guidelines:
- Focus on facial features, expression, upper body
- Include lighting (soft, studio, natural)
- Add quality terms (high resolution, detailed, professional)
- Use simple backgrounds (blurred, studio, neutral)
- Include photography terms (portrait photography, headshot)
- Make it photorealistic

Format your response exactly as:

**RUNWAY PROMPT:**
[detailed prompt in English]

**CHINESE TRANSLATION:**
[Chinese translation of the prompt]`
    };

    let conversationMessages;

    if (messages && Array.isArray(messages) && messages.length > 0) {
      // Handle conversation-based optimization (for refinements)
      conversationMessages = [systemPrompt, ...messages];
      
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

    // Improved retry logic with model fallback
    let response;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        console.log(`🔄 OpenAI API call attempt ${retryCount + 1}/${maxRetries}`);
        
        // Use different models based on retry count
        const modelToUse = retryCount === 0 ? 'gpt-4o-mini' : 'gpt-3.5-turbo';
        
        response = await openai.chat.completions.create({
          model: modelToUse,
          messages: conversationMessages, 
          temperature: 0.7,
          max_tokens: 400,
        }, {
          timeout: 20000, // 20 seconds timeout per request
        });

        console.log('✅ OpenAI API call successful');
        break; // Success, exit retry loop
        
      } catch (apiError: any) {
        retryCount++;
        console.error(`❌ OpenAI API call failed (attempt ${retryCount}/${maxRetries}):`, {
          error: apiError.message,
          code: apiError.code,
          type: apiError.type,
          status: apiError.status
        });

        if (retryCount >= maxRetries) {
          // If all retries failed, throw the error
          throw apiError;
        }

        // Wait before retry (exponential backoff)
        const waitTime = Math.min(Math.pow(2, retryCount) * 1000, 5000); // 2s, 4s, 5s max
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    if (!response) {
      throw new Error('Failed to get response from OpenAI after retries');
    }

    const fullResponse = response.choices[0]?.message?.content?.trim() || '';
    
    if (!fullResponse) {
      throw new Error('Empty response from OpenAI');
    }
    
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
  } catch (error: any) {
    console.error('Error optimizing avatar prompt:', error);
    
    // Return more specific error messages
    let errorMessage = 'Failed to optimize prompt';
    
    if (error.code === 'insufficient_quota') {
      errorMessage = 'OpenAI API quota exceeded. Please check your billing.';
    } else if (error.code === 'rate_limit_exceeded') {
      errorMessage = 'OpenAI API rate limit exceeded. Please try again later.';
    } else if (error.code === 'invalid_api_key') {
      errorMessage = 'Invalid OpenAI API key. Please check your configuration.';
    } else if (error.message?.includes('timeout')) {
      errorMessage = 'OpenAI API request timed out. Please try again.';
    } else if (error.message?.includes('network')) {
      errorMessage = 'Network error connecting to OpenAI. Please try again.';
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 