import { useState, useEffect, useMemo } from 'react';
import { Card, Empty, Spin, message, Typography, Tag, Pagination, Tabs, Divider } from 'antd';
import { ApiService } from '../services/api';
import './QuizPaperManage.css';

const { Text, Paragraph } = Typography;

// 题目接口定义
interface Question {
  quiz_id: string;
  quiz_name: string;
  question_id: string;
  question_content: {
    type: string;
    question: string;
    options: string[];
    answer: string;
    difficulty: string;
    score: string;
    explanation: string;
    knowledge: string;
    knowledge_id: string;
  };
}

interface QuizPaperManageProps {
  selectedQuizId?: string;
}

export const QuizPaperManage = ({ selectedQuizId }: QuizPaperManageProps) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [activeQuestionTypeTab, setActiveQuestionTypeTab] = useState<string>('all');

  // 加载所有题目（用于题型过滤）
  const loadAllQuestions = async () => {
    if (!selectedQuizId) {
      setAllQuestions([]);
      return;
    }
    
    try {
      const result = await ApiService.getQuizQuestions(selectedQuizId, 1, 10000);
      if (result.success && result.data) {
        setAllQuestions(result.data);
      }
    } catch (error) {
      console.error('加载所有题目失败:', error);
      message.error('加载题目失败');
    }
  };

  const loadQuestions = async (page: number, size: number) => {
    if (!selectedQuizId) {
      setQuestions([]);
      setTotal(0);
      setAllQuestions([]);
      return;
    }
    
    setLoading(true);
    try {
      const result = await ApiService.getQuizQuestions(selectedQuizId, page, size);
      if (result.success) {
        setQuestions(result.data || []);
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
    if (selectedQuizId) {
      setCurrentPage(1);
      setActiveQuestionTypeTab('all');
      // 先加载分页数据
      loadQuestions(1, pageSize);
      // 同时加载所有题目（用于题型统计和过滤），不等待完成
      loadAllQuestions();
    } else {
      setQuestions([]);
      setTotal(0);
      setAllQuestions([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuizId]);

  useEffect(() => {
    if (selectedQuizId && activeQuestionTypeTab === 'all') {
      loadQuestions(currentPage, pageSize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, selectedQuizId]);

  // 切换题型tab时确保所有题目已加载
  useEffect(() => {
    if (activeQuestionTypeTab !== 'all' && selectedQuizId) {
      // 如果 allQuestions 为空，强制加载
      if (allQuestions.length === 0) {
        loadAllQuestions();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuestionTypeTab, selectedQuizId]);

  // 获取当前页显示的题目（考虑题型过滤）
  const displayedQuestions = useMemo(() => {
    if (activeQuestionTypeTab === 'all') {
      return questions;
    }
    // 确保 allQuestions 有数据才进行过滤
    if (allQuestions.length === 0) {
      return [];
    }
    // 过滤题型，不区分大小写
    return allQuestions.filter(q => {
      const questionType = q.question_content?.type?.toLowerCase();
      const activeType = activeQuestionTypeTab.toLowerCase();
      return questionType === activeType;
    });
  }, [questions, allQuestions, activeQuestionTypeTab]);

  // 统计各题型的数量
  const getQuestionTypeCounts = () => {
    const counts = {
      all: total,
      single_choice: 0,
      multiple_choice: 0,
      true_false: 0,
      essay: 0
    };
    
    // 始终使用 allQuestions 来统计（如果已加载），否则使用 questions
    const questionsForCount = allQuestions.length > 0 ? allQuestions : questions;
    questionsForCount.forEach(q => {
      const type = q.question_content.type;
      if (type) {
        counts[type as keyof typeof counts] = (counts[type as keyof typeof counts] || 0) + 1;
      }
    });
    
    return counts;
  };

  // 获取题型中文名称
  const getQuestionTypeLabel = (type: string): string => {
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

  const typeCounts = getQuestionTypeCounts();
  const typeTabItems = [
    { key: 'all', label: `全部 (${typeCounts.all}题)` },
    { key: 'single_choice', label: `单选题 (${typeCounts.single_choice}题)` },
    { key: 'multiple_choice', label: `多选题 (${typeCounts.multiple_choice}题)` },
    { key: 'true_false', label: `判断题 (${typeCounts.true_false}题)` },
    { key: 'essay', label: `问答题 (${typeCounts.essay}题)` },
  ].filter(item => {
    // 只显示有题目的题型
    if (item.key === 'all') return true;
    return typeCounts[item.key as keyof typeof typeCounts] > 0;
  });

  return (
    <div className="quiz-paper-manage">
      <Spin spinning={loading}>
        {!selectedQuizId ? (
          <Empty description="请从左侧选择试卷" />
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ fontSize: 16, color: '#333' }}>
                试卷题目 (共 {total} 道)
              </Text>
            </div>

            <Tabs
              activeKey={activeQuestionTypeTab}
              onChange={(key) => {
                setActiveQuestionTypeTab(key);
                // 切换题型时，如果 allQuestions 为空，立即加载
                if (key !== 'all' && allQuestions.length === 0) {
                  loadAllQuestions();
                }
              }}
              items={typeTabItems}
              style={{ marginBottom: 16 }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {displayedQuestions.length === 0 ? (
                <Empty 
                  description={
                    activeQuestionTypeTab === 'all' 
                      ? '该试卷暂无题目' 
                      : `暂无${getQuestionTypeLabel(activeQuestionTypeTab)}题目`
                  } 
                />
              ) : (
                displayedQuestions.map((question, index) => {
                  const questionContent = question.question_content;
                  const questionType = questionContent.type;
                  
                  return (
                    <Card
                      key={question.question_id || index}
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
                        <Paragraph style={{ margin: 0, fontSize: 15, fontWeight: 500, color: '#333', flex: 1 }}>
                          {questionContent.question}
                        </Paragraph>
                      </div>
                      
                      {(questionType || questionContent.difficulty || questionContent.score) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                          {questionType && (
                            <Tag color="blue">
                              {getQuestionTypeLabel(questionType)}
                            </Tag>
                          )}
                          {questionContent.difficulty && (
                            <Tag color={getDifficultyColor(questionContent.difficulty)}>
                              难度: {questionContent.difficulty}
                            </Tag>
                          )}
                          {questionContent.score && (
                            <Tag>分值: {questionContent.score}</Tag>
                          )}
                        </div>
                      )}
                      
                      {questionContent.options && questionContent.options.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          {questionContent.options.map((option, optIndex) => {
                            // 判断选项是否被选中（用于单选题和多选题）
                            const optionLetter = String.fromCharCode(65 + optIndex);
                            const isOptionSelected = (questionType === 'single_choice' || questionType === 'multiple_choice')
                              ? questionContent.answer && questionContent.answer.includes(optionLetter)
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
                      
                      {questionContent.answer && (
                        <div style={{ marginBottom: 12 }}>
                          <Text strong style={{ color: '#333' }}>答案：</Text>
                          <Text style={{ marginLeft: 8, color: '#333' }}>{questionContent.answer}</Text>
                        </div>
                      )}
                      
                      {questionContent.knowledge && (
                        <>
                          <Divider style={{ margin: '12px 0' }} />
                          <div style={{ marginBottom: 12 }}>
                            <Text strong style={{ color: '#333' }}>知识点：</Text>
                            <Text style={{ marginLeft: 8, color: '#333' }}>{questionContent.knowledge}</Text>
                          </div>
                        </>
                      )}
                      
                      {questionContent.explanation && (
                        <>
                          <Divider style={{ margin: '12px 0' }} />
                          <div style={{ marginBottom: 12 }}>
                            <Text strong style={{ color: '#333' }}>解析：</Text>
                            <Text style={{ marginLeft: 8, color: '#333' }}>{questionContent.explanation}</Text>
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
              <div className="quiz-paper-manage-pagination" style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
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
    </div>
  );
};
