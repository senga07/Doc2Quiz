"""
AI出题Controller层
负责接收HTTP请求、参数验证、调用Service、返回响应
"""
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from utils.unified_logger import get_logger
from services.question_service import question_service

logger = get_logger(__name__)

router = APIRouter()


# ========== 数据模型 ==========

class GenerateQuestionRequest(BaseModel):
    selected_items: List[Dict[str, Any]]  # 选中的知识点和知识项（每个item包含question_types字段）


# ========== Controller接口 ==========

@router.post("/generate", response_model=dict)
async def generate_questions(request: GenerateQuestionRequest):
    """根据选中的知识点和关联文件生成题目"""
    try:
        result = await question_service.generate_questions(
            request.selected_items
        )
        
        return {
            "success": True,
            **result
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"生成题目失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"生成失败: {str(e)}")


@router.get("/history", response_model=dict)
async def get_quiz_history():
    """获取出题历史记录列表"""
    try:
        history = question_service.get_quiz_history()
        
        return {
            "success": True,
            "history": history
        }
    except Exception as e:
        logger.error(f"获取题目列表失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取失败: {str(e)}")

