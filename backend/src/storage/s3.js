const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Short-lived, so a copied link stops working soon after; the app asks for a fresh one each view.
const SIGNED_URL_SECONDS = 300;

function createS3Storage({ region, bucket, accessKeyId, secretAccessKey }) {
  const client = new S3Client({
    region,
    ...(accessKeyId && secretAccessKey && { credentials: { accessKeyId, secretAccessKey } }),
  });

  return {
    driver: 's3',
    async put(key, body, contentType) {
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType, CacheControl: 'private, max-age=31536000, immutable' })
      );
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
    /** A pre-signed GET link, or null if the object doesn't exist. */
    async signedUrl(key) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      } catch (err) {
        if (err.$metadata?.httpStatusCode === 404 || err.name === 'NotFound') return null;
        throw err;
      }
      return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: SIGNED_URL_SECONDS });
    },
  };
}

module.exports = { createS3Storage };
