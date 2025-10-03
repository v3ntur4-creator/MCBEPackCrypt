import React, { useState, useEffect, useRef } from 'react';
import { Button, Typography, Space, message, Modal, Upload, Form, Card, Row, Col, Progress, Result, Divider, Checkbox, Collapse } from 'antd';
import { UploadOutlined, LockOutlined, UnlockOutlined, SafetyOutlined, KeyOutlined, InboxOutlined, CheckCircleOutlined, DownloadOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import ErrorModal from '../components/ErrorModal';
import DownloadTaskModal from '../components/DownloadTaskModal';
import LocalComputeModal from '../components/LocalComputeModal';
import { saveDownloadTask, getDownloadTask, clearDownloadTask, startDownload } from '../utils/downloadTaskStorage';
import { cryptoServiceAdapter } from '../services/cryptoServiceAdapter';
import { deploymentModeDetector } from '../utils/deploymentMode';

const { Dragger } = Upload;

const { Title, Paragraph } = Typography;

const HomePage: React.FC = () => {
  const { t } = useTranslation();
  const [encryptModalVisible, setEncryptModalVisible] = useState(false);
  const [decryptModalVisible, setDecryptModalVisible] = useState(false);
  const [encryptLoading, setEncryptLoading] = useState(false);
  const [decryptLoading, setDecryptLoading] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successData, setSuccessData] = useState<any>(null);
  const [operationType, setOperationType] = useState<'encrypt' | 'decrypt'>('encrypt');
  
  // 错误弹窗状态
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{ message: string; stack?: string }>({ message: '' });
  const [encryptProgress, setEncryptProgress] = useState({ current: 0, total: 100, status: 'idle' });
  const [decryptProgress, setDecryptProgress] = useState({ current: 0, total: 100, status: 'idle' });
  const [encryptFile, setEncryptFile] = useState<File | null>(null);
  const [encryptedFile, setEncryptedFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [encryptForm] = Form.useForm();
  const [decryptForm] = Form.useForm();
  
  // 下载任务提醒状态
  const [downloadTaskModalVisible, setDownloadTaskModalVisible] = useState(false);
  const [pendingDownloadTask, setPendingDownloadTask] = useState<any>(null);
  
  // 部署模式状态
  const [deploymentMode, setDeploymentMode] = useState<string>('');
  const [modeDescription, setModeDescription] = useState<string>('');
  
  // 本地计算弹窗状态
  const [localComputeModalVisible, setLocalComputeModalVisible] = useState(false);
  
  // 详细信息面板状态
  const [encryptDetailsVisible, setEncryptDetailsVisible] = useState(true); // 默认展开
  const [decryptDetailsVisible, setDecryptDetailsVisible] = useState(true); // 默认展开
  const [encryptLogs, setEncryptLogs] = useState<string[]>([]);
  const [decryptLogs, setDecryptLogs] = useState<string[]>([]);
  
  // 滚动控制refs
  const encryptLogRef = useRef<HTMLDivElement>(null);
  const decryptLogRef = useRef<HTMLDivElement>(null);
  const [encryptIsAtBottom, setEncryptIsAtBottom] = useState(true);
  const [decryptIsAtBottom, setDecryptIsAtBottom] = useState(true);

  // 检查滚动位置是否在底部
  const checkScrollPosition = (element: HTMLDivElement, type: 'encrypt' | 'decrypt') => {
    const isAtBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 5; // 5px tolerance
    if (type === 'encrypt') {
      setEncryptIsAtBottom(isAtBottom);
    } else {
      setDecryptIsAtBottom(isAtBottom);
    }
  };

  // 滚动到底部
  const scrollToBottom = (ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  };

  // 添加日志记录函数
  const addLog = (type: 'encrypt' | 'decrypt', message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    
    if (type === 'encrypt') {
      setEncryptLogs(prev => {
        const newLogs = [...prev, logMessage];
        // 如果用户在底部，则自动滚动到底部
        setTimeout(() => {
          if (encryptIsAtBottom && encryptLogRef.current) {
            scrollToBottom(encryptLogRef);
          }
        }, 0);
        return newLogs;
      });
    } else {
      setDecryptLogs(prev => {
        const newLogs = [...prev, logMessage];
        // 如果用户在底部，则自动滚动到底部
        setTimeout(() => {
          if (decryptIsAtBottom && decryptLogRef.current) {
            scrollToBottom(decryptLogRef);
          }
        }, 0);
        return newLogs;
      });
    }
  };

  // 清空日志
  const clearLogs = (type: 'encrypt' | 'decrypt') => {
    if (type === 'encrypt') {
      setEncryptLogs([]);
      setEncryptIsAtBottom(true); // 重置滚动状态
    } else {
      setDecryptLogs([]);
      setDecryptIsAtBottom(true); // 重置滚动状态
    }
  };

  // 检查是否有未完成的下载任务
  useEffect(() => {
    const checkPendingTask = () => {
      const task = getDownloadTask();
      if (task) {
        setPendingDownloadTask(task);
        setDownloadTaskModalVisible(true);
      }
    };

    // 检测部署模式
    const detectMode = async () => {
      const mode = await deploymentModeDetector.detectDeploymentMode();
      const description = await deploymentModeDetector.getModeDescription();
      setDeploymentMode(mode.mode);
      setModeDescription(description);

      // 检查是否需要显示本地计算说明弹窗
      if (mode.mode === 'frontend-only') {
        const hasShownNotice = localStorage.getItem('localComputeNoticeShown');
        if (!hasShownNotice) {
          setLocalComputeModalVisible(true);
        }
      }
    };

    detectMode();

    // 页面加载时检查下载任务
    checkPendingTask();
    
  }, []);

  // 检查下载任务的函数
  const checkForPendingDownloadTask = () => {
    const task = getDownloadTask();
    if (task) {
      setPendingDownloadTask(task);
      setDownloadTaskModalVisible(true);
      return true;
    }
    return false;
  };

  // 处理下载任务模态框的关闭
  const handleDownloadTaskModalClose = () => {
    setDownloadTaskModalVisible(false);
    setPendingDownloadTask(null);
  };

  // 处理下载任务的下载
  const handleDownloadTaskDownload = () => {
    if (pendingDownloadTask?.downloadUrl) {
      startDownload(pendingDownloadTask.downloadUrl);
      clearDownloadTask();
    }
  };

  // 处理下载任务的放弃
  const handleDownloadTaskDiscard = () => {
    clearDownloadTask();
  };



  // 文件格式验证
  const validateEncryptFile = (file: File) => {
    const allowedTypes = ['.zip', '.mcpack'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!allowedTypes.includes(fileExtension)) {
      message.error(t('encrypt.modal.validation.unsupported', { formats: allowedTypes.join(', ') }));
      return false;
    }
    return true;
  };

  const validateDecryptFiles = (file: File, fieldName: string) => {
    const fileName = file.name.toLowerCase();
    
    if (fieldName === 'encryptedFile') {
      if (!fileName.endsWith('.zip')) {
        message.error(t('decrypt.modal.validation.encryptedFormat'));
        return false;
      }
    } else if (fieldName === 'keyFile') {
      if (!fileName.endsWith('.key')) {
        message.error(t('decrypt.modal.validation.keyFormat'));
        return false;
      }
    }
    return true;
  };

  // 轮询进度的函数
  const pollProgress = async (type: 'encrypt' | 'decrypt') => {
    const url = type === 'encrypt' ? '/api/encrypt/progress' : '/api/decrypt/progress';
    const setProgress = type === 'encrypt' ? setEncryptProgress : setDecryptProgress;
    
    try {
      const response = await fetch(url);
      if (response.ok) {
        const progress = await response.json();
        setProgress(progress);
        
        // 如果还在处理中，继续轮询
        if (progress.status !== 'completed' && progress.status !== 'error' && progress.status !== 'idle') {
          setTimeout(() => pollProgress(type), 1000);
        }
      }
    } catch (error) {
      console.error('Failed to get progress:', error);
    }
  };

  // 处理加密
  const handleEncrypt = async () => {
    if (!encryptFile) {
      message.error(t('encrypt.modal.validation.required'));
      return;
    }
    
    try {
      setEncryptLoading(true);
      setEncryptProgress({ current: 0, total: 100, status: 'starting' });
      
      // 清空之前的日志并添加开始日志
      clearLogs('encrypt');
      addLog('encrypt', t('encrypt.progress.starting'));
      
      // 使用加密服务适配器
      const result = await cryptoServiceAdapter.encryptFile(
        encryptFile,
        (progress) => {
          setEncryptProgress(progress);
          
          // 根据进度状态添加日志
          if (progress.status === 'processing directories') {
            addLog('encrypt', t('encrypt.progress.processing_directories'));
          } else if (progress.status === 'preparing files for encryption') {
            addLog('encrypt', t('encrypt.progress.preparing_files'));
          } else if (progress.status.includes('encrypting')) {
            addLog('encrypt', t('encrypt.progress.encrypting'));
          } else if (progress.status === 'processing encrypted results') {
            addLog('encrypt', t('encrypt.progress.processing_results'));
          } else if (progress.status === 'processing excluded files') {
            addLog('encrypt', t('encrypt.progress.processing_excluded'));
          } else if (progress.status === 'generating contents.json') {
            addLog('encrypt', t('encrypt.progress.generating_contents'));
          } else if (progress.status === 'finalizing') {
            addLog('encrypt', t('encrypt.progress.finalizing'));
          } else if (progress.status === 'completed') {
            addLog('encrypt', t('encrypt.progress.completed'));
          }
        },
        (detailedLog) => {
          // 添加详细日志
          addLog('encrypt', detailedLog);
        }
      );
      
      setSuccessData(result.data);
      setOperationType('encrypt');
      
      // 保存下载任务到会话存储（仅在服务器端模式下）
      if (result.data?.downloadUrl) {
        saveDownloadTask({
          downloadUrl: result.data.downloadUrl,
          operationType: 'encrypt',
          files: result.data.files,
          expiresIn: result.data.expiresIn || '5 minutes'
        });
      }
      
      setEncryptModalVisible(false);
      setSuccessModalVisible(true);
      setEncryptFile(null);
      encryptForm.resetFields();
    } catch (error) {
      console.error('Encryption error:', error);
      setEncryptProgress({ current: 0, total: 100, status: 'error' });
      addLog('encrypt', `${t('encrypt.progress.error')}: ${error instanceof Error ? error.message : error}`);
      setErrorInfo({
          message: error instanceof Error ? error.message : (error as string || t('encrypt.progress.error')),
          stack: error instanceof Error ? error.stack : undefined
        });
      setErrorModalVisible(true);
    } finally {
      setEncryptLoading(false);
    }
  };

  // 处理解密
  const handleDecrypt = async () => {
    if (!encryptedFile || !keyFile) {
      message.error(t('decrypt.modal.validation.bothRequired'));
      return;
    }
    
    try {
      setDecryptLoading(true);
      setDecryptProgress({ current: 0, total: 100, status: 'starting' });
      
      // 清空之前的日志并添加开始日志
      clearLogs('decrypt');
      addLog('decrypt', t('decrypt.progress.starting'));
      
      // 获取表单值
      const formValues = decryptForm.getFieldsValue();
      const preserveContentsJson = formValues.preserveContentsJson || false;
      
      // 使用解密服务适配器
      const result = await cryptoServiceAdapter.decryptFile(
        encryptedFile,
        keyFile,
        preserveContentsJson,
        (progress) => {
          setDecryptProgress(progress);
          
          // 根据进度状态添加日志
          if (progress.status === 'decrypting contents.json') {
            addLog('decrypt', t('decrypt.progress.decrypting_contents'));
          } else if (progress.status === 'preparing files for decryption') {
            addLog('decrypt', t('decrypt.progress.preparing_files'));
          } else if (progress.status.includes('decrypting')) {
            addLog('decrypt', t('decrypt.progress.decrypting'));
          } else if (progress.status === 'processing decrypted results') {
            addLog('decrypt', t('decrypt.progress.processing_results'));
          } else if (progress.status === 'copying excluded files') {
            addLog('decrypt', t('decrypt.progress.copying_excluded'));
          } else if (progress.status === 'completed') {
            addLog('decrypt', t('decrypt.progress.completed'));
          }
        },
        (detailedLog) => {
          // 添加详细日志
          addLog('decrypt', detailedLog);
        }
      );
      
      setSuccessData(result.data);
      setOperationType('decrypt');
      
      // 保存下载任务到会话存储（仅在服务器端模式下）
      if (result.data?.downloadUrl) {
        saveDownloadTask({
          downloadUrl: result.data.downloadUrl,
          operationType: 'decrypt',
          files: result.data.files,
          expiresIn: result.data.expiresIn || "5min"
        });
      }
      
      setDecryptModalVisible(false);
      setSuccessModalVisible(true);
      setEncryptedFile(null);
      setKeyFile(null);
      decryptForm.resetFields();
    } catch (error) {
      console.error('Decryption error:', error);
      setDecryptProgress({ current: 0, total: 100, status: 'error' });
      addLog('decrypt', `${t('decrypt.progress.error')}: ${error instanceof Error ? error.message : error}`);
      setErrorInfo({
          message: error instanceof Error ? error.message : (error as string || t('decrypt.progress.error')),
          stack: error instanceof Error ? error.stack : undefined
        });
      setErrorModalVisible(true);
    } finally {
      setDecryptLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '40px', textAlign: 'center' }}>
        <Title level={2} style={{ marginBottom: '16px' }}>{t('home.welcome')}</Title>
        <Paragraph style={{ fontSize: '16px', color: '#666' }}>
          {t('home.description')}
        </Paragraph>
      </div>
      
      <Space size="large" direction="vertical" style={{ width: '100%' }}>
        
        <div>
          <Title level={3}>{t('features.title')}</Title>
          <Row gutter={[24, 24]} style={{ marginTop: '20px' }}>
            {/* 加密功能卡片 */}
            <Col xs={24} md={12}>
              <Card
                style={{ height: '100%' }}
                cover={
                  <div 
                    style={{ 
                      padding: '40px', 
                      textAlign: 'center', 
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      // 检查是否有未完成的下载任务
                      if (!checkForPendingDownloadTask()) {
                        clearLogs('encrypt'); // 清理之前的日志
                        setEncryptModalVisible(true);
                      }
                    }}
                  >
                    <LockOutlined style={{ fontSize: '48px' }} />
                  </div>
                }
                actions={[
                  <Button 
                    type="primary" 
                    size="large" 
                    icon={<SafetyOutlined />}
                    onClick={() => {
                      // 检查是否有未完成的下载任务
                      if (!checkForPendingDownloadTask()) {
                        clearLogs('encrypt'); // 清理之前的日志
                        setEncryptModalVisible(true);
                      }
                    }}
                    style={{ width: '80%' }}
                  >
                    {t('encrypt.button')}
                  </Button>
                ]}
              >
                <div style={{ cursor: 'default' }}>
                  <Card.Meta
                    title={t('encrypt.title')}
                    description={
                      <div>
                        <p>{t('encrypt.description')}</p>
                        <ul style={{ paddingLeft: '20px', margin: '10px 0' }}>
                          <li>{t('encrypt.features.formats')}</li>
                          <li>{t('encrypt.features.key')}</li>
                          <li>{t('encrypt.features.fast')}</li>
                          <li>{t('encrypt.features.protection')}</li>
                        </ul>
                      </div>
                    }
                  />
                </div>
              </Card>
            </Col>

            {/* 解密功能卡片 */}
            <Col xs={24} md={12}>
              <Card
                style={{ height: '100%' }}
                cover={
                  <div 
                    style={{ 
                      padding: '40px', 
                      textAlign: 'center', 
                      background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                      color: 'white',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      // 检查是否有未完成的下载任务
                      if (!checkForPendingDownloadTask()) {
                        clearLogs('decrypt'); // 清理之前的日志
                        setDecryptModalVisible(true);
                      }
                    }}
                  >
                    <UnlockOutlined style={{ fontSize: '48px' }} />
                  </div>
                }
                actions={[
                  <Button 
                    type="primary" 
                    size="large" 
                    icon={<KeyOutlined />}
                    onClick={() => {
                      // 检查是否有未完成的下载任务
                      if (!checkForPendingDownloadTask()) {
                        clearLogs('decrypt'); // 清理之前的日志
                        setDecryptModalVisible(true);
                      }
                    }}
                    style={{ width: '80%' }}
                  >
                    {t('decrypt.button')}
                  </Button>
                ]}
              >
                <div style={{ cursor: 'default' }}>
                  <Card.Meta
                    title={t('decrypt.title')}
                    description={
                      <div>
                        <p>{t('decrypt.description')}</p>
                        <ul style={{ paddingLeft: '20px', margin: '10px 0' }}>
                          <li>{t('decrypt.features.files')}</li>
                          <li>{t('decrypt.features.validation')}</li>
                          <li>{t('decrypt.features.fast')}</li>
                          <li>{t('decrypt.features.restore')}</li>
                        </ul>
                      </div>
                    }
                  />
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      </Space>

      {/* 加密文件弹窗 */}
      <Modal
        title={t('encrypt.modal.title')}
        open={encryptModalVisible}
        onCancel={encryptLoading ? undefined : () => {
          setEncryptModalVisible(false);
          setEncryptFile(null);
          encryptForm.resetFields();
        }}
        closable={!encryptLoading}
        maskClosable={!encryptLoading}
        footer={[
          <Button key="cancel" onClick={() => {
            setEncryptModalVisible(false);
            setEncryptFile(null);
            encryptForm.resetFields();
          }} disabled={encryptLoading}>
            {t('common.cancel')}
          </Button>,
          <Button 
              key="submit" 
              type="primary" 
              loading={encryptLoading}
              onClick={handleEncrypt}
            >
              {t('encrypt.button')}
            </Button>,
        ]}
      >
        <Form form={encryptForm} layout="vertical">
          {encryptLoading && (
            <div style={{ marginBottom: 16 }}>
              <Progress 
                percent={Math.round((encryptProgress.current / encryptProgress.total) * 100)} 
                status={encryptProgress.status === 'error' ? 'exception' : 'active'}
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#87d068',
                }}
              />
              <div style={{ textAlign: 'center', marginTop: 8, color: '#666' }}>
                {encryptProgress.status === 'starting' && t('encrypt.progress.starting')}
                {encryptProgress.status === 'processing directories' && t('encrypt.progress.processing_directories')}
                {encryptProgress.status === 'preparing files for encryption' && t('encrypt.progress.preparing_files')}
                {encryptProgress.status.includes('encrypting') && t('encrypt.progress.encrypting')}
                {encryptProgress.status === 'processing encrypted results' && t('encrypt.progress.processing_results')}
                {encryptProgress.status === 'processing excluded files' && t('encrypt.progress.processing_excluded')}
                {encryptProgress.status === 'generating contents.json' && t('encrypt.progress.generating_contents')}
                {encryptProgress.status === 'finalizing' && t('encrypt.progress.finalizing')}
                {encryptProgress.status === 'completed' && t('encrypt.progress.completed')}
                {encryptProgress.status === 'error' && t('encrypt.progress.error')}
              </div>
            </div>
          )}
          <Form.Item
            name="file"
            label={t('encrypt.modal.selectFile')}
            rules={[{ required: true, message: t('encrypt.modal.validation.required') }]}
            valuePropName="fileList"
            getValueFromEvent={(e) => {
              if (Array.isArray(e)) {
                return e;
              }
              return e && e.fileList;
            }}
          >
            <Dragger
               beforeUpload={(file) => {
                 if (validateEncryptFile(file)) {
                   setEncryptFile(file);
                 }
                 return false; // 阻止自动上传
               }}
               maxCount={1}
               accept=".zip,.mcpack"
               style={{ padding: '20px' }}
               disabled={encryptLoading}
             >
               <p className="ant-upload-drag-icon">
                 <InboxOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
               </p>
               <p className="ant-upload-text">{t('encrypt.modal.dragText')}</p>
               <p className="ant-upload-hint">
                 {t('encrypt.modal.hint')}
               </p>
             </Dragger>
          </Form.Item>
        </Form>
        
        {/* 详细信息面板 */}
        {encryptLogs.length > 0 && (
          <Collapse 
            style={{ marginTop: 16 }}
            defaultActiveKey={['1']} // 默认展开
            items={[
              {
                key: '1',
                label: (
                  <span>
                    <InfoCircleOutlined style={{ marginRight: 8 }} />
                    {t('encrypt.details.title')}
                  </span>
                ),
                children: (
                  <div 
                    ref={encryptLogRef}
                    className="stack-trace-container"
                    style={{ 
                      backgroundColor: '#fafafa',
                      padding: '12px',
                      borderRadius: '4px',
                      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                      fontSize: '12px',
                      lineHeight: '1.4',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      maxHeight: '300px',
                      overflowY: 'auto',
                      border: '1px solid #e8e8e8'
                    }}
                    onScroll={(e) => checkScrollPosition(e.target as HTMLDivElement, 'encrypt')}
                  >
                    {encryptLogs.join('\n')}
                  </div>
                )
              }
            ]}
            ghost
          />
        )}
      </Modal>

      {/* 解密文件弹窗 */}
      <Modal
        title={t('decrypt.modal.title')}
        open={decryptModalVisible}
        onCancel={decryptLoading ? undefined : () => {
          setDecryptModalVisible(false);
          setEncryptedFile(null);
          setKeyFile(null);
          decryptForm.resetFields();
        }}
        closable={!decryptLoading}
        maskClosable={!decryptLoading}
        footer={[
          <Button key="cancel" onClick={() => {
            setDecryptModalVisible(false);
            setEncryptedFile(null);
            setKeyFile(null);
            decryptForm.resetFields();
          }} disabled={decryptLoading}>
            {t('common.cancel')}
          </Button>,
          <Button 
              key="submit" 
              type="primary" 
              loading={decryptLoading}
              onClick={handleDecrypt}
            >
              {t('decrypt.button')}
            </Button>,
        ]}
      >
        <Form form={decryptForm} layout="vertical">
          {decryptLoading && (
            <div style={{ marginBottom: 16 }}>
              <Progress 
                percent={Math.round((decryptProgress.current / decryptProgress.total) * 100)} 
                status={decryptProgress.status === 'error' ? 'exception' : 'active'}
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#87d068',
                }}
              />
              <div style={{ textAlign: 'center', marginTop: 8, color: '#666' }}>
                {decryptProgress.status === 'starting' && t('decrypt.progress.starting')}
                {decryptProgress.status === 'decrypting contents.json' && t('decrypt.progress.decrypting_contents')}
                {decryptProgress.status === 'preparing files for decryption' && t('decrypt.progress.preparing_files')}
                {decryptProgress.status.includes('decrypting') && t('decrypt.progress.decrypting')}
                {decryptProgress.status === 'processing decrypted results' && t('decrypt.progress.processing_results')}
                {decryptProgress.status === 'copying excluded files' && t('decrypt.progress.copying_excluded')}
                {decryptProgress.status === 'completed' && t('decrypt.progress.completed')}
                {decryptProgress.status === 'error' && t('decrypt.progress.error')}
              </div>
            </div>
          )}
          <Form.Item
            name="encryptedFile"
            label={t('decrypt.modal.encryptedFile')}
            rules={[{ required: true, message: t('decrypt.modal.validation.encryptedRequired') }]}
            valuePropName="fileList"
            getValueFromEvent={(e) => {
              if (Array.isArray(e)) {
                return e;
              }
              return e && e.fileList;
            }}
          >
            <Dragger
               beforeUpload={(file) => {
                 if (validateDecryptFiles(file, 'encryptedFile')) {
                   setEncryptedFile(file);
                 }
                 return false;
               }}
               maxCount={1}
               accept=".zip"
               style={{ padding: '20px', marginBottom: '16px' }}
               disabled={decryptLoading}
             >
               <p className="ant-upload-drag-icon">
                 <LockOutlined style={{ fontSize: '36px', color: '#52c41a' }} />
               </p>
               <p className="ant-upload-text">{t('decrypt.modal.uploadEncrypted')}</p>
               <p className="ant-upload-hint">
                 {t('decrypt.modal.encryptedHint')}
               </p>
             </Dragger>
          </Form.Item>
          
          <Form.Item
            name="keyFile"
            label={t('decrypt.modal.keyFile')}
            rules={[{ required: true, message: t('decrypt.modal.validation.keyRequired') }]}
            valuePropName="fileList"
            getValueFromEvent={(e) => {
              if (Array.isArray(e)) {
                return e;
              }
              return e && e.fileList;
            }}
          >
            <Dragger
               beforeUpload={(file) => {
                 if (validateDecryptFiles(file, 'keyFile')) {
                   setKeyFile(file);
                 }
                 return false;
               }}
               maxCount={1}
               accept=".key"
               style={{ padding: '20px' }}
               disabled={decryptLoading}
             >
               <p className="ant-upload-drag-icon">
                 <KeyOutlined style={{ fontSize: '36px', color: '#faad14' }} />
               </p>
               <p className="ant-upload-text">{t('decrypt.modal.uploadKey')}</p>
               <p className="ant-upload-hint">
                 {t('decrypt.modal.keyHint')}
               </p>
             </Dragger>
          </Form.Item>
          
          <Form.Item
            name="preserveContentsJson"
            valuePropName="checked"
            style={{ marginTop: '16px' }}
          >
            <Checkbox>
              {t('decrypt.modal.preserveContents')}
            </Checkbox>
          </Form.Item>
        </Form>
        
        {/* 详细信息面板 */}
        {decryptLogs.length > 0 && (
          <Collapse 
            style={{ marginTop: 16 }}
            defaultActiveKey={['1']} // 默认展开
            items={[
              {
                key: '1',
                label: (
                  <span>
                    <InfoCircleOutlined style={{ marginRight: 8 }} />
                    {t('decrypt.details.title')}
                  </span>
                ),
                children: (
                  <div 
                    ref={decryptLogRef}
                    className="stack-trace-container"
                    style={{ 
                      backgroundColor: '#fafafa',
                      padding: '12px',
                      borderRadius: '4px',
                      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                      fontSize: '12px',
                      lineHeight: '1.4',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      maxHeight: '300px',
                      overflowY: 'auto',
                      border: '1px solid #e8e8e8'
                    }}
                    onScroll={(e) => checkScrollPosition(e.target as HTMLDivElement, 'decrypt')}
                  >
                    {decryptLogs.join('\n')}
                  </div>
                )
              }
            ]}
            ghost
          />
        )}
        </Modal>

        {/* 成功完成弹窗 */}
        <Modal
          title={null}
          open={successModalVisible}
          onCancel={() => {
            setSuccessModalVisible(false);
            setSuccessData(null);
          }}
          footer={[
            <Button key="close" onClick={() => {
              setSuccessModalVisible(false);
              setSuccessData(null);
            }}>
              {t('common.close')}
            </Button>,
            <Button 
              key="download" 
              type="primary" 
              icon={<DownloadOutlined />}
              onClick={() => {
                if (successData?.downloadUrl) {
                  startDownload(successData.downloadUrl);
                  clearDownloadTask(); // 清除会话存储中的下载任务
                } else {
                  // frontend-only模式下，文件已经自动下载，只需关闭弹窗
                  message.success(deploymentMode === 'frontend-only' ? 'File automatically downloaded to browser' : t('result.downloadStarted'));
                  setSuccessModalVisible(false);
                  setSuccessData(null);
                }
              }}
              style={{ display: successData?.downloadUrl ? 'inline-block' : 'none' }}
            >
              {t('result.download')}
            </Button>,
          ]}
          width={600}
        >
          <Result
            icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            title={operationType === 'encrypt' ? t('result.encryptSuccess') : t('result.decryptSuccess')}
            subTitle={
              <div>
                <p>{operationType === 'encrypt' ? t('result.encryptMessage') : t('result.decryptMessage')}</p>
                {deploymentMode === 'frontend-only' ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{t('result.browserDownloadMessage')}</p>
                ) : (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{t('result.expireMessage', { time: successData?.expiresIn || '5 minutes' })}</p>
                )}
              </div>
            }
          />
          
          {successData && (
            <div style={{ marginTop: '20px', padding: '16px', background: 'var(--input-bg)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <Typography.Title level={5}>{t('result.fileInfo')}</Typography.Title>
              <div style={{ marginLeft: '16px' }}>
                {operationType === 'encrypt' ? (
                  <>
                    <p>🔒 {t('result.encryptedFile')}: {successData.files?.encrypted || 'output.zip'}</p>
                    <p>🔑 {t('result.keyFile')}: {successData.files?.key || 'output.zip.key'}</p>
                    <Divider style={{ margin: '12px 0' }} />
                    <p style={{ color: '#fa8c16', fontWeight: 'bold' }}>⚠️ {t('result.keyWarning')}</p>
                  </>
                ) : (
                  <>
                    <p>📦 {t('result.decryptedFile')}: {successData.files?.decrypted || 'decrypted.zip'}</p>
                    <p style={{ color: '#52c41a' }}>✅ {t('result.decryptComplete')}</p>
                  </>
                )}
              </div>
            </div>
          )}
        </Modal>
        
        {/* 错误弹窗 */}
        <ErrorModal
          visible={errorModalVisible}
          onClose={() => {
            setErrorModalVisible(false);
            setErrorInfo({ message: '' });
          }}
          error={errorInfo}
        />
        
        {/* 下载任务提醒弹窗 */}
        <DownloadTaskModal
          visible={downloadTaskModalVisible}
          task={pendingDownloadTask}
          onClose={handleDownloadTaskModalClose}
          onDownload={handleDownloadTaskDownload}
          onDiscard={handleDownloadTaskDiscard}
        />
        
        {/* 本地计算说明弹窗 */}
        <LocalComputeModal
          visible={localComputeModalVisible}
          onClose={() => setLocalComputeModalVisible(false)}
        />
      </div>
    );
  };
  
  export default HomePage;