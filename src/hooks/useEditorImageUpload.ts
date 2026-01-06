import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { useCallback } from "react";
import { useSession } from "@/lib/auth-client";

/**
 * Hook that provides an image upload handler for the rich text editor.
 * Uploads images to Convex storage and returns the URL.
 *
 * @param providedUserEmail - Optional email to use instead of getting from session
 */
export function useEditorImageUpload(providedUserEmail?: string) {
  const { data: session } = useSession();
  const generateUploadUrl = useMutation(api.attachments.generateUploadUrl);
  const getImageUrl = useMutation(api.attachments.getImageUrl);

  // Use provided email or fall back to session
  const userEmail = providedUserEmail || session?.user?.email;

  const handleImageUpload = useCallback(
    async (file: File): Promise<string | null> => {
      if (!userEmail) {
        return null;
      }

      try {
        // 1. Get upload URL from Convex
        const uploadUrl = await generateUploadUrl({ userEmail });

        // 2. Upload the file to Convex storage
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": file.type,
          },
          body: file,
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        const { storageId } = await response.json();

        // 3. Get the permanent URL for the uploaded image
        const { url } = await getImageUrl({ storageId, userEmail });

        return url;
      } catch (error) {
        console.error("Failed to upload image:", error);
        return null;
      }
    },
    [userEmail, generateUploadUrl, getImageUrl]
  );

  return {
    onImageUpload: userEmail ? handleImageUpload : undefined,
    isLoggedIn: !!userEmail,
  };
}
