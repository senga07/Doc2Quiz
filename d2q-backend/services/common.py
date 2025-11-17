"""
公共服务方法
提供文件操作、JSON操作等公共功能
"""
import json
import shutil
from pathlib import Path
from typing import List, Dict, Any, Optional
from utils.unified_logger import get_logger

logger = get_logger(__name__)


# ========== 文件操作相关 ==========

def ensure_dir(directory: Path) -> None:
    """
    确保目录存在，如果不存在则创建
    
    Args:
        directory: 目录路径
    """
    directory.mkdir(parents=True, exist_ok=True)


def generate_unique_file_path(target_dir: Path, filename: str) -> Path:
    """
    生成唯一的文件路径（如果文件已存在，添加序号）
    
    Args:
        target_dir: 目标目录
        filename: 文件名
        
    Returns:
        唯一的文件路径
    """
    file_path = target_dir / filename
    
    # 如果文件已存在，添加序号
    counter = 1
    original_path = file_path
    while file_path.exists():
        stem = original_path.stem
        suffix = original_path.suffix
        file_path = target_dir / f"{stem}_{counter}{suffix}"
        counter += 1
    
    return file_path


def save_file_to_disk(file_obj, file_path: Path) -> None:
    """
    保存文件到磁盘
    
    Args:
        file_obj: 文件对象（支持read方法）
        file_path: 目标文件路径
    """
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file_obj, buffer)


def get_file_info(file_path: Path, base_dir: Path) -> Dict[str, Any]:
    """
    获取文件信息
    
    Args:
        file_path: 文件路径
        base_dir: 基础目录（用于计算相对路径）
        
    Returns:
        文件信息字典
    """
    return {
        "filename": file_path.name,
        "file_path": str(file_path.relative_to(base_dir)),
        "file_size": file_path.stat().st_size,
        "modified_time": file_path.stat().st_mtime
    }


def list_files_in_dir(target_dir: Path, base_dir: Path) -> List[Dict[str, Any]]:
    """
    列出目录中的所有文件
    
    Args:
        target_dir: 目标目录
        base_dir: 基础目录（用于计算相对路径）
        
    Returns:
        文件信息列表
    """
    if not target_dir.exists():
        return []
    
    files = []
    for file_path in target_dir.iterdir():
        if file_path.is_file():
            files.append(get_file_info(file_path, base_dir))
    
    return files


# ========== JSON文件操作相关 ==========

def load_json_file(file_path: Path, default_key: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    加载JSON文件
    
    Args:
        file_path: JSON文件路径
        default_key: 如果JSON是字典，要提取的键名（如"items"、"questions"等）
        
    Returns:
        数据列表，如果文件不存在或加载失败返回空列表
    """
    if not file_path.exists():
        logger.info(f"文件不存在: {file_path}")
        return []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        if default_key and isinstance(data, dict):
            return data.get(default_key, [])
        elif isinstance(data, list):
            return data
        else:
            logger.warning(f"JSON文件格式不正确: {file_path}")
            return []
    except Exception as e:
        logger.error(f"加载JSON文件失败 {file_path}: {str(e)}", exc_info=True)
        return []


def save_json_file(file_path: Path, data: Any, default_key: Optional[str] = None) -> None:
    """
    保存数据到JSON文件
    
    Args:
        file_path: JSON文件路径
        data: 要保存的数据
        default_key: 如果data是列表，要包装的键名（如"items"、"questions"等）
    """
    ensure_dir(file_path.parent)
    
    try:
        if default_key and isinstance(data, list):
            json_data = {default_key: data}
        else:
            json_data = data
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)
        
        logger.info(f"数据已保存到 {file_path}")
    except Exception as e:
        logger.error(f"保存JSON文件失败 {file_path}: {str(e)}", exc_info=True)
        raise


# ========== 时间相关 ==========

def generate_id(prefix: str = "id") -> str:
    """
    生成基于时间戳的ID
    
    Args:
        prefix: ID前缀
        
    Returns:
        生成的ID字符串
    """
    from datetime import datetime
    return f"{prefix}_{int(datetime.now().timestamp() * 1000)}"


def get_current_iso_time() -> str:
    """
    获取当前时间的ISO格式字符串
    
    Returns:
        ISO格式的时间字符串
    """
    from datetime import datetime
    return datetime.now().isoformat()

