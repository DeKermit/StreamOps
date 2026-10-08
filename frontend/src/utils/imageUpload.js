// utils/imageUpload.js
// Images are stored as plain base64 data-URL strings in SQLite TEXT columns
// (there's no multer/multipart upload middleware in this app), so this just
// reads a <input type="file"> selection into that format in the browser,
// with a size cap to keep requests (and the DB) reasonable.
const MAX_BYTES = 2 * 1024 * 1024; // 2MB, comfortably under the 8mb JSON body limit

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file.'));
      return;
    }
    if (file.size > MAX_BYTES) {
      reject(new Error('Image is too large - please use one under 2MB.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}
