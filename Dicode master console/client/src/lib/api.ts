import axios from 'axios';
import { auth } from './firebase';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-6easthj3va-uc.a.run.app';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// Add request interceptor to automatically include Firebase Auth token
apiClient.interceptors.request.use(
  async (config) => {
    // Get the current user's ID token
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }

    // IMPORTANT: For FormData, we must NOT set Content-Type header
    // Axios needs to set it automatically with the proper boundary
    if (config.data instanceof FormData) {
      // Delete Content-Type if it was set, let axios handle it
      delete config.headers['Content-Type'];

      // Debug: Log FormData details
      console.log('🔧 Interceptor - FormData detected');
      console.log('🔧 Headers:', { ...config.headers });
      const entries: any[] = [];
      for (const [key, value] of (config.data as FormData).entries()) {
        entries.push({ key, value: value instanceof File ? `File(${value.name}, ${value.size} bytes)` : value });
      }
      console.log('🔧 FormData entries in interceptor:', entries);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export async function checkApiKey(): Promise<{ configured: boolean }> {
  const response = await apiClient.get('/check-key');
  return response.data;
}

export async function generateVideo(data: FormData) {
  // Use native fetch instead of axios for FormData
  // Axios has issues serializing FormData in browser environments

  console.log('🌐 Sending request to /generate with native fetch');
  console.log('🌐 FormData instance:', data instanceof FormData);

  // Get auth token manually
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  const token = await user.getIdToken();

  // Use fetch API which properly handles FormData
  const response = await fetch(`${API_BASE_URL}/generate-video`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      // Don't set Content-Type - let browser set it with proper boundary
    },
    body: data,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function remixVideo(data: any) {
  const response = await apiClient.post('/remix-video', data, {
    headers: { 'Content-Type': 'application/json' }
  });
  return response.data;
}

export async function getGenerationResult(taskId: string) {
  const response = await apiClient.get(`/generate-result/${taskId}`);
  return response.data;
}

export function getProgressStream(taskId: string): EventSource {
  return new EventSource(`${API_BASE_URL}/progress/${taskId}`);
}

export function getDownloadUrl(sequenceId: string, shotNumber: number): string {
  return `${API_BASE_URL}/download/${sequenceId}/${shotNumber}`;
}

export async function stitchSequence(sequenceId: string) {
  const response = await apiClient.post(`/stitch/${sequenceId}`);
  return response.data;
}
