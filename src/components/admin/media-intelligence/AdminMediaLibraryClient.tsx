"use client";

import MediaLibraryCore from "../media/MediaLibraryCore";

export default function AdminMediaLibraryClient() {
  return <MediaLibraryCore mode="manage" initialFolder="images" />;
}
