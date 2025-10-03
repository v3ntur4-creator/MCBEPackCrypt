import React, { useState, useEffect } from 'react';
import { Modal, Button, Typography, Space, Divider } from 'antd';
import { LockOutlined, ThunderboltOutlined, FileProtectOutlined, SafetyOutlined, BulbOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Title, Paragraph, Text } = Typography;

interface LocalComputeModalProps {
  visible: boolean;
  onClose: () => void;
}

const LocalComputeModal: React.FC<LocalComputeModalProps> = ({ visible, onClose }) => {
  const { t } = useTranslation();

  const handleUnderstood = () => {
    localStorage.setItem('localComputeNoticeShown', 'true');
    onClose();
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LockOutlined style={{ color: '#1890ff' }} />
          <span>{t('localCompute.title')}</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="understood" type="primary" onClick={handleUnderstood}>
          {t('localCompute.understood')}
        </Button>
      ]}
      width={600}
      centered
    >
      <div style={{ padding: '16px 0' }}>
        {/* 关于计算方式 */}
        <Title level={4} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <ThunderboltOutlined style={{ color: '#52c41a' }} />
          {t('localCompute.aboutComputation')}
        </Title>
        
        <Paragraph style={{ marginBottom: 16 }}>
          {t('localCompute.computationDescription')}
        </Paragraph>

        <div style={{ marginLeft: 16, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <ThunderboltOutlined style={{ color: '#faad14' }} />
            <Text>{t('localCompute.localPower')}</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <FileProtectOutlined style={{ color: '#1890ff' }} />
            <Text>{t('localCompute.filesStayLocal')}</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <LockOutlined style={{ color: '#722ed1' }} />
            <Text>{t('localCompute.completePrivacy')}</Text>
          </div>
        </div>

        <Divider />

        {/* 性能提示 */}
        <Title level={4} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <BulbOutlined style={{ color: '#faad14' }} />
          {t('localCompute.performanceTitle')}
        </Title>
        
        <Paragraph style={{ marginBottom: 16 }}>
          {t('localCompute.performanceDescription')}
        </Paragraph>

        <div style={{ marginLeft: 16, marginBottom: 16 }}>
          <div style={{ marginBottom: 4 }}>• {t('localCompute.cpuUsage')}</div>
          <div style={{ marginBottom: 4 }}>• {t('localCompute.browserDelay')}</div>
          <div style={{ marginBottom: 4 }}>• {t('localCompute.fanSpeed')}</div>
        </div>

        <Paragraph style={{ marginBottom: 24 }}>
          {t('localCompute.normalBehavior')}
        </Paragraph>

        <Divider />

        {/* 隐私保证 */}
        <Title level={4} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <SafetyOutlined style={{ color: '#52c41a' }} />
          {t('localCompute.privacyTitle')}
        </Title>
        
        <Paragraph style={{ marginBottom: 16, fontWeight: 'bold' }}>
          {t('localCompute.privacyGuarantee')}
        </Paragraph>

        <div style={{ marginLeft: 16, marginBottom: 16 }}>
          <div style={{ marginBottom: 4 }}>• {t('localCompute.browserProcessing')}</div>
          <div style={{ marginBottom: 4 }}>• {t('localCompute.keyGeneration')}</div>
          <div style={{ marginBottom: 4 }}>• {t('localCompute.noAccess')}</div>
          <div style={{ marginBottom: 4 }}>• {t('localCompute.noCloudRecord')}</div>
        </div>

        <Divider />

        <div style={{ 
          backgroundColor: 'var(--success-bg, #f6ffed)', 
          border: '1px solid var(--success-border, #b7eb8f)', 
          borderRadius: 6, 
          padding: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <BulbOutlined style={{ color: '#52c41a' }} />
          <Text style={{ fontStyle: 'italic' }}>
            {t('localCompute.tip')}
          </Text>
        </div>
      </div>
    </Modal>
  );
};

export default LocalComputeModal;