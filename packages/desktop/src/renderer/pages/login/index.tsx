import loginLogo from '@renderer/assets/logos/brand/app.png';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '@/renderer/services/i18n';
import { useNavigate } from 'react-router-dom';
import AppLoader from '@renderer/components/layout/AppLoader';
import { useAuth } from '../../hooks/context/AuthContext';
import './LoginPage.css';

type MessageState = {
  type: 'error' | 'success';
  text: string;
};

type Mode = 'login' | 'register';

const OAUTH_PROVIDERS = [
  { slug: 'google', label: 'Google' },
  { slug: 'microsoft', label: 'Microsoft' },
];

const GoogleIcon = () => (
  <svg viewBox='0 0 24 24' aria-hidden='true' width='18' height='18'>
    <path
      fill='#EA4335'
      d='M12 10.2v3.9h5.4c-.2 1.2-.9 2.2-1.9 2.9l3 2.3c1.8-1.6 2.8-4 2.8-6.8 0-.7-.1-1.4-.2-2.1H12Z'
    />
    <path
      fill='#34A853'
      d='M12 21c2.7 0 4.9-.9 6.6-2.4l-3-2.3c-.8.5-1.9.9-3.6.9-2.7 0-4.9-1.8-5.7-4.2l-3.1 2.4C4.9 18.7 8.1 21 12 21Z'
    />
    <path
      fill='#4A90E2'
      d='M6.3 13c-.2-.5-.3-1-.3-1.6s.1-1.1.3-1.6L3.2 7.4C2.4 8.9 2 10.4 2 12s.4 3.1 1.2 4.6L6.3 13Z'
    />
    <path
      fill='#FBBC05'
      d='M12 6.8c1.5 0 2.8.5 3.8 1.5l2.8-2.8C16.9 3.9 14.7 3 12 3 8.1 3 4.9 5.3 3.2 8.6L6.3 11c.8-2.4 3-4.2 5.7-4.2Z'
    />
  </svg>
);

const MicrosoftIcon = () => (
  <svg viewBox='0 0 24 24' aria-hidden='true' width='18' height='18'>
    <path fill='#F25022' d='M3 3h8.5v8.5H3z' />
    <path fill='#7FBA00' d='M12.5 3H21v8.5h-8.5z' />
    <path fill='#00A4EF' d='M3 12.5h8.5V21H3z' />
    <path fill='#FFB900' d='M12.5 12.5H21V21h-8.5z' />
  </svg>
);

const OAuthIcon = ({ slug }: { slug: string }) => {
  if (slug === 'google') return <GoogleIcon />;
  if (slug === 'microsoft') return <MicrosoftIcon />;
  return null;
};

const LoginPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { status, login, loginWithOAuthToken, register, verifyMfa } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [message, setMessage] = useState<MessageState | null>(null);
  const [loading, setLoading] = useState(false);
  const [mfaState, setMfaState] = useState<{ required: boolean; challengeToken?: string }>({ required: false });
  const [mfaCode, setMfaCode] = useState('');

  const usernameRef = useRef<HTMLInputElement | null>(null);
  const messageTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    document.body.classList.add('login-page-active');
    return () => {
      document.body.classList.remove('login-page-active');
      if (messageTimer.current) window.clearTimeout(messageTimer.current);
    };
  }, []);

  useEffect(() => {
    document.title = t('login.pageTitle');
  }, [t]);

  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  useEffect(() => {
    const loadSaved = async () => {
      const result = await window.electronAPI?.loadCredentials?.();
      if (result?.success && result.credentials) {
        setUsername(result.credentials.username);
        setPassword(result.credentials.password);
        setRememberMe(true);
      }
      window.setTimeout(() => usernameRef.current?.focus(), 0);
    };
    void loadSaved();
    return () => {
      if (messageTimer.current) window.clearTimeout(messageTimer.current);
    };
  }, []);

  useEffect(() => {
    if (status === 'authenticated') void navigate('/guid', { replace: true });
  }, [navigate, status]);

  const clearMessageLater = useCallback(() => {
    if (messageTimer.current) window.clearTimeout(messageTimer.current);
    messageTimer.current = window.setTimeout(() => {
      setMessage((prev) => (prev?.type === 'success' ? prev : null));
    }, 5000);
  }, []);

  const showMessage = useCallback(
    (next: MessageState) => {
      setMessage(next);
      if (next.type === 'error') clearMessageLater();
    },
    [clearMessageLater]
  );

  const supportedLanguages = useMemo<{ code: string; label: string }[]>(
    () => [
      { code: 'zh-CN', label: '简体中文' },
      { code: 'zh-TW', label: '繁體中文' },
      { code: 'ja-JP', label: '日本語' },
      { code: 'ko-KR', label: '한국어' },
      { code: 'tr-TR', label: 'Türkçe' },
      { code: 'uk-UA', label: 'Українська' },
      { code: 'en-US', label: 'English' },
    ],
    []
  );

  const handleLanguageChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    changeLanguage(event.target.value).catch((error: Error) => console.error('Failed to change language:', error));
  }, []);

  const handleLoginSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const trimmedUsername = username.trim();
      if (!trimmedUsername || !password) {
        showMessage({ type: 'error', text: t('login.errors.empty') });
        return;
      }
      setLoading(true);
      setMessage(null);
      const result = await login({ username: trimmedUsername, password, remember: rememberMe });
      if (result.success) {
        if (rememberMe) void window.electronAPI?.saveCredentials?.({ username: trimmedUsername, password });
        else void window.electronAPI?.clearCredentials?.();
        showMessage({ type: 'success', text: t('login.success') });
        window.setTimeout((): void => void navigate('/guid', { replace: true }), 600);
      } else if (result.mfaRequired && result.mfaChallengeToken) {
        setMfaState({ required: true, challengeToken: result.mfaChallengeToken });
        showMessage({ type: 'error', text: result.message ?? 'Enter your MFA code.' });
      } else {
        const errorText = (() => {
          switch (result.code) {
            case 'invalidCredentials':
              return t('login.errors.invalidCredentials');
            case 'tooManyAttempts':
              return t('login.errors.tooManyAttempts');
            case 'networkError':
              return t('login.errors.networkError');
            case 'serverError':
              return t('login.errors.serverError');
            default:
              return result.message ?? t('login.errors.unknown');
          }
        })();
        showMessage({ type: 'error', text: errorText });
      }
      setLoading(false);
    },
    [login, navigate, password, rememberMe, showMessage, t, username]
  );

  const handleRegisterSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (password !== confirmPassword) {
        showMessage({ type: 'error', text: 'Passwords do not match.' });
        return;
      }
      setLoading(true);
      setMessage(null);
      const result = await register({ username: username.trim(), password, email: email.trim() || undefined });
      if (result.success) {
        showMessage({ type: 'success', text: result.message });
        window.setTimeout((): void => setMode('login'), 3000);
      } else {
        showMessage({ type: 'error', text: result.message });
      }
      setLoading(false);
    },
    [confirmPassword, email, password, register, showMessage, username]
  );

  const handleOAuthLogin = useCallback(
    async (provider: string) => {
      setLoading(true);
      setMessage(null);
      try {
        const result = await window.electronAPI?.triggerOAuthLogin?.(provider);
        if (result?.success && result.token) {
          const loginResult = await loginWithOAuthToken(result.token);
          if (loginResult.success) {
            showMessage({ type: 'success', text: t('login.success') });
            window.setTimeout((): void => void navigate('/guid', { replace: true }), 600);
          } else {
            showMessage({ type: 'error', text: loginResult.message ?? 'OAuth login failed.' });
          }
        } else if (result?.error && result.error !== 'Window closed by user') {
          showMessage({ type: 'error', text: result.error });
        }
      } catch {
        showMessage({ type: 'error', text: 'OAuth login failed.' });
      }
      setLoading(false);
    },
    [loginWithOAuthToken, navigate, showMessage, t]
  );

  const handleMfaSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!mfaState.challengeToken) return;
      const trimmedCode = mfaCode.trim();
      if (!trimmedCode) {
        showMessage({ type: 'error', text: 'Please enter your MFA code.' });
        return;
      }
      setLoading(true);
      setMessage(null);
      const result = await verifyMfa({
        mfaChallengeToken: mfaState.challengeToken,
        code: trimmedCode,
        remember: rememberMe,
      });
      if (result.success) {
        showMessage({ type: 'success', text: t('login.success') });
        window.setTimeout((): void => void navigate('/guid', { replace: true }), 600);
      } else {
        showMessage({ type: 'error', text: result.message ?? 'Invalid MFA code.' });
      }
      setLoading(false);
    },
    [mfaCode, mfaState, navigate, rememberMe, showMessage, t, verifyMfa]
  );

  if (status === 'checking') return <AppLoader />;

  return (
    <div className='login-page'>
      <div className='login-page__card'>
        <label className='login-page__lang-select-wrapper' htmlFor='lang-select'>
          <select
            id='lang-select'
            className='login-page__lang-select'
            value={i18n.language}
            onChange={handleLanguageChange}
          >
            {supportedLanguages.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </label>

        <div className='login-page__header'>
          <div className='login-page__logo'>
            <img src={loginLogo} alt={t('login.brand')} />
          </div>
          <h1 className='login-page__title'>{t('login.brand')}</h1>
          <p className='login-page__subtitle'>{mode === 'login' ? t('login.subtitle') : 'Create your account'}</p>
        </div>

        {/* OAuth buttons */}
        <div className='login-page__oauth'>
          {OAUTH_PROVIDERS.map((provider) => (
            <button
              key={provider.slug}
              type='button'
              className='login-page__oauth-btn'
              disabled={loading}
              onClick={() => void handleOAuthLogin(provider.slug)}
            >
              <OAuthIcon slug={provider.slug} />
              <span>{mode === 'login' ? `Sign in with ${provider.label}` : `Sign up with ${provider.label}`}</span>
            </button>
          ))}
        </div>

        <div className='login-page__divider'>
          <span>or</span>
        </div>

        {mode === 'login' ? (
          <form className='login-page__form' onSubmit={(e) => void handleLoginSubmit(e)}>
            <div className='login-page__form-item'>
              <label className='login-page__label' htmlFor='username'>
                {t('login.username')}
              </label>
              <div className='login-page__input-wrapper'>
                <svg
                  className='login-page__input-icon'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                  aria-hidden='true'
                >
                  <path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' />
                  <circle cx='12' cy='7' r='4' />
                </svg>
                <input
                  ref={usernameRef}
                  id='username'
                  name='username'
                  className='login-page__input'
                  placeholder={t('login.usernamePlaceholder')}
                  autoComplete='username'
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  aria-required='true'
                />
              </div>
            </div>

            <div className='login-page__form-item'>
              <label className='login-page__label' htmlFor='password'>
                {t('login.password')}
              </label>
              <div className='login-page__input-wrapper'>
                <svg
                  className='login-page__input-icon'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                  aria-hidden='true'
                >
                  <rect x='3' y='11' width='18' height='11' rx='2' ry='2' />
                  <path d='M7 11V7a5 5 0 0 1 10 0v4' />
                </svg>
                <input
                  id='password'
                  name='password'
                  type={passwordVisible ? 'text' : 'password'}
                  className='login-page__input'
                  placeholder={t('login.passwordPlaceholder')}
                  autoComplete='current-password'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-required='true'
                />
                <button
                  type='button'
                  className='login-page__toggle-password'
                  onClick={() => setPasswordVisible((prev) => !prev)}
                  aria-label={passwordVisible ? t('login.hidePassword') : t('login.showPassword')}
                >
                  <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                    {passwordVisible ? (
                      <>
                        <path d='M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24' />
                        <line x1='1' y1='1' x2='23' y2='23' />
                      </>
                    ) : (
                      <>
                        <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' />
                        <circle cx='12' cy='12' r='3' />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            <div className='login-page__checkbox'>
              <input
                type='checkbox'
                id='remember-me'
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label htmlFor='remember-me'>{t('login.rememberMe')}</label>
            </div>

            <button type='submit' className='login-page__submit' disabled={loading}>
              {loading && (
                <svg className='login-page__spinner' viewBox='0 0 24 24' width='18' height='18'>
                  <circle
                    cx='12'
                    cy='12'
                    r='10'
                    stroke='currentColor'
                    strokeWidth='3'
                    fill='none'
                    strokeDasharray='50'
                    strokeDashoffset='25'
                    strokeLinecap='round'
                  />
                </svg>
              )}
              <span>{loading ? t('login.submitting') : t('login.submit')}</span>
            </button>

            <div
              role='alert'
              aria-live='polite'
              className={`login-page__message ${message ? 'login-page__message--visible' : ''} ${message ? (message.type === 'success' ? 'login-page__message--success' : 'login-page__message--error') : ''}`}
              hidden={!message}
            >
              {message?.text}
            </div>
          </form>
        ) : (
          <form className='login-page__form' onSubmit={(e) => void handleRegisterSubmit(e)}>
            <div className='login-page__form-item'>
              <label className='login-page__label' htmlFor='reg-username'>
                Username
              </label>
              <div className='login-page__input-wrapper'>
                <svg
                  className='login-page__input-icon'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                  aria-hidden='true'
                >
                  <path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' />
                  <circle cx='12' cy='7' r='4' />
                </svg>
                <input
                  ref={usernameRef}
                  id='reg-username'
                  name='username'
                  className='login-page__input'
                  placeholder='your_username'
                  autoComplete='username'
                  required
                  minLength={3}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div className='login-page__form-item'>
              <label className='login-page__label' htmlFor='reg-email'>
                Email (optional)
              </label>
              <div className='login-page__input-wrapper'>
                <svg
                  className='login-page__input-icon'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                  aria-hidden='true'
                >
                  <path d='M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z' />
                  <polyline points='22,6 12,13 2,6' />
                </svg>
                <input
                  id='reg-email'
                  name='email'
                  type='email'
                  className='login-page__input'
                  placeholder='you@example.com'
                  autoComplete='email'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className='login-page__form-item'>
              <label className='login-page__label' htmlFor='reg-password'>
                Password
              </label>
              <div className='login-page__input-wrapper'>
                <svg
                  className='login-page__input-icon'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                  aria-hidden='true'
                >
                  <rect x='3' y='11' width='18' height='11' rx='2' ry='2' />
                  <path d='M7 11V7a5 5 0 0 1 10 0v4' />
                </svg>
                <input
                  id='reg-password'
                  name='password'
                  type='password'
                  className='login-page__input'
                  placeholder='Min. 8 characters'
                  autoComplete='new-password'
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div className='login-page__form-item'>
              <label className='login-page__label' htmlFor='reg-confirm'>
                Confirm password
              </label>
              <div className='login-page__input-wrapper'>
                <svg
                  className='login-page__input-icon'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                  aria-hidden='true'
                >
                  <rect x='3' y='11' width='18' height='11' rx='2' ry='2' />
                  <path d='M7 11V7a5 5 0 0 1 10 0v4' />
                </svg>
                <input
                  id='reg-confirm'
                  name='confirm-password'
                  type='password'
                  className='login-page__input'
                  placeholder='Repeat your password'
                  autoComplete='new-password'
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <button type='submit' className='login-page__submit' disabled={loading}>
              {loading && (
                <svg className='login-page__spinner' viewBox='0 0 24 24' width='18' height='18'>
                  <circle
                    cx='12'
                    cy='12'
                    r='10'
                    stroke='currentColor'
                    strokeWidth='3'
                    fill='none'
                    strokeDasharray='50'
                    strokeDashoffset='25'
                    strokeLinecap='round'
                  />
                </svg>
              )}
              <span>{loading ? 'Creating account…' : 'Create account'}</span>
            </button>

            <div
              role='alert'
              aria-live='polite'
              className={`login-page__message ${message ? 'login-page__message--visible' : ''} ${message ? (message.type === 'success' ? 'login-page__message--success' : 'login-page__message--error') : ''}`}
              hidden={!message}
            >
              {message?.text}
            </div>
          </form>
        )}

        {mfaState.required && mode === 'login' && (
          <form className='login-page__form' onSubmit={(e) => void handleMfaSubmit(e)}>
            <div className='login-page__form-item'>
              <label className='login-page__label' htmlFor='mfa-code'>
                MFA Code
              </label>
              <div className='login-page__input-wrapper'>
                <input
                  id='mfa-code'
                  name='mfa-code'
                  className='login-page__input'
                  placeholder='000000'
                  autoComplete='one-time-code'
                  inputMode='numeric'
                  pattern='[0-9]*'
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  aria-required='true'
                  autoFocus
                />
              </div>
            </div>
            <button type='submit' className='login-page__submit' disabled={loading}>
              {loading && (
                <svg className='login-page__spinner' viewBox='0 0 24 24' width='18' height='18'>
                  <circle
                    cx='12'
                    cy='12'
                    r='10'
                    stroke='currentColor'
                    strokeWidth='3'
                    fill='none'
                    strokeDasharray='50'
                    strokeDashoffset='25'
                    strokeLinecap='round'
                  />
                </svg>
              )}
              <span>{loading ? 'Verifying…' : 'Verify'}</span>
            </button>
          </form>
        )}

        <div className='login-page__mode-toggle'>
          {mode === 'login' ? (
            <button
              type='button'
              className='login-page__link'
              onClick={() => {
                setMode('register');
                setMessage(null);
              }}
            >
              Don&apos;t have an account? <strong>Sign up</strong>
            </button>
          ) : (
            <button
              type='button'
              className='login-page__link'
              onClick={() => {
                setMode('login');
                setMessage(null);
              }}
            >
              Already have an account? <strong>Sign in</strong>
            </button>
          )}
        </div>

        <div className='login-page__footer'>
          <div className='login-page__footer-content'>
            <span>{t('login.footerPrimary')}</span>
            <span className='login-page__footer-divider'>•</span>
            <span>{t('login.footerSecondary')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
