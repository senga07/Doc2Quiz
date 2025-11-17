import { Card } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import './QuizCreateCard.css';

export const QuizCreateCard = () => {
  return (
    <div className="quiz-create-container">
      <Card
        className="quiz-create-card"
        hoverable
      >
        <div className="quiz-create-content">
          <div className="quiz-create-icon">
            <PlusOutlined />
          </div>
          <div className="quiz-create-text">新增出题任务</div>
        </div>
      </Card>
    </div>
  );
};

