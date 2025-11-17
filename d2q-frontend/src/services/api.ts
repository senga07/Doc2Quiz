import { KnowledgeItem, KnowledgePoint, QuizHistory, SelectedKnowledgePointNode } from '../types';

export class ApiService {
  // API基础路径 - 按模块划分
  private static knowledgeUrl = '/api/knowledge';  // 知识目录模块
  private static quizUrl = '/api/quiz';            // AI出题模块
  private static bankUrl = '/api/bank';            // 题库管理模块

  // 题库管理模块 - 获取题目列表
  static async getQuestions(page: number = 1, pageSize: number = 10, bankId?: string): Promise<{
    success: boolean;
    data?: any[];
    total?: number;
    page?: number;
    page_size?: number;
    question_info?: {
      question_id: string;
      created_time: string;
    };
  }> {
    try {
      let url = `${this.bankUrl}/question/list?page=${page}&page_size=${pageSize}`;
      if (bankId) {
        url += `&bank_id=${encodeURIComponent(bankId)}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        return await response.json();
      }
      return { success: false };
    } catch (error) {
      console.error('获取题目列表失败:', error);
      return { success: false };
    }
  }

  // AI出题模块 - 生成题目
  // 注意：question_types 现在包含在每个 selected_item 中，不再作为独立参数传递
  static async generateQuestions(
    selectedItems: (KnowledgeItem | SelectedKnowledgePointNode)[]
  ): Promise<any> {
    try {
      const response = await fetch(`${this.quizUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selected_items: selectedItems
        })
      });

      if (response.ok) {
        return await response.json();
      }
      const errorData = await response.json().catch(() => ({ detail: '生成题目失败' }));
      throw new Error(errorData.detail || '生成题目失败');
    } catch (error) {
      console.error('生成题目失败:', error);
      throw error;
    }
  }


  // 知识目录模块 - 知识树管理
  static async saveKnowledgeTree(items: KnowledgeItem[]): Promise<boolean> {
    try {
      const response = await fetch(`${this.knowledgeUrl}/tree/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items })
      });

      if (response.ok) {
        const result = await response.json();
        return result.success === true;
      }
      return false;
    } catch (error) {
      console.error('保存知识树结构失败:', error);
      return false;
    }
  }

  static async loadKnowledgeTree(): Promise<KnowledgeItem[]> {
    try {
      const response = await fetch(`${this.knowledgeUrl}/tree/load`);
      if (response.ok) {
        const result = await response.json();
        return result.items || [];
      }
      return [];
    } catch (error) {
      console.error('加载知识树结构失败:', error);
      return [];
    }
  }

  // 题库管理模块 - AI组卷知识树（只返回有题目的知识点）
  static async loadKnowledgeTreeForCompose(bankId?: string): Promise<KnowledgeItem[]> {
    try {
      let url = `${this.bankUrl}/tree/load-for-compose`;
      if (bankId) {
        url += `?bank_id=${encodeURIComponent(bankId)}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        return result.items || [];
      }
      return [];
    } catch (error) {
      console.error('加载AI组卷知识树失败:', error);
      return [];
    }
  }


  // 知识目录模块 - 文件上传
  static async uploadFile(file: File, knowledgeItemId?: string): Promise<any> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (knowledgeItemId) {
        formData.append('knowledge_item_id', knowledgeItemId);
      }

      const response = await fetch(`${this.knowledgeUrl}/file/upload`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('上传文件失败:', error);
      return null;
    }
  }

  static async uploadMultipleFiles(files: File[], knowledgeItemId?: string): Promise<any> {
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });
      if (knowledgeItemId) {
        formData.append('knowledge_item_id', knowledgeItemId);
      }

      const response = await fetch(`${this.knowledgeUrl}/file/upload-multiple`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('批量上传文件失败:', error);
      return null;
    }
  }

  // 知识目录模块 - 知识点管理
  static async getKnowledgePoints(knowledgeItemId?: string): Promise<KnowledgePoint[]> {
    try {
      const url = knowledgeItemId 
        ? `${this.knowledgeUrl}/point/list?knowledge_item_id=${knowledgeItemId}`
        : `${this.knowledgeUrl}/point/list`;
      
      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        return result.knowledge_points || [];
      }
      return [];
    } catch (error) {
      console.error('获取知识点列表失败:', error);
      return [];
    }
  }

  // 知识目录模块 - 文件列表
  static async getFileList(knowledgeItemId?: string): Promise<any[]> {
    try {
      const url = knowledgeItemId 
        ? `${this.knowledgeUrl}/file/list?knowledge_item_id=${knowledgeItemId}`
        : `${this.knowledgeUrl}/file/list`;
      
      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        return result.files || [];
      }
      return [];
    } catch (error) {
      console.error('获取文件列表失败:', error);
      return [];
    }
  }

  // 知识目录模块 - 删除知识点
  static async deleteKnowledgePoints(knowledgeItemId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.knowledgeUrl}/point/delete?knowledge_item_id=${knowledgeItemId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        const result = await response.json();
        return result.success === true;
      }
      return false;
    } catch (error) {
      console.error('删除知识点失败:', error);
      return false;
    }
  }

  // AI出题模块 - 出题历史
  static async getQuizHistory(): Promise<QuizHistory[]> {
    try {
      const response = await fetch(`${this.quizUrl}/history`);
      if (response.ok) {
        const result = await response.json();
        return result.history || [];
      }
      return [];
    } catch (error) {
      console.error('获取出题历史记录失败:', error);
      return [];
    }
  }

  // 题库管理模块 - 题库管理
  static async createQuestionBank(bankName: string, creator?: string): Promise<{
    success: boolean;
    bank?: {
      bank_id: string;
      bank_name: string;
      creator: string;
      created_time: string;
    };
    detail?: string;
  }> {
    try {
      const response = await fetch(`${this.bankUrl}/bank/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bank_name: bankName,
          creator: creator || '系统'
        })
      });

      if (response.ok) {
        return await response.json();
      }
      const errorData = await response.json().catch(() => ({ detail: '创建题库失败' }));
      throw new Error(errorData.detail || '创建题库失败');
    } catch (error) {
      console.error('创建题库失败:', error);
      throw error;
    }
  }

  static async getQuestionBanks(): Promise<Array<{
    bank_id: string;
    bank_name: string;
    creator: string;
    created_time: string;
  }>> {
    try {
      const response = await fetch(`${this.bankUrl}/bank/list`);
      if (response.ok) {
        const result = await response.json();
        return result.banks || [];
      }
      return [];
    } catch (error) {
      console.error('获取题库列表失败:', error);
      return [];
    }
  }

  // 题库管理模块 - 保存题目
  static async saveQuestions(questions: any[], bankId?: string): Promise<{
    success: boolean;
    message?: string;
    question_id?: string;
    question_count?: number;
  }> {
    try {
      const response = await fetch(`${this.bankUrl}/question/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questions: questions,
          bank_id: bankId
        })
      });

      if (response.ok) {
        return await response.json();
      }
      const errorData = await response.json().catch(() => ({ detail: '保存题目失败' }));
      throw new Error(errorData.detail || '保存题目失败');
    } catch (error) {
      console.error('保存题目失败:', error);
      throw error;
    }
  }

  // 题库管理模块 - 更新题目记录的bank_id
  static async updateQuestionBank(questionId: string, bankId: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const response = await fetch(`${this.bankUrl}/question/update-bank`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question_id: questionId,
          bank_id: bankId
        })
      });

      if (response.ok) {
        return await response.json();
      }
      const errorData = await response.json().catch(() => ({ detail: '更新题库关联失败' }));
      throw new Error(errorData.detail || '更新题库关联失败');
    } catch (error) {
      console.error('更新题库关联失败:', error);
      throw error;
    }
  }

  // 题库管理模块 - 删除题目
  static async deleteQuestion(questionId: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const response = await fetch(`${this.bankUrl}/question/delete?question_id=${encodeURIComponent(questionId)}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        return await response.json();
      }
      const errorData = await response.json().catch(() => ({ detail: '删除题目失败' }));
      throw new Error(errorData.detail || '删除题目失败');
    } catch (error) {
      console.error('删除题目失败:', error);
      throw error;
    }
  }

  // 题库管理模块 - 获取题型统计（根据知识点ID列表）
  static async getQuestionTypeStatistics(knowledgeIds: string[]): Promise<{
    success: boolean;
    total?: number;
    type_statistics?: {
      single_choice: number;
      multiple_choice: number;
      true_false: number;
      essay: number;
    };
  }> {
    try {
      if (!knowledgeIds || knowledgeIds.length === 0) {
        return {
          success: true,
          total: 0,
          type_statistics: {
            single_choice: 0,
            multiple_choice: 0,
            true_false: 0,
            essay: 0
          }
        };
      }
      
      // 构建查询参数，FastAPI会自动处理List类型
      const params = knowledgeIds.map(id => `knowledge_ids=${encodeURIComponent(id)}`).join('&');
      const url = `${this.bankUrl}/question/type-statistics?${params}`;
      const response = await fetch(url);
      if (response.ok) {
        return await response.json();
      }
      return { success: false };
    } catch (error) {
      console.error('获取题型统计失败:', error);
      return { success: false };
    }
  }

  // 题库管理模块 - 获取试卷列表
  static async getQuizBanks(): Promise<{
    success: boolean;
    quizs?: Array<{
      quiz_id: string;
      quiz_name: string;
      creator: string;
      created_time: string;
    }>;
  }> {
    try {
      const response = await fetch(`${this.bankUrl}/quiz-bank/list`);
      if (response.ok) {
        return await response.json();
      }
      return { success: false };
    } catch (error) {
      console.error('获取试卷列表失败:', error);
      return { success: false };
    }
  }

  // 题库管理模块 - 获取试卷中的题目列表
  static async getQuizQuestions(quizId: string, page: number = 1, pageSize: number = 10): Promise<{
    success: boolean;
    data?: Array<{
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
    }>;
    total?: number;
    page?: number;
    page_size?: number;
  }> {
    try {
      const response = await fetch(`${this.bankUrl}/quiz/${quizId}/questions?page=${page}&page_size=${pageSize}`);
      if (response.ok) {
        return await response.json();
      }
      return { success: false };
    } catch (error) {
      console.error('获取试卷题目失败:', error);
      return { success: false };
    }
  }

  // 题库管理模块 - 组卷
  static async composeQuiz(params: {
    bank_id: string;
    knowledge_ids: string[];
    target_counts: {
      single_choice: number;
      multiple_choice: number;
      true_false: number;
      essay: number;
    };
    quiz_name: string;
  }): Promise<{
    success: boolean;
    message?: string;
    question_count?: number;
  }> {
    try {
      const response = await fetch(`${this.bankUrl}/quiz/compose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params)
      });

      if (response.ok) {
        return await response.json();
      }
      const errorData = await response.json().catch(() => ({ detail: '组卷失败' }));
      throw new Error(errorData.detail || '组卷失败');
    } catch (error) {
      console.error('组卷失败:', error);
      throw error;
    }
  }

  // 题库管理模块 - 创建试卷
  static async createQuiz(quizName: string, creator: string = '系统'): Promise<{
    success: boolean;
    message?: string;
    quiz?: {
      quiz_id: string;
      quiz_name: string;
      creator: string;
      created_time: string;
    };
  }> {
    try {
      const response = await fetch(`${this.bankUrl}/quiz/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quiz_name: quizName,
          creator: creator
        })
      });

      if (response.ok) {
        return await response.json();
      }
      const errorData = await response.json().catch(() => ({ detail: '创建失败' }));
      throw new Error(errorData.detail || '创建失败');
    } catch (error) {
      console.error('创建试卷失败:', error);
      throw error;
    }
  }

  // 题库管理模块 - 更新试卷题目信息
  static async updateQuizQuestionsQuizInfo(quizId: string, quizName: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const response = await fetch(`${this.bankUrl}/quiz/update-quiz-info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quiz_id: quizId,
          quiz_name: quizName
        })
      });

      if (response.ok) {
        return await response.json();
      }
      const errorData = await response.json().catch(() => ({ detail: '更新失败' }));
      throw new Error(errorData.detail || '更新失败');
    } catch (error) {
      console.error('更新试卷题目信息失败:', error);
      throw error;
    }
  }
}


