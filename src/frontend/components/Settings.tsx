import React, { useState, useEffect } from 'react';
import { Modal, Button, Select, Typography, Divider } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';

const { Title } = Typography;

interface LanguageOption {
  key: string;
  label: string;
}

const Settings: React.FC = () => {
  const { i18n, t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<string>('auto');

  const languageOptions: LanguageOption[] = [
    { key: 'auto', label: t('language.auto') },
    { key: 'zh-CN', label: t('language.zh-CN') },
    { key: 'en-US', label: t('language.en-US') }
  ];

  const detectAndSetLanguage = () => {
    // 自动检测浏览器语言
    const browserLanguage = navigator.language || navigator.languages[0];
    let detectedLanguage = 'en-US'; // 默认英文，用于不支持的语言
    
    if (browserLanguage.startsWith('zh')) {
      detectedLanguage = 'zh-CN';
    } else if (browserLanguage.startsWith('en')) {
      detectedLanguage = 'en-US';
    }
    // 其他语言都默认使用英文
    
    i18n.changeLanguage(detectedLanguage);
  };

  useEffect(() => {
    // 检查是否有用户保存的语言偏好
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage && savedLanguage !== 'auto') {
      setCurrentLanguage(savedLanguage);
      i18n.changeLanguage(savedLanguage);
    } else {
      // 没有保存的语言偏好，进行自动检测
      detectAndSetLanguage();
    }
  }, [i18n]);

  const handleLanguageChange = (language: string) => {
    setCurrentLanguage(language);
    
    if (language === 'auto') {
      // 用户选择自动检测，移除保存的语言偏好
      localStorage.removeItem('language');
      detectAndSetLanguage();
    } else {
      // 用户选择特定语言，保存偏好
      localStorage.setItem('language', language);
      i18n.changeLanguage(language);
    }
  };

  const showModal = () => {
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  return (
    <>
      <Button
        type="text"
        icon={<SettingOutlined />}
        onClick={showModal}
        style={{
          border: 'none',
          borderRadius: '6px',
          width: '40px',
          height: '40px'
        }}
      />
      
      <Modal
        title={t('settings.title')}
        open={isModalVisible}
        onCancel={handleCancel}
        footer={[
          <Button key="close" onClick={handleCancel}>
            {t('common.close')}
          </Button>
        ]}
        width={400}
      >
        <div style={{ padding: '16px 0' }}>
          <Title level={5} style={{ marginBottom: '16px' }}>
            {t('settings.language')}
          </Title>
          
          <Select
            value={currentLanguage}
            onChange={handleLanguageChange}
            style={{ width: '100%', marginBottom: '24px' }}
            size="large"
            options={languageOptions.map(option => ({
              value: option.key,
              label: option.label
            }))}
          />
          
          <Divider />
          
          <Title level={5} style={{ marginBottom: '16px' }}>
            {t('settings.theme')}
          </Title>
          
          <Select
            value={theme}
            onChange={setTheme}
            style={{ width: '100%' }}
            size="large"
            options={[
              { value: 'auto', label: t('settings.themeAuto') },
              { value: 'light', label: t('settings.themeLight') },
              { value: 'dark', label: t('settings.themeDark') }
            ]}
          />

        </div>
      </Modal>
    </>
  );
};

export default Settings;