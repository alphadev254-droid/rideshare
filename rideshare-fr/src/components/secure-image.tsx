import { useEffect, useState } from "react";
import { API_CONFIG } from "@/lib/api/config";
import { tokenStorage } from "@/lib/api/storage";
import { cn } from "@/lib/utils";

function normalizeUploadPath(path: string): string {
  if (path.startsWith("http")) {
    return new URL(path).pathname;
  }
  return path.startsWith("/uploads/") ? path : `/uploads/${path.replace(/^\/+/, "")}`;
}

async function fetchProtectedUpload(path: string, access: "auto" | "public" = "auto"): Promise<string | null> {
  const token = tokenStorage.getAccess();
  const uploadPath = normalizeUploadPath(path);
  const usePublic = access === "public" || !token;
  const endpoint = usePublic ? "/uploads/public-file" : "/uploads/file";
  const res = await fetch(
    `${API_CONFIG.baseUrl}${endpoint}?path=${encodeURIComponent(uploadPath)}`,
    !usePublic && token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  );
  if (!res.ok) return null;

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export function SecureImage({
  src,
  alt,
  className,
  access = "auto",
}: {
  src?: string | null;
  alt: string;
  className?: string;
  access?: "auto" | "public";
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!src) {
      setBlobUrl(null);
      return;
    }

    let active = true;
    let objectUrl: string | null = null;

    fetchProtectedUpload(src, access)
      .then((url) => {
        if (!active) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setBlobUrl(url);
      })
      .catch(() => {
        if (active) setBlobUrl(null);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, access]);

  if (!src) return null;
  if (!blobUrl) {
    return <div className={cn("animate-pulse bg-surface-2", className)} aria-hidden="true" />;
  }

  return <img src={blobUrl} alt={alt} className={className} />;
}

export function SecureFileLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  async function openFile(e: React.MouseEvent) {
    e.preventDefault();
    const url = await fetchProtectedUpload(href);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return (
    <a href={href} onClick={openFile} className={className}>
      {children}
    </a>
  );
}
