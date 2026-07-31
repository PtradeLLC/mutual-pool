import React, { useState } from 'react';
import { User, GigPlatform, UserRole } from '../types';
import { X, Camera, User as UserIcon, Upload, Check, Sparkles } from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { saveUserToFirestore } from '../lib/firestoreService';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUpdateUser: (updatedUser: User) => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateUser,
}) => {
  const [displayName, setDisplayName] = useState(currentUser.displayName || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl || '');
  const [platform, setPlatform] = useState<GigPlatform>(currentUser.platform || 'DoorDash');
  const [role, setRole] = useState<UserRole>(currentUser.role || 'RIDER');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image file must be smaller than 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setAvatarUrl(reader.result);
          setError('');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateInitialsAvatar = () => {
    const nameToUse = displayName.trim() || 'User';
    const generated = `https://ui-avatars.com/api/?name=${encodeURIComponent(nameToUse)}&background=005FB8&color=fff&size=300`;
    setAvatarUrl(generated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const finalAvatar = avatarUrl.trim() || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || 'User')}&background=005FB8&color=fff&size=300`;

      const updatedUser: User = {
        ...currentUser,
        displayName: displayName.trim() || currentUser.displayName,
        avatarUrl: finalAvatar,
        platform,
        role,
      };

      // 1. Update Firebase Auth Profile if user is logged in
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: updatedUser.displayName,
          photoURL: finalAvatar,
        });
      }

      // 2. Save to Firestore
      await saveUserToFirestore(updatedUser);

      // 3. Sync with local state and backend
      onUpdateUser(updatedUser);

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1000);
    } catch (err: unknown) {
      console.error('Error updating profile:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to update profile.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#005FB8]">
            <UserIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#111827]">Edit Profile & Avatar</h3>
            <p className="text-xs text-[#6B7280]">Update your display picture, name, and gig platform</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-xs flex items-center gap-2 font-semibold">
            <Check className="w-4 h-4" />
            Profile updated successfully!
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Avatar Preview & File Input */}
          <div className="flex flex-col items-center gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
            <div className="relative group">
              <img
                src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || 'User')}&background=005FB8&color=fff&size=300`}
                alt="Profile Preview"
                className="w-20 h-20 rounded-full object-cover ring-4 ring-white shadow-md"
              />
              <label
                htmlFor="avatar-file-input"
                className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                title="Upload new image"
              >
                <Camera className="w-6 h-6" />
              </label>
              <input
                id="avatar-file-input"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <label
                htmlFor="avatar-file-input"
                className="px-3 py-1.5 rounded-lg bg-white border border-gray-300 hover:bg-gray-100 text-xs font-semibold text-[#111827] flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-[#005FB8]" />
                <span>Upload Photo</span>
              </label>

              <button
                type="button"
                onClick={handleGenerateInitialsAvatar}
                className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 text-xs font-semibold text-[#005FB8] flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate Initials Avatar</span>
              </button>
            </div>
          </div>

          {/* Custom Avatar URL Field */}
          <div>
            <label className="block text-xs font-bold text-[#374151] mb-1">
              Image URL (Optional)
            </label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/my-photo.jpg"
              className="w-full px-3.5 py-2 text-xs border border-gray-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#005FB8]"
            />
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-xs font-bold text-[#374151] mb-1">
              Display Name
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Chris B"
              className="w-full px-3.5 py-2 text-xs border border-gray-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#005FB8]"
            />
          </div>

          {/* Primary Gig Platform & Role */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#374151] mb-1">
                Primary Gig Platform
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as GigPlatform)}
                className="w-full px-3.5 py-2 text-xs border border-gray-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#005FB8] bg-white"
              >
                <option value="DoorDash">DoorDash</option>
                <option value="Uber Eats">Uber Eats</option>
                <option value="Instacart">Instacart</option>
                <option value="Lyft">Lyft</option>
                <option value="Grubhub">Grubhub</option>
                <option value="Spark">Spark (Walmart)</option>
                <option value="Amazon Flex">Amazon Flex</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#374151] mb-1">
                Work Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full px-3.5 py-2 text-xs border border-gray-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#005FB8] bg-white"
              >
                <option value="RIDER">Delivery Rider / Courier</option>
                <option value="DRIVER">Rideshare / Fleet Driver</option>
                <option value="POD_ADMIN">Pod Administrator</option>
                <option value="Admin">Site Administrator (Admin)</option>
                <option value="SUPER_ADMIN">Platform Super Admin</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-[#005FB8] hover:bg-[#004C93] text-white shadow-xs disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
