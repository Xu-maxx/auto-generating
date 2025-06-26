import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { taskId } = await request.json();

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    if (!process.env.JIMENG_API_KEY) {
      return NextResponse.json({ error: 'JIMENG API key not configured' }, { status: 500 });
    }

    // Call JIMENG API to cancel the task
    const response = await fetch('https://api.jimeng.ai/v1/video/cancel', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.JIMENG_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task_id: taskId
      }),
    });

    console.log(`Cancel API response status: ${response.status}`);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
        console.log('JIMENG cancel API error response:', errorData);
      } catch (e) {
        errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
      }
      
      return NextResponse.json({ 
        error: `Failed to cancel video generation: ${errorData.message || 'Unknown error'}`,
        details: errorData
      }, { status: response.status });
    }

    const result = await response.json();
    console.log('JIMENG cancel API success response:', result);

    return NextResponse.json({
      success: true,
      message: 'Video generation cancelled successfully',
      taskId: taskId,
      data: result
    });

  } catch (error) {
    console.error('Error cancelling video generation:', error);
    return NextResponse.json(
      { error: 'Failed to cancel video generation' },
      { status: 500 }
    );
  }
} 