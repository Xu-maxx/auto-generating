import { NextRequest, NextResponse } from 'next/server';
import { ProductStyle } from '@/types/product';
import fs from 'fs';
import path from 'path';

const STYLES_FILE = path.join(process.cwd(), 'data', 'product-styles.json');

// Ensure data directory exists
function ensureDataDirectory() {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Read styles from file
function readStyles(): ProductStyle[] {
  ensureDataDirectory();
  if (!fs.existsSync(STYLES_FILE)) {
    return [];
  }
  try {
    const data = fs.readFileSync(STYLES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading styles file:', error);
    return [];
  }
}

// Write styles to file
function writeStyles(styles: ProductStyle[]) {
  ensureDataDirectory();
  try {
    fs.writeFileSync(STYLES_FILE, JSON.stringify(styles, null, 2));
  } catch (error) {
    console.error('Error writing styles file:', error);
    throw error;
  }
}

// GET style for a specific product
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const styles = readStyles();
    const productStyle = styles.find(s => s.productId === parseInt(productId));

    return NextResponse.json({
      success: true,
      style: productStyle || null
    });
  } catch (error) {
    console.error('Error fetching product style:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch product style' },
      { status: 500 }
    );
  }
}

// POST/PUT style for a product
export async function POST(request: NextRequest) {
  try {
    const { productId, style } = await request.json();

    if (!productId || !style) {
      return NextResponse.json(
        { success: false, error: 'Product ID and style are required' },
        { status: 400 }
      );
    }

    const styles = readStyles();
    const existingStyleIndex = styles.findIndex(s => s.productId === productId);
    
    const now = new Date().toISOString();
    const productStyle: ProductStyle = {
      id: existingStyleIndex >= 0 ? styles[existingStyleIndex].id : Date.now(),
      productId,
      style,
      createdAt: existingStyleIndex >= 0 ? styles[existingStyleIndex].createdAt : now,
      updatedAt: now
    };

    if (existingStyleIndex >= 0) {
      styles[existingStyleIndex] = productStyle;
    } else {
      styles.push(productStyle);
    }

    writeStyles(styles);

    return NextResponse.json({
      success: true,
      style: productStyle
    });
  } catch (error) {
    console.error('Error saving product style:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save product style' },
      { status: 500 }
    );
  }
} 