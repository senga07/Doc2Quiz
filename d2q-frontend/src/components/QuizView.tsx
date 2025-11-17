import { Quiz } from '../types';

interface QuizViewProps {
  quiz: Quiz;
  onReset: () => void;
}

export const QuizView = ({ quiz, onReset }: QuizViewProps) => {
  return (
    <div className="quiz-view">
      <h2>测验题目</h2>
      <div className="quiz-questions">
        {quiz.questions.map((question, index) => (
          <div key={question.question_id} className="question-item">
            <h3>题目 {index + 1}</h3>
            <p>{question.question_text}</p>
            <ul>
              {question.options.map((option, optIndex) => (
                <li key={optIndex}>{option}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <button onClick={onReset}>返回</button>
    </div>
  );
};


