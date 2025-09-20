import React from 'react';
import { Layout, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

const { Footer: AntFooter } = Layout;
const { Text, Link } = Typography;

const Footer: React.FC = () => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <AntFooter
      style={{
        padding: '24px',
        textAlign: 'center',
        marginTop: '40px'
      }}
    >
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <Text style={{ fontSize: '14px' }}>
          © {currentYear} {t('footer.copyright')}
        </Text>
        <div style={{ marginTop: '8px' }}>
          <Text style={{ fontSize: '12px' }}>
            {t('footer.license')}：
            <Link 
              href="https://www.gnu.org/licenses/gpl-3.0.html" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ marginLeft: '4px' }}
            >
              GNU General Public License v3.0
            </Link>
            {' | '}
            {t('footer.repository')}：
            <Link 
              href="https://cnb.cool/EnderRealm/public/MCBEPackCrypt" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ marginLeft: '4px' }}
            >
              MCBEPackCrypt
            </Link>
            {' | '}
            {t('footer.issues')}：
            <Link 
              href="https://cnb.cool/EnderRealm/public/MCBEPackCrypt/-/issues" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ marginLeft: '4px' }}
            >
              {t('footer.issuePage')}
            </Link>
          </Text>
        </div>
      </div>
    </AntFooter>
  );
};

export default Footer;