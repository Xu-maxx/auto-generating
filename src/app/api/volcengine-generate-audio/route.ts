import { NextRequest, NextResponse } from 'next/server';

// Voice mapping using the CORRECT voice types from voice_data_clean.csv
const VOICE_MAPPING: Record<string, string> = {
  // Multi-emotion voices (from CSV)
  "北京小爷（多情感）": "zh_male_beijingxiaoye_emo_v2_mars_bigtts",
  "柔美女友（多情感）": "zh_female_roumeinvyou_emo_v2_mars_bigtts",
  "阳光青年（多情感）": "zh_male_yangguangqingnian_emo_v2_mars_bigtts",
  "魅力女友（多情感）": "zh_female_meilinvyou_emo_v2_mars_bigtts",
  "爽快思思（多情感）": "zh_female_shuangkuaisisi_emo_v2_mars_bigtts",
  "甜心小美（多情感）": "zh_female_tianxinxiaomei_emo_v2_mars_bigtts",
  "高冷御姐（多情感）": "zh_female_gaolengyujie_emo_v2_mars_bigtts",
  "傲娇霸总（多情感）": "zh_male_aojiaobazong_emo_v2_mars_bigtts",
  "广州德哥（多情感）": "zh_male_guangzhoudege_emo_mars_bigtts",
  "京腔侃爷（多情感）": "zh_male_jingqiangkanye_emo_mars_bigtts",
  "邻居阿姨（多情感）": "zh_female_linjuayi_emo_v2_mars_bigtts",
  "优柔公子（多情感）": "zh_male_yourougongzi_emo_v2_mars_bigtts",
  "儒雅男友（多情感）": "zh_male_ruyayichen_emo_v2_mars_bigtts",
  "俊朗男友（多情感）": "zh_male_junlangnanyou_emo_v2_mars_bigtts",
  "冷酷哥哥（多情感）": "zh_male_lengkugege_emo_v2_mars_bigtts",

  // Standard voices (from CSV)
  "Tina老师": "zh_female_yingyujiaoyu_mars_bigtts",
  "暖阳女声": "zh_female_kefunvsheng_mars_bigtts",
  "甜美桃子": "zh_female_tianmeitaozi_mars_bigtts",
  "灿灿/Shiny": "zh_female_cancan_mars_bigtts",
  "清新女声": "zh_female_qingxinnvsheng_mars_bigtts",
  "爽快思思/Skye": "zh_female_shuangkuaisisi_moon_bigtts",
  "温暖阿虎/Alvin": "zh_male_wennuanahu_moon_bigtts",
  "少年梓辛/Brayan": "zh_male_shaonianzixin_moon_bigtts",
  "知性女声": "zh_female_zhixingnvsheng_mars_bigtts",
  "清爽男大": "zh_male_qingshuangnanda_mars_bigtts",
  "邻家女孩": "zh_female_linjianvhai_moon_bigtts",
  "渊博小叔": "zh_male_yuanboxiaoshu_moon_bigtts",
  "阳光青年": "zh_male_yangguangqingnian_moon_bigtts",
  "甜美小源": "zh_female_tianmeixiaoyuan_moon_bigtts",
  "清澈梓梓": "zh_female_qingchezizi_moon_bigtts",
  "解说小明": "zh_male_jieshuoxiaoming_moon_bigtts",
  "开朗姐姐": "zh_female_kailangjiejie_moon_bigtts",
  "邻家男孩": "zh_male_linjiananhai_moon_bigtts",
  "甜美悦悦": "zh_female_tianmeiyueyue_moon_bigtts",
  "心灵鸡汤": "zh_female_xinlingjitang_moon_bigtts",

  // ICL voices (from CSV)
  "知性温婉": "ICL_zh_female_zhixingwenwan_tob",
  "暖心体贴": "ICL_zh_male_nuanxintitie_tob",
  "温柔文雅": "ICL_zh_female_wenrouwenya_tob",
  "开朗轻快": "ICL_zh_male_kailangqingkuai_tob",
  "活泼爽朗": "ICL_zh_male_huoposhuanglang_tob",
  "率真小伙": "ICL_zh_male_shuaizhenxiaohuo_tob",

  // Professional and character voices (from CSV)
  "温柔小哥": "zh_male_wenrouxiaoge_mars_bigtts",
  "亲切女声": "zh_female_qinqienvsheng_moon_bigtts",
  "机灵小伙": "ICL_zh_male_shenmi_v1_tob",
  "元气甜妹": "ICL_zh_female_wuxi_tob",
  "知心姐姐": "ICL_zh_female_wenyinvsheng_v1_tob",
  "阳光阿辰": "zh_male_qingyiyuxuan_mars_bigtts",
  "快乐小东": "zh_male_xudong_conversation_wvae_bigtts",
  "冷酷哥哥": "ICL_zh_male_lengkugege_v1_tob",
  "纯澈女生": "ICL_zh_female_feicui_v1_tob",
  "初恋女友": "ICL_zh_female_yuxin_v1_tob",
  "贴心闺蜜": "ICL_zh_female_xnx_tob",
  "温柔白月光": "ICL_zh_female_yry_tob",
  "开朗学长": "en_male_jason_conversation_wvae_bigtts",
  "魅力苏菲": "zh_female_sophie_conversation_wvae_bigtts",
  "贴心妹妹": "ICL_zh_female_yilin_tob",

  // English voices (from CSV)
  "Smith": "en_male_smith_mars_bigtts",
  "Anna": "en_female_anna_mars_bigtts",
  "Adam": "en_male_adam_mars_bigtts",
  "Sarah": "en_female_sarah_mars_bigtts",
  "Dryw": "en_male_dryw_mars_bigtts",
  "Amanda": "en_female_amanda_mars_bigtts",
  "Jackson": "en_male_jackson_mars_bigtts",
  "Cartoon Chef": "ICL_en_male_cc_sha_v1_tob",
  "Emily": "en_female_emily_mars_bigtts",
  "Daniel": "zh_male_xudong_conversation_wvae_bigtts",
  "Lucas": "zh_male_M100_conversation_wvae_bigtts",
  "Diana": "multi_female_maomao_conversation_wvae_bigtts",
  "Sophie": "zh_female_sophie_conversation_wvae_bigtts",
  "Daisy": "en_female_dacey_conversation_wvae_bigtts",
  "Owen": "en_male_charlie_conversation_wvae_bigtts",
  "Ethan": "ICL_en_male_aussie_v1_tob",
  "Luna": "en_female_sarah_new_conversation_wvae_bigtts",
  "Michael": "ICL_en_male_michael_tob",

  // Multi-language voices (from CSV)
  "かずね（和音）/Javier or Álvaro": "multi_male_jingqiangkanye_moon_bigtts",
  "はるこ（晴子）/Esmeralda": "multi_female_shuangkuaisisi_moon_bigtts",
  "ひろし（広志）/Roberto": "multi_male_wanqudashu_moon_bigtts",
  "あけみ（朱美）": "multi_female_gaolengyujie_moon_bigtts",
  "ひかる（光）": "multi_zh_male_youyoujunzi_moon_bigtts",
  "Lucía": "multi_male_M100_conversation_wvae_bigtts",
  "Sofía": "multi_female_sophie_conversation_wvae_bigtts",
  "Daníel": "multi_male_xudong_conversation_wvae_bigtts",
  "さとみ（智美）": "multi_female_sophie_conversation_wvae_bigtts",
  "まさお（正男）": "multi_male_xudong_conversation_wvae_bigtts",
  "つき（月）": "multi_female_maomao_conversation_wvae_bigtts",

  // Regional accents (from CSV)
  "京腔侃爷/Harmony": "zh_male_jingqiangkanye_moon_bigtts",
  "湾湾小何": "zh_female_wanwanxiaohe_moon_bigtts",
  "湾区大叔": "zh_female_wanqudashu_moon_bigtts",
  "呆萌川妹": "zh_female_daimengchuanmei_moon_bigtts",
  "广州德哥": "zh_male_guozhoudege_moon_bigtts",
  "北京小爷": "zh_male_beijingxiaoye_moon_bigtts",
  "浩宇小哥": "zh_male_haoyuxiaoge_moon_bigtts",
  "广西远舟": "zh_male_guangxiyuanzhou_moon_bigtts",
  "妹坨洁儿": "zh_female_meituojieer_moon_bigtts",
  "豫州子轩": "zh_male_yuzhouzixuan_moon_bigtts",

  // Special character voices (from CSV)
  "奶气萌娃": "zh_male_naiqimengwa_mars_bigtts",
  "婆婆": "zh_female_popo_mars_bigtts",
  "高冷御姐": "zh_female_gaolengyujie_moon_bigtts",
  "傲娇霸总": "zh_male_aojiaobazong_moon_bigtts",
  "魅力女友": "zh_female_meilinvyou_moon_bigtts",
  "深夜播客": "zh_male_shenyeboke_moon_bigtts",
  "柔美女友": "zh_female_sajiaonvyou_moon_bigtts",
  "撒娇学妹": "zh_female_yuanqinvyou_moon_bigtts",
  "东方浩然": "zh_male_dongfanghaoran_moon_bigtts",
  "悠悠君子": "zh_male_M100_conversation_wvae_bigtts",
  "文静毛毛": "zh_female_maomao_conversation_wvae_bigtts",
  "温柔小雅": "zh_female_wenrouxiaoya_moon_bigtts",

  // Character voices (from CSV)
  "天才童声": "zh_male_tiancaitongsheng_mars_bigtts",
  "猴哥": "zh_male_sunwukong_mars_bigtts",
  "熊二": "zh_male_xionger_mars_bigtts",
  "佩奇猪": "zh_female_peiqi_mars_bigtts",
  "武则天": "zh_female_wuzetian_mars_bigtts",
  "顾姐": "zh_female_gujie_mars_bigtts",
  "樱桃丸子": "zh_female_yingtaowanzi_mars_bigtts",

  // Professional narrator voices (from CSV)
  "广告解说": "zh_male_chunhui_mars_bigtts",
  "少儿故事": "zh_female_shaoergushi_mars_bigtts",
  "四郎": "zh_male_silang_mars_bigtts",
  "磁性解说男声/Morgan": "zh_male_jieshuonansheng_mars_bigtts",
  "鸡汤妹妹/Hope": "zh_female_jitangmeimei_mars_bigtts",
  "贴心女声/Candy": "zh_female_tiexinnvsheng_mars_bigtts",
  "俏皮女声": "zh_female_qiaopinvsheng_mars_bigtts",
  "萌丫头/Cutey": "zh_female_mengyatou_mars_bigtts",
  "懒音绵宝": "zh_male_lanxiaoyang_mars_bigtts",
  "亮嗓萌仔": "zh_male_dongmanhaimian_mars_bigtts",
  "悬疑解说": "zh_male_changtianyi_mars_bigtts",
  "儒雅青年": "zh_male_ruyaqingnian_mars_bigtts",
  "霸气青叔": "zh_male_baqiqingshu_mars_bigtts",
  "擎苍": "zh_male_qingcang_mars_bigtts",
  "活力小哥": "zh_male_yangguangqingnian_mars_bigtts",
  "古风少御": "zh_female_gufengshaoyu_mars_bigtts",
  "温柔淑女": "zh_female_wenroushunv_mars_bigtts",
  "反卷青年": "zh_male_fanjuanqingnian_mars_bigtts",
  "双节棍小哥": "zh_male_zhoujielun_emo_v2_mars_bigtts",

  // Default voice - using proven working voice type
  "default": "zh_male_jieshuonansheng_mars_bigtts"
};

// Working fallback voices from successful Python implementation
const FALLBACK_VOICES = [
  "zh_male_jieshuonansheng_mars_bigtts", // Proven to work - magnetic male narrator
  "zh_male_yangguangqingnian_emo_v2_mars_bigtts", // Proven to work - sunny youth
  "zh_male_beijingxiaoye_emo_v2_mars_bigtts", // Beijing accent male
  "zh_female_roumeinvyou_emo_v2_mars_bigtts", // Gentle female voice
  "zh_female_wenroushunv_mars_bigtts" // Gentle lady voice
];

async function tryTTSRequest(requestPayload: any, voiceType: string, accessToken: string, attempt: number = 1): Promise<any> {
  console.log(`🎤 Attempt ${attempt}: Trying voice type: ${voiceType}`);
  
  const payload = {
    ...requestPayload,
    audio: {
      ...requestPayload.audio,
      voice_type: voiceType
    }
  };

  const response = await fetch('https://openspeech.bytedance.com/api/v1/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Exact format from working Python code
      'Authorization': `Bearer;${accessToken}`
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  
  if (!response.ok) {
    console.error(`❌ Attempt ${attempt} failed for voice ${voiceType}:`, response.status, result);
    throw new Error(`TTS API error: ${response.status} - ${JSON.stringify(result)}`);
  }

  return { response, result, voiceType };
}

async function queryTTSResult(basePayload: any, reqid: string, voiceType: string, accessToken: string, text: string, maxAttempts: number = 20): Promise<any> {
  console.log('⏳ Querying TTS result...');
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    
    const queryPayload = {
      app: basePayload.app,
      user: basePayload.user,
      audio: {
        voice_type: voiceType,
        encoding: "mp3"
      },
      request: {
        reqid: reqid,
        text: text,
        operation: "query"
      }
    };

    try {
      const response = await fetch('https://openspeech.bytedance.com/api/v1/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer;${accessToken}`
        },
        body: JSON.stringify(queryPayload)
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`📊 Query ${attempt + 1}: HTTP ${response.status}`);
        console.log(`📋 Response preview: ${JSON.stringify(result).substring(0, 200)}...`);
        
        // Check if we have audio data
        if (result.data && result.data) {
          console.log(`✅ Audio data received after ${attempt + 1} queries`);
          return { result, voiceType };
        } else {
          // Show status info
          const statusMsg = result.message || 'Unknown status';
          const code = result.code || 'No code';
          console.log(`⏳ Synthesizing... (code: ${code}, msg: ${statusMsg})`);
        }
      } else {
        const errorDetail = await response.json();
        console.log(`❌ Query failed: ${JSON.stringify(errorDetail)}`);
      }
    } catch (error) {
      console.error(`❌ Query attempt ${attempt + 1} error:`, error);
    }
    
    if (attempt < maxAttempts - 1) {
      console.log(`⏸️ Waiting 1 second before retry...`);
    }
  }
  
  throw new Error('Query timeout - TTS generation took too long');
}

export async function POST(request: NextRequest) {
  try {
    const { text, voiceName, speed = 1.0, volume = 1.0 } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (!voiceName) {
      return NextResponse.json({ error: 'Voice name is required' }, { status: 400 });
    }

    const primaryVoiceType = VOICE_MAPPING[voiceName] || VOICE_MAPPING["default"];
    
    console.log('🎤 Generating audio with Volcengine TTS...');
    console.log('📝 Text:', text);
    console.log('🗣️ Voice:', voiceName, '->', primaryVoiceType);

    const appId = process.env.VOLCENGINE_TTS_APP_ID;
    const accessToken = process.env.VOLCENGINE_TTS_ACCESS_TOKEN;

    if (!appId || !accessToken) {
      console.error('❌ Missing Volcengine TTS credentials');
      console.error('Required environment variables:');
      console.error('- VOLCENGINE_TTS_APP_ID:', appId ? '✓ Set' : '❌ Missing');
      console.error('- VOLCENGINE_TTS_ACCESS_TOKEN:', accessToken ? '✓ Set' : '❌ Missing');
      
      return NextResponse.json(
        { error: 'TTS service not configured - missing credentials' },
        { status: 500 }
      );
    }

    // Generate unique IDs exactly like the Python code
    const uid = `user_${Date.now().toString(16)}`;
    const reqid = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Prepare request payload EXACTLY like working Python code
    const baseRequestPayload = {
      app: {
        appid: appId,
        token: accessToken,
        cluster: "volcano_tts"
      },
      user: {
        uid: uid
      },
      audio: {
        voice_type: primaryVoiceType, // Will be overridden in tryTTSRequest
        encoding: "mp3",
        speed_ratio: speed,
        volume_ratio: volume
      },
      request: {
        reqid: reqid,
        text: text,
        operation: "submit", // IMPORTANT: submit operation first
        with_frontend: 1, // IMPORTANT: from working Python code
        frontend_type: "unitTson" // IMPORTANT: from working Python code
      }
    };

    console.log('📤 Submitting TTS task...');

    // Try primary voice first, then fallbacks if needed
    const voicesToTry = [primaryVoiceType, ...FALLBACK_VOICES.filter(v => v !== primaryVoiceType)];
    let lastError: Error | null = null;
    let successfulResult: any = null;

    for (let i = 0; i < voicesToTry.length; i++) {
      const voiceType = voicesToTry[i];
      
      try {
        // Step 1: Submit the TTS task (like Python code)
        const { response, result, voiceType: usedVoice } = await tryTTSRequest(
          baseRequestPayload, 
          voiceType, 
          accessToken, 
          i + 1
        );

        // Check if we get immediate data or need to query
        if (result.data && result.data) {
          // Immediate success
          console.log(`✅ Immediate success with voice type: ${usedVoice}`);
          successfulResult = { result, usedVoice };
          break;
        } else if (result.message && result.message.includes("Successfully submitted")) {
          // Async mode - need to query for results
          console.log(`📤 Task submitted successfully, querying results...`);
          
          try {
            const queryResult = await queryTTSResult(
              baseRequestPayload, 
              reqid, 
              voiceType, 
              accessToken, 
              text
            );
            console.log(`✅ Success with voice type: ${queryResult.voiceType}`);
            successfulResult = queryResult;
            break;
          } catch (queryError) {
            console.error(`❌ Query failed for voice ${voiceType}:`, queryError);
            lastError = queryError as Error;
            continue;
          }
        } else if (result.code === 3000) {
          // Direct success with code 3000
          console.log(`✅ Success with voice type: ${usedVoice}`);
          successfulResult = { result, usedVoice };
          break;
        } else {
          console.warn(`⚠️ Voice ${usedVoice} returned code ${result.code}: ${result.message}`);
          lastError = new Error(`TTS failed with code ${result.code}: ${result.message}`);
        }
        
      } catch (error) {
        console.error(`❌ Voice ${voiceType} failed:`, error);
        lastError = error as Error;
        
        // If this is a 3001 error (resource not granted), try next voice
        if (error instanceof Error && error.message.includes('3001')) {
          console.log(`🔄 Voice ${voiceType} not authorized, trying next fallback...`);
          continue;
        }
        
        // For other errors, also try next voice
        continue;
      }
    }

    // If no voice worked, return error
    if (!successfulResult) {
      console.error('❌ All voice types failed');
      const errorMessage = lastError ? lastError.message : 'All voice types failed';
      
      return NextResponse.json(
        { error: `TTS generation failed: ${errorMessage}. Please check your Volcengine credentials and voice permissions.` },
        { status: 400 }
      );
    }

    const { result, usedVoice } = successfulResult;

    // The audio data should be in result.data as base64
    if (!result.data) {
      console.error('❌ No audio data in response');
      return NextResponse.json(
        { error: 'No audio data returned from TTS service' },
        { status: 500 }
      );
    }

    console.log('✅ Audio generated successfully');
    
    return NextResponse.json({
      success: true,
      audioData: result.data, // base64 encoded audio
      duration: result.addition?.duration || null,
      voiceUsed: voiceName,
      voiceType: usedVoice,
      reqid: reqid,
      fallbackUsed: usedVoice !== primaryVoiceType ? true : false
    });

  } catch (error) {
    console.error('❌ Error generating audio:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate audio' },
      { status: 500 }
    );
  }
} 