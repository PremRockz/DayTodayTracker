import { GoogleSignin } from '@react-native-google-signin/google-signin';

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const MULTIPART_BOUNDARY = 'homebook-drive-sync';

const getAccessToken = async (): Promise<string> => {
  const { accessToken } = await GoogleSignin.getTokens();
  return accessToken;
};

const authHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

const describeErrorResponse = async (response: Response): Promise<string> => {
  const body = await response.text();
  return `${response.status}: ${body}`;
};

const findFileId = async (accessToken: string, fileName: string): Promise<string | null> => {
  const query = encodeURIComponent(`name = '${fileName}' and trashed = false`);
  const url = `${DRIVE_FILES_URL}?spaces=appDataFolder&q=${query}&fields=files(id)`;
  const response = await fetch(url, { headers: authHeader(accessToken) });

  if (!response.ok) {
    throw new Error(`Drive file lookup failed: ${await describeErrorResponse(response)}`);
  }

  const { files } = await response.json();
  return files && files.length > 0 ? files[0].id : null;
};

export const uploadAppDataFile = async (fileName: string, data: unknown): Promise<void> => {
  const accessToken = await getAccessToken();
  const existingFileId = await findFileId(accessToken, fileName);

  const metadata = existingFileId ? {} : { name: fileName, parents: ['appDataFolder'] };
  const body =
    `--${MULTIPART_BOUNDARY}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${MULTIPART_BOUNDARY}\r\n` +
    'Content-Type: application/json\r\n\r\n' +
    `${JSON.stringify(data)}\r\n` +
    `--${MULTIPART_BOUNDARY}--`;

  const url = existingFileId
    ? `${DRIVE_UPLOAD_URL}/${existingFileId}?uploadType=multipart`
    : `${DRIVE_UPLOAD_URL}?uploadType=multipart`;

  const response = await fetch(url, {
    method: existingFileId ? 'PATCH' : 'POST',
    headers: {
      ...authHeader(accessToken),
      'Content-Type': `multipart/related; boundary=${MULTIPART_BOUNDARY}`,
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Drive upload failed: ${await describeErrorResponse(response)}`);
  } else {
    console.log(`Drive upload succeeded: ${fileName}`,url,
      existingFileId ? 'PATCH' : 'POST',
      {
      ...authHeader(accessToken),
      'Content-Type': `multipart/related; boundary=${MULTIPART_BOUNDARY}`,
    },
    body,
    response
     );
     const data = await response.json();
      console.log('drive payload', data);
  }
};

export const downloadAppDataFile = async <T>(fileName: string): Promise<T | null> => {
  const accessToken = await getAccessToken();
  const fileId = await findFileId(accessToken, fileName);
  if (!fileId) return null;

  const response = await fetch(`${DRIVE_FILES_URL}/${fileId}?alt=media`, {
    headers: authHeader(accessToken),
  });

  if (!response.ok) {
    throw new Error(`Drive download failed: ${response.status}`);
  } else {
    console.log(`Drive download succeeded: ${fileName}`, `${DRIVE_FILES_URL}/${fileId}?alt=media`, {
      headers: authHeader(accessToken),
    },response);
  }

  return response.json();
};
