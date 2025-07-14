import React, { useState } from 'react';
import { VideoGenerationTask } from '@/types/session';
import { SelectedTag } from '@/types/tag';
import { TagService } from '@/utils/tagService';
import MaterialVideoSubmissionHelper, { MaterialVideoSubmissionOptions } from '@/utils/materialVideoSubmission';
import MaterialSubmissionService from '@/utils/materialSubmission';
import ApiClient from '@/utils/apiClient';

interface MaterialSubmissionButtonProps {
  videoTasks: VideoGenerationTask[];
  productId: number;
  productName: string;
  selectedTags: SelectedTag[]; // Updated to use selected tags
  disabled?: boolean;
  onSubmissionComplete?: (results: any[]) => void;
  onSubmissionError?: (error: string) => void;
}

const MaterialSubmissionButton: React.FC<MaterialSubmissionButtonProps> = ({
  videoTasks,
  productId,
  productName,
  selectedTags,
  disabled = false,
  onSubmissionComplete,
  onSubmissionError
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState<string>('');
  const tagService = TagService.getInstance();

  const handleSubmitMaterials = async () => {
    if (isSubmitting) return;

    console.log('🔍 DEBUG: All videoTasks received:', videoTasks);
    console.log('🔍 DEBUG: videoTasks details:', videoTasks.map(task => ({
      taskId: task.taskId,
      status: task.status,
      relativePath: task.relativePath,
      localPath: task.localPath,
      videoUrl: task.videoUrl,
      imageName: task.imageName,
      imageUrl: task.imageUrl,
      previewUrl: task.previewUrl
    })));

    const completedTasks = videoTasks.filter(task => task.status === 'downloaded' && (task.relativePath || task.localPath || task.videoUrl));
    
    console.log('🔍 DEBUG: Filtered completedTasks:', completedTasks);
    console.log('🔍 DEBUG: completedTasks count:', completedTasks.length);
    console.log('🔍 DEBUG: completedTasks image URLs:', completedTasks.map(task => ({
      taskId: task.taskId,
      imageName: task.imageName,
      imageUrl: task.imageUrl,
      previewUrl: task.previewUrl,
      hasImageUrl: !!task.imageUrl,
      hasPreviewUrl: !!task.previewUrl
    })));
    
    if (completedTasks.length === 0) {
      alert('No completed videos to submit');
      return;
    }

    if (selectedTags.length === 0) {
      alert('Please select at least one tag first');
      return;
    }

    // Check if we have a valid token before proceeding
    const apiClient = ApiClient.getInstance();
    const token = apiClient.getToken();
    
    if (!token) {
      alert('Please login first');
      return;
    }

    console.log('🔍 DEBUG: Current API token status:', {
      hasToken: !!token,
      tokenPreview: token ? token.substring(0, 30) + '...' : 'No token'
    });

    const completedCount = completedTasks.length;
    
    // Convert selected tags to comma-separated string for API
    // Safety check: Filter to only leaf tags before converting
    // This ensures we only submit selectable tags even if somehow a non-leaf tag was selected
    const tagService = TagService.getInstance();
    
    // Try tag IDs first (numbers only), then fallback to tag names if needed
    const tagIds = tagService.convertSelectedTagsToIdString(selectedTags);
    const tagNames = tagService.convertSelectedTagsToString(selectedTags);
    
    console.log('🔍 DEBUG: Processed tags for API submission:', {
      originalSelectedTags: selectedTags.map(tag => ({ 
        id: tag.id, 
        name: tag.name, 
        parentName: tag.parentName 
      })),
      tagIdsString: tagIds,
      tagNamesString: tagNames,
      tagCount: selectedTags.length,
      willTryTagIdsFirst: true
    });
    
    // Validate both formats
    if (!tagService.validateTagIdsString(tagIds)) {
      alert('Invalid tag IDs format. Only numbers and commas are allowed');
      return;
    }
    
    if (!tagService.validateTagsString(tagNames)) {
      alert('Invalid tag names format. Only Chinese, English, numbers, and commas are allowed');
      return;
    }

    setIsSubmitting(true);
    setSubmissionProgress('Preparing submission...');

    // Helper function to attempt submission with specific tags format
    const attemptSubmission = async (tags: string, format: 'IDs' | 'Names') => {
      const submissionHelper = MaterialVideoSubmissionHelper.getInstance();

      const options: MaterialVideoSubmissionOptions = {
        productId,
        materialType: 'material', // This will be converted to 4001 (空境) for video materials
        tags,
        onProgress: (status, details) => {
          setSubmissionProgress(status);
          console.log('Submission progress:', status, details);
        },
        onError: (error) => {
          console.error('Submission error:', error);
          onSubmissionError?.(error);
        }
      };

      console.log(`🚀 Attempting material submission with tag ${format} according to 接口.txt API specification:`, {
        endpoint: '/system/materialMgt/preSubmitGeneratedMaterial',
        requestBody: {
          materialType: 4001, // 空境 (video materials)
          materialFileType: 1002, // mp4 format
          productId: productId,
          tags: tags
        },
        completedVideosCount: completedTasks.length,
        selectedTagsCount: selectedTags.length,
        tagsPreview: tags.length > 50 ? tags.substring(0, 50) + '...' : tags,
        format: format
      });
      
      return await submissionHelper.submitMultipleVideos(completedTasks, options);
    };

    try {
      let results;
      
      try {
        // First attempt: Try with tag IDs (numbers only)
        setSubmissionProgress('Trying submission with tag IDs...');
        results = await attemptSubmission(tagIds, 'IDs');
        console.log('✅ Material submission successful with tag IDs');
      } catch (firstError) {
        console.log('⚠️ First attempt with tag IDs failed:', firstError);
        
        // Check if it's a parsing error that might be resolved with tag names
        const errorMessage = firstError instanceof Error ? firstError.message : String(firstError);
        if (errorMessage.includes('For input string') || errorMessage.includes('parsing') || errorMessage.includes('400')) {
          console.log('🔄 Retrying with tag names...');
          setSubmissionProgress('Retrying submission with tag names...');
          
          try {
            // Second attempt: Try with tag names (Chinese text)
            results = await attemptSubmission(tagNames, 'Names');
            console.log('✅ Material submission successful with tag names');
          } catch (secondError) {
            console.error('❌ Both submission attempts failed:', { firstError, secondError });
            throw secondError; // Throw the second error if both attempts fail
          }
        } else {
          // If it's not a parsing error, don't retry
          throw firstError;
        }
      }
      
      console.log('Material submission results:', results);
      
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      
      if (successCount > 0) {
        setSubmissionProgress(`Successfully submitted ${successCount} videos!`);
        onSubmissionComplete?.(results);
      }
      
      if (failureCount > 0) {
        const errorMessage = `${failureCount} videos failed to submit. Check console for details.`;
        setSubmissionProgress(errorMessage);
        onSubmissionError?.(errorMessage);
      }
      
    } catch (error) {
      console.error('Error submitting materials:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Provide more specific error messages for tag-related issues
      let userFriendlyMessage = errorMessage;
      if (errorMessage.includes('For input string') || errorMessage.includes('parsing')) {
        userFriendlyMessage = 'Tag format issue: Both tag IDs and tag names failed. Please try selecting different tags or contact support.';
      } else if (errorMessage.includes('400')) {
        userFriendlyMessage = 'API validation error: Please check your tag selection and try again.';
      } else if (errorMessage.includes('401')) {
        userFriendlyMessage = 'Authentication error: Please login again and try submitting.';
      }
      
      setSubmissionProgress(`Error: ${userFriendlyMessage}`);
      onSubmissionError?.(userFriendlyMessage);
    } finally {
      setIsSubmitting(false);
      
      // Clear progress after 5 seconds
      setTimeout(() => {
        setSubmissionProgress('');
      }, 5000);
    }
  };

  const completedCount = videoTasks.filter(task => task.status === 'downloaded' && (task.relativePath || task.localPath || task.videoUrl)).length;

  return (
    <div className="space-y-2">
      <div className="bg-blue-50 p-3 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Submit as Materials</h4>
        <p className="text-sm text-blue-700 mb-1">
          Product: {productName} (ID: {productId})
        </p>
        <p className="text-sm text-blue-700 mb-1">
          API: /system/materialMgt/preSubmitGeneratedMaterial
        </p>
        <p className="text-sm text-blue-700 mb-1">
          Type: 4001 (空境 - Video Materials) | Format: 1002 (mp4)
        </p>
        <p className="text-sm text-blue-700">
          Tags: {selectedTags.length > 0 ? (
            <span title={selectedTags.map(tag => tag.name).join(', ')}>
              {selectedTags.length} leaf tags selected
              {selectedTags.length <= 3 && ` (${selectedTags.map(tag => tag.name).join(', ')})`}
            </span>
          ) : 'No tags selected'}
        </p>
        <p className="text-xs text-blue-600 mt-1">
          💡 System will try tag IDs first, then tag names if needed
        </p>
      </div>

      <button
        onClick={handleSubmitMaterials}
        disabled={disabled || isSubmitting || completedCount === 0 || selectedTags.length === 0}
        className={`w-full px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
          disabled || isSubmitting || completedCount === 0 || selectedTags.length === 0
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-green-600 hover:bg-green-700 text-white'
        }`}
      >
        {isSubmitting 
          ? 'Submitting Materials...' 
          : `Submit ${completedCount} Videos as Materials`
        }
      </button>
      
      {submissionProgress && (
        <div className="text-sm text-gray-600 p-2 bg-gray-50 rounded">
          {submissionProgress}
        </div>
      )}
      
      {completedCount === 0 && (
        <div className="text-sm text-gray-500 text-center">
          No completed videos ready for submission
        </div>
      )}

      {selectedTags.length === 0 && (
        <div className="text-sm text-yellow-600 text-center bg-yellow-50 p-2 rounded border border-yellow-200">
          ⚠️ Select at least one leaf tag to enable submission
          <br />
          <span className="text-xs">Only specific categories (leaf tags) can be selected for materials</span>
        </div>
      )}
    </div>
  );
};

export default MaterialSubmissionButton; 