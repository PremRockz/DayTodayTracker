import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { GOOGLE_WEB_CLIENT_ID } from '../config/googleAuthConfig';

let configured = false;

const ensureConfigured = () => {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: true,
    scopes: ['https://www.googleapis.com/auth/drive.appdata'],
  });
  configured = true;
};

export interface GoogleAuthUser {
  email: string;
  name: string | null;
  photo: string | null;
  idToken: string | null;
}

export type GoogleSignInResult =
  | { status: 'success'; user: GoogleAuthUser }
  | { status: 'cancelled' };

export const signInWithGoogle = async (): Promise<GoogleSignInResult> => {
  ensureConfigured();

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();

  console.log('Google sign-in response:', response);
  
  if (!isSuccessResponse(response)) {
    return { status: 'cancelled' };
  }

  const { user } = response.data;
  return {
    status: 'success',
    user: {
      email: user.email,
      name: user.name,
      photo: user.photo,
      idToken: response.data.idToken,
    },
  };
};

export const signOutFromGoogle = async (): Promise<void> => {
  await GoogleSignin.signOut();
};

export const describeGoogleSignInError = (error: unknown): string => {
  if (isErrorWithCode(error)) {
    switch (error.code) {
      case statusCodes.SIGN_IN_CANCELLED:
        return 'Sign in was cancelled';
      case statusCodes.IN_PROGRESS:
        return 'Sign in is already in progress';
      case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
        return 'Google Play Services is not available on this device';
      default:
        return 'Google sign-in failed. Please try again';
    }
  }
  return 'Google sign-in failed. Please try again';
};
