import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { useCallback } from "react";
import { useConvexUser } from "@/hooks/useConvexUser";

/**
 * Hook that provides an image upload handler for the rich text editor.
 * Uploads images to Convex storage and returns the URL.
 *
 * @param _providedUserEmail - Ignored, kept for API compatibility
 */
export function useEditorImageUpload(_providedUserEmail?: string) {
  const { session } = useConvexUser();
  const generateUploadUrl = useMutation(api.attachments.generateUploadUrl);
  const getImageUrl = useMutation(api.attachments.getImageUrl);

  const isLoggedIn = !!session?.user;

  const handleImageUpload = useCallback(
    async (file: File): Promise<string | null> => {
      try {
        // 1. Get upload URL from Convex
        const uploadUrl = await generateUploadUrl({});

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
        const { url } = await getImageUrl({ storageId });

        return url;
      } catch (error) {
        console.error("Failed to upload image:", error);
        return null;
      }
    },
    [generateUploadUrl, getImageUrl]
  );

  return {
    onImageUpload: isLoggedIn ? handleImageUpload : undefined,
    isLoggedIn,
  };
}
