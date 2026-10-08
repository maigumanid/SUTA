import { SIZE } from '@/constants/theme';
import ProfileAvatar from '@/components/common/ProfileAvatar';

export default function InitialsAvatar({ name, avatarPath }: { name: string; avatarPath?: string }) {
  return <ProfileAvatar name={name} avatarPath={avatarPath} size={SIZE.avatarMedium} />;
}
