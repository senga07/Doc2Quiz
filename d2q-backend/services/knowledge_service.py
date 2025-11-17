"""
知识目录服务层
包含文件上传、知识树管理、知识点提取等业务逻辑
"""
import json
from pathlib import Path
from typing import List, Optional, Dict, Any, Union
from uuid import uuid4
from fastapi import UploadFile, BackgroundTasks
from utils.unified_logger import get_logger
from utils.json_utils import json_match
from infrastructure.service_manager import service_manager
from services.common import (
    load_json_file, save_json_file, get_current_iso_time,
    ensure_dir, generate_unique_file_path, save_file_to_disk, list_files_in_dir
)

logger = get_logger(__name__)

# 数据文件路径
DATA_DIR = Path(__file__).parent.parent / "data"
KNOWLEDGE_TREE_FILE = DATA_DIR / "knowledge_tree.json"
FILE_DIR = Path(__file__).parent.parent / "file"


class KnowledgeService:
    """知识目录服务类"""
    
    @staticmethod
    def upload_single_file(file: UploadFile) -> dict:
        """上传单个文件到 file 目录"""
        ensure_dir(FILE_DIR)
        file_path = generate_unique_file_path(FILE_DIR, file.filename)
        save_file_to_disk(file.file, file_path)
        logger.info(f"文件已上传到: {file_path}")
        
        return {
            "filename": file.filename,
            "file_path": str(file_path.relative_to(FILE_DIR.parent)),
            "file_size": file_path.stat().st_size
        }
    
    @staticmethod
    def upload_multiple_files(
        files: List[UploadFile]
    ) -> List[dict]:
        """批量上传文件到 file 目录"""
        uploaded_files = []
        
        for file in files:
            file_info = KnowledgeService.upload_single_file(file)
            uploaded_files.append(file_info)
        
        return uploaded_files
    
    @staticmethod
    def list_files(knowledge_item_id: Optional[str] = None) -> List[dict]:
        """列出文件列表"""
        # 直接列出 file 目录下的所有文件
        return list_files_in_dir(FILE_DIR, FILE_DIR.parent)
    
    @staticmethod
    def parse_directory_structure(directory: Union[str, List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
        """解析目录结构"""
        if isinstance(directory, list):
            return directory
        
        if not isinstance(directory, str):
            logger.warning(f"目录结构类型不正确: {type(directory)}")
            return []
        
        parsed = json_match(directory.strip())
        if parsed and isinstance(parsed, list):
            return parsed
        elif parsed and isinstance(parsed, dict):
            if 'items' in parsed:
                return parsed['items']
            elif 'directory' in parsed:
                return parsed['directory']
            else:
                logger.warning(f"解析结果不是预期的数组格式: {type(parsed)}")
                return []
        else:
            try:
                directory_items = json.loads(directory.strip())
                if not isinstance(directory_items, list):
                    logger.error(f"解析结果不是数组: {type(directory_items)}")
                    return []
                return directory_items
            except json.JSONDecodeError as e:
                logger.error(f"无法解析目录结构: {str(e)}, 内容: {directory[:200]}")
                return []
    
    @staticmethod
    def load_knowledge_tree() -> List[Dict[str, Any]]:
        """加载知识目录树"""
        return load_json_file(KNOWLEDGE_TREE_FILE, default_key="items")
    
    @staticmethod
    def save_knowledge_tree(knowledge_items: List[Dict[str, Any]]) -> None:
        """保存知识目录树"""
        save_json_file(KNOWLEDGE_TREE_FILE, knowledge_items, default_key="items")
        logger.info(f"知识目录树已保存，共 {len(knowledge_items)} 个节点")
    
    @staticmethod
    def find_parent_document(knowledge_items: List[Dict[str, Any]], knowledge_item_id: str) -> Optional[Dict[str, Any]]:
        """查找父文档节点"""
        for item in knowledge_items:
            if item.get("id") == knowledge_item_id:
                return item
        return None
    
    @staticmethod
    def remove_existing_knowledge_points(
        knowledge_items: List[Dict[str, Any]], 
        knowledge_item_id: str, 
        file_name: str
    ) -> List[Dict[str, Any]]:
        """删除指定文档下已有的知识点节点（根据file_name）"""
        return [
            item for item in knowledge_items 
            if not (item.get("parentId") == knowledge_item_id 
                   and item.get("type") == "knowledge"
                   and item.get("file_name") == file_name)
        ]
    
    @staticmethod
    def convert_directory_to_knowledge_items(
        directory_items: List[Dict[str, Any]], 
        knowledge_item_id: str, 
        file_name: str
    ) -> List[Dict[str, Any]]:
        """将目录结构转换为知识项节点（使用UUID生成ID）"""
        new_items = []
        id_mapping: Dict[int, str] = {}
        
        # 第一遍：为所有节点生成UUID并建立映射
        for dir_item in directory_items:
            original_id = dir_item['id']
            uuid_id = str(uuid4())
            id_mapping[original_id] = uuid_id
        
        # 第二遍：创建知识项节点并建立父子关系
        for dir_item in directory_items:
            original_id = dir_item['id']
            node_id = id_mapping[original_id]
            
            # 确定父节点ID
            if dir_item['parentId'] != -1:
                parent_id = id_mapping[dir_item['parentId']]
            else:
                parent_id = knowledge_item_id
            
            knowledge_item = {
                "id": node_id,
                "name": dir_item['text'],
                "type": "knowledge",
                "parentId": parent_id,
                "createdAt": get_current_iso_time(),
                "file_name": file_name,
                "node_id": dir_item['id']
            }
            new_items.append(knowledge_item)
        
        return new_items
    
    @staticmethod
    def merge_knowledge_points_to_tree(
        directory_items: List[Dict[str, Any]], 
        knowledge_item_id: str, 
        file_name: str
    ) -> int:
        """将知识点目录结构合并到知识目录树中"""
        knowledge_items = KnowledgeService.load_knowledge_tree()
        
        parent_doc = KnowledgeService.find_parent_document(knowledge_items, knowledge_item_id)
        if not parent_doc:
            logger.warning(f"未找到父文档节点: {knowledge_item_id}")
            return 0
        
        knowledge_items = KnowledgeService.remove_existing_knowledge_points(
            knowledge_items, knowledge_item_id, file_name
        )
        new_items = KnowledgeService.convert_directory_to_knowledge_items(
            directory_items, knowledge_item_id, file_name
        )
        knowledge_items.extend(new_items)
        KnowledgeService.save_knowledge_tree(knowledge_items)
        
        logger.info(f"知识点已合并到知识目录树，新增 {len(new_items)} 个节点")
        return len(new_items)
    
    @staticmethod
    def flatten_knowledge_item(item_dict: dict) -> dict:
        """扁平化知识项（移除children字段，设置createdAt）"""
        item_dict.pop('children', None)
        if not item_dict.get('createdAt'):
            item_dict['createdAt'] = get_current_iso_time()
        return item_dict
    
    @staticmethod
    async def extract_knowledge_points(file_path: str) -> Optional[str]:
        """
        使用大模型提取文档的目录结构（知识点）
        直接传递原文件给模型，而不是读取文件内容
        
        Args:
            file_path: 文件路径
            
        Returns:
            提取的目录结构（字符串格式）
        """
        client = service_manager.get_openai_client()
        path = Path(file_path)
        if not path.exists() or not path.is_file():
            raise ValueError(f"文件不存在或不是有效文件: {file_path}")

        file_object = client.files.create(file=path, purpose="file-extract")

        prompt = """根据文档整理目录，返回json数据，例如： [ { "id":1, "text":"目录1", "parentId":-1 }, { "id":2, "text":"目录1.1", "parentId":1 }, { "id":3, "text":"目录2", "parentId":-1 } ] 表示目录1和目录2是同一层级，目录1.1在目录1层级下，通过parentId表示父节点，parentId=-1表示根节点"""
        completion = client.chat.completions.create(
            model="qwen-long",
            messages=[
                {'role': 'system', 'content': f'fileid://{file_object.id}'},
                {'role': 'user', 'content': prompt}
            ]
        )

        if completion.choices and len(completion.choices) > 0:
            directory_structure = completion.choices[0].message.content
            if directory_structure:
                # 使用 json_match 解析 JSON，然后转换回 JSON 字符串
                parsed = json_match(directory_structure.strip())
                if parsed:
                    # 如果解析成功，返回 JSON 字符串
                    return json.dumps(parsed, ensure_ascii=False)
                # 如果解析失败，返回原始字符串（可能已经是 JSON 格式）
                return directory_structure.strip()
        raise ValueError("解析失败")
    
    @staticmethod
    async def extract_and_save_knowledge_point(
        file_path: str,
        file_name: str,
        knowledge_item_id: Optional[str]
    ) -> int:
        """
        提取知识点并合并到知识目录树
        
        Returns:
            新增的节点数量
        """
        directory = await KnowledgeService.extract_knowledge_points(file_path)
        
        if not directory:
            return 0
        
        if knowledge_item_id:
            directory_items = KnowledgeService.parse_directory_structure(directory)
            
            if not directory_items or not isinstance(directory_items, list):
                logger.warning("目录结构解析失败或为空，无法合并到知识目录树")
                return 0
            else:
                return KnowledgeService.merge_knowledge_points_to_tree(
                    directory_items, 
                    knowledge_item_id, 
                    file_name
                )
        return 0
    
    @staticmethod
    def list_knowledge_points(knowledge_item_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """从知识目录树中列出知识点"""
        knowledge_points = []
        if KNOWLEDGE_TREE_FILE.exists():
            with open(KNOWLEDGE_TREE_FILE, 'r', encoding='utf-8') as f:
                tree_data = json.load(f)
                items = tree_data.get("items", [])
                
                for item in items:
                    if item.get("type") == "knowledge":
                        if knowledge_item_id:
                            if item.get("parentId") == knowledge_item_id:
                                knowledge_points.append({
                                    "file_name": item.get("file_name", ""),
                                    "knowledge_item_id": knowledge_item_id,
                                    "node_id": item.get("node_id"),
                                    "text": item.get("name", ""),
                                    "id": item.get("id", "")
                                })
                        else:
                            knowledge_points.append({
                                "file_name": item.get("file_name", ""),
                                "knowledge_item_id": item.get("parentId", ""),
                                "node_id": item.get("node_id"),
                                "text": item.get("name", ""),
                                "id": item.get("id", "")
                            })
        
        return knowledge_points
    
    @staticmethod
    def delete_knowledge_points(knowledge_item_id: str) -> int:
        """根据知识项ID从知识目录树中删除关联的知识点节点"""
        if not KNOWLEDGE_TREE_FILE.exists():
            return 0
        
        with open(KNOWLEDGE_TREE_FILE, 'r', encoding='utf-8') as f:
            tree_data = json.load(f)
            items = tree_data.get("items", [])
        
        def find_all_descendants(parent_id: str, all_items: List[Dict[str, Any]]) -> set:
            """递归查找所有子节点"""
            descendants = set()
            for item in all_items:
                if item.get("parentId") == parent_id:
                    item_id = item.get("id", "")
                    descendants.add(item_id)
                    descendants.update(find_all_descendants(item_id, all_items))
            return descendants
        
        items_to_delete = find_all_descendants(knowledge_item_id, items)
        remaining_items = [item for item in items if item.get("id") not in items_to_delete]
        
        tree_data["items"] = remaining_items
        with open(KNOWLEDGE_TREE_FILE, 'w', encoding='utf-8') as f:
            json.dump(tree_data, f, ensure_ascii=False, indent=2)
        
        deleted_count = len(items_to_delete)
        logger.info(f"从知识目录树中删除了 {deleted_count} 个知识点节点 (knowledge_item_id: {knowledge_item_id})")
        
        return deleted_count


# 服务实例
knowledge_service = KnowledgeService()

