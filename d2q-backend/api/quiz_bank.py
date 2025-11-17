"""
试卷管理Controller层
负责接收HTTP请求、参数验证、调用Service、返回响应
遵循SpringBoot的Controller-Service分层架构
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from utils.unified_logger import get_logger
from services.question_bank_service import question_bank_service

logger = get_logger(__name__)

router = APIRouter()


# ========== 数据模型 ==========

class CreateQuizRequest(BaseModel):
    quiz_name: str  # 试卷名称
    creator: Optional[str] = "系统"  # 创建者，默认为"系统"


class UpdateQuizQuestionsRequest(BaseModel):
    quiz_id: str  # 试卷ID
    quiz_name: str  # 试卷名称


# ========== Controller接口 ==========

@router.get("/quiz-bank/list", response_model=dict)
async def get_quiz_banks():
    """获取所有试卷列表"""
    try:
        quizs = question_bank_service.get_quiz_banks()
        
        return {
            "success": True,
            "quizs": quizs
        }
    except Exception as e:
        logger.error(f"获取试卷列表失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取失败: {str(e)}")


@router.get("/quiz/{quiz_id}/questions", response_model=dict)
async def get_quiz_questions(
    quiz_id: str,
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=10000, description="每页数量")
):
    """获取指定试卷中的题目列表（支持分页）"""
    try:
        result = question_bank_service.get_quiz_questions(quiz_id, page, page_size)
        
        return {
            "success": True,
            **result
        }
    except Exception as e:
        logger.error(f"获取试卷题目失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取失败: {str(e)}")


@router.post("/quiz/create", response_model=dict)
async def create_quiz(request: CreateQuizRequest):
    """创建新试卷并保存到quiz_bank.json，同时更新quiz_question.json中quiz_id为空的数据"""
    try:
        # 创建试卷
        quiz_data = question_bank_service.create_quiz(
            request.quiz_name,
            request.creator
        )
        
        # 更新quiz_question.json中quiz_id为空的数据
        question_bank_service.update_quiz_questions_quiz_info(
            quiz_data["quiz_id"],
            quiz_data["quiz_name"]
        )
        
        return {
            "success": True,
            "message": "创建成功",
            "quiz": quiz_data
        }
    except Exception as e:
        logger.error(f"创建试卷失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"创建失败: {str(e)}")


@router.post("/quiz/update-quiz-info", response_model=dict)
async def update_quiz_questions_quiz_info(request: UpdateQuizQuestionsRequest):
    """更新试卷题目中的quiz_id和quiz_name（只更新quiz_id为空的数据）"""
    try:
        question_bank_service.update_quiz_questions_quiz_info(
            request.quiz_id,
            request.quiz_name
        )
        
        return {
            "success": True,
            "message": "更新成功"
        }
    except Exception as e:
        logger.error(f"更新试卷题目信息失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"更新失败: {str(e)}")

