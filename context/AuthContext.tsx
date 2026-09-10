import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus, Alert, Platform, BackHandler } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import { FinanceService } from '../services/FinanceService';

interface AuthContextType {
  isLocked: boolean;
  isLoggedIn: boolean;
  authChecked: boolean;
  lockApp: () => void;
  unlockApp: () => Promise<boolean>;
  exitSession: () => void;
  exitApp: () => void;
  loginUser: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isLocked: false,
  isLoggedIn: true,
  authChecked: false,
  lockApp: () => {},
  unlockApp: async () => false,
  exitSession: () => {},
  exitApp: () => {},
  loginUser: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const [isLocked, setIsLocked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const appState = useRef(AppState.currentState);
  const isAuthenticating = useRef(false);

  const checkInitialAuth = useCallback(async () => {
    try {
      const status = FinanceService.getSessionStatus();
      setIsLoggedIn(status.isLoggedIn);

      const profile = FinanceService.getUserProfile();
      if (profile.biometrics_enabled === 1 && status.isLoggedIn) {
        // Enforce lock state immediately
        setIsLocked(true);

        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (hasHardware && isEnrolled) {
          // Delay briefly to allow Android Activity to settle and gain window focus
          await new Promise((resolve) => setTimeout(resolve, 300));

          if (!isAuthenticating.current) {
            isAuthenticating.current = true;
            try {
              const res = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Authenticate to open SPENT',
                fallbackLabel: 'Use Passcode',
              });
              if (res.success) {
                setIsLocked(false);
              } else {
                // Keep locked on cancellation or failure
                setIsLocked(true);
              }
            } catch (authErr) {
              console.warn('Initial biometric prompt error:', authErr);
              // CRITICAL: keep locked on error (e.g. temporary focus loss), do NOT unlock
              setIsLocked(true);
            } finally {
              setTimeout(() => {
                isAuthenticating.current = false;
              }, 400);
            }
          }
        } else {
          // Device does not support or have enrolled biometrics
          setIsLocked(false);
        }
      } else {
        setIsLocked(false);
      }
    } catch (e) {
      console.warn('checkInitialAuth exception:', e);
      setIsLocked(false);
    } finally {
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    checkInitialAuth();
  }, [checkInitialAuth]);

  // Listen to AppState transitions (background -> active re-lock)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      // Avoid triggering when the transition was caused by the system biometric modal itself
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        !isAuthenticating.current
      ) {
        try {
          const profile = FinanceService.getUserProfile();
          const status = FinanceService.getSessionStatus();
          if (profile.biometrics_enabled === 1 && status.isLoggedIn) {
            setIsLocked(true);
            isAuthenticating.current = true;
            try {
              const res = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Authenticate to resume SPENT',
                fallbackLabel: 'Use Passcode',
              });
              if (res.success) {
                setIsLocked(false);
              } else {
                setIsLocked(true);
              }
            } catch {
              setIsLocked(true);
            } finally {
              setTimeout(() => {
                isAuthenticating.current = false;
              }, 400);
            }
          }
        } catch {
          // Keep current lock state
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const lockApp = useCallback(() => {
    setIsLocked(true);
  }, []);

  const unlockApp = useCallback(async (): Promise<boolean> => {
    if (isAuthenticating.current) return false;
    isAuthenticating.current = true;
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHardware && isEnrolled) {
        const res = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to unlock SPENT',
          fallbackLabel: 'Use Passcode',
        });
        if (res.success) {
          setIsLocked(false);
          return true;
        }
        return false;
      }
      setIsLocked(false);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => {
        isAuthenticating.current = false;
      }, 400);
    }
  }, []);

  const loginUser = useCallback(() => {
    FinanceService.startUserSession();
    setIsLoggedIn(true);
    setIsLocked(false);
  }, []);

  const exitApp = useCallback(() => {
    if (Platform.OS === 'android') {
      BackHandler.exitApp();
    }
  }, []);

  const exitSession = useCallback(() => {
    const profile = FinanceService.getUserProfile();
    const buttons: any[] = [
      { text: 'Cancel', style: 'cancel' },
    ];

    if (profile.biometrics_enabled === 1) {
      buttons.push({
        text: 'Lock App',
        style: 'default',
        onPress: () => {
          setIsLocked(true);
        },
      });
    }

    if (Platform.OS === 'android') {
      buttons.push({
        text: 'Exit App',
        style: 'default',
        onPress: () => {
          FinanceService.terminateUserSession();
          setIsLoggedIn(false);
          BackHandler.exitApp();
        },
      });
    }

    buttons.push({
      text: 'Log Out',
      style: 'destructive',
      onPress: () => {
        FinanceService.terminateUserSession();
        setIsLoggedIn(false);
        setIsLocked(false);
        router.replace('/');
      },
    });

    Alert.alert(
      'Session & App Control',
      Platform.OS === 'android'
        ? 'Choose an action: Lock the app immediately, exit the application, or log out of your session.'
        : 'Choose an action: Lock the app immediately or log out of your session.',
      buttons
    );
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        isLocked,
        isLoggedIn,
        authChecked,
        lockApp,
        unlockApp,
        exitSession,
        exitApp,
        loginUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
