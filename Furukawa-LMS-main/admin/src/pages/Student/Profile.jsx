import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { IconUser, IconMail, IconPhone, IconCalendar, IconSchool, IconCamera } from '@tabler/icons-react';
import AccountStatusNotification from '../../components/student/AccountStatusNotification';
import AccountStatusWrapper from '../../components/student/AccountStatusWrapper';
import { useUpdateAvatarMutation } from '@/Redux/AllApi/UserApi';
import { profile } from '@/Redux/Slice/AuthSlice';
import { getMediaUrl } from '@/utils/mediaUtils';

const Profile = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const [updateAvatar, { isLoading: uploading }] = useUpdateAvatarMutation();
  const fileRef = React.useRef(null);
  const [preview, setPreview] = React.useState(null);

  const onPickImage = () => fileRef.current?.click();
  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const onUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('avatar', file);
    try {
      await updateAvatar(form).unwrap();
      await dispatch(profile()).unwrap();
      setPreview(null);
      if (fileRef.current) fileRef.current.value = '';
      alert('Profile picture updated');
    } catch (e) {
      alert(e?.data?.message || 'Failed to update avatar');
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Not available';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'ACTIVE': { color: 'bg-green-100 text-green-800', text: 'Active' },
      'PENDING': { color: 'bg-yellow-100 text-yellow-800', text: 'Pending Approval' },
      'SUSPENDED': { color: 'bg-orange-100 text-orange-800', text: 'Suspended' },
      'BANNED': { color: 'bg-red-100 text-red-800', text: 'Banned' }
    };

    const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-800', text: status };
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    );
  };

  return (
    <AccountStatusWrapper allowPending={true}>
      <div className="max-w-4xl mx-auto">
      {/* Account Status Notification */}
      {user.status !== 'ACTIVE' && (
        <AccountStatusNotification status={user.status} />
      )}

      <div className="bg-white shadow-lg rounded-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-8">
          <div className="flex items-center space-x-6">
            <div className="relative">
              <img
                src={preview || getMediaUrl(user.avatar?.url) || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || user.userName)}&background=ffffff&color=2563eb&size=128`}
                alt="Profile"
                className="w-24 h-24 rounded-full border-4 border-white shadow-lg object-cover"
              />
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
              <button
                type="button"
                onClick={onPickImage}
                className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-white text-blue-600 rounded-full p-2 shadow hover:bg-blue-50"
                title="Change profile picture"
              >
                <IconCamera className="w-4 h-4" />
              </button>
              {preview && (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={onUpload}
                    disabled={uploading}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                  >
                    {uploading ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPreview(null); if (fileRef.current) fileRef.current.value=''; }}
                    className="px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              )}
              <div className="absolute -bottom-2 -right-2">
                {getStatusBadge(user.status)}
              </div>
            </div>
            <div className="text-white">
              <h1 className="text-3xl font-bold mb-2">{user.fullName}</h1>
              <p className="text-blue-100 text-lg">@{user.userName}</p>
              <p className="text-blue-200 capitalize">{user.role?.toLowerCase()}</p>
            </div>
          </div>
        </div>

        {/* Profile Information */}
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
            <IconUser className="w-5 h-5 mr-2 text-blue-600" />
            Personal Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                <IconUser className="w-5 h-5 text-gray-500 mr-3" />
                <div>
                  <p className="text-sm text-gray-500">Full Name</p>
                  <p className="font-medium text-gray-900">{user.fullName}</p>
                </div>
              </div>

              <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                <IconMail className="w-5 h-5 text-gray-500 mr-3" />
                <div>
                  <p className="text-sm text-gray-500">Email Address</p>
                  <p className="font-medium text-gray-900">{user.email}</p>
                </div>
              </div>

              <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                <IconPhone className="w-5 h-5 text-gray-500 mr-3" />
                <div>
                  <p className="text-sm text-gray-500">Phone Number</p>
                  <p className="font-medium text-gray-900">{user.phoneNumber}</p>
                </div>
              </div>
            </div>

            {/* Account Info */}
            <div className="space-y-4">
              <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                <IconCalendar className="w-5 h-5 text-gray-500 mr-3" />
                <div>
                  <p className="text-sm text-gray-500">Member Since</p>
                  <p className="font-medium text-gray-900">{formatDate(user.createdAt)}</p>
                </div>
              </div>

              <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                <IconCalendar className="w-5 h-5 text-gray-500 mr-3" />
                <div>
                  <p className="text-sm text-gray-500">Last Login</p>
                  <p className="font-medium text-gray-900">{formatDate(user.lastLogin)}</p>
                </div>
              </div>

              <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                <IconSchool className="w-5 h-5 text-gray-500 mr-3" />
                <div>
                  <p className="text-sm text-gray-500">Account Status</p>
                  <div className="mt-1">
                    {getStatusBadge(user.status)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Account Status Information */}
          {user.status !== 'ACTIVE' && (
            <div className="mt-8 p-6 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Account Status Information</h3>
              {user.status === 'PENDING' && (
                <p className="text-gray-700">
                  Your account is currently pending approval from an administrator. Once approved, 
                  you will have full access to all learning materials and features.
                </p>
              )}
              {user.status === 'SUSPENDED' && (
                <p className="text-gray-700">
                  Your account has been suspended. This may be temporary. Please contact your 
                  instructor or administrator for more information about restoring your access.
                </p>
              )}
              {user.status === 'BANNED' && (
                <p className="text-gray-700">
                  Your account has been banned from the platform. Please contact your instructor 
                  or administrator if you believe this is an error.
                </p>
              )}
            </div>
          )}

          {/* Contact Information */}
          <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-lg font-medium text-blue-900 mb-2">Need Help?</h3>
            <p className="text-blue-700">
              If you have any questions about your account or need assistance, 
              please contact your instructor or the system administrator.
            </p>
          </div>
        </div>
      </div>
      </div>
    </AccountStatusWrapper>
  );
};

export default Profile;
