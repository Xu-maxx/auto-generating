import React, { useState, useEffect, useCallback } from 'react';
import { Tag, SelectedTag } from '@/types/tag';
import { TagService } from '@/utils/tagService';

interface TagSelectorProps {
  selectedTags: SelectedTag[];
  onTagSelectionChange: (tags: SelectedTag[]) => void;
  disabled?: boolean;
  className?: string;
}

const TagSelector: React.FC<TagSelectorProps> = ({
  selectedTags,
  onTagSelectionChange,
  disabled = false,
  className = ''
}) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const tagService = TagService.getInstance();

  // Load tags on component mount
  useEffect(() => {
    const loadTags = async () => {
      try {
        setLoading(true);
        setError(null);
        const hierarchicalTags = await tagService.getHierarchicalTags();
        setTags(hierarchicalTags);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tags');
        console.error('Error loading tags:', err);
      } finally {
        setLoading(false);
      }
    };

    loadTags();
  }, []);

  // Toggle tag selection - only allow leaf tags (tags without children)
  const toggleTag = useCallback((tag: Tag, parentTag?: Tag) => {
    if (disabled) return;

    // Check if tag is a leaf (has no children)
    const isLeafTag = !tag.children || tag.children.length === 0;
    
    if (!isLeafTag) {
      // Don't allow selection of parent tags
      return;
    }

    const isSelected = selectedTags.some(selected => selected.id === tag.id);
    
    if (isSelected) {
      // Remove from selection
      onTagSelectionChange(selectedTags.filter(selected => selected.id !== tag.id));
    } else {
      // Add to selection
      const newSelectedTag: SelectedTag = {
        id: tag.id,
        name: tag.name,
        parentId: parentTag?.id,
        parentName: parentTag?.name
      };
      onTagSelectionChange([...selectedTags, newSelectedTag]);
    }
  }, [selectedTags, onTagSelectionChange, disabled]);

  // Toggle tag expansion
  const toggleExpansion = useCallback((tagId: number) => {
    const updateTagExpansion = (tags: Tag[]): Tag[] => {
      return tags.map(tag => {
        if (tag.id === tagId) {
          return { ...tag, expanded: !tag.expanded };
        }
        if (tag.children) {
          return { ...tag, children: updateTagExpansion(tag.children) };
        }
        return tag;
      });
    };

    setTags(updateTagExpansion(tags));
  }, [tags]);

  // Filter tags based on search query
  const filterTags = useCallback((tags: Tag[], query: string): Tag[] => {
    if (!query.trim()) return tags;
    
    const matchesQuery = (tag: Tag): boolean => {
      return tag.name.toLowerCase().includes(query.toLowerCase());
    };
    
    const filterRecursive = (tags: Tag[]): Tag[] => {
      return tags.reduce((acc: Tag[], tag) => {
        const hasMatchingChildren = tag.children && filterRecursive(tag.children).length > 0;
        const matches = matchesQuery(tag);
        
        if (matches || hasMatchingChildren) {
          acc.push({
            ...tag,
            children: tag.children ? filterRecursive(tag.children) : undefined,
            expanded: hasMatchingChildren || matches // Auto-expand if has matching children
          });
        }
        
        return acc;
      }, []);
    };
    
    return filterRecursive(tags);
  }, []);

  // Render individual tag item
  const renderTag = useCallback((tag: Tag, level: number = 0, parentTag?: Tag) => {
    const isSelected = selectedTags.some(selected => selected.id === tag.id);
    const hasChildren = tag.children && tag.children.length > 0;
    const isLeafTag = !hasChildren;
    const indent = level * 16;

    return (
      <div key={tag.id} className="select-none">
        <div 
          className={`flex items-center py-1 px-2 rounded ${
            isLeafTag ? 'cursor-pointer hover:bg-gray-100' : 'cursor-default'
          } ${
            isSelected ? 'bg-blue-50 border-l-2 border-blue-500' : ''
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          style={{ paddingLeft: `${8 + indent}px` }}
        >
          {/* Expansion toggle */}
          {hasChildren && (
            <button
              onClick={() => toggleExpansion(tag.id)}
              className="mr-2 p-1 hover:bg-gray-200 rounded"
              disabled={disabled}
            >
              {tag.expanded ? '▼' : '▶'}
            </button>
          )}
          
          {/* Tag checkbox and label */}
          <label className={`flex items-center flex-1 ${isLeafTag ? 'cursor-pointer' : 'cursor-default'}`} style={{ marginLeft: hasChildren ? '0' : '24px' }}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleTag(tag, parentTag)}
              disabled={disabled || !isLeafTag}
              className={`mr-2 ${!isLeafTag ? 'opacity-30 cursor-not-allowed' : ''}`}
              title={!isLeafTag ? 'Only leaf tags can be selected' : ''}
            />
            <span className={`text-sm ${
              isSelected ? 'font-medium text-blue-700' : 
              isLeafTag ? 'text-gray-700' : 'text-gray-500 italic'
            }`}>
              {tag.name}
              {!isLeafTag && (
                <span className="ml-1 text-xs text-gray-400">(category)</span>
              )}
            </span>
          </label>
        </div>
        
        {/* Children */}
        {hasChildren && tag.expanded && (
          <div className="ml-2">
            {tag.children?.map(child => renderTag(child, level + 1, tag))}
          </div>
        )}
      </div>
    );
  }, [selectedTags, toggleTag, toggleExpansion, disabled]);

  // Remove selected tag
  const removeSelectedTag = (tagId: number) => {
    onTagSelectionChange(selectedTags.filter(tag => tag.id !== tagId));
  };

  const filteredTags = filterTags(tags, searchQuery);

  if (loading) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-sm text-gray-600">Loading tags...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${className}`}>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">Error loading tags: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
          >
            Refresh page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      {/* Search input */}
      <div className="mb-3">
        <input
          type="text"
          placeholder="Search tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Selected tags display */}
      {selectedTags.length > 0 && (
        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-800">Selected Tags ({selectedTags.length})</span>
            <button
              onClick={() => onTagSelectionChange([])}
              disabled={disabled}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {selectedTags.map(tag => (
              <span
                key={tag.id}
                className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full"
              >
                {tag.parentName && (
                  <span className="text-blue-600 mr-1">{tag.parentName} → </span>
                )}
                {tag.name}
                {!disabled && (
                  <button
                    onClick={() => removeSelectedTag(tag.id)}
                    className="ml-1 text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tags tree */}
      <div className="border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
        {filteredTags.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            {searchQuery ? 'No tags found matching your search.' : 'No tags available.'}
          </div>
        ) : (
          <div className="p-2">
            {filteredTags.map(tag => renderTag(tag))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-2 text-xs text-gray-500">
        💡 Only specific categories (leaf tags) can be selected. Parent categories are for organization only.
        <br />
        📂 Categories marked as "(category)" contain subcategories - expand them to find selectable tags.
      </div>
    </div>
  );
};

export default TagSelector; 