import ApiClient from './apiClient';
import { Tag, TagsResponse, SelectedTag } from '@/types/tag';

export class TagService {
  private static instance: TagService;
  private apiClient: ApiClient;

  private constructor() {
    this.apiClient = ApiClient.getInstance();
  }

  static getInstance(): TagService {
    if (!TagService.instance) {
      TagService.instance = new TagService();
    }
    return TagService.instance;
  }

  /**
   * Fetch all tags from the API via local Next.js API route
   */
  async getAllTags(): Promise<Tag[]> {
    try {
      const token = this.apiClient.getToken();
      
      if (!token) {
        throw new Error('Not authenticated - no token available');
      }

      // Use local API route instead of external API
      const response = await fetch('/api/tags?pageNum=1&pageSize=100000', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch tags');
      }
      
      return data.tags || [];
    } catch (error) {
      console.error('Error fetching tags:', error);
      throw error;
    }
  }

  /**
   * Build hierarchical tag structure starting from fatherId === 6170
   * As per API documentation usage instructions
   */
  async getHierarchicalTags(): Promise<Tag[]> {
    const allTags = await this.getAllTags();
    
    // Step 1: Find root tags (fatherId === 6170)
    const rootTags = allTags.filter(tag => tag.fatherId === 6170);
    
    // Step 2: Build hierarchy recursively
    const buildHierarchy = (parentId: number): Tag[] => {
      const children = allTags.filter(tag => tag.fatherId === parentId);
      return children.map(child => ({
        ...child,
        children: buildHierarchy(child.id),
        expanded: false
      }));
    };
    
    // Step 3: Build complete hierarchy
    const hierarchicalTags = rootTags.map(root => ({
      ...root,
      children: buildHierarchy(root.id),
      expanded: false
    }));
    
    return hierarchicalTags;
  }

  /**
   * Check if a tag is a leaf tag (has no children)
   */
  isLeafTag(tag: Tag): boolean {
    return !tag.children || tag.children.length === 0;
  }

  /**
   * Filter selected tags to only include leaf tags
   * This helps ensure data consistency when leaf-only selection is required
   */
  filterToLeafTagsOnly(selectedTags: SelectedTag[], allTags: Tag[]): SelectedTag[] {
    return selectedTags.filter(selectedTag => {
      const fullTag = this.findTagById(allTags, selectedTag.id);
      return fullTag && this.isLeafTag(fullTag);
    });
  }

  /**
   * Convert selected tags to comma-separated string for API submission
   * According to 接口.txt: tags should be comma-separated, only Chinese/English/numbers allowed
   */
  convertSelectedTagsToString(selectedTags: SelectedTag[]): string {
    // Log any non-leaf tags that somehow made it through (should not happen with proper UI)
    const tagNames = selectedTags.map(tag => {
      // Log for debugging - in production, only leaf tags should be selectable
      if (process.env.NODE_ENV === 'development') {
        console.log(`📝 Converting tag for API: ${tag.name} (ID: ${tag.id}, Parent: ${tag.parentName || 'None'})`);
      }
      return tag.name;
    });
    
    const result = tagNames.join(',');
    
    // Validate the result matches API requirements
    if (!this.validateTagsString(result)) {
      console.error('❌ Generated tags string does not meet API requirements:', {
        tagsString: result,
        selectedTags: selectedTags.map(t => ({ id: t.id, name: t.name })),
        validationPattern: '/^[a-zA-Z0-9\\u4e00-\\u9fa5,]+$/'
      });
    }
    
    return result;
  }

  /**
   * Convert selected tags to comma-separated tag IDs for API submission
   * Alternative approach if tag names cause parsing issues on backend
   */
  convertSelectedTagsToIdString(selectedTags: SelectedTag[]): string {
    const tagIds = selectedTags.map(tag => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`📝 Converting tag ID for API: ${tag.name} (ID: ${tag.id})`);
      }
      return tag.id.toString();
    });
    
    const result = tagIds.join(',');
    
    console.log('📝 Generated tag IDs string:', {
      originalSelectedTags: selectedTags.map(t => ({ id: t.id, name: t.name })),
      tagIdsString: result
    });
    
    return result;
  }

  /**
   * Validate tags format according to API requirements (接口.txt)
   * Only Chinese, English, numbers, and commas are allowed
   */
  validateTagsString(tags: string): boolean {
    const tagPattern = /^[a-zA-Z0-9\u4e00-\u9fa5,]+$/;
    return tagPattern.test(tags);
  }

  /**
   * Validate tag IDs string format (numbers and commas only)
   */
  validateTagIdsString(tagIds: string): boolean {
    const tagIdPattern = /^[0-9,]+$/;
    return tagIdPattern.test(tagIds);
  }

  /**
   * Find a tag by ID in the hierarchical structure
   */
  findTagById(tags: Tag[], id: number): Tag | null {
    for (const tag of tags) {
      if (tag.id === id) {
        return tag;
      }
      if (tag.children) {
        const found = this.findTagById(tag.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Get the full path of a tag (parent hierarchy)
   */
  getTagPath(tags: Tag[], targetId: number): string[] {
    const findPath = (nodes: Tag[], id: number, path: string[] = []): string[] | null => {
      for (const node of nodes) {
        const currentPath = [...path, node.name];
        if (node.id === id) {
          return currentPath;
        }
        if (node.children) {
          const found = findPath(node.children, id, currentPath);
          if (found) return found;
        }
      }
      return null;
    };
    
    return findPath(tags, targetId) || [];
  }
} 