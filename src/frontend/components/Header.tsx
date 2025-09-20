import React from 'react';
import { Layout, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import Settings from './Settings';

const { Title } = Typography;

const { Header: AntHeader } = Layout;

const Header: React.FC = () => {
  const { t } = useTranslation();
  
  return (
    <AntHeader
      style={{
        backgroundColor: '#fff',
        borderBottom: '1px solid #d9d9d9',
        padding: '0 24px',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
      }}
    >
      {/* 左侧应用标题 */}
      <div style={{ flex: 1 }}>
        <Title level={3} style={{ margin: 0, fontWeight: 'bold', color: '#000' }}>
          {t('header.title')}
        </Title>
      </div>
      
      {/* 右侧放置语言选择器 */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Settings />
      </div>
    </AntHeader>
  );
};

export default Header;