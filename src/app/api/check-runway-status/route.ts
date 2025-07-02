import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json({ error: 'No taskId provided' }, { status: 400 });
    }

    if (!process.env.RUNWAY_API_KEY) {
      console.error('Missing RUNWAY_API_KEY environment variable');
      return NextResponse.json({ error: 'Runway API key not configured' }, { status: 500 });
    }

    const statusResponse = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.RUNWAY_API_KEY}`,
        'X-Runway-Version': '2024-11-06',
      },
    });

    if (!statusResponse.ok) {
      const errorData = await statusResponse.json().catch(() => ({ message: 'Unknown error' }));
      console.error('Runway status check error:', errorData);
      return NextResponse.json({ 
        success: false,
        error: `Runway API error: ${errorData.message || 'Unknown error'}` 
      }, { status: statusResponse.status });
    }

    const taskData = await statusResponse.json();

    if (taskData.status === 'SUCCEEDED' && taskData.output) {
      // Return the completed task data with images
      return NextResponse.json({
        success: true,
        status: taskData.status,
        images: taskData.output.map((url: string, index: number) => ({
          url,
          index
        }))
      });
    } else if (taskData.status === 'FAILED') {
      return NextResponse.json({
        success: true,
        status: taskData.status,
        error: taskData.failure?.reason || 'Task failed'
      });
    } else {
      // Still processing
      return NextResponse.json({
        success: true,
        status: taskData.status || 'PENDING'
      });
    }

  } catch (error) {
    console.error('Error checking runway status:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Failed to check task status' 
    }, { status: 500 });
  }
} 