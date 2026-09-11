// IHA fork: storage providers such as Cloudflare R2 accept uploads on one host
// (the S3 API endpoint, which requires signed requests) but serve files
// publicly from another (a custom domain). next-s3-upload composes the URL
// from the API endpoint, so swap in the public base when one is configured.
// Object keys are flat (see /api/s3-upload), so the last path segment is the key.
export const publicUploadBase = process.env.NEXT_PUBLIC_S3_PUBLIC_URL?.replace(
  /\/$/,
  '',
)

export function toPublicUploadUrl(url: string): string {
  if (!publicUploadBase) return url
  const key = url.split('/').pop()
  return key ? `${publicUploadBase}/${key}` : url
}
