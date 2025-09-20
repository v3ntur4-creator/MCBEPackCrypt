import React, { useState, useEffect } from 'react';
import { Modal, Button, Result, Typography, Progress, Divider } from 'antd';
import { DownloadOutlined, ClockCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { DownloadTask, clearDownloadTask, startDownload, getRemainingTime } from '../utils/downloadTaskStorage';

const { Text, Title } = Typography;

interface DownloadTaskModalProps {
  visible: boolean;
  task: DownloadTask | null;
  onClose: () => void;
  onDownload: () => void;
  onDiscard: () => void;
}

const DownloadTaskModal: React.FC<DownloadTaskModalProps> = ({
  visible,
  task,
  onClose,
  onDownload,
  onDiscard
}) => {
  const { t } = useTranslation();
  const [remainingTime, setRemainingTime] = useState(0);
  const [remainingPercent, setRemainingPercent] = useState(100);

  // 国际化时间格式化函数
  const formatRemainingTime = (remainingMs: number): string => {
    const minutes = Math.floor(remainingMs / (1000 * 60));
    const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  useEffect(() => {
    if (!visible || !task) {
      return;
    }

    const updateTimer = () => {
      const remaining = getRemainingTime();
      setRemainingTime(remaining);
      
      // 计算剩余时间百分比（5分钟 = 300000ms）
      const totalTime = 5 * 60 * 1000;
      const percent = Math.max(0, (remaining / totalTime) * 100);
      setRemainingPercent(percent);
      
      // 如果时间到了，自动关闭并清除任务
      if (remaining <= 0) {
        clearDownloadTask();
        onClose();
      }
    };

    // 立即更新一次
    updateTimer();
    
    // 每秒更新一次
    const timer = setInterval(updateTimer, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [visible, task, onClose]);

  const handleDownload = () => {
    if (task?.downloadUrl) {
      startDownload(task.downloadUrl);
      onDownload();
      onClose();
    }
  };

  const handleDiscard = () => {
    clearDownloadTask();
    onDiscard();
    onClose();
  };

  if (!task) {
    return null;
  }

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ClockCircleOutlined style={{ color: '#1890ff' }} />
          {t('downloadTask.title')}
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="discard" icon={<DeleteOutlined />} onClick={handleDiscard}>
          {t('downloadTask.discard')}
        </Button>,
        <Button 
          key="download" 
          type="primary" 
          icon={<DownloadOutlined />} 
          onClick={handleDownload}
        >
          {t('downloadTask.download')}
        </Button>,
      ]}
      width={500}
      centered
    >
      <Result
        icon={<ClockCircleOutlined style={{ color: '#1890ff' }} />}
        title={t('downloadTask.pendingTitle')}
        subTitle={
          <div>
            <p>{t('downloadTask.pendingMessage')}</p>
            <div style={{ margin: '16px 0' }}>
              <Text strong style={{ color: '#fa8c16' }}>
                {t('downloadTask.remainingTime')}: {formatRemainingTime(remainingTime)}
              </Text>
            </div>
            <Progress 
              percent={remainingPercent} 
              strokeColor={{
                '0%': '#ff4d4f',
                '50%': '#fa8c16',
                '100%': '#52c41a',
              }}
              showInfo={false}
              size="small"
            />
          </div>
        }
      />
      
      {task && (
        <div style={{ marginTop: '20px', padding: '16px', background: 'var(--input-bg)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <Title level={5}>{t('result.fileInfo')}</Title>
          <div style={{ marginLeft: '16px' }}>
            {task.operationType === 'encrypt' ? (
              <>
                <p>🔒 {t('result.encryptedFile')}: {task.files?.encrypted || 'output.zip'}</p>
                <p>🔑 {t('result.keyFile')}: {task.files?.key || 'output.zip.key'}</p>
                <Divider style={{ margin: '12px 0' }} />
                <p style={{ color: '#fa8c16', fontWeight: 'bold' }}>⚠️ {t('result.keyWarning')}</p>
              </>
            ) : (
              <>
                <p>📦 {t('result.decryptedFile')}: {task.files?.decrypted || 'decrypted.zip'}</p>
                <p style={{ color: '#52c41a' }}>✅ {t('result.decryptComplete')}</p>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};

export default DownloadTaskModal;