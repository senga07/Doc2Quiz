"""
题库管理Controller层
负责接收HTTP请求、参数验证、调用Service、返回响应
遵循SpringBoot的Controller-Service分层架构
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from utils.unified_logger import get_logger
from services.question_bank_service import question_bank_service

logger = get_logger(__name__)

router = APIRouter()


# ========== 数据模型 ==========

class QuestionItem(BaseModel):
    question: str  # 题干
    options: List[str]  # 选项
    answer: str  # 答案
    difficulty: str  # 难易度
    score: str  # 分值
    explanation: Optional[str] = None  # 解析
    type: Optional[str] = None  # 题目类型
    knowledge: Optional[str] = None  # 知识点
    knowledge_id: Optional[str] = None  # 知识点ID

class SaveQuestionsRequest(BaseModel):
    questions: List[QuestionItem]  # 题目列表
    bank_id: Optional[str] = None  # 题库ID

class CreateQuestionBankRequest(BaseModel):
    bank_name: str  # 题库名称
    creator: Optional[str] = "system"  # 创建人，默认为"系统"

class UpdateQuestionBankRequest(BaseModel):
    question_id: str  # 题目记录ID
    bank_id: str  # 题库ID


# ========== Controller接口 ==========

@router.post("/bank/create", response_model=dict)
async def create_question_bank(request: CreateQuestionBankRequest):
    """创建题库并保存到question_bank.json"""
    try:
        new_bank = question_bank_service.create_question_bank(
            request.bank_name,
            request.creator
        )
        
        return {
            "success": True,
            "bank": new_bank
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建题库失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"创建失败: {str(e)}")


@router.get("/bank/list", response_model=dict)
async def get_question_banks():
    """获取题库列表"""
    try:
        banks = question_bank_service.get_question_banks()
        
        return {
            "success": True,
            "banks": banks
        }
    except Exception as e:
        logger.error(f"获取题库列表失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取失败: {str(e)}")


@router.post("/question/save", response_model=dict)
async def save_questions(request: SaveQuestionsRequest):
    """保存题目列表到question.json，如果指定了bank_id则关联到题库"""
    try:
        # 将题目列表转换为 JSON 格式
        question_list = []
        for question in request.questions:
            question_dict = question.dict() if hasattr(question, 'dict') else question
            question_list.append(question_dict)
        
        # 保存题目记录
        new_record = question_bank_service.save_questions(question_list, request.bank_id)
        
        if request.bank_id:
            logger.info(f"题目内容已保存，关联题库 {request.bank_id}，共 {len(request.questions)} 道题目")
        else:
            logger.info(f"题目内容已保存，共 {len(request.questions)} 道题目")
        
        return {
            "success": True,
            "message": "题目保存成功",
            "question_id": new_record["question_id"],
            "question_count": len(request.questions)
        }
    except Exception as e:
        logger.error(f"保存题目失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"保存失败: {str(e)}")


@router.post("/question/update-bank", response_model=dict)
async def update_question_bank(request: UpdateQuestionBankRequest):
    """更新题目记录的bank_id"""
    try:
        question_bank_service.update_question_bank(request.question_id, request.bank_id)
        
        return {
            "success": True,
            "message": "题库关联成功"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新题目题库关联失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"更新失败: {str(e)}")


@router.get("/question/list", response_model=dict)
async def get_questions(page: int = 1, page_size: int = 10, bank_id: Optional[str] = None):
    """获取题目列表，支持分页和按题库ID过滤"""
    try:
        result = question_bank_service.get_questions(page, page_size, bank_id)
        
        return {
            "success": True,
            **result
        }
    except Exception as e:
        logger.error(f"获取题目列表失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取失败: {str(e)}")


@router.delete("/question/delete", response_model=dict)
async def delete_question(question_id: str = Query(..., description="题目ID")):
    """删除指定ID的题目"""
    try:
        question_bank_service.delete_question(question_id)
        
        return {
            "success": True,
            "message": "题目删除成功"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除题目失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")

