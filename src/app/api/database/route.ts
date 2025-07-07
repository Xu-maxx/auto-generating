import { NextResponse } from 'next/server';
import { checkDatabaseHealth, migrateFromRedisToMongoDB, getStorageStats } from '@/utils/databaseInit';
import { getStorageType } from '@/utils/database';

// GET /api/database - Get database health and stats
export async function GET() {
  try {
    const [health, stats] = await Promise.all([
      checkDatabaseHealth(),
      getStorageStats()
    ]);

    return NextResponse.json({
      success: true,
      health,
      stats,
      currentStorage: getStorageType(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST /api/database - Perform database operations
export async function POST(request: Request) {
  try {
    const { action } = await request.json();

    switch (action) {
      case 'migrate':
        await migrateFromRedisToMongoDB();
        return NextResponse.json({
          success: true,
          message: 'Migration completed successfully'
        });

      case 'health':
        const health = await checkDatabaseHealth();
        return NextResponse.json({
          success: true,
          health
        });

      case 'stats':
        const stats = await getStorageStats();
        return NextResponse.json({
          success: true,
          stats
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Database operation error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 