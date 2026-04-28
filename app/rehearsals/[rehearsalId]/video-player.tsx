"use client";

import { useEffect, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type VideoPlayerProps = {
  rehearsalId: string;
  fileName: string;
};

type ApiSuccess<T> = {
  ok: true;
  data: T;
};

type ApiError = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

type ApiResponse<T> = ApiSuccess<T> | ApiError;

type PlaybackData = {
  playbackUrl: string;
  videoAssetId: string;
  mimeType: string;
  originalFileName: string;
};

type PlaybackResponse = ApiResponse<PlaybackData>;

export function VideoPlayer({ rehearsalId, fileName }: VideoPlayerProps) {
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadPlaybackUrl() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `/api/rehearsals/${rehearsalId}/video/playback-url`,
          { method: "GET" }
        );

        const data = (await response.json()) as PlaybackResponse;

        if (!data.ok) {
          throw new Error(data.error.message);
        }

        // Optional extra safety in case a non-conforming response slips through
        if (!response.ok) {
          throw new Error("Failed to load playback URL.");
        }

        if (!isMounted) return;

        setPlaybackUrl(data.data.playbackUrl);
      } catch (err) {
        if (!isMounted) return;

        setError(
          err instanceof Error ? err.message : "Failed to load video playback."
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadPlaybackUrl();

    return () => {
      isMounted = false;
    };
  }, [rehearsalId]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Loading video...</CardTitle>
          <CardDescription>Preparing secure playback.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Unable to load video</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!playbackUrl) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">No playback URL available</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{fileName}</CardTitle>
        <CardDescription>Uploaded rehearsal video</CardDescription>
      </CardHeader>
      <CardContent>
        <video
          controls
          preload="metadata"
          className="w-full rounded-md border bg-black"
          src={playbackUrl}
        >
          Your browser does not support video playback.
        </video>
      </CardContent>
    </Card>
  );
}