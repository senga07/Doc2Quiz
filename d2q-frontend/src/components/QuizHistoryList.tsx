import { useState, useEffect } from 'react';
import { Card, Spin } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { QuizHistory } from '../types';
import { ApiService } from '../services/api';
import './QuizHistoryList.css';

export const QuizHistoryList = () => {
  const [history, setHistory] = useState<QuizHistory[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await ApiService.getQuizHistory();
      setHistory(data);
    } catch (error) {
      console.error('加载出题历史记录失败:', error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeStr: string) => {
    try {
      const date = new Date(timeStr);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (error) {
      return timeStr;
    }
  };

  if (loading) {
    return (
      <div className="quiz-history-list">
        <Spin tip="加载中..." size="large" style={{ display: 'block', textAlign: 'center', padding: '40px' }} />
      </div>
    );
  }

  return (
    <div className="quiz-history-list">
      {/* 新增卡片 */}
      <Card
        className="quiz-history-card quiz-create-card"
        size="small"
        hoverable
      >
        <div className="quiz-history-content quiz-create-content">
          <div className="quiz-create-icon">
            <PlusOutlined />
          </div>
          <div className="quiz-history-title quiz-create-text">发起新任务</div>
        </div>
      </Card>
      
      {/* 历史任务卡片 */}
      {history.map((item) => (
        <Card
          key={item.question_id}
          className="quiz-history-card"
          size="small"
          hoverable
        >
          <div className="quiz-history-content">
            <div className="quiz-history-title">题目ID: {item.question_id}</div>
            <div className="quiz-history-time">创建时间: {formatTime(item.created_time)}</div>
          </div>
        </Card>
      ))}
    </div>
  );
};

