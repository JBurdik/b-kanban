import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { FileUpload } from "./FileUpload";

interface Props {
  cardId: Id<"cards">;
  readOnly?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.startsWith("video/")) return "🎥";
  if (mimeType.startsWith("audio/")) return "🎵";
  if (mimeType === "application/pdf") return "📄";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "📊";
  if (mimeType.includes("document") || mimeType.includes("word")) return "📝";
  return "📎";
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export function AttachmentList({ cardId, readOnly = false }: Props) {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const attachments = useQuery(api.attachments.list, { cardId });
  const deleteAttachment = useMutation(api.attachments.remove);

  const handleDelete = async (attachmentId: Id<"attachments">, fileName: string) => {
    if (confirm(`Delete ${fileName}?`)) {
      await deleteAttachment({ attachmentId });
    }
  };

  if (attachments === undefined) {
    return (
      <div className="animate-pulse space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-12 bg-dark-bg rounded" />
        ))}
      </div>
    );
  }

  const imageAttachments = attachments.filter((a) => isImage(a.mimeType));
  const otherAttachments = attachments.filter((a) => !isImage(a.mimeType));

  return (
    <div className="space-y-4">
      {/* Upload area (if editable) */}
      {!readOnly && (
        <FileUpload cardId={cardId} />
      )}

      {attachments.length === 0 && readOnly && (
        <p className="text-dark-muted text-sm italic">No attachments</p>
      )}

      {/* Image previews */}
      {imageAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {imageAttachments.map((attachment) => (
            <div key={attachment._id} className="relative group">
              <button
                onClick={() => attachment.url && setLightboxImage(attachment.url)}
                className="w-20 h-20 bg-dark-bg rounded-lg overflow-hidden hover:ring-2 hover:ring-accent transition-all flex-shrink-0"
              >
                {attachment.url && (
                  <img
                    src={attachment.url}
                    alt={attachment.fileName}
                    className="w-full h-full object-cover"
                  />
                )}
              </button>
              {!readOnly && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(attachment._id, attachment.fileName);
                  }}
                  className="absolute -top-1 -right-1 bg-dark-surface border border-dark-border text-dark-muted hover:text-red-400 hover:border-red-400 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Other files */}
      {otherAttachments.length > 0 && (
        <div className="space-y-2">
          {otherAttachments.map((attachment) => (
            <div
              key={attachment._id}
              className="flex items-center justify-between p-3 bg-dark-bg rounded-lg group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xl flex-shrink-0">
                  {getFileIcon(attachment.mimeType)}
                </span>
                <div className="min-w-0">
                  {attachment.url ? (
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium hover:text-accent truncate block"
                    >
                      {attachment.fileName}
                    </a>
                  ) : (
                    <span className="text-sm font-medium truncate block">
                      {attachment.fileName}
                    </span>
                  )}
                  <p className="text-xs text-dark-muted">
                    {formatFileSize(attachment.fileSize)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {attachment.url && (
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-dark-muted hover:text-dark-text p-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </a>
                )}
                {!readOnly && (
                  <button
                    onClick={() => handleDelete(attachment._id, attachment.fileName)}
                    className="text-dark-muted hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox for full-size image view */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 p-2"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={lightboxImage}
            alt="Full size"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
