import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from cfg.setting import get_settings
from contextlib import asynccontextmanager
from utils.unified_logger import initialize_logging, get_logger


# 初始化统一日志系统
logging_config = initialize_logging(
    log_level=20,  # INFO
    log_dir="logs",
    main_log_filename="d2q_backend.log",
    enable_console=True,
    enable_file=True
)

logger = get_logger(__name__)

app = FastAPI(
    title="Doc2Quiz API",
    version="1.0.0"
)

# 添加CORS中间件以支持前端跨域请求
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 导入API路由
from api.knowledge_point import router as knowledge_point_router
from api.question_gen import router as question_gen_router
from api.question_bank import router as question_bank_router
from api.quiz_gen import router as quiz_gen_router
from api.quiz_bank import router as quiz_bank_router

# 导入服务管理器
from infrastructure.service_manager import service_manager

# 注册路由 - 按功能模块划分
# 知识目录模块：文件上传、知识树管理、知识点提取
app.include_router(knowledge_point_router, prefix="/api/knowledge", tags=["知识目录"])
# AI出题模块：题目生成、出题历史
app.include_router(question_gen_router, prefix="/api/quiz", tags=["AI出题"])
# 题库管理模块：题库CRUD、题目保存、题目列表
app.include_router(question_bank_router, prefix="/api/bank", tags=["题库管理"])
# AI组卷模块：组卷、知识树加载、题型统计（路径保持与原题库管理模块一致）
app.include_router(quiz_gen_router, prefix="/api/bank", tags=["AI组卷"])
# 试卷管理模块：试卷列表、试卷题目、创建试卷、更新试卷（路径保持与原题库管理模块一致）
app.include_router(quiz_bank_router, prefix="/api/bank", tags=["试卷管理"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    if service_manager.initialize():
        logger.info("应用启动完成")
    yield


if __name__ == "__main__":
    logger.info(f"启动 Doc2Quiz API 服务 - {get_settings().host}:{get_settings().port}")
    uvicorn.run(app, port=get_settings().port, host=get_settings().host)


