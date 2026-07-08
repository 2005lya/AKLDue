import {
  useSignIn,
  useSignUp,
  useSSO,
} from '@clerk/expo';

import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const { signIn } = useSignIn();

  const { signUp } = useSignUp();

  const { startSSOFlow } = useSSO();


  const [mode, setMode] =
    useState<'signIn' | 'signUp'>('signIn');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] =
    useState('');
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] =
    useState(false);
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [isForgotPassword, setIsForgotPassword] =
  useState(false);

  const [resetStep, setResetStep] =
  useState<'email' | 'code' | 'password'>('email');

const [resetCode, setResetCode] = useState('');
const [newPassword, setNewPassword] = useState('');
const [confirmNewPassword, setConfirmNewPassword] =
  useState('');

  async function finishSignUp() {
  await signUp.finalize({
    navigate: () => {
      // RootNavigator will switch automatically.
    },
  });
}

async function finishSignIn() {
  await signIn.finalize({
    navigate: () => {
      // RootNavigator will switch automatically.
    },
  });
}


async function handleGoogleSignIn() {
  try {
    setIsSubmitting(true);

    const { createdSessionId, setActive } =
      await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri({
          scheme: 'aklduelearning',
          path: 'auth',
        }),
      });

    if (createdSessionId) {
      await setActive?.({
        session: createdSessionId,
      });
    }
  } catch (error) {
    console.error('Google sign in failed:', error);

    Alert.alert(
      'Google sign in failed',
      'Please try again.'
    );
  } finally {
    setIsSubmitting(false);
  }
}

async function handleSendResetCode() {
  const normalizedEmail =
    email.trim().toLowerCase();

  if (!normalizedEmail) {
   Alert.alert(
    'Enter your email',
    'We need your email to reset the password.'
  );
    return;
  }
  try {
    setIsSubmitting(true);

    const { error: createError } =
      await signIn.create({
        identifier: normalizedEmail,
      });

    if (createError) {
      console.error(createError);

      Alert.alert(
        'Could not reset password',
        'Check your email and try again.'
      );
      return;
    }

    const { error: sendCodeError } =
      await signIn.resetPasswordEmailCode.sendCode();

    if (sendCodeError) {
      console.error(sendCodeError);

      Alert.alert(
        'Could not send code',
        'Please try again.'
      );
      return;
    }

    setResetStep('code');

    Alert.alert(
      'Code sent',
      `Check ${normalizedEmail} for your reset code.`
    );
  } catch (error) {
    console.error('Sending reset code failed:', error);

    Alert.alert(
      'Could not send code',
      'Please try again.'
    );
  } finally {
    setIsSubmitting(false);
  }
}

async function handleVerifyResetCode() {
  if (!resetCode.trim()) {
    Alert.alert('Enter code', 'Enter the code from your email.');
    return;
  }

  try {
    setIsSubmitting(true);

    const { error } =
      await signIn.resetPasswordEmailCode.verifyCode({
        code: resetCode.trim(),
      });

    if (error) {
      console.error(error);
      Alert.alert('Invalid code', 'Check the code and try again.');
      return;
    }

    setResetStep('password');
  } catch (error) {
    console.error(error);
    Alert.alert('Invalid code', 'Check the code and try again.');
  } finally {
    setIsSubmitting(false);
  }
}

async function handleSetNewPassword() {
  if (!newPassword) {
    Alert.alert('Enter password', 'Enter your new password.');
    return;
  }

  if (newPassword !== confirmNewPassword) {
    Alert.alert(
      'Passwords do not match',
      'Enter the same password twice.'
    );
    return;
  }

  try {
    setIsSubmitting(true);

    const { error } =
      await signIn.resetPasswordEmailCode.submitPassword({
        password: newPassword,
        signOutOfOtherSessions: true,
      });

    if (error) {
      console.error(error);
      Alert.alert(
        'Could not reset password',
        'Use a stronger password and try again.'
      );
      return;
    }

    if (signIn.status === 'complete') {
      await finishSignIn();
    }
  } catch (error) {
    console.error(error);
    Alert.alert(
      'Could not reset password',
      'Please try again.'
    );
  } finally {
    setIsSubmitting(false);
  }
}

  async function handleSubmit() {
    const normalizedEmail =
      email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      Alert.alert(
        'Missing details',
        'Enter your email and password.'
      );
      return;
    }

    if (
      mode === 'signUp' &&
      password !== confirmPassword
    ) {
      Alert.alert(
        'Passwords do not match',
        'Enter the same password twice.'
      );
      return;
    }

    try {
      setIsSubmitting(true);

      if (mode === 'signIn') {
        const { error } = await signIn.password({
          emailAddress: normalizedEmail,
          password,
        });

        if (error) {
          console.error(error);
          Alert.alert(
            'Sign in failed',
            'Check your email and password.'
          );
          return;
        }

        if (signIn.status === 'complete') {
          await finishSignIn();
        }

        return;
      }

      const { error } = await signUp.password({
        emailAddress: normalizedEmail,
        password,
      });

      if (error) {
        console.error(error);
        Alert.alert(
          'Could not create account',
          'Check your details or try another email.'
        );
        return;
      }

      await signUp.verifications.sendEmailCode();
      setIsVerifying(true);
    } catch (error) {
      console.error(error);

      Alert.alert(
        'Authentication failed',
        'Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerify() {
    if (code.trim().length === 0) {
      Alert.alert(
        'Enter verification code',
        'Check your email for the code.'
      );
      return;
    }

    try {
      setIsSubmitting(true);

      await signUp.verifications.verifyEmailCode({
        code: code.trim(),
      });

      if (signUp.status === 'complete') {
        await finishSignUp();
      } else {
        Alert.alert(
          'Verification incomplete',
          'Please check the code and try again.'
        );
      }
    } catch (error) {
      console.error(error);

      Alert.alert(
        'Invalid code',
        'Check the code and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isForgotPassword) {
  const isEmailStep = resetStep === 'email';
  const isCodeStep = resetStep === 'code';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.appName}>
          {isEmailStep
            ? 'Reset password'
            : isCodeStep
              ? 'Verify code'
              : 'New password'}
        </Text>

        <Text style={styles.subtitle}>
          {isEmailStep
            ? 'Enter your email to receive a reset code.'
            : isCodeStep
              ? `Enter the code sent to ${email.trim()}.`
              : 'Choose a new password for your account.'}
        </Text>

        {isEmailStep && (
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Email"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
          />
        )}

        {isCodeStep && (
          <TextInput
            autoFocus
            keyboardType="number-pad"
            placeholder="Reset code"
            style={styles.input}
            value={resetCode}
            onChangeText={setResetCode}
          />
        )}

        {resetStep === 'password' && (
          <>
            <TextInput
              autoFocus
              placeholder="New password"
              secureTextEntry
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
            />

            <TextInput
              placeholder="Confirm new password"
              secureTextEntry
              style={styles.input}
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
            />
          </>
        )}

        <Pressable
          disabled={isSubmitting}
          onPress={
            isEmailStep
              ? handleSendResetCode
              : isCodeStep
                ? handleVerifyResetCode
                : handleSetNewPassword
          }
          style={styles.submitButton}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitText}>
              {isEmailStep
                ? 'Send reset code'
                : isCodeStep
                  ? 'Verify code'
                  : 'Set new password'}
            </Text>
          )}
        </Pressable>

        <Pressable
          disabled={isSubmitting}
          onPress={() => {
            setResetStep('email');
            setResetCode('');
            setNewPassword('');
            setConfirmNewPassword('');
            setIsForgotPassword(false);
          }}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryText}>
            Back to sign in
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

  if (isVerifying) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.appName}>Verify email</Text>

          <Text style={styles.subtitle}>
            Enter the code sent to {email.trim()}.
          </Text>

          <TextInput
            autoFocus
            keyboardType="number-pad"
            maxLength={6}
            placeholder="Verification code"
            style={styles.input}
            value={code}
            onChangeText={setCode}
          />

          <Pressable
            disabled={isSubmitting}
            onPress={handleVerify}
            style={styles.submitButton}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitText}>
                Verify
              </Text>
            )}
          </Pressable>

          <Pressable
            disabled={isSubmitting}
            onPress={() =>
              signUp.verifications.sendEmailCode()
            }
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryText}>
              Send a new code
            </Text>
          </Pressable>

          <Pressable
            disabled={isSubmitting}
            onPress={() => {
              setCode('');
              setIsVerifying(false);
            }}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryText}>
              Change email
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.appName}>AKLDue</Text>

        <Text style={styles.subtitle}>
          Never miss an Auckland due date.
        </Text>

        <View style={styles.modeControl}>
          <Pressable
            onPress={() => setMode('signIn')}
            style={[
              styles.mode,
              mode === 'signIn' &&
                styles.modeSelected,
            ]}
          >
            <Text
              style={
                mode === 'signIn'
                  ? styles.selectedText
                  : styles.modeText
              }
            >
              Sign in
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setMode('signUp')}
            style={[
              styles.mode,
              mode === 'signUp' &&
                styles.modeSelected,
            ]}
          >
            <Text
              style={
                mode === 'signUp'
                  ? styles.selectedText
                  : styles.modeText
              }
            >
              Create account
            </Text>
          </Pressable>
        </View>

        <Pressable
  disabled={isSubmitting}
  onPress={handleGoogleSignIn}
  style={styles.googleButton}
>
  <Text style={styles.googleButtonText}>
    Continue with Google
  </Text>
</Pressable>

<View style={styles.divider}>
  <View style={styles.dividerLine} />
  <Text style={styles.dividerText}>or</Text>
  <View style={styles.dividerLine} />
</View>

        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="Email"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          autoCapitalize="none"
          autoComplete={
            mode === 'signIn'
              ? 'current-password'
              : 'new-password'
          }
          placeholder="Password"
          secureTextEntry
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />

        {mode === 'signIn' && (
  <Pressable
    onPress={() => setIsForgotPassword(true)}
    style={styles.forgotButton}
  >
    <Text style={styles.forgotText}>
      Forgot password?
    </Text>
  </Pressable>
)}

        {mode === 'signUp' && (
          <TextInput
            autoCapitalize="none"
            autoComplete="new-password"
            placeholder="Confirm password"
            secureTextEntry
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        )}

        <Pressable
          disabled={isSubmitting}
          onPress={handleSubmit}
          style={styles.submitButton}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitText}>
              {mode === 'signIn'
                ? 'Sign in'
                : 'Create account'}
            </Text>
          )}
        </Pressable>

        {mode === 'signUp' && (
          <View nativeID="clerk-captcha" />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  appName: {
    fontSize: 34,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 28,
    fontSize: 16,
    color: '#64748b',
  },
  modeControl: {
    flexDirection: 'row',
    marginBottom: 20,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
  },
  mode: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeSelected: {
    backgroundColor: '#0f172a',
  },
  modeText: {
    color: '#475569',
    fontWeight: '600',
  },
  selectedText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  input: {
    minHeight: 50,
    marginBottom: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#dbe1e8',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    fontSize: 16,
  },
  submitButton: {
    minHeight: 50,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#0f172a',
  },
  submitText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: '#475569',
    fontWeight: '600',
  },
  googleButton: {
  minHeight: 50,
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: 1,
  borderColor: '#dbe1e8',
  borderRadius: 8,
  backgroundColor: '#ffffff',
},
googleButtonText: {
  color: '#0f172a',
  fontSize: 16,
  fontWeight: '600',
},
divider: {
  flexDirection: 'row',
  alignItems: 'center',
  marginVertical: 20,
},
dividerLine: {
  flex: 1,
  height: 1,
  backgroundColor: '#dbe1e8',
},
dividerText: {
  marginHorizontal: 12,
  color: '#64748b',
},
forgotButton: {
  alignSelf: 'flex-end',
  marginBottom: 8,
  paddingVertical: 4,
},
forgotText: {
  color: '#475569',
  fontWeight: '600',
},
});