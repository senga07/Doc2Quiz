// 文档类型
export interface Document {
  document_id: string;
  filename: string;
  upload_time: string;
  status: 'processing' | 'ready' | 'error';
  file_size?: number;
}

// 测验类型
export interface Quiz {
  quiz_id: string;
  document_id: string;
  questions: Question[];
  created_time: string;
}

// 题目类型
export interface Question {
  question_id: string;
  question_text: string;
  options: string[];
  correct_answer: number;
  explanation?: string;
}

// API 请求类型
export interface QuizRequest {
  document_id: string;
  question_count: number;
}

export interface UploadResponse {
  document_id: string;
  filename: string;
  status: string;
}

// 知识项类型
export type KnowledgeItemType = 'folder' | 'document' | 'knowledge';

export interface KnowledgeItem {
  id: string;
  name: string;
  type: KnowledgeItemType;
  parentId: string | null;
  children?: KnowledgeItem[];
  createdAt?: string;
  file_name?: string; // 知识点节点的文件名
  node_id?: number; // 知识点节点的原始ID
  question_types?: QuestionTypeConfigItem[]; // 题型配置（可选，如果未配置则继承父节点）
}

// 目录项类型
export interface DirectoryItem {
  id: number;
  text: string;
  parentId: number; // -1 表示根节点
}

// 知识点类型
export interface KnowledgePoint {
  file_name: string;
  directory: string; // JSON 数组字符串，格式: [{"id":1,"text":"目录1","parentId":-1},...]
  knowledge_item_id?: string;
  file_path?: string;
  extracted_at?: string;
}

// 出题历史记录类型（现在从question.json读取）
export interface QuizHistory {
  question_id: string;
  created_time: string;
  knowledge_id?: string;  // 知识点ID（AI返回）
  bank_id?: string;  // 关联的题库ID
  question_content?: any[];  // 题目内容（JSON 对象列表）
}

// 题型配置类型
export interface QuestionTypeConfigItem {
  type: string; // 题型：single_choice, multiple_choice, true_false, essay
  label: string; // 题型标签
  low: number; // 低难度数量
  medium: number; // 中难度数量
  high: number; // 高难度数量
}

// 选中的知识点节点类型（用于AI出题）
export interface SelectedKnowledgePointNode {
  id: string; // 唯一标识，格式: knowledge_item_id-file_name-node_id
  knowledge_item_id: string; // 所属文档ID
  file_name: string; // 文件名
  node_id: number; // 知识点节点ID
  text: string; // 知识点文本
  path: string[]; // 从根到当前节点的路径
  type: 'knowledge'; // 类型标识
  question_types?: QuestionTypeConfigItem[]; // 题型配置（可选，如果未配置则继承父节点）
}

