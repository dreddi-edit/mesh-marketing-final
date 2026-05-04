import { list } from '@vercel/blob';

const TARGET_PATHNAME = 'ide/macos/Mesh.dmg';
const blobToken =
  process.env.IDE_BLOB_READ_WRITE_TOKEN ||
  process.env.BLOB_READ_WRITE_TOKEN2 ||
  process.env.BLOB_READ_WRITE_TOKEN;

export default async function handler(req, res) {
  try {
    const { blobs } = await list({
      prefix: TARGET_PATHNAME,
      limit: 50,
      token: blobToken
    });

    const exactMatches = blobs.filter((blob) => blob.pathname === TARGET_PATHNAME);
    if (exactMatches.length === 0) {
      res.setHeader('Cache-Control', 'no-store');
      return res.redirect(302, '/docs#ide-launch');
    }

    // If multiple versions exist with same pathname, prefer the freshest upload.
    exactMatches.sort((a, b) => {
      const aTime = new Date(a.uploadedAt).getTime();
      const bTime = new Date(b.uploadedAt).getTime();
      return bTime - aTime;
    });

    const target = exactMatches[0].url;
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, target);
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, '/docs#ide-launch');
  }
}
