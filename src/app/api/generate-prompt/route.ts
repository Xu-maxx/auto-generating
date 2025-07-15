import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000, // Increase to 60 seconds
  maxRetries: 2, // Keep retries reasonable
});

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

export async function POST(request: NextRequest) {
  try {
    const { image, messages } = await request.json();

    // Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OpenAI API key not configured');
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Handle legacy format (single image) for backward compatibility
    if (image && !messages) {
      console.log('🔄 Using legacy format (single image)');
      
      // Simplified retry logic with shorter timeouts
      let response;
      let retryCount = 0;
      const maxRetries = 3; // Increase retries

      while (retryCount < maxRetries) {
        try {
          console.log(`🔄 OpenAI API call attempt ${retryCount + 1}/${maxRetries}`);
          
          // Use gpt-4o for better quality since payload issue is solved
          const modelToUse = 'gpt-4o';
          
          response = await openai.chat.completions.create({
            model: modelToUse,
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
            temperature: 0.7,
            max_tokens: 500, // Restore tokens for better quality
          }, {
            timeout: 45000, // Increase timeout to 45 seconds
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

          // Wait before retry (longer wait)
          const waitTime = 5000; // Increase to 5 seconds
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      if (!response) {
        throw new Error('Failed to get response from OpenAI after retries');
      }

      const prompt = response.choices[0]?.message?.content?.trim() || '';
      
      if (!prompt) {
        throw new Error('Empty response from OpenAI');
      }
      
      console.log('🤖 OpenAI raw response:', prompt.substring(0, 200) + '...');
      
      // Parse the response
      const { runwayPrompt, chineseTranslation } = parsePromptResponse(prompt);

      return NextResponse.json({ 
        success: true,
        prompt: prompt,
        runwayPrompt: runwayPrompt,
        chineseTranslation: chineseTranslation
      });
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

    // Check for payload size issues
    const messagePayloadSize = JSON.stringify(validMessages).length;
    console.log('📦 Message payload size:', messagePayloadSize, 'bytes');
    
    if (messagePayloadSize > 50000) { // 50KB limit
      console.warn('⚠️ Large payload detected, may cause timeout');
    }

    console.log('🔄 Calling OpenAI API with', validMessages.length, 'messages');

    // Give more time with longer timeouts
    let response;
    let retryCount = 0;
    const maxRetries = 3; // Increase retries

    while (retryCount < maxRetries) {
      try {
        console.log(`🔄 OpenAI API call attempt ${retryCount + 1}/${maxRetries}`);
        
        // Use gpt-4o for better quality since payload issue is solved
        const modelToUse = 'gpt-4o';
        
        response = await openai.chat.completions.create({
          model: modelToUse,
          messages: validMessages,
          temperature: 0.7,
          max_tokens: 500, // Restore tokens for better quality
        }, {
          timeout: 45000, // Increase timeout to 45 seconds
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

        // Wait before retry (longer wait)
        const waitTime = 5000; // Increase to 5 seconds
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    if (!response) {
      throw new Error('Failed to get response from OpenAI after retries');
    }

    const prompt = response.choices[0]?.message?.content?.trim() || '';

    if (!prompt) {
      throw new Error('Empty response from OpenAI');
    }
    
    console.log('🤖 OpenAI raw response:', prompt.substring(0, 200) + '...');
    
    // Parse the response
    const { runwayPrompt, chineseTranslation } = parsePromptResponse(prompt);

    return NextResponse.json({ 
      success: true,
      prompt: prompt,
      runwayPrompt: runwayPrompt,
      chineseTranslation: chineseTranslation
    });
  } catch (error: any) {
    console.error('❌ Error calling OpenAI API:', error);
    
    // Handle specific OpenAI errors
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        return NextResponse.json(
          { error: 'Request timed out. The image payload may be too large. Try reducing reference images.' },
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
      } else if (error.message.includes('content_policy')) {
        return NextResponse.json(
          { error: 'Content policy violation. Please try with different images.' },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to generate prompt. Please try again or reduce image complexity.' },
      { status: 500 }
    );
  }
} 