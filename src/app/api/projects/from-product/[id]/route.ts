import { NextRequest, NextResponse } from 'next/server';
import { ProjectManager } from '@/utils/projectManager';
import ApiClient from '@/utils/apiClient';
import { Product } from '@/types/product';

// GET or CREATE project from product ID
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: productId } = await params;
    
    // Get authentication token from headers
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    const token = authHeader.substring(7);
    
    // Fetch product information from the API
    const apiClient = ApiClient.getInstance();
    apiClient.setToken(token);
    
    try {
      const productResponse = await apiClient.getProducts(1, 1000);
      const product = productResponse.rows?.find((p: Product) => p.id === parseInt(productId));
      
      if (!product) {
        return NextResponse.json(
          { success: false, error: 'Product not found' },
          { status: 404 }
        );
      }
      
      // Look for existing project with this product ID
      const allProjects = await ProjectManager.getAllProjects();
      const existingProject = allProjects.find(p => p.name.includes(`Product ${productId}`));
      
      if (existingProject) {
        // Return existing project
        const fullProject = await ProjectManager.getProject(existingProject.id);
        return NextResponse.json({ success: true, project: fullProject });
      } else {
        // Create new project for this product
        const projectName = `${product.productName} - Material Video`;
        const projectStyle = `Material video project for ${product.productName} (Product ID: ${productId})`;
        
        const newProject = await ProjectManager.createProject(projectName, projectStyle);
        return NextResponse.json({ success: true, project: newProject });
      }
    } catch (apiError) {
      console.error('Error fetching product:', apiError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch product information' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error handling product-to-project conversion:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create/find project' },
      { status: 500 }
    );
  }
} 