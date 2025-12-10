import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Loader2, Camera } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { upsertUserProfile } from '@/lib/firestore';
import Avatar from '@/components/shared/Avatar';
import ProfileLayout from '@/components/desktop/ProfileLayout';
import AICopilot from '@/components/shared/AICopilot';

// Hook to detect if we're on desktop
const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  return isDesktop;
};

const RedirectToProfile = ({ section }: { section: string }) => {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  useEffect(() => {
    // Only redirect on desktop
    if (isDesktop) {
      navigate('/employee/profile', { state: { activeSection: section } });
    }
  }, [navigate, section, isDesktop]);

  return null;
};

const EditProfile: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshUser, updateAvatar } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: user?.name || '',
    gender: user?.gender || '',
    dateOfBirth: user?.dateOfBirth
      ? new Date(user.dateOfBirth as string).toISOString().split('T')[0]
      : '',
  });

  // Avatar upload state
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrorMessage('');
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!updateAvatar) {
      setErrorMessage('Avatar upload not supported');
      return;
    }

    setUploadingAvatar(true);
    setAvatarProgress(0);
    setErrorMessage('');

    try {
      await updateAvatar(file, (progress) => {
        setAvatarProgress(progress);
      });
      setSuccessMessage('Avatar updated successfully!');

      // Clear success message after delay
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error updating avatar:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
      setAvatarProgress(0);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSubmit = async () => {
    if (!user?.id) return;

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await upsertUserProfile(user.id, {
        name: formData.name.trim(),
        gender: formData.gender as any || undefined,
        dateOfBirth: formData.dateOfBirth ? new Date(formData.dateOfBirth) : undefined,
      });

      await refreshUser();
      setSuccessMessage('Profile updated successfully!');

      setTimeout(() => {
        navigate(-1);
      }, 1500);
    } catch (error) {
      console.error('Error updating profile:', error);
      setErrorMessage('Failed to update profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarChange}
        className="hidden"
      />

      {/* Desktop View - Redirect to Profile Dashboard */}
      <div className="hidden lg:block">
        <div className="min-h-screen bg-[#050608] flex items-center justify-center">
          <p className="text-white/50">Redirecting to profile...</p>
          {/* Effect to redirect */}
          <RedirectToProfile section="edit-profile" />
        </div>
      </div>

      {/* Mobile View */}
      < div className="lg:hidden min-h-screen bg-black pb-24" >
        {/* Header */}
        < header className="sticky top-0 z-10 bg-black/90 backdrop-blur-sm border-b border-white/10" >
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <ArrowLeft size={24} className="text-white" />
            </button>
            <h1 className="text-lg font-semibold text-white">Edit Profile</h1>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.name.trim()}
              className="p-2 -mr-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 size={24} className="text-[#00A3FF] animate-spin" />
              ) : (
                <Check size={24} className="text-[#00A3FF]" />
              )}
            </button>
          </div>
        </header >

        {/* Success/Error Messages */}
        {
          successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-4 mt-4 p-3 bg-green-500/20 border border-green-500/30 rounded-xl"
            >
              <p className="text-green-400 text-sm text-center">{successMessage}</p>
            </motion.div>
          )
        }

        {
          errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-4 mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl"
            >
              <p className="text-red-400 text-sm text-center">{errorMessage}</p>
            </motion.div>
          )
        }

        {/* Content */}
        <div className="px-4 py-6 space-y-6">
          {/* Avatar Section */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center"
          >
            <div className="relative">
              {/* Only use ref in one place, but since we hide the other, it might work? 
                  Actually refs attach to the DOM node. If we render both, the last one wins.
                  But we conditionally hide with CSS. Both exist in DOM.
                  So `fileInputRef.current` will point to the Mobile one (last rendered).
                  We need to use a LABEL or ensure only one renders.
                  Better: Conditionally render the entire block based on screen size using JS useMediaQuery?
                  Or simple solution: Separate refs or IDs.
                  Actually, since we are doing `hidden lg:block` and `lg:hidden`, both are in the DOM.
                  The ref will point to the input in the Mobile view since it comes last in JSX.
                  Clicking "Camera" in Desktop will trigger `fileInputRef.current.click()`, which clicks the MOBILE input.
                  This is fine! It works invisibly.
               */}
              <input
                // We don't need a second input if we trigger the first one, but the first one is inside the desktop dict
                // Let's just duplicate the input and not use ref for the second one?
                // Or better, move the input OUTSIDE the conditional divs?
                // Yes, move input to top of return.
                className="hidden"
                type="hidden" // Placeholder replacement instructions
              />
              <Avatar
                src={user?.avatar}
                name={user?.name}
                size="xxl"
              />

              {uploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                  <Loader2 className="text-white animate-spin" size={32} />
                </div>
              )}

              {!uploadingAvatar && (
                <button
                  onClick={handleAvatarClick}
                  className="absolute bottom-0 right-0 p-2 bg-[#00A3FF] rounded-full border-4 border-black hover:bg-[#0082CC] transition-colors"
                >
                  <Camera size={20} className="text-white" />
                </button>
              )}
            </div>
            {uploadingAvatar && (
              <p className="text-xs text-[#00A3FF] mt-2 font-medium">
                Uploading: {Math.round(avatarProgress)}%
              </p>
            )}
          </motion.div>

          {/* Form Fields */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            {/* Name */}
            <div className="bg-[#1a1a1a] rounded-2xl p-4">
              <label className="block text-white/50 text-sm mb-2">Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Enter your name"
                className="w-full bg-transparent text-white text-lg outline-none placeholder:text-white/30"
              />
            </div>

            {/* Gender */}
            <div className="bg-[#1a1a1a] rounded-2xl p-4">
              <label className="block text-white/50 text-sm mb-3">Gender</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'male', label: 'Male' },
                  { value: 'female', label: 'Female' },
                  { value: 'other', label: 'Other' },
                  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleChange('gender', option.value)}
                    className={`py-2.5 px-4 rounded-xl text-sm font-medium transition-colors ${formData.gender === option.value
                      ? 'bg-[#00A3FF] text-white'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                      }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date of Birth */}
            <div className="bg-[#1a1a1a] rounded-2xl p-4">
              <label className="block text-white/50 text-sm mb-2">Date of Birth</label>
              <input
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                className="w-full bg-transparent text-white text-lg outline-none [color-scheme:dark]"
              />
            </div>
          </motion.div>

          {/* Email (Read-only) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-[#1a1a1a] rounded-2xl p-4 opacity-60"
          >
            <label className="block text-white/50 text-sm mb-2">Email</label>
            <p className="text-white/70 text-lg">{user?.email}</p>
            <p className="text-white/30 text-xs mt-1">Email cannot be changed</p>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default EditProfile;

