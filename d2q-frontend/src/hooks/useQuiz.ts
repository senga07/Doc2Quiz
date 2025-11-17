import { useState } from 'react';
import { Quiz, Document } from '../types';
import { ApiService } from '../services/api';

export const useQuiz = () => {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const docs = await ApiService.getDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error('加载文档列表失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateQuiz = async (documentId: string, questionCount: number = 10) => {
    setIsLoading(true);
    try {
      const newQuiz = await ApiService.generateQuiz({
        document_id: documentId,
        question_count: questionCount
      });
      if (newQuiz) {
        setQuiz(newQuiz);
      }
    } catch (error) {
      console.error('生成测验失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetQuiz = () => {
    setQuiz(null);
  };

  return {
    quiz,
    documents,
    isLoading,
    loadDocuments,
    generateQuiz,
    resetQuiz
  };
};


