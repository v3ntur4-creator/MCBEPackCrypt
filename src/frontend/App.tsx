import React from 'react';
import { Layout } from 'antd';
import HomePage from './pages/HomePage';
import Header from './components/Header';
import Footer from './components/Footer';
import { ThemeProvider } from './contexts/ThemeContext';
import './i18n';
import './styles/theme.css';

const { Content } = Layout;

function App() {
  return (
    <ThemeProvider>
      <Layout style={{ minHeight: '100vh' }}>
        <Header />
        <Content>
          <HomePage />
        </Content>
        <Footer />
      </Layout>
    </ThemeProvider>
  );
}

export default App;