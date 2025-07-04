import React, { useState } from 'react';
import { VideoGenerationTask } from '@/types/session';
import MaterialVideoSubmissionHelper, { MaterialVideoSubmissionOptions } from '@/utils/materialVideoSubmission';
import MaterialSubmissionService from '@/utils/materialSubmission';
import ApiClient from '@/utils/apiClient';

interface MaterialSubmissionButtonProps {
  videoTasks: VideoGenerationTask[];
  productId: number;
  productName: string;
  folderName: string; // Use folder name as tags
  disabled?: boolean;
  onSubmissionComplete?: (results: any[]) => void;
  onSubmissionError?: (error: string) => void;
}

const MaterialSubmissionButton: React.FC<MaterialSubmissionButtonProps> = ({
  videoTasks,
  productId,
  productName,
  folderName,
  disabled = false,
  onSubmissionComplete,
  onSubmissionError
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState<string>('');

  const handleSubmitMaterials = async () => {
    if (isSubmitting) return;

    console.log('🔍 DEBUG: All videoTasks received:', videoTasks);
    console.log('🔍 DEBUG: videoTasks details:', videoTasks.map(task => ({
      taskId: task.taskId,
      status: task.status,
      relativePath: task.relativePath,
      localPath: task.localPath,
      videoUrl: task.videoUrl,
      imageName: task.imageName
    })));

    const completedTasks = videoTasks.filter(task => task.status === 'downloaded' && (task.relativePath || task.localPath));
    
    console.log('🔍 DEBUG: Filtered completedTasks:', completedTasks);
    console.log('🔍 DEBUG: completedTasks count:', completedTasks.length);
    
    if (completedTasks.length === 0) {
      alert('No completed videos to submit');
      return;
    }

    if (!folderName.trim()) {
      alert('Please enter a folder name first (this will be used as tags)');
      return;
    }

    // Check if we have a valid token before proceeding
    const apiClient = ApiClient.getInstance();
    const token = apiClient.getToken();
    
    console.log('🔍 DEBUG: Token check:', {
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      tokenPreview: token ? token.substring(0, 20) + '...' : 'No token'
    });

    if (!token) {
      const errorMessage = 'Authentication token is missing. Please login again.';
      alert(errorMessage);
      onSubmissionError?.(errorMessage);
      return;
    }

    // Test token validity with a simple request
    console.log('🔍 DEBUG: Testing token validity with products API...');
    try {
      const testResponse = await fetch('/api/products?pageSize=1', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('🔍 DEBUG: Token test response:', {
        status: testResponse.status,
        ok: testResponse.ok
      });
      
      if (!testResponse.ok) {
        const errorMessage = 'Authentication token is invalid or expired. Please login again.';
        alert(errorMessage);
        onSubmissionError?.(errorMessage);
        return;
      }
      
      const testResult = await testResponse.json();
      console.log('🔍 DEBUG: Token test result:', {
        success: testResult.success,
        error: testResult.error
      });
      
      if (!testResult.success) {
        const errorMessage = 'Authentication token is invalid or expired. Please login again.';
        alert(errorMessage);
        onSubmissionError?.(errorMessage);
        return;
      }
      
      console.log('✅ DEBUG: Token validation successful, proceeding with material submission...');
    } catch (tokenTestError) {
      console.error('❌ DEBUG: Token test failed:', tokenTestError);
      const errorMessage = 'Failed to validate authentication token. Please login again.';
      alert(errorMessage);
      onSubmissionError?.(errorMessage);
      return;
    }

    // Use folder name as tags, clean it for API requirements
    const tags = folderName.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fa5,]/g, '').replace(/\s+/g, ',');
    
    console.log('🔍 DEBUG: Processed tags:', {
      originalFolderName: folderName,
      processedTags: tags
    });
    
    // Validate tags format
    if (!MaterialSubmissionService.validateTags(tags)) {
      alert('Invalid folder name format. Only Chinese, English, numbers, and commas are allowed');
      return;
    }

    setIsSubmitting(true);
    setSubmissionProgress('Preparing submission...');

    try {
      const submissionHelper = MaterialVideoSubmissionHelper.getInstance();

      const options: MaterialVideoSubmissionOptions = {
        productId,
        materialType: 'material', // This will be converted to 4001 (空境)
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

      console.log('Starting material submission with options:', {
        ...options,
        materialType: '4001 (空境)',
        fileType: '1002 (mp4)',
        completedVideos: completedTasks.length,
        tagsFromFolderName: tags
      });
      
      const results = await submissionHelper.submitMultipleVideos(completedTasks, options);
      
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
      console.error('Material submission error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setSubmissionProgress(`Error: ${errorMessage}`);
      onSubmissionError?.(errorMessage);
    } finally {
      setIsSubmitting(false);
      
      // Clear progress after 3 seconds
      setTimeout(() => {
        setSubmissionProgress('');
      }, 3000);
    }
  };

  // Since videoTasks are already filtered to selected downloaded videos, use them directly
  const completedCount = videoTasks.filter(task => task.status === 'downloaded' && (task.relativePath || task.localPath)).length;

  return (
    <div className="space-y-2">
      <div className="bg-blue-50 p-3 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Submit as Materials</h4>
        <p className="text-sm text-blue-700 mb-1">
          Product: {productName} (ID: {productId})
        </p>
        <p className="text-sm text-blue-700 mb-1">
          Type: 4001 (空境) | Format: 1002 (mp4)
        </p>
        <p className="text-sm text-blue-700">
          Tags: {folderName || 'Enter folder name first'}
        </p>
      </div>

      <button
        onClick={handleSubmitMaterials}
        disabled={disabled || isSubmitting || completedCount === 0 || !folderName.trim()}
        className={`w-full px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
          disabled || isSubmitting || completedCount === 0 || !folderName.trim()
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

      {!folderName.trim() && (
        <div className="text-sm text-yellow-600 text-center">
          Enter a folder name to enable submission
        </div>
      )}
    </div>
  );
};

export default MaterialSubmissionButton; 