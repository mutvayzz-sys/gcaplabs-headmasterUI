import { Modal, Typography } from '@arco-design/web-react';
import type { TFunction } from 'i18next';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

const HEADMASTER_DOWNLOAD_URL = 'https://gcaplabs.com/';

export function openDownloadLatest(): void {
  window.open(HEADMASTER_DOWNLOAD_URL, '_blank', 'noopener,noreferrer');
}

export function getInstallationIntegrityTitle(t: TFunction): string {
  return t('common.backendStartup.incompleteInstallation.title');
}

export function getBackendStartupInstallationDescription(t: TFunction): string {
  return t('common.backendStartup.incompleteInstallation.description');
}

export function getRuntimeComponentInstallationDescription(t: TFunction, resource: string): string {
  return t('common.backendStartup.incompleteInstallation.runtimeComponentDescription', { resource });
}

export function getInstallationIntegrityDownloadText(t: TFunction): string {
  return t('common.backendStartup.incompleteInstallation.downloadLatest');
}

export function getDownloadLatestModalActionProps(t: TFunction, onContinue?: () => void): {
  cancelButtonProps?: {
    style?: {
      display?: string;
    };
  };
  okText: string;
  onOk: () => void;
  cancelText?: string;
  onCancel?: () => void;
} {
  return {
    okText: getInstallationIntegrityDownloadText(t),
    onOk: openDownloadLatest,
    ...(onContinue && {
      cancelText: 'Continue Anyway',
      onCancel: onContinue,
    }),
    ...(!onContinue && {
      cancelButtonProps: {
        style: {
          display: 'none',
        },
      },
    }),
  };
}

export const InstallationIntegrityContent: React.FC<{ description: string }> = ({ description }) => (
  <div className='text-t-1'>
    <Typography.Paragraph className='mb-0 text-t-secondary'>{description}</Typography.Paragraph>
  </div>
);

type InstallationIntegrityModalController = ReturnType<typeof Modal.useModal>[0];

export function showInstallationIntegrityModal(
  modal: InstallationIntegrityModalController,
  t: TFunction,
  description: string,
  onContinue?: () => void
): void {
  modal.error({
    title: getInstallationIntegrityTitle(t),
    content: <InstallationIntegrityContent description={description} />,
    ...getDownloadLatestModalActionProps(t, onContinue),
    closable: Boolean(onContinue),
    maskClosable: Boolean(onContinue),
  });
}

export const InstallationIntegrityModalHost: React.FC<{ description: string; onContinue?: () => void }> = ({
  description,
  onContinue,
}) => {
  const [modal, modalContextHolder] = Modal.useModal();
  const { t } = useTranslation();
  const shownRef = useRef(false);

  useEffect(() => {
    if (shownRef.current) return;
    shownRef.current = true;
    showInstallationIntegrityModal(modal, t, description, onContinue);
  }, [description, modal, t, onContinue]);

  return <>{modalContextHolder}</>;
};
