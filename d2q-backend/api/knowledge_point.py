"""
知识目录Controller层
负责接收HTTP请求、参数验证、调用Service、返回响应
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form, BackgroundTasks
from pydantic import BaseModel
from utils.unified_logger import get_logger
from services.knowledge_service import knowledge_service

logger = get_logger(__name__)

router = APIRouter()


# ========== 数据模型 ==========

class KnowledgeItem(BaseModel):
    id: str
    name: str
    type: str  # 'folder' or 'document' or 'knowledge'
    parentId: Optional[str] = None
    children: Optional[List['KnowledgeItem']] = None
    createdAt: Optional[str] = None

# 允许递归模型
KnowledgeItem.model_rebuild()

class KnowledgeTreeRequest(BaseModel):
    items: List[KnowledgeItem]

class KnowledgePointRequest(BaseModel):
    """知识点提取请求"""
    file_path: str
    file_name: str
    knowledge_item_id: Optional[str] = None


# ========== Controller接口 ==========

@router.post("/file/upload")
async def upload_file(
    file: UploadFile = File(...)
):
    """上传文件到本地 file 文件夹"""
    try:
        file_info = knowledge_service.upload_single_file(file)
        
        return {
            "success": True,
            "message": "文件上传成功",
            **file_info
        }
    except Exception as e:
        logger.error(f"文件上传失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")


@router.post("/file/upload-multiple")
async def upload_multiple_files(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    knowledge_item_id: Optional[str] = Form(None)
):
    """批量上传文件到本地 file 文件夹"""
    try:
        uploaded_files = knowledge_service.upload_multiple_files(files)
        
        # 如果提供了 knowledge_item_id，添加后台任务：提取知识点（不阻塞上传响应）
        if knowledge_item_id:
            for uploaded_file in uploaded_files:
                try:
                    from pathlib import Path
                    FILE_DIR = Path(__file__).parent.parent / "file"
                    full_file_path = FILE_DIR.parent / uploaded_file["file_path"]
                    
                    # 注意：background_tasks.add_task 需要传递可调用对象和参数
                    background_tasks.add_task(
                        knowledge_service.extract_and_save_knowledge_point,
                        str(full_file_path),
                        uploaded_file["filename"],
                        knowledge_item_id
                    )
                except Exception as e:
                    logger.warning(f"创建知识点提取任务失败（文件: {uploaded_file['filename']}）: {str(e)}")
        
        return {
            "success": True,
            "message": f"成功上传 {len(uploaded_files)} 个文件",
            "files": uploaded_files
        }
    except Exception as e:
        logger.error(f"批量文件上传失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")


@router.get("/file/list")
async def list_files(knowledge_item_id: Optional[str] = None):
    """列出文件列表"""
    try:
        files = knowledge_service.list_files(knowledge_item_id)
        
        return {
            "success": True,
            "files": files
        }
    except Exception as e:
        logger.error(f"列出文件失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"列出文件失败: {str(e)}")


@router.post("/tree/save", response_model=dict)
async def save_knowledge_tree_api(request: KnowledgeTreeRequest):
    """保存知识目录树结构到文件（扁平化存储，只保留parentId）"""
    try:
        knowledge_items = [
            knowledge_service.flatten_knowledge_item(item.model_dump()) 
            for item in request.items
        ]
        knowledge_service.save_knowledge_tree(knowledge_items)
        
        from pathlib import Path
        DATA_DIR = Path(__file__).parent.parent / "data"
        KNOWLEDGE_TREE_FILE = DATA_DIR / "knowledge_tree.json"
        
        return {
            "success": True,
            "message": "知识树结构保存成功",
            "file_path": str(KNOWLEDGE_TREE_FILE)
        }
    except Exception as e:
        logger.error(f"保存知识树结构失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"保存失败: {str(e)}")


@router.get("/tree/load", response_model=dict)
async def load_knowledge_tree_api():
    """从文件加载知识目录树结构"""
    try:
        knowledge_items = knowledge_service.load_knowledge_tree()
        
        from pathlib import Path
        DATA_DIR = Path(__file__).parent.parent / "data"
        KNOWLEDGE_TREE_FILE = DATA_DIR / "knowledge_tree.json"
        logger.info(f"知识树结构已从 {KNOWLEDGE_TREE_FILE} 加载")
        
        return {
            "success": True,
            "items": knowledge_items
        }
    except Exception as e:
        logger.error(f"加载知识树结构失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"加载失败: {str(e)}")


@router.post("/point/extract", response_model=dict)
async def extract_and_save_knowledge_point(request: KnowledgePointRequest):
    """提取知识点并直接合并到知识目录树中"""
    try:
        new_count = await knowledge_service.extract_and_save_knowledge_point(
            request.file_path,
            request.file_name,
            request.knowledge_item_id
        )
        
        if new_count == 0:
            logger.warning("未能成功合并知识点到知识目录树")
        
        return {
            "success": True,
            "message": "知识点提取并合并到知识目录树成功"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"提取知识点失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"提取失败: {str(e)}")


@router.get("/point/list", response_model=dict)
async def list_knowledge_points(knowledge_item_id: Optional[str] = None):
    """从知识目录树中列出知识点"""
    try:
        knowledge_points = knowledge_service.list_knowledge_points(knowledge_item_id)
        
        return {
            "success": True,
            "knowledge_points": knowledge_points
        }
    except Exception as e:
        logger.error(f"列出知识点失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"列出知识点失败: {str(e)}")


@router.delete("/point/delete", response_model=dict)
async def delete_knowledge_points(knowledge_item_id: str = Query(..., description="知识项ID")):
    """根据知识项ID从知识目录树中删除关联的知识点节点"""
    try:
        deleted_count = knowledge_service.delete_knowledge_points(knowledge_item_id)
        
        return {
            "success": True,
            "message": f"成功删除 {deleted_count} 个知识点",
            "deleted_count": deleted_count
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除知识点失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"删除知识点失败: {str(e)}")
