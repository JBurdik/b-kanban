import { useState, useEffect, useRef } from "react";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { signOut, changePassword } from "@/lib/auth-client";
import { useConvexUser } from "@/hooks/useConvexUser";
import { Avatar } from "@/components/Avatar";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user: sessionUser, isLoading, session } = useConvexUser();
  const userId = sessionUser?.id as Id<"users"> | undefined;
  const navigate = useNavigate();

  // Fetch user from Convex to get updated avatar
  const convexUser = useQuery(
    api.users.getByEmail,
    sessionUser?.email ? { email: sessionUser.email } : "skip",
  );

  // Use convexUser for display, fallback to sessionUser
  const user = convexUser ?? sessionUser;

  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Convex mutations
  const updateProfile = useMutation(api.users.updateProfile);
  const deleteAccountMutation = useMutation(api.users.deleteAccount);
  const generateAvatarUploadUrl = useMutation(
    api.users.generateAvatarUploadUrl,
  );
  const saveAvatar = useMutation(api.users.saveAvatar);
  const removeAvatar = useMutation(api.users.removeAvatar);
  const [isUpdatingName, setIsUpdatingName] = useState(false);

  // Initialize name from user data
  useEffect(() => {
    if (user && !name) {
      setName(user.name);
    }
  }, [user, name]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" />;
  }

  const handleNameSave = async () => {
    if (name.trim() && name !== user?.name && userId) {
      setIsUpdatingName(true);
      try {
        await updateProfile({ userId, name: name.trim() });
      } finally {
        setIsUpdatingName(false);
      }
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const userEmail = user?.email;
    if (!file || !userEmail) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be less than 5MB");
      return;
    }

    setIsUploadingAvatar(true);
    try {
      // Get upload URL
      const uploadUrl = await generateAvatarUploadUrl({ userEmail });

      // Upload file
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!response.ok) {
        throw new Error("Failed to upload image");
      }

      const { storageId } = await response.json();

      // Save avatar reference
      await saveAvatar({ userEmail, storageId });
    } catch (err) {
      console.error("Failed to upload avatar:", err);
      alert("Failed to upload avatar. Please try again.");
    } finally {
      setIsUploadingAvatar(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveAvatar = async () => {
    const userEmail = user?.email;
    if (!userEmail) return;
    if (!confirm("Remove your custom avatar?")) return;

    try {
      await removeAvatar({ userEmail });
    } catch (err) {
      console.error("Failed to remove avatar:", err);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }

    setIsChangingPassword(true);
    try {
      const result = await changePassword({ currentPassword, newPassword });
      if (result.error) {
        setPasswordError(result.error.message || "Failed to change password");
      } else {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setPasswordSuccess(true);
        setTimeout(() => setPasswordSuccess(false), 3000);
      }
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : "Failed to change password",
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!userId) return;
    if (
      confirm(
        "Are you sure you want to delete your account? This action cannot be undone.",
      )
    ) {
      if (
        confirm(
          "This will permanently delete all your data including boards and cards. Proceed?",
        )
      ) {
        setIsDeletingAccount(true);
        try {
          await deleteAccountMutation({ userId });
          await signOut();
          navigate({ to: "/login" });
        } catch (err) {
          console.error("Failed to delete account:", err);
          setIsDeletingAccount(false);
        }
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">Profile Settings</h1>

      {/* Profile Info */}
      <div className="card mb-6">
        <div className="flex items-start gap-6">
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <Avatar
                name={user?.name || ""}
                id={userId}
                imageUrl={user?.image}
                size="lg"
                className="w-20 h-20"
              />
              {isUploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                  <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <div className="flex flex-col gap-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="text-xs text-accent hover:text-accent/80 transition-colors"
              >
                {isUploadingAvatar ? "Uploading..." : "Change avatar"}
              </button>
              {user?.image && (
                <button
                  onClick={handleRemoveAvatar}
                  className="text-xs text-dark-muted hover:text-red-400 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          <div className="flex-1">
            <h2 className="font-semibold mb-4">Account Information</h2>

            {/* Name */}
            <div className="mb-4">
              <label className="block text-sm text-dark-muted mb-1">Name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input flex-1"
                />
                <button
                  onClick={handleNameSave}
                  disabled={isUpdatingName || name === user?.name}
                  className="btn-primary"
                >
                  {isUpdatingName ? "Saving..." : "Save"}
                </button>
              </div>
            </div>

            {/* Email (readonly) */}
            <div className="mb-4">
              <label className="block text-sm text-dark-muted mb-1">
                Email
              </label>
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className="input w-full bg-dark-bg cursor-not-allowed"
              />
              <p className="text-xs text-dark-muted mt-1">
                Email cannot be changed
              </p>
            </div>

            {/* Member since */}
            <div>
              <label className="block text-sm text-dark-muted mb-1">
                Member since
              </label>
              <p className="text-sm">
                {session?.user?.createdAt
                  ? new Date(session.user.createdAt).toLocaleDateString()
                  : "Unknown"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="card mb-6">
        <h2 className="font-semibold mb-4">Change Password</h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm text-dark-muted mb-1">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-dark-muted mb-1">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input w-full"
              minLength={8}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-dark-muted mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input w-full"
              minLength={8}
              required
            />
          </div>

          {passwordError && (
            <p className="text-red-400 text-sm">{passwordError}</p>
          )}
          {passwordSuccess && (
            <p className="text-green-400 text-sm">
              Password changed successfully!
            </p>
          )}

          <button
            type="submit"
            disabled={isChangingPassword}
            className="btn-primary"
          >
            {isChangingPassword ? "Changing..." : "Change Password"}
          </button>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="card border-red-500/50">
        <h2 className="font-semibold text-red-400 mb-4">Danger Zone</h2>
        <p className="text-sm text-dark-muted mb-4">
          Once you delete your account, there is no going back. Please be
          certain.
        </p>
        <button
          onClick={handleDeleteAccount}
          disabled={isDeletingAccount}
          className="px-4 py-2 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
        >
          {isDeletingAccount ? "Deleting..." : "Delete Account"}
        </button>
      </div>
    </div>
  );
}
