import { AvatarSessionData } from '@/utils/avatarSessionManager';

interface SessionInfoPanelProps {
  avatarSession: AvatarSessionData | null;
}

export default function SessionInfoPanel({ avatarSession }: SessionInfoPanelProps) {
  if (!avatarSession) return null;

  return (
    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-blue-800">Avatar Session Active</h3>
          <p className="text-sm text-blue-600">
            {avatarSession.avatarGroup 
              ? `Group: ${avatarSession.avatarGroup.name} (${avatarSession.uploadedAssets.length} assets)`
              : `Session: ${avatarSession.id.split('-')[0]}... (${avatarSession.uploadedAssets.length} assets)`
            }
          </p>
        </div>
        <div className="text-xs text-blue-500">
          {avatarSession.avatarGroup ? 'Ready for new looks' : 'Ready to create group'}
        </div>
      </div>
    </div>
  );
} 