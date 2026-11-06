import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { storage } from './firebase';

/**
 * Uploads an image file to the specified storage path and returns its public download URL.
 *
 * @param file The File object to upload
 * @param path The target path inside Firebase Storage
 * @returns Download URL string
 */
export async function uploadImage(file: File, path: string): Promise<string> {
  const storageRef = ref(storage, path);
  const metadata = {
    contentType: file.type,
  };

  await uploadBytes(storageRef, file, metadata);
  const downloadUrl = await getDownloadURL(storageRef);
  return downloadUrl;
}

/**
 * Uploads a job-related image (e.g. proof of problem, photo of task).
 *
 * @param jobId The associated Job ID
 * @param file The image File to upload
 * @returns Download URL string
 */
export async function uploadJobImage(jobId: string, file: File): Promise<string> {
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `jobs/${jobId}/${timestamp}_${sanitizedName}`;
  return uploadImage(file, path);
}

/**
 * Uploads a user profile avatar image.
 *
 * @param uid The user ID
 * @param file The avatar File to upload
 * @returns Download URL string
 */
export async function uploadProfileImage(uid: string, file: File): Promise<string> {
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `users/${uid}/avatar_${timestamp}_${sanitizedName}`;
  return uploadImage(file, path);
}

/**
 * Deletes an image from Firebase Storage given its download URL or storage path.
 *
 * @param url Full download URL or storage path
 */
export async function deleteImage(url: string): Promise<void> {
  if (!url) return;

  try {
    const storageRef = ref(storage, url);
    await deleteObject(storageRef);
  } catch (error) {
    console.error(`Failed to delete image at "${url}":`, error);
    throw error;
  }
}
