import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Voice names from voice_data_clean.csv
const VOICE_OPTIONS = [
  "北京小爷（多情感）", "柔美女友（多情感）", "阳光青年（多情感）", "魅力女友（多情感）", 
  "爽快思思（多情感）", "甜心小美（多情感）", "高冷御姐（多情感）", "傲娇霸总（多情感）", 
  "广州德哥（多情感）", "京腔侃爷（多情感）", "邻居阿姨（多情感）", "优柔公子（多情感）", 
  "儒雅男友（多情感）", "俊朗男友（多情感）", "冷酷哥哥（多情感）", "Tina老师", 
  "暖阳女声", "甜美桃子", "灿灿/Shiny", "清新女声", "爽快思思/Skye", "温暖阿虎/Alvin", 
  "少年梓辛/Brayan", "知性女声", "清爽男大", "邻家女孩", "渊博小叔", "阳光青年", 
  "甜美小源", "清澈梓梓", "解说小明", "开朗姐姐", "邻家男孩", "甜美悦悦", "心灵鸡汤", 
  "知性温婉", "暖心体贴", "温柔文雅", "开朗轻快", "活泼爽朗", "率真小伙", "温柔小哥", 
  "亲切女声", "机灵小伙", "元气甜妹", "知心姐姐", "阳光阿辰", "快乐小东", "冷酷哥哥", 
  "纯澈女生", "初恋女友", "贴心闺蜜", "温柔白月光", "开朗学长", "魅力苏菲", "贴心妹妹", 
  "Smith", "Anna", "Adam", "Sarah", "Dryw", "かずね（和音）/Javier or Álvaro", 
  "はるこ（晴子）/Esmeralda", "ひろし（広志）/Roberto", "あけみ（朱美）", "Amanda", 
  "Jackson", "Cartoon Chef", "ひかる（光）", "Emily", "Daniel", "Lucas", "Diana", 
  "Lucía", "Sofía", "Daníel", "さとみ（智美）", "まさお（正男）", "つき（月）", "Sophie", 
  "Daisy", "Owen", "Ethan", "Luna", "Michael", "京腔侃爷/Harmony", "湾湾小何", 
  "湾区大叔", "呆萌川妹", "广州德哥", "北京小爷", "浩宇小哥", "广西远舟", "妹坨洁儿", 
  "豫州子轩", "奶气萌娃", "婆婆", "高冷御姐", "傲娇霸总", "魅力女友", "深夜播客", 
  "柔美女友", "撒娇学妹", "东方浩然", "悠悠君子", "文静毛毛", "温柔小雅", "天才童声", 
  "猴哥", "熊二", "佩奇猪", "武则天", "顾姐", "樱桃丸子", "广告解说", "少儿故事", 
  "四郎", "磁性解说男声/Morgan", "鸡汤妹妹/Hope", "贴心女声/Candy", "俏皮女声", 
  "萌丫头/Cutey", "懒音绵宝", "亮嗓萌仔", "悬疑解说", "儒雅青年", "霸气青叔", 
  "擎苍", "活力小哥", "古风少御", "温柔淑女", "反卷青年", "双节棍小哥"
];

export async function POST(request: NextRequest) {
  try {
    const { avatarDescription, imageUrls = [] } = await request.json();

    if (!avatarDescription && (!imageUrls || imageUrls.length === 0)) {
      return NextResponse.json({ error: 'No avatar description or images provided' }, { status: 400 });
    }

    const messages: any[] = [
      {
        role: 'system',
        content: `You are an expert voice casting director. You will receive character descriptions and AI-generated avatar images, and need to select the most suitable voice from the available options.

IMPORTANT: All images provided are AI-generated digital avatar characters, NOT real people. These are synthetic/artificial characters created for avatar videos. You can freely analyze these AI-generated characters for voice selection.

Consider these character aspects:
1. Character type and archetype (student, professional, young, mature, etc.)
2. Personality traits mentioned (温柔/gentle, 活泼/lively, 冷酷/cool, 甜美/sweet, etc.)
3. Professional or cultural context
4. Age and gender indicators from both description and AI-generated visuals
5. Mood and character style shown in the AI-generated images
6. Overall character design and presentation

You must return your response as JSON with this exact structure:
{
  "voice": "[exact voice name from the options]",
  "reasoning": "[brief explanation based on character description and AI-generated visuals]"
}

Available voice options: ${VOICE_OPTIONS.join(', ')}`
      }
    ];

    // Build the user message content - including AI-generated images
    const userContent: any[] = [];
    
    if (avatarDescription) {
      if (avatarDescription.startsWith('Avatar image:')) {
        // Handle filename-only case
        userContent.push({
          type: 'text',
          text: `I have an AI-generated avatar character with filename: "${avatarDescription}". ${imageUrls.length > 0 ? 'I\'ve also provided the actual AI-generated character images below for analysis.' : 'Please select a neutral, versatile voice suitable for this character.'}`
        });
      } else {
        // Handle regular description
        userContent.push({
          type: 'text',
          text: `Character description: "${avatarDescription}". ${imageUrls.length > 0 ? 'I\'ve also provided AI-generated character images below that match this description.' : ''} Please analyze both the description and AI-generated visuals to select the most suitable voice.`
        });
      }
    }

    // Add AI-generated images if provided
    if (imageUrls && imageUrls.length > 0) {
      if (!avatarDescription) {
        userContent.push({
          type: 'text',
          text: `Based on these AI-generated avatar character images, please analyze the character design and select the most suitable voice.`
        });
      }
      
      // Add all AI-generated images
      imageUrls.forEach((imageUrl: string, index: number) => {
        userContent.push({
          type: 'image_url',
          image_url: {
            url: imageUrl,
          },
        });
      });
    }

    // Fallback if no content
    if (userContent.length === 0) {
      userContent.push({
        type: 'text',
        text: 'Please select a neutral, versatile voice suitable for general avatar characters.'
      });
    }

    // NOTE: All images are AI-generated characters, safe for OpenAI analysis

    messages.push({
      role: 'user',
      content: userContent
    });

    try {
      console.log('🎤 Starting voice selection...');
      console.log('📝 Avatar description:', avatarDescription || 'None provided');
      console.log('🖼️ AI-generated images being sent to OpenAI:', imageUrls.length);
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        max_tokens: 500,
        temperature: 0.3,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "voice_selection",
            schema: {
              type: "object",
              properties: {
                voice: {
                  type: "string",
                  description: "The exact voice name from the available options"
                },
                reasoning: {
                  type: "string",
                  description: "Brief explanation for the voice selection based on character analysis"
                }
              },
              required: ["voice", "reasoning"],
              additionalProperties: false
            }
          }
        }
      });

      console.log('🔍 OpenAI Response:', {
        finishReason: response.choices[0]?.finish_reason,
        hasContent: !!response.choices[0]?.message?.content,
        refusal: response.choices[0]?.message?.refusal
      });

      const responseContent = response.choices[0]?.message?.content?.trim() || '';
      console.log('📄 Raw response content:', responseContent);
      
      try {
        // Parse JSON response
        const parsedResponse = JSON.parse(responseContent);
        const selectedVoice = parsedResponse.voice?.trim().replace(/['"]/g, '') || null;
        const reasoning = parsedResponse.reasoning?.trim() || 'AI selected this voice as most suitable';
        
        console.log('🔍 Extracted voice:', selectedVoice);
        console.log('🔍 Extracted reasoning:', reasoning);
        
        // Validate the selected voice is in our options
        if (selectedVoice) {
          // First try exact match
          let validVoice = VOICE_OPTIONS.find(voice => voice === selectedVoice);
          
          // If no exact match, try partial matches
          if (!validVoice) {
            validVoice = VOICE_OPTIONS.find(voice => 
              voice.includes(selectedVoice) || 
              selectedVoice.includes(voice)
            );
          }
          
          // If still no match, try normalized matching (remove spaces, case insensitive)
          if (!validVoice) {
            const normalizedSelected = selectedVoice.toLowerCase().replace(/\s+/g, '').replace(/[()（）]/g, '');
            validVoice = VOICE_OPTIONS.find(voice => {
              const normalizedVoice = voice.toLowerCase().replace(/\s+/g, '').replace(/[()（）]/g, '');
              return normalizedVoice.includes(normalizedSelected) || normalizedSelected.includes(normalizedVoice);
            });
          }
          
          // If still no match, try finding by key parts (before slash, before parentheses)
          if (!validVoice) {
            const selectedBase = selectedVoice.split('/')[0].split('（')[0].split('(')[0].trim();
            validVoice = VOICE_OPTIONS.find(voice => {
              const voiceBase = voice.split('/')[0].split('（')[0].split('(')[0].trim();
              return voiceBase === selectedBase || voiceBase.includes(selectedBase) || selectedBase.includes(voiceBase);
            });
          }
          
          if (validVoice) {
            console.log('✅ Successfully selected voice:', validVoice);
            if (validVoice !== selectedVoice) {
              console.log('🔄 Voice matched from:', selectedVoice, 'to:', validVoice);
            }
            return NextResponse.json({
              success: true,
              selectedVoice: validVoice,
              reasoning: reasoning,
              fallback: false
            });
          } else {
            console.log('⚠️ Selected voice not found in options:', selectedVoice);
            console.log('📝 Available options:', VOICE_OPTIONS.slice(0, 10).join(', '), '...');
            throw new Error('Invalid voice selection');
          }
        } else {
          console.log('⚠️ Could not extract voice from response');
          throw new Error('Could not extract voice selection');
        }
      } catch (parseError) {
        console.error('❌ JSON parsing failed:', parseError);
        console.log('📄 Attempting fallback regex parsing...');
        
        // Fallback to regex parsing for non-JSON responses
        const voiceMatch = responseContent.match(/Voice:\s*(.+?)(?:\n|$)/i);
        const reasonMatch = responseContent.match(/Reasoning:\s*(.+?)(?:\n|$)/i);
        
        let selectedVoice = voiceMatch ? voiceMatch[1].trim().replace(/['"]/g, '') : null;
        const reasoning = reasonMatch ? reasonMatch[1].trim() : 'AI selected this voice as most suitable';
        
        if (selectedVoice) {
          // First try exact match
          let validVoice = VOICE_OPTIONS.find(voice => voice === selectedVoice);
          
          // If no exact match, try partial matches
          if (!validVoice) {
            validVoice = VOICE_OPTIONS.find(voice => 
              voice.includes(selectedVoice) || 
              selectedVoice.includes(voice)
            );
          }
          
          // If still no match, try normalized matching (remove spaces, case insensitive)
          if (!validVoice) {
            const normalizedSelected = selectedVoice.toLowerCase().replace(/\s+/g, '').replace(/[()（）]/g, '');
            validVoice = VOICE_OPTIONS.find(voice => {
              const normalizedVoice = voice.toLowerCase().replace(/\s+/g, '').replace(/[()（）]/g, '');
              return normalizedVoice.includes(normalizedSelected) || normalizedSelected.includes(normalizedVoice);
            });
          }
          
          // If still no match, try finding by key parts (before slash, before parentheses)
          if (!validVoice) {
            const selectedBase = selectedVoice.split('/')[0].split('（')[0].split('(')[0].trim();
            validVoice = VOICE_OPTIONS.find(voice => {
              const voiceBase = voice.split('/')[0].split('（')[0].split('(')[0].trim();
              return voiceBase === selectedBase || voiceBase.includes(selectedBase) || selectedBase.includes(voiceBase);
            });
          }
          
          if (validVoice) {
            console.log('✅ Successfully selected voice via fallback:', validVoice);
            if (validVoice !== selectedVoice) {
              console.log('🔄 Voice matched from:', selectedVoice, 'to:', validVoice);
            }
            return NextResponse.json({
              success: true,
              selectedVoice: validVoice,
              reasoning: reasoning,
              fallback: false
            });
          } else {
            console.log('⚠️ Selected voice not found in options via fallback:', selectedVoice);
            console.log('📝 Available options:', VOICE_OPTIONS.slice(0, 10).join(', '), '...');
          }
        }
        
        throw new Error('Could not extract voice selection from response');
      }
    } catch (error) {
      console.error('❌ Voice selection failed:', error);
      
      // Enhanced fallback logic
      const smartFallback = () => {
        const description = (avatarDescription || '').toLowerCase();
        
        // Check for gender indicators
        const maleIndicators = ['male', 'man', 'boy', 'gentleman', 'masculine', 'him', 'his', 'he'];
        const femaleIndicators = ['female', 'woman', 'girl', 'lady', 'feminine', 'her', 'hers', 'she'];
        
        const isMale = maleIndicators.some(indicator => description.includes(indicator));
        const isFemale = femaleIndicators.some(indicator => description.includes(indicator));
        
        // Age indicators
        const youngIndicators = ['young', 'teenage', 'youth', 'child', 'kid'];
        const matureIndicators = ['mature', 'adult', 'middle-aged', 'elderly', 'senior'];
        
        const isYoung = youngIndicators.some(indicator => description.includes(indicator));
        const isMature = matureIndicators.some(indicator => description.includes(indicator));
        
        // Personality indicators
        const gentleIndicators = ['gentle', 'soft', 'warm', 'kind', 'sweet'];
        const energeticIndicators = ['energetic', 'lively', 'vibrant', 'dynamic'];
        
        const isGentle = gentleIndicators.some(indicator => description.includes(indicator));
        const isEnergetic = energeticIndicators.some(indicator => description.includes(indicator));
        
        // Smart selection based on analysis
        if (isMale && isYoung) {
          return { voice: '阳光青年', reason: 'Young male characteristics detected' };
        } else if (isMale && isMature) {
          return { voice: '磁性解说男声/Morgan', reason: 'Mature male characteristics detected' };
        } else if (isFemale && isGentle) {
          return { voice: '温柔淑女', reason: 'Gentle female characteristics detected' };
        } else if (isFemale && isEnergetic) {
          return { voice: '活力小哥', reason: 'Energetic female characteristics detected' };
        } else if (isFemale) {
          return { voice: '甜美桃子', reason: 'Female characteristics detected' };
        } else if (isMale) {
          return { voice: '温暖阿虎/Alvin', reason: 'Male characteristics detected' };
        } else {
          return { voice: '温暖阿虎/Alvin', reason: 'Neutral/versatile choice for general use' };
        }
      };
      
      const fallbackResult = smartFallback();
      console.log('🔄 Using smart fallback:', fallbackResult);
      
      return NextResponse.json({
        success: true,
        selectedVoice: fallbackResult.voice,
        reasoning: `Smart fallback: ${fallbackResult.reason}`,
        fallback: true,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

  } catch (error) {
    console.error('Error selecting voice:', error);
    return NextResponse.json(
      { error: 'Failed to select voice' },
      { status: 500 }
    );
  }
} 