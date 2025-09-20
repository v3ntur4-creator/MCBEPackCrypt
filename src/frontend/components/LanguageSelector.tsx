/**
 * @deprecated 此组件已废弃，请使用 Settings 组件中的语言选择功能
 * This component is deprecated, please use the language selection feature in the Settings component
 */
import React, { useState, useEffect } from 'react';
import { Dropdown, Button, Space } from 'antd';
import { GlobalOutlined, CheckOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { MenuProps } from 'antd';

interface LanguageOption {
  key: string;
  label: string;
  flag?: string;
}

const LanguageSelector: React.FC = () => {
  const { i18n, t } = useTranslation();
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

  const menuItems: MenuProps['items'] = languageOptions.map(option => ({
    key: option.key,
    label: (
      <Space>
        {currentLanguage === option.key && <CheckOutlined style={{ color: '#1890ff' }} />}
        {option.label}
      </Space>
    ),
    onClick: () => handleLanguageChange(option.key)
  }));

  return (
    <Dropdown
      menu={{ items: menuItems }}
      placement="bottomRight"
      trigger={['click']}
    >
      <Button
        type="text"
        icon={<GlobalOutlined />}
        style={{
          border: 'none',
          borderRadius: '6px',
          width: '40px',
          height: '40px'
        }}
      />
    </Dropdown>
  );
};

export default LanguageSelector;