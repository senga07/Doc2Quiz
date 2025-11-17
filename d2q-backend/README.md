# Doc2Quiz Backend

文档转测验后端服务 - 基于 FastAPI 的智能教育平台后端

## 功能模块

### 1. 知识目录管理 (`api/knowledge_point.py`)
- 文件上传（单文件/批量）
- 知识树结构管理
- 知识点提取和合并
- 知识点列表和删除

### 2. AI 出题 (`api/question_gen.py`)
- 基于知识点和文档内容生成题目
- 支持多种题型（单选、多选、判断、填空、简答等）
- 出题历史记录

### 3. 题库管理 (`api/question_bank.py`)
- 题库创建和管理
- 题目保存和编辑
- 题目列表查询（支持分页和筛选）
- 题目删除

### 4. AI 组卷 (`api/quiz_gen.py`)
- 根据知识点和题型要求智能组卷
- 题型数量统计
- 知识树过滤（仅显示有题目的节点）

### 5. 试卷管理 (`api/quiz_bank.py`)
- 试卷创建和管理
- 试卷题目查询（支持分页）
- 试卷信息更新

## 安装依赖

### 使用 pip

```bash
pip install -e .
```

### 使用 uv（推荐）

项目包含 `uv.lock` 文件，可以使用 uv 进行依赖管理：

```bash
uv sync
```

## 配置

### 环境变量配置

在项目根目录创建 `.env` 文件：

```env
# 服务器配置（可选，有默认值）
HOST=0.0.0.0
PORT=8000

# Azure OpenAI 配置（可选）
AZURE_OPENAI_ENDPOINT=your_endpoint
AZURE_OPENAI_API_KEY=your_api_key
AZURE_OPENAI_API_VERSION=2024-02-15-preview

# Dashscope 配置（可选）
DASHSCOPE_API_KEY=your_api_key

# LLM 模型配置（可选）
# 格式: "provider:model"
# 例如: "dashscope:qwen-turbo" 或 "azure_openai:gpt-4o-mini"
FAST_LLM=dashscope:qwen-turbo
```

### 支持的 LLM 提供者

- `azure_openai` - Azure OpenAI 服务
- `dashscope` - 阿里云通义千问

## 运行服务

### 开发模式

```bash
python main.py
```

### 使用 uvicorn 直接运行

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

服务将在 http://localhost:8000 启动

## API 文档

启动服务后，访问以下地址查看 API 文档：

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 项目结构

```
d2q-backend/
├── api/                    # API路由层（Controller）
│   ├── knowledge_point.py  # 知识目录API
│   ├── question_gen.py     # AI出题API
│   ├── question_bank.py    # 题库管理API
│   ├── quiz_gen.py         # AI组卷API
│   └── quiz_bank.py        # 试卷管理API
├── services/               # 业务服务层（Service）
│   ├── knowledge_service.py      # 知识目录服务
│   ├── question_service.py       # 题目生成服务
│   └── question_bank_service.py  # 题库和试卷服务
├── infrastructure/         # 基础设施层
│   └── service_manager.py  # 服务管理器（初始化LLM等）
├── cfg/                    # 配置管理
│   └── setting.py          # 应用配置（Pydantic Settings）
├── constants/              # 常量定义
│   └── providers.py        # LLM提供者配置
├── utils/                  # 工具函数
│   ├── unified_logger.py   # 统一日志系统
│   ├── json_utils.py       # JSON工具
│   └── custom_serializer.py # 自定义序列化器
├── data/                   # 数据存储目录
│   ├── knowledge_tree.json # 知识树数据
│   ├── question_bank.json  # 题库数据
│   ├── question.json       # 题目数据
│   ├── quiz_bank.json      # 试卷数据
│   └── quiz_question.json  # 试卷题目关联数据
├── file/                   # 文件存储目录
├── logs/                   # 日志目录
│   └── d2q_backend.log     # 主日志文件
├── main.py                 # 应用入口
└── pyproject.toml          # 项目配置和依赖
```

## 架构设计

采用分层架构设计，遵循 SpringBoot 的 Controller-Service 模式：

1. **Controller层** (`api/`): 处理 HTTP 请求、参数验证、调用 Service、返回响应
2. **Service层** (`services/`): 业务逻辑处理、数据操作
3. **Infrastructure层** (`infrastructure/`): 基础设施服务（如 LLM 服务初始化）
4. **Utils层** (`utils/`): 通用工具函数

## 数据存储

系统使用 JSON 文件存储数据，所有数据文件位于 `data/` 目录：

- `knowledge_tree.json` - 知识树结构（扁平化存储）
- `question_bank.json` - 题库信息
- `question.json` - 题目数据
- `quiz_bank.json` - 试卷信息
- `quiz_question.json` - 试卷题目关联数据

## 日志系统

系统使用统一的日志系统：

- 日志文件保存在 `logs/` 目录
- 主日志文件：`d2q_backend.log`
- 支持控制台和文件双重输出
- 日志级别可通过配置调整

## 依赖说明

主要依赖包括：

- **FastAPI**: Web 框架
- **LangChain/LangGraph**: AI 应用框架
- **OpenAI/Dashscope**: LLM 服务
- **pdfplumber/python-docx**: 文档解析
- **Pydantic**: 数据验证和配置管理

完整依赖列表请查看 `pyproject.toml`

## 开发指南

### 添加新的 API 端点

1. 在 `api/` 目录创建或修改对应的路由文件
2. 在 `services/` 目录实现业务逻辑
3. 在 `main.py` 中注册路由

### 添加新的服务

1. 在 `services/` 目录创建服务文件
2. 实现服务类和方法
3. 在对应的 Controller 中调用服务

## 许可证

MIT License


