import { useState, useEffect, useMemo } from 'react';
import { Card, Tag, Typography, Divider, Pagination, Empty, Spin, message, Tabs, Button, Modal, Input, Select, Space } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { ApiService } from '../services/api';
import './QuizBank.css';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// 试题类型定义
type QuestionType = 'single_choice' | 'multiple_choice' | 'true_false' | 'essay';

interface Question {
  question_id?: string; // 题目ID（用于编辑和删除）
  question: string;
  options: string[];
  answer: string;
  difficulty: string;
  score: string;
  explanation?: string;
  knowledge?: string; // 知识点
  type?: QuestionType; // 题目类型
  edited?: boolean; // 是否被编辑过
}

export interface QuestionBank {
  bank_id: string;
  bank_name: string;
  creator: string;
  created_time: string;
}

interface QuizBankProps {
  selectedBankId?: string;
}

export const QuizBank = ({ selectedBankId }: QuizBankProps) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]); // 存储所有题目（用于题型过滤）
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [activeQuestionTypeTab, setActiveQuestionTypeTab] = useState<string>('all');
  
  // 编辑题目Modal相关状态
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number>(-1);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string>(''); // 编辑的题目ID

  // 识别题目类型
  const detectQuestionType = (question: Question): QuestionType => {
    // 如果已经有type字段，直接使用
    if (question.type) {
      return question.type;
    }
    
    // 如果没有选项，判定为问答题
    if (!question.options || question.options.length === 0) {
      return 'essay';
    }
    
    // 如果只有两个选项，且选项内容包含"正确"、"错误"、"对"、"错"等关键词，判定为判断题
    if (question.options.length === 2) {
      const optionText = question.options.join(' ').toLowerCase();
      if (optionText.includes('正确') || optionText.includes('错误') || 
          optionText.includes('对') || optionText.includes('错') ||
          optionText.includes('true') || optionText.includes('false') ||
          optionText.includes('是') || optionText.includes('否')) {
        return 'true_false';
      }
    }
    
    // 如果答案包含多个字母（如AB、ACD），判定为多选题
    if (question.answer && question.answer.length > 1 && /^[A-Z]+$/.test(question.answer.trim())) {
      return 'multiple_choice';
    }
    
    // 如果有选项且答案只有一个字母，判定为单选题
    if (question.options.length > 0 && question.answer && question.answer.length === 1 && /^[A-Z]$/.test(question.answer.trim())) {
      return 'single_choice';
    }
    
    // 默认返回单选题
    return 'single_choice';
  };

  // 加载所有题目（用于题型过滤）
  const loadAllQuestions = async () => {
    if (!selectedBankId) {
      setAllQuestions([]);
      return;
    }
    
    try {
      // 加载一个很大的页面大小来获取所有题目
      const result = await ApiService.getQuestions(1, 10000, selectedBankId);
      if (result.success) {
        // 为每个题目识别类型（如果没有type字段）
        const questionsWithType = (result.data || []).map((q: Question) => ({
          ...q,
          type: q.type || detectQuestionType(q)
        }));
        setAllQuestions(questionsWithType);
      }
    } catch (error) {
      console.error('加载所有题目失败:', error);
    }
  };

  const loadQuestions = async (page: number, size: number) => {
    if (!selectedBankId) {
      setQuestions([]);
      setTotal(0);
      setAllQuestions([]);
      return;
    }
    
    setLoading(true);
    try {
      const result = await ApiService.getQuestions(page, size, selectedBankId);
      if (result.success) {
        // 为每个题目识别类型（如果没有type字段）
        const questionsWithType = (result.data || []).map((q: Question) => ({
          ...q,
          type: q.type || detectQuestionType(q)
        }));
        setQuestions(questionsWithType);
        setTotal(result.total || 0);
        
        // 同时加载所有题目（用于题型过滤）
        if (activeQuestionTypeTab !== 'all') {
          loadAllQuestions();
        }
      } else {
        message.error('加载题目失败');
      }
    } catch (error) {
      console.error('加载题目失败:', error);
      message.error('加载题目失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBankId) {
      setCurrentPage(1); // 切换题库时重置到第一页
      setActiveQuestionTypeTab('all'); // 重置tab为全部
      loadQuestions(1, pageSize);
    } else {
      setQuestions([]);
      setTotal(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBankId]);

  useEffect(() => {
    if (selectedBankId) {
      loadQuestions(currentPage, pageSize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize]);

  // 统计各题型的数量（基于所有题目）
  const getQuestionTypeCounts = () => {
    const sourceQuestions = activeQuestionTypeTab === 'all' ? questions : allQuestions;
    const counts = {
      all: total, // 使用total而不是questions.length，因为total是服务端返回的总数
      single_choice: 0,
      multiple_choice: 0,
      true_false: 0,
      essay: 0
    };
    
    // 如果allQuestions有数据，使用allQuestions统计；否则使用questions
    const questionsForCount = allQuestions.length > 0 ? allQuestions : questions;
    questionsForCount.forEach(q => {
      if (q.type) {
        counts[q.type] = (counts[q.type] || 0) + 1;
      }
    });
    
    return counts;
  };

  // 获取题型中文名称
  const getQuestionTypeLabel = (type: QuestionType | 'all'): string => {
    const labels: Record<string, string> = {
      all: '全部',
      single_choice: '单选题',
      multiple_choice: '多选题',
      true_false: '判断题',
      essay: '问答题'
    };
    return labels[type] || type;
  };

  const handlePageChange = (page: number, size?: number) => {
    setCurrentPage(page);
    if (size) {
      setPageSize(size);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    if (difficulty === '高') return 'red';
    if (difficulty === '中') return 'orange';
    return 'green';
  };

  // 切换题型tab时加载所有题目（用于过滤）
  useEffect(() => {
    if (activeQuestionTypeTab !== 'all' && selectedBankId) {
      loadAllQuestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuestionTypeTab, selectedBankId]);

  // 获取当前页显示的题目（考虑题型过滤）
  const displayedQuestions = useMemo(() => {
    if (activeQuestionTypeTab === 'all') {
      return questions;
    }
    // 使用allQuestions进行过滤
    return allQuestions.filter(q => q.type === activeQuestionTypeTab);
  }, [questions, allQuestions, activeQuestionTypeTab]);

  // 删除题目
  const handleDeleteQuestion = (questionId: string, index: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这道题目吗？',
      okText: '确定',
      cancelText: '取消',
      okButtonProps: {
        danger: true,
        style: { backgroundColor: '#db002a', borderColor: '#db002a' }
      },
      onOk: async () => {
        try {
          // 调用后端API删除题目
          await ApiService.deleteQuestion(questionId);
          
          // 从当前显示的题目列表中删除
          if (activeQuestionTypeTab === 'all') {
            const updatedQuestions = questions.filter((_, i) => i !== index);
            setQuestions(updatedQuestions);
            setTotal(total - 1);
            // 同时从allQuestions中删除
            const updatedAllQuestions = allQuestions.filter(q => q.question_id !== questionId);
            setAllQuestions(updatedAllQuestions);
          } else {
            const updatedAllQuestions = allQuestions.filter(q => q.question_id !== questionId);
            setAllQuestions(updatedAllQuestions);
            // 如果当前页显示的是allQuestions，也需要更新questions
            if (questions.some(q => q.question_id === questionId)) {
              const updatedQuestions = questions.filter(q => q.question_id !== questionId);
              setQuestions(updatedQuestions);
              setTotal(total - 1);
            }
          }
          message.success('题目已删除');
        } catch (error: any) {
          console.error('删除题目失败:', error);
          message.error(error.message || '删除题目失败，请重试');
        }
      }
    });
  };

  // 打开编辑Modal
  const handleOpenEditModal = (question: Question, index: number) => {
    setEditingQuestionIndex(index);
    setEditingQuestionId(question.question_id || '');
    // 确保options数组存在
    const questionWithOptions = {
      ...question,
      options: question.options || []
    };
    setEditingQuestion(questionWithOptions);
    setIsEditModalVisible(true);
  };

  // 保存编辑
  const handleSaveEdit = () => {
    if (editingQuestionIndex >= 0 && editingQuestion) {
      // 重新识别题目类型（以防编辑后类型改变）
      const updatedType = detectQuestionType(editingQuestion);
      const updatedQuestion = { 
        ...editingQuestion, 
        edited: true,
        type: updatedType
      };
      
      // 更新本地状态
      if (activeQuestionTypeTab === 'all') {
        const updatedQuestions = [...questions];
        updatedQuestions[editingQuestionIndex] = updatedQuestion;
        setQuestions(updatedQuestions);
        // 同时更新allQuestions
        const updatedAllQuestions = [...allQuestions];
        const questionIndex = allQuestions.findIndex(q => q.question_id === editingQuestionId);
        if (questionIndex >= 0) {
          updatedAllQuestions[questionIndex] = updatedQuestion;
          setAllQuestions(updatedAllQuestions);
        }
      } else {
        const updatedAllQuestions = [...allQuestions];
        const questionIndex = allQuestions.findIndex(q => q.question_id === editingQuestionId);
        if (questionIndex >= 0) {
          updatedAllQuestions[questionIndex] = updatedQuestion;
          setAllQuestions(updatedAllQuestions);
        }
        // 如果当前页显示的是questions，也需要更新
        const questionIndexInQuestions = questions.findIndex(q => q.question_id === editingQuestionId);
        if (questionIndexInQuestions >= 0) {
          const updatedQuestions = [...questions];
          updatedQuestions[questionIndexInQuestions] = updatedQuestion;
          setQuestions(updatedQuestions);
        }
      }
      
      setIsEditModalVisible(false);
      setEditingQuestionIndex(-1);
      setEditingQuestion(null);
      setEditingQuestionId('');
      message.success('题目已更新');
    }
  };

  return (
    <div className="quiz-bank">
      <Spin spinning={loading}>
        {!selectedBankId ? (
          <Empty description="请从左侧选择题库" />
        ) : questions.length === 0 ? (
          <Empty description="该题库暂无题目" />
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#333' }}>
                题目列表 (共 {total} 道)
              </div>
            </div>
            
            {/* 题型Tab切换 */}
            <Tabs
              activeKey={activeQuestionTypeTab}
              onChange={setActiveQuestionTypeTab}
              items={(() => {
                const counts = getQuestionTypeCounts();
                const tabItems = [
                  {
                    key: 'all',
                    label: `全部 (${counts.all}题)`,
                  },
                  {
                    key: 'single_choice',
                    label: `单选题 (${counts.single_choice}题)`,
                  },
                  {
                    key: 'multiple_choice',
                    label: `多选题 (${counts.multiple_choice}题)`,
                  },
                  {
                    key: 'true_false',
                    label: `判断题 (${counts.true_false}题)`,
                  },
                  {
                    key: 'essay',
                    label: `问答题 (${counts.essay}题)`,
                  },
                ];
                // 只显示有题目的题型
                return tabItems.filter(item => {
                  if (item.key === 'all') return true;
                  return counts[item.key as keyof typeof counts] > 0;
                });
              })()}
              style={{ marginBottom: 16 }}
            />
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {displayedQuestions.length === 0 ? (
                <Empty description={`暂无${activeQuestionTypeTab === 'all' ? '' : getQuestionTypeLabel(activeQuestionTypeTab as QuestionType)}题目`} />
              ) : (
                displayedQuestions.map((item, index) => {
                  return (
                    <Card
                      key={index}
                      size="small"
                      style={{
                        border: '1px solid #f0f0f0',
                        borderRadius: 6,
                        background: '#fff'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                        <Text style={{ fontSize: 15, fontWeight: 500, color: '#333', flexShrink: 0 }}>
                          第 {index + 1} 题
                        </Text>
                        {item.edited && (
                          <Tag color="green" style={{ flexShrink: 0 }}>已编辑</Tag>
                        )}
                        <Paragraph style={{ margin: 0, fontSize: 15, fontWeight: 500, color: '#333', flex: 1 }}>
                          {item.question}
                        </Paragraph>
                        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                          <Button
                            type="link"
                            size="small"
                            onClick={() => handleOpenEditModal(item, index)}
                            style={{ color: '#db002a' }}
                          >
                            编辑
                          </Button>
                          <Button
                            type="link"
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={() => item.question_id && handleDeleteQuestion(item.question_id, index)}
                          >
                            删除
                          </Button>
                        </div>
                      </div>
                      
                      {(item.type || item.difficulty || item.score) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                          {item.type && (
                            <Tag color="blue">
                              {getQuestionTypeLabel(item.type)}
                            </Tag>
                          )}
                          {item.difficulty && (
                            <Tag color={getDifficultyColor(item.difficulty)}>
                              难度: {item.difficulty}
                            </Tag>
                          )}
                          {item.score && (
                            <Tag>分值: {item.score}</Tag>
                          )}
                        </div>
                      )}
                      
                      {item.options.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          {item.options.map((option, optIndex) => {
                            // 判断选项是否被选中（用于单选题和多选题）
                            const isOptionSelected = item.type === 'single_choice' || item.type === 'multiple_choice'
                              ? item.answer && item.answer.includes(option.charAt(0))
                              : false;
                            return (
                              <div 
                                key={optIndex} 
                                style={{ 
                                  marginBottom: 8, 
                                  fontSize: 14, 
                                  color: isOptionSelected ? '#db002a' : '#666',
                                  fontWeight: isOptionSelected ? 500 : 'normal'
                                }}
                              >
                                {option}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
                      {item.answer && (
                        <div style={{ marginBottom: 12 }}>
                          <Text strong style={{ color: '#333' }}>答案：</Text>
                          <Text style={{ marginLeft: 8, color: '#333' }}>{item.answer}</Text>
                        </div>
                      )}
                      
                      {item.knowledge && (
                        <>
                          <Divider style={{ margin: '12px 0' }} />
                          <div style={{ marginBottom: 12 }}>
                            <Text strong style={{ color: '#333' }}>知识点：</Text>
                            <Text style={{ marginLeft: 8, color: '#333' }}>{item.knowledge}</Text>
                          </div>
                        </>
                      )}
                      
                      {item.explanation && (
                        <>
                          <Divider style={{ margin: '12px 0' }} />
                          <div style={{ marginBottom: 12 }}>
                            <Text strong style={{ color: '#333' }}>解析：</Text>
                            <Text style={{ marginLeft: 8, color: '#333' }}>{item.explanation}</Text>
                          </div>
                        </>
                      )}
                    </Card>
                  );
                })
              )}
            </div>
            
            {/* 只在显示全部题目时显示分页，因为题型过滤是在客户端进行的 */}
            {activeQuestionTypeTab === 'all' && total > 0 && (
              <div className="quiz-bank-pagination">
                <Pagination
                  current={currentPage}
                  pageSize={pageSize}
                  total={total}
                  onChange={handlePageChange}
                  onShowSizeChange={handlePageChange}
                  showSizeChanger
                  showQuickJumper
                  showTotal={(total) => `共 ${total} 道题目`}
                  pageSizeOptions={['10', '20', '50', '100']}
                />
              </div>
            )}
          </>
        )}
      </Spin>

      {/* 编辑题目Modal */}
      <Modal
        title="编辑题目"
        open={isEditModalVisible}
        onOk={handleSaveEdit}
        onCancel={() => {
          setIsEditModalVisible(false);
          setEditingQuestion(null);
          setEditingQuestionIndex(-1);
          setEditingQuestionId('');
        }}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        {editingQuestion && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>题干：</Text>
              <TextArea
                value={editingQuestion.question}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditingQuestion({ ...editingQuestion, question: e.target.value })}
                rows={3}
                style={{ marginTop: 8 }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text strong>选项：</Text>
                <Button
                  type="dashed"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    const currentOptions = editingQuestion.options || [];
                    const newOptions = [...currentOptions, `${String.fromCharCode(65 + currentOptions.length)}. `];
                    setEditingQuestion({ ...editingQuestion, options: newOptions });
                  }}
                >
                  添加选项
                </Button>
              </div>
              {(!editingQuestion.options || editingQuestion.options.length === 0) ? (
                <div style={{ color: '#999', fontSize: 14, marginTop: 8 }}>
                  问答题无需选项，可直接填写答案
                </div>
              ) : (
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  {editingQuestion.options.map((option, optIndex) => (
                    <div key={optIndex} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Input
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...editingQuestion.options];
                          newOptions[optIndex] = e.target.value;
                          setEditingQuestion({ ...editingQuestion, options: newOptions });
                        }}
                        placeholder={`选项 ${String.fromCharCode(65 + optIndex)}`}
                        style={{ flex: 1 }}
                      />
                      {editingQuestion.options.length > 1 && (
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => {
                            const newOptions = editingQuestion.options.filter((_, i) => i !== optIndex);
                            setEditingQuestion({ ...editingQuestion, options: newOptions });
                          }}
                        >
                          删除
                        </Button>
                      )}
                    </div>
                  ))}
                </Space>
              )}
            </div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>答案：</Text>
              <Input
                value={editingQuestion.answer}
                onChange={(e) => setEditingQuestion({ ...editingQuestion, answer: e.target.value })}
                style={{ marginTop: 8 }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>知识点：</Text>
              <Input
                value={editingQuestion.knowledge || ''}
                onChange={(e) => setEditingQuestion({ ...editingQuestion, knowledge: e.target.value })}
                style={{ marginTop: 8 }}
                placeholder="请输入知识点"
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>解析：</Text>
              <TextArea
                value={editingQuestion.explanation || ''}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditingQuestion({ ...editingQuestion, explanation: e.target.value })}
                rows={4}
                style={{ marginTop: 8 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div>
                <Text strong>难度：</Text>
                <Select
                  value={editingQuestion.difficulty}
                  onChange={(value) => setEditingQuestion({ ...editingQuestion, difficulty: value })}
                  style={{ width: 120, marginLeft: 8 }}
                >
                  <Option value="低">低</Option>
                  <Option value="中">中</Option>
                  <Option value="高">高</Option>
                </Select>
              </div>
              <div>
                <Text strong>分值：</Text>
                <Input
                  value={editingQuestion.score}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, score: e.target.value })}
                  style={{ width: 120, marginLeft: 8 }}
                />
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

