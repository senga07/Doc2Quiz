import json
import logging
import re


def json_match(content: str):
    """简化的JSON解析函数，支持去除markdown代码块格式"""
    if not content:
        return {}
    
    # 清理内容：去除markdown代码块格式
    clean_content = content.strip()
    
    # 去除 ```json 和 ``` 标记
    if clean_content.startswith('```'):
        lines = clean_content.split('\n')
        # 移除第一行（```json 或 ```）
        if lines[0].strip().startswith('```'):
            lines = lines[1:]
        # 移除最后一行（```）
        if lines and lines[-1].strip() == '```':
            lines = lines[:-1]
        clean_content = '\n'.join(lines).strip()
    
    try:
        # 首先尝试直接解析清理后的内容
        return json.loads(clean_content)
    except json.JSONDecodeError:
        pass
    
    try:
        # 尝试查找JSON对象块 { ... }
        json_match_obj = re.search(r'\{.*\}', clean_content, re.DOTALL)
        if json_match_obj:
            return json.loads(json_match_obj.group())
    except json.JSONDecodeError:
        pass
    
    try:
        # 尝试查找JSON数组块 [ ... ]
        json_match_arr = re.search(r'\[.*\]', clean_content, re.DOTALL)
        if json_match_arr:
            return json.loads(json_match_arr.group())
    except json.JSONDecodeError:
        pass
    
    logging.error(f"JSON解析失败，原始内容: {content[:200]}...")
    return {}