import { useState, useEffect } from 'react';
import { Layout, ConfigProvider, Tabs, Card, Empty, Spin, Typography, Button, Modal, Form, Input, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { KnowledgeDirectory } from './components/KnowledgeDirectory';
import { FileUpload } from './components/FileUpload';
import { QuizCreate } from './components/QuizCreate';
import { QuizBank, QuestionBank } from './components/QuizBank';
import { QuizCompose } from './components/QuizCompose';
import { QuizPaperManage } from './components/QuizPaperManage';
import { KnowledgeItem, SelectedKnowledgePointNode } from './types';
import { ApiService } from './services/api';
import './App.css';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

// 主题配置
const theme = {
  token: {
    colorPrimary: '#db002a',
    colorError: '#db002a', // danger 按钮也使用主题色
  },
};

function App() {
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);
  const [activeTab, setActiveTab] = useState<string>('directory');
  const [selectedQuizItems, setSelectedQuizItems] = useState<(KnowledgeItem | SelectedKnowledgePointNode)[]>([]);
  
  // 题库管理相关状态
  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [loadingBanks, setLoadingBanks] = useState(false);
  
  // AI组卷相关状态
  const [composeBankId, setComposeBankId] = useState<string>('');
  
  // 试卷管理相关状态
  const [quizBanks, setQuizBanks] = useState<Array<{ quiz_id: string; quiz_name: string; creator: string; created_time: string }>>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string>('');
  const [loadingQuizBanks, setLoadingQuizBanks] = useState(false);
  
  // 新增题库Modal相关状态
  const [isCreateBankModalVisible, setIsCreateBankModalVisible] = useState(false);
  const [bankForm] = Form.useForm();
  
  // 新增试卷Modal相关状态
  const [isCreateQuizModalVisible, setIsCreateQuizModalVisible] = useState(false);
  const [quizForm] = Form.useForm();
  
  // 知识目录刷新触发器（使用时间戳触发刷新）
  const [knowledgeTreeRefreshKey, setKnowledgeTreeRefreshKey] = useState<number>(0);
  
  // 刷新知识目录的函数
  const refreshKnowledgeTree = () => {
    setKnowledgeTreeRefreshKey(Date.now());
  };

  const handleQuizItemsChange = (items: (KnowledgeItem | SelectedKnowledgePointNode)[]) => {
    setSelectedQuizItems(items);
  };

  const handleRemoveQuizItem = (itemId: string, siblingsToAdd?: SelectedKnowledgePointNode[]) => {
    setSelectedQuizItems(prevItems => {
      const filtered = prevItems.filter(item => item.id !== itemId);
      // 如果有兄弟节点需要添加，将它们添加到列表中
      if (siblingsToAdd && siblingsToAdd.length > 0) {
        // 过滤掉已经存在的节点，避免重复
        const newSiblings = siblingsToAdd.filter(sibling => 
          !filtered.some(item => item.id === sibling.id)
        );
        const result = [...filtered, ...newSiblings];
        console.log('删除节点:', itemId, '删除前数量:', prevItems.length, '删除后数量:', filtered.length, '添加兄弟节点:', newSiblings.length, '最终数量:', result.length);
        return result;
      }
      console.log('删除节点:', itemId, '删除前数量:', prevItems.length, '删除后数量:', filtered.length);
      return filtered;
    });
  };

  const handleClearAllQuizItems = () => {
    setSelectedQuizItems([]);
  };

  // 加载题库列表
  const loadQuestionBanks = async () => {
    setLoadingBanks(true);
    try {
      const banks = await ApiService.getQuestionBanks();
      setQuestionBanks(banks);
      if (banks.length > 0 && !selectedBankId) {
        // 默认选中第一个题库
        setSelectedBankId(banks[0].bank_id);
      }
    } catch (error) {
      console.error('加载题库列表失败:', error);
    } finally {
      setLoadingBanks(false);
    }
  };

  // 当切换到题库管理页面时加载题库列表
  useEffect(() => {
    if (activeTab === 'bank') {
      loadQuestionBanks();
    }
  }, [activeTab]);

  // 加载试卷列表
  const loadQuizBanks = async () => {
    setLoadingQuizBanks(true);
    try {
      const result = await ApiService.getQuizBanks();
      if (result.success && result.quizs) {
        setQuizBanks(result.quizs);
        if (result.quizs.length > 0 && !selectedQuizId) {
          // 默认选中第一个试卷
          setSelectedQuizId(result.quizs[0].quiz_id);
        }
      }
    } catch (error) {
      console.error('加载试卷列表失败:', error);
    } finally {
      setLoadingQuizBanks(false);
    }
  };

  // 当切换到试卷管理页面时加载试卷列表
  useEffect(() => {
    if (activeTab === 'paper') {
      loadQuizBanks();
    }
  }, [activeTab]);

  // 处理新增题库按钮点击
  const handleAddBankClick = () => {
    setIsCreateBankModalVisible(true);
  };

  // 创建题库
  const handleCreateBank = async () => {
    try {
      const values = await bankForm.validateFields();
      const result = await ApiService.createQuestionBank(values.bankName, '系统');
      if (result.success && result.bank) {
        message.success('题库创建成功');
        setIsCreateBankModalVisible(false);
        bankForm.resetFields();
        // 刷新题库列表
        await loadQuestionBanks();
        // 选中新创建的题库
        if (result.bank) {
          setSelectedBankId(result.bank.bank_id);
        }
      } else {
        message.error(result.detail || '创建题库失败');
      }
    } catch (error: any) {
      console.error('创建题库失败:', error);
      message.error(error.message || '创建题库失败');
    }
  };

  // 处理新增试卷按钮点击
  const handleAddQuizClick = () => {
    setIsCreateQuizModalVisible(true);
  };

  // 创建试卷
  const handleCreateQuiz = async () => {
    try {
      const values = await quizForm.validateFields();
      const result = await ApiService.createQuiz(values.quizName, '系统');
      if (result.success && result.quiz) {
        message.success('试卷创建成功');
        setIsCreateQuizModalVisible(false);
        quizForm.resetFields();
        // 刷新试卷列表
        await loadQuizBanks();
        // 选中新创建的试卷
        if (result.quiz) {
          setSelectedQuizId(result.quiz.quiz_id);
        }
      } else {
        message.error(result.message || '创建试卷失败');
      }
    } catch (error: any) {
      console.error('创建试卷失败:', error);
      message.error(error.message || '创建试卷失败');
    }
  };

  // 根据当前标签页决定右侧显示内容
  const renderRightContent = () => {
    if (activeTab === 'quiz') {
      // AI出题标签页，显示选中的知识点和出题功能
      return (
        <QuizCreate
          selectedItems={selectedQuizItems}
          onRemoveItem={handleRemoveQuizItem}
          onClearAll={handleClearAllQuizItems}
          onNavigateToBank={(bankId) => {
            if (bankId) {
              setSelectedBankId(bankId);
            }
            setActiveTab('bank');
          }}
        />
      );
    } else if (activeTab === 'bank') {
      // 题库管理标签页
      return <QuizBank selectedBankId={selectedBankId} />;
    } else if (activeTab === 'compose') {
      // AI组卷标签页
      return (
        <QuizCompose
          selectedItems={selectedQuizItems}
          onRemoveItem={handleRemoveQuizItem}
          onClearAll={handleClearAllQuizItems}
          selectedBankId={composeBankId}
          onBankIdChange={setComposeBankId}
          onNavigateToPaper={(quizId) => {
            if (quizId) {
              setSelectedQuizId(quizId);
            }
            setActiveTab('paper');
          }}
        />
      );
    } else if (activeTab === 'paper') {
      // 试卷管理标签页
      return <QuizPaperManage selectedQuizId={selectedQuizId} />;
    } else {
      // 知识目录标签页，显示文件上传组件
      return <FileUpload selectedItem={selectedItem} onKnowledgeExtracted={refreshKnowledgeTree} />;
    }
  };

  const tabItems = [
    {
      key: 'directory',
      label: '知识目录',
    },
    {
      key: 'quiz',
      label: 'AI 出题',
    },
    {
      key: 'bank',
      label: '题库管理',
    },
    {
      key: 'compose',
      label: 'AI组卷',
    },
    {
      key: 'paper',
      label: '试卷管理',
    },
  ];

  return (
    <ConfigProvider theme={theme}>
      <div className="app-container" style={{ minHeight: '100vh', background: '#f6f8ff', padding: '16px' }}>
        <Layout className="app-layout" style={{ background: 'transparent' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <Header className="app-header" style={{ background: '#fff', padding: '0', height: 48, lineHeight: '48px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', width: 'fit-content' }}>
              <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={tabItems}
                className="app-nav-tabs"
              />
            </Header>
          </div>
          <Layout style={{ background: 'transparent', gap: '16px' }}>
            <Sider className="app-sider" width="20%" style={{ minWidth: 200, maxWidth: 250, background: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)' }}>
              {activeTab === 'bank' ? (
                // 题库管理页面：显示题库列表
                <div style={{ padding: '12px', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ marginBottom: 12 }}>
                    <Text strong style={{ fontSize: 16 }}>题库列表</Text>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12 }}>
                    <Spin spinning={loadingBanks}>
                      {questionBanks.length === 0 ? (
                        <Empty description="暂无题库" style={{ marginTop: 40 }} />
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {questionBanks.map((bank) => (
                            <Card
                              key={bank.bank_id}
                              size="small"
                              hoverable
                              onClick={() => setSelectedBankId(bank.bank_id)}
                              style={{
                                cursor: 'pointer',
                                border: selectedBankId === bank.bank_id ? '2px solid #db002a' : '1px solid #f0f0f0',
                                borderRadius: 6,
                                background: selectedBankId === bank.bank_id ? '#fff1f0' : '#fff'
                              }}
                            >
                              <div style={{ marginBottom: 8 }}>
                                <Text strong style={{ fontSize: 15, color: '#333' }}>
                                  {bank.bank_name}
                                </Text>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <Text style={{ fontSize: 12, color: '#666' }}>
                                  创建人：{bank.creator}
                                </Text>
                                <Text style={{ fontSize: 12, color: '#666' }}>
                                  创建时间：{new Date(bank.created_time).toLocaleString('zh-CN')}
                                </Text>
                              </div>
                            </Card>
                          ))}
                        </div>
                      )}
                    </Spin>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                    <Button
                      type="primary"
                      danger
                      icon={<PlusOutlined />}
                      onClick={handleAddBankClick}
                      size="small"
                      style={{ flex: 1 }}
                    >
                      新增
                    </Button>
                  </div>
                </div>
              ) : activeTab === 'paper' ? (
                // 试卷管理页面：显示试卷列表
                <div style={{ padding: '12px', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ marginBottom: 12 }}>
                    <Text strong style={{ fontSize: 16 }}>试卷列表</Text>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12 }}>
                    <Spin spinning={loadingQuizBanks}>
                      {quizBanks.length === 0 ? (
                        <Empty description="暂无试卷" style={{ marginTop: 40 }} />
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {quizBanks.map((quiz) => (
                            <Card
                              key={quiz.quiz_id}
                              size="small"
                              hoverable
                              onClick={() => setSelectedQuizId(quiz.quiz_id)}
                              style={{
                                cursor: 'pointer',
                                border: selectedQuizId === quiz.quiz_id ? '2px solid #db002a' : '1px solid #f0f0f0',
                                borderRadius: 6,
                                background: selectedQuizId === quiz.quiz_id ? '#fff1f0' : '#fff'
                              }}
                            >
                              <div style={{ marginBottom: 8 }}>
                                <Text strong style={{ fontSize: 15, color: '#333' }}>
                                  {quiz.quiz_name}
                                </Text>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <Text style={{ fontSize: 12, color: '#666' }}>
                                  创建人：{quiz.creator}
                                </Text>
                                <Text style={{ fontSize: 12, color: '#666' }}>
                                  创建时间：{new Date(quiz.created_time).toLocaleString('zh-CN')}
                                </Text>
                              </div>
                            </Card>
                          ))}
                        </div>
                      )}
                    </Spin>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                    <Button
                      type="primary"
                      danger
                      icon={<PlusOutlined />}
                      onClick={handleAddQuizClick}
                      size="small"
                      style={{ flex: 1 }}
                    >
                      新增
                    </Button>
                  </div>
                </div>
              ) : (
                // 其他页面：显示知识目录
                <KnowledgeDirectory
                  onSelectItem={setSelectedItem}
                  selectedItem={selectedItem}
                  activeTab={activeTab}
                  onQuizItemsChange={handleQuizItemsChange}
                  selectedQuizItems={selectedQuizItems}
                  refreshKey={knowledgeTreeRefreshKey}
                  selectedBankId={activeTab === 'compose' ? composeBankId : undefined}
                />
              )}
            </Sider>
            <Content className="app-content" style={{ background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)' }}>
              {renderRightContent()}
            </Content>
          </Layout>
        </Layout>

        {/* 新增题库Modal */}
        <Modal
          title="创建题库"
          open={isCreateBankModalVisible}
          onOk={handleCreateBank}
          onCancel={() => {
            setIsCreateBankModalVisible(false);
            bankForm.resetFields();
          }}
          okText="确定"
          cancelText="取消"
        >
          <Form form={bankForm} layout="vertical">
            <Form.Item
              name="bankName"
              label="题库名称"
              rules={[{ required: true, message: '请输入题库名称' }]}
            >
              <Input placeholder="请输入题库名称" autoFocus />
            </Form.Item>
          </Form>
        </Modal>

        {/* 新增试卷Modal */}
        <Modal
          title="创建试卷"
          open={isCreateQuizModalVisible}
          onOk={handleCreateQuiz}
          onCancel={() => {
            setIsCreateQuizModalVisible(false);
            quizForm.resetFields();
          }}
          okText="确定"
          cancelText="取消"
        >
          <Form form={quizForm} layout="vertical">
            <Form.Item
              name="quizName"
              label="试卷名称"
              rules={[{ required: true, message: '请输入试卷名称' }]}
            >
              <Input placeholder="请输入试卷名称" autoFocus />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </ConfigProvider>
  );
}

export default App;


