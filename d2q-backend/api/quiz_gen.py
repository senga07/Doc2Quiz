"""
AI组卷Controller层
负责接收HTTP请求、参数验证、调用Service、返回响应
遵循SpringBoot的Controller-Service分层架构
"""
from typing import List, Optional, Dict
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from utils.unified_logger import get_logger
from services.question_bank_service import question_bank_service

logger = get_logger(__name__)

router = APIRouter()


# ========== 数据模型 ==========

class ComposeQuizRequest(BaseModel):
    bank_id: str  # 题库ID
    knowledge_ids: List[str]  # 选中的知识点ID列表
    target_counts: Dict[str, int]  # 各题型的目标数量
    quiz_name: str  # 试卷名称


# ========== Controller接口 ==========

@router.post("/quiz/compose", response_model=dict)
async def compose_quiz(request: ComposeQuizRequest):
    """根据组卷策略组合题目并保存到quiz_question.json"""
    try:
        result = question_bank_service.compose_quiz(
            request.bank_id,
            request.knowledge_ids,
            request.target_counts,
            request.quiz_name
        )
        
        return {
            "success": True,
            "message": "组卷成功",
            **result
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"组卷失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"组卷失败: {str(e)}")


@router.get("/tree/load-for-compose", response_model=dict)
async def load_knowledge_tree_for_compose(bank_id: Optional[str] = None):
    """AI组卷左侧菜单接口：返回过滤后的知识树，只保留question.json中存在knowledge_id的节点及其父节点"""
    try:
        knowledge_items = question_bank_service.get_filtered_knowledge_tree(bank_id)
        
        return {
            "success": True,
            "items": knowledge_items
        }
    except Exception as e:
        logger.error(f"加载AI组卷知识树失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"加载失败: {str(e)}")


@router.get("/question/type-statistics", response_model=dict)
async def get_question_type_statistics(
    knowledge_ids: List[str] = Query(..., description="知识点ID列表")
):
    """根据知识点ID列表统计各题型的数量（不区分题库）"""
    try:
        if not knowledge_ids:
            raise HTTPException(status_code=400, detail="知识点ID列表不能为空")
        
        statistics = question_bank_service.get_question_type_statistics(knowledge_ids)
        
        return {
            "success": True,
            **statistics
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取题型统计失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取失败: {str(e)}")

