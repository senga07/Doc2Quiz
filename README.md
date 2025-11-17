# Doc2Quiz

文档转测验系统 - 将文档自动转换为测验题目的智能教育平台

## 项目简介

Doc2Quiz 是一个基于 AI 的智能教育平台，能够将文档自动转换为测验题目。系统支持文档上传、知识点提取、AI 自动出题、题库管理、智能组卷和试卷管理等完整功能。

## 项目结构

```
Doc2Quiz/
├── d2q-backend/          # 后端服务 (FastAPI)
│   ├── api/             # API路由层
│   │   ├── knowledge_point.py    # 知识目录API
│   │   ├── question_gen.py       # AI出题API
│   │   ├── question_bank.py      # 题库管理API
│   │   ├── quiz_gen.py           # AI组卷API
│   │   └── quiz_bank.py          # 试卷管理API
│   ├── services/        # 业务服务层
│   │   ├── knowledge_service.py      # 知识目录服务
│   │   ├── question_service.py       # 题目生成服务
│   │   └── question_bank_service.py  # 题库和试卷服务
│   ├── infrastructure/  # 基础设施层
│   │   └── service_manager.py    # 服务管理器
│   ├── cfg/             # 配置管理
│   │   └── setting.py           # 应用配置
│   ├── constants/       # 常量定义
│   │   └── providers.py         # LLM提供者配置
│   ├── utils/           # 工具函数
│   │   ├── unified_logger.py    # 统一日志系统
│   │   ├── json_utils.py         # JSON工具
│   │   └── custom_serializer.py  # 自定义序列化器
│   ├── data/            # 数据存储目录
│   │   ├── knowledge_tree.json   # 知识树数据
│   │   ├── question_bank.json    # 题库数据
│   │   ├── question.json         # 题目数据
│   │   ├── quiz_bank.json        # 试卷数据
│   │   └── quiz_question.json    # 试卷题目关联数据
│   ├── file/            # 文件存储目录
│   ├── logs/            # 日志目录
│   ├── main.py          # 应用入口
│   └── pyproject.toml   # 项目配置
│
└── d2q-frontend/        # 前端应用 (React + TypeScript)
    ├── src/
    │   ├── components/      # React组件
    │   │   ├── KnowledgeDirectory.tsx   # 知识目录组件
    │   │   ├── FileUpload.tsx           # 文件上传组件
    │   │   ├── QuizCreate.tsx           # AI出题组件
    │   │   ├── QuizBank.tsx             # 题库管理组件
    │   │   ├── QuizCompose.tsx          # AI组卷组件
    │   │   └── QuizPaperManage.tsx      # 试卷管理组件
    │   ├── hooks/          # 自定义Hooks
    │   ├── services/       # API服务
    │   │   └── api.ts      # API调用封装
    │   ├── types/          # TypeScript类型定义
    │   ├── utils/          # 工具函数
    │   └── App.tsx         # 主应用组件
    └── package.json
```

## 快速开始

### 环境要求

- Python 3.12+
- Node.js 18+
- npm 或 yarn

### 后端启动

1. 进入后端目录：
```bash
cd d2q-backend
```

2. 安装依赖：
```bash
pip install -e .
```

3. 配置环境变量（可选）：
创建 `.env` 文件，配置 LLM 相关参数：
```env
# Azure OpenAI 配置（可选）
AZURE_OPENAI_ENDPOINT=your_endpoint
AZURE_OPENAI_API_KEY=your_api_key
AZURE_OPENAI_API_VERSION=2024-02-15-preview

# Dashscope 配置（可选）
DASHSCOPE_API_KEY=your_api_key

# LLM 模型配置（可选）
FAST_LLM=dashscope:qwen-turbo  # 或 azure_openai:gpt-4o-mini
```

4. 启动服务：
```bash
python main.py
```

后端服务将在 http://localhost:8000 启动

5. 查看 API 文档：
访问 http://localhost:8000/docs 查看 Swagger API 文档

### 前端启动

1. 进入前端目录：
```bash
cd d2q-frontend
```

2. 安装依赖：
```bash
npm install
```

3. 启动开发服务器：
```bash
npm run dev
```

前端应用将在 http://localhost:5173 启动（Vite 默认端口）

4. 构建生产版本：
```bash
npm run build
```

## 核心功能

### 1. 知识目录管理
- **文件上传**：支持单文件或批量上传文档（支持 PDF、Word 等格式）
- **知识树管理**：树形结构管理知识目录，支持文件夹、文档和知识点三级结构
- **知识点提取**：基于 AI 自动从文档中提取知识点并合并到知识树
- **知识点列表**：查看和管理知识点

### 2. AI 出题
- **智能出题**：根据选中的知识点和文档内容，使用 AI 自动生成题目
- **题型支持**：支持单选题、多选题、判断题、填空题、简答题等多种题型
- **出题历史**：查看历史出题记录

### 3. 题库管理
- **题库创建**：创建和管理多个题库
- **题目保存**：将 AI 生成的题目保存到指定题库
- **题目列表**：分页查看题库中的题目，支持按题库筛选
- **题目编辑**：编辑和删除题目

### 4. AI 组卷
- **智能组卷**：根据知识点和题型要求，从题库中智能组合题目生成试卷
- **题型统计**：统计指定知识点下的各题型数量
- **知识树过滤**：显示包含题目的知识点树结构

### 5. 试卷管理
- **试卷创建**：创建和管理试卷
- **试卷题目**：查看试卷中的题目列表，支持分页
- **试卷更新**：更新试卷信息

## API 接口

### 知识目录模块 (`/api/knowledge`)
- `POST /api/knowledge/file/upload` - 单文件上传
- `POST /api/knowledge/file/upload-multiple` - 批量文件上传
- `GET /api/knowledge/file/list` - 获取文件列表
- `POST /api/knowledge/tree/save` - 保存知识树结构
- `GET /api/knowledge/tree/load` - 加载知识树结构
- `POST /api/knowledge/point/extract` - 提取知识点
- `GET /api/knowledge/point/list` - 列出知识点
- `DELETE /api/knowledge/point/delete` - 删除知识点

### AI出题模块 (`/api/quiz`)
- `POST /api/quiz/generate` - 生成题目
- `GET /api/quiz/history` - 获取出题历史

### 题库管理模块 (`/api/bank`)
- `POST /api/bank/bank/create` - 创建题库
- `GET /api/bank/bank/list` - 获取题库列表
- `POST /api/bank/question/save` - 保存题目
- `POST /api/bank/question/update-bank` - 更新题目题库关联
- `GET /api/bank/question/list` - 获取题目列表
- `DELETE /api/bank/question/delete` - 删除题目

### AI组卷模块 (`/api/bank`)
- `POST /api/bank/quiz/compose` - 智能组卷
- `GET /api/bank/tree/load-for-compose` - 加载组卷知识树
- `GET /api/bank/question/type-statistics` - 获取题型统计

### 试卷管理模块 (`/api/bank`)
- `GET /api/bank/quiz-bank/list` - 获取试卷列表
- `GET /api/bank/quiz/{quiz_id}/questions` - 获取试卷题目
- `POST /api/bank/quiz/create` - 创建试卷
- `POST /api/bank/quiz/update-quiz-info` - 更新试卷信息

## 技术栈

### 后端
- **框架**：FastAPI 0.117+
- **语言**：Python 3.12+
- **AI框架**：
  - LangChain 0.3+
  - LangGraph 0.6+
  - OpenAI 1.0+
  - Dashscope 1.24+ (通义千问)
- **文档处理**：
  - pdfplumber 0.11+ (PDF解析)
  - python-docx 1.1+ (Word解析)
  - PyPDF2 3.0+ (PDF处理)
- **其他**：
  - Pydantic 2.0+ (数据验证)
  - Uvicorn 0.37+ (ASGI服务器)

### 前端
- **框架**：React 18
- **语言**：TypeScript 5.2+
- **构建工具**：Vite 5.0+
- **UI组件库**：Ant Design 5.28+
- **HTTP客户端**：Axios 1.6+
- **服务端**：Express 4.18+ (生产环境)

## 数据存储

系统使用 JSON 文件存储数据：
- `knowledge_tree.json` - 知识树结构
- `question_bank.json` - 题库信息
- `question.json` - 题目数据
- `quiz_bank.json` - 试卷信息
- `quiz_question.json` - 试卷题目关联

## 日志系统

系统使用统一的日志系统，日志文件保存在 `d2q-backend/logs/` 目录下：
- `d2q_backend.log` - 主日志文件

## 开发说明

### 后端架构
采用分层架构设计：
- **Controller层** (`api/`)：处理 HTTP 请求和响应
- **Service层** (`services/`)：业务逻辑处理
- **Infrastructure层** (`infrastructure/`)：基础设施服务
- **Utils层** (`utils/`)：工具函数

### 前端架构
- **组件化设计**：按功能模块划分组件
- **类型安全**：使用 TypeScript 确保类型安全
- **API封装**：统一的 API 调用封装

## 许可证

MIT License


