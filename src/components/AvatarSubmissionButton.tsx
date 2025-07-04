import React, { useState } from 'react';
import { VideoGenerationTask } from '@/types/session';
import MaterialVideoSubmissionHelper, { MaterialVideoSubmissionOptions } from '@/utils/materialVideoSubmission';
import MaterialSubmissionService from '@/utils/materialSubmission';
import ApiClient from '@/utils/apiClient';

interface AvatarSubmissionButtonProps {
  videoTasks: VideoGenerationTask[];
  productId: number;
  productName: string;
  disabled?: boolean;
  onSubmissionComplete?: (results: any[]) => void;
  onSubmissionError?: (error: string) => void;
}

const AvatarSubmissionButton: React.FC<AvatarSubmissionButtonProps> = ({
  videoTasks,
  productId,
  productName,
  disabled = false,
  onSubmissionComplete,
  onSubmissionError
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState<string>('');

  const handleSubmitAvatars = async () => {
    if (isSubmitting) return;

    console.log('🎭 DEBUG: All avatar videoTasks received:', videoTasks);
    console.log('🎭 DEBUG: videoTasks details:', videoTasks.map(task => ({
      taskId: task.taskId,
      status: task.status,
      relativePath: task.relativePath,
      localPath: task.localPath,
      videoUrl: task.videoUrl,
      imageName: task.imageName
    })));

    const completedTasks = videoTasks.filter(task => task.status === 'downloaded' && (task.relativePath || task.localPath));
    
    console.log('🎭 DEBUG: Filtered completedTasks:', completedTasks);
    console.log('🎭 DEBUG: completedTasks count:', completedTasks.length);
    
    if (completedTasks.length === 0) {
      alert('No completed avatar videos to submit');
      return;
    }

    // Check if we have a valid token before proceeding
    const apiClient = ApiClient.getInstance();
    const token = apiClient.getToken();
    
    console.log('🎭 DEBUG: Token check:', {
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
    console.log('🎭 DEBUG: Testing token validity with products API...');
    try {
      const testResponse = await fetch('/api/products?pageSize=1', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('🎭 DEBUG: Token test response:', {
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
      console.log('🎭 DEBUG: Token test result:', {
        success: testResult.success,
        error: testResult.error
      });
      
      if (!testResult.success) {
        const errorMessage = 'Authentication token is invalid or expired. Please login again.';
        alert(errorMessage);
        onSubmissionError?.(errorMessage);
        return;
      }
      
      console.log('✅ DEBUG: Token validation successful, proceeding with avatar submission...');
    } catch (tokenTestError) {
      console.error('❌ DEBUG: Token test failed:', tokenTestError);
      const errorMessage = 'Failed to validate authentication token. Please login again.';
      alert(errorMessage);
      onSubmissionError?.(errorMessage);
      return;
    }

    // Use fixed tags for avatar submissions
    const tags = 'avatar';
    
    console.log('🎭 DEBUG: Avatar submission settings:', {
      tags,
      materialType: '3001 (口播)',
      productId
    });

    setIsSubmitting(true);
    setSubmissionProgress('Preparing avatar submission...');

    try {
      const submissionHelper = MaterialVideoSubmissionHelper.getInstance();

      const options: MaterialVideoSubmissionOptions = {
        productId,
        materialType: 'avatar', // This will be converted to 3001 (口播)
        tags,
        onProgress: (status, details) => {
          setSubmissionProgress(status);
          console.log('Avatar submission progress:', status, details);
        },
        onError: (error) => {
          console.error('Avatar submission error:', error);
          onSubmissionError?.(error);
        }
      };

      console.log('Starting avatar submission with options:', {
        ...options,
        materialType: '3001 (口播)',
        fileType: '1002 (mp4)',
        completedVideos: completedTasks.length,
        fixedTags: tags
      });
      
      const results = await submissionHelper.submitMultipleVideos(completedTasks, options);
      
      console.log('Avatar submission results:', results);
      
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      
      if (successCount > 0) {
        setSubmissionProgress(`Successfully submitted ${successCount} avatar videos!`);
        onSubmissionComplete?.(results);
      }
      
      if (failureCount > 0) {
        const errorMessage = `${failureCount} avatar videos failed to submit. Check console for details.`;
        setSubmissionProgress(errorMessage);
        onSubmissionError?.(errorMessage);
      }
      
    } catch (error) {
      console.error('Avatar submission error:', error);
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

  const completedCount = videoTasks.filter(task => task.status === 'downloaded' && (task.relativePath || task.localPath)).length;

  return (
    <div className="space-y-2">
      <div className="bg-green-50 p-3 rounded-lg">
        <h4 className="font-medium text-green-900 mb-2">Submit as Avatar Videos</h4>
        <p className="text-sm text-green-700 mb-1">
          Product: {productName} (ID: {productId})
        </p>
        <p className="text-sm text-green-700 mb-1">
          Type: 3001 (口播) | Format: 1002 (mp4)
        </p>
        <p className="text-sm text-green-700">
          Tags: avatar (fixed)
        </p>
      </div>

      <button
        onClick={handleSubmitAvatars}
        disabled={disabled || isSubmitting || completedCount === 0}
        className={`w-full px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
          disabled || isSubmitting || completedCount === 0
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-green-600 hover:bg-green-700 text-white'
        }`}
      >
        {isSubmitting 
          ? 'Submitting Avatar Videos...' 
          : `Submit ${completedCount} Avatar Videos`
        }
      </button>
      
      {submissionProgress && (
        <div className="text-sm text-gray-600 p-2 bg-gray-50 rounded">
          {submissionProgress}
        </div>
      )}
      
      {completedCount === 0 && (
        <div className="text-sm text-gray-500 text-center">
          No completed avatar videos ready for submission
        </div>
      )}
    </div>
  );
};

export default AvatarSubmissionButton; 