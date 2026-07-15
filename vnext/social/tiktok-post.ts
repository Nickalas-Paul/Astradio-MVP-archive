import { getValidAccessToken } from './tiktok-token-store';

type TikTokApiError = {
  code?: string;
  message?: string;
};

type InitResponseData = {
  publish_id?: string;
  upload_url?: string;
};

type InitResponse = {
  data?: InitResponseData;
  error?: TikTokApiError;
};

export async function postVideoToTikTok(
  videoBuffer: Buffer,
  title: string,
): Promise<{ publish_id: string }> {
  const accessToken = await getValidAccessToken();
  const videoSize = videoBuffer.length;

  const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      post_info: {
        title,
        privacy_level: 'SELF_ONLY',
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: videoSize,
        chunk_size: videoSize,
        total_chunk_count: 1,
      },
    }),
  });

  const initJson = (await initRes.json().catch(() => ({}))) as InitResponse;
  const initError = initJson.error;
  const initData = initJson.data;

  if (!initRes.ok || !initData?.publish_id || !initData?.upload_url) {
    const msg =
      initError?.message ||
      initError?.code ||
      `TikTok video init failed (${initRes.status})`;
    throw new Error(msg);
  }

  const uploadRes = await fetch(initData.upload_url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
    },
    body: new Uint8Array(videoBuffer),
  });

  if (!uploadRes.ok) {
    const uploadText = await uploadRes.text().catch(() => '');
    throw new Error(
      `TikTok video upload failed (${uploadRes.status})${uploadText ? `: ${uploadText.slice(0, 200)}` : ''}`,
    );
  }

  return { publish_id: initData.publish_id };
}
