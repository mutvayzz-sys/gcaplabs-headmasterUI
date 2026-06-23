import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className='flex items-center gap-8px text-t-secondary text-14px'>
      {t('settings.languageValue', { defaultValue: 'English' })}
    </div>
  );
};

export default LanguageSwitcher;
