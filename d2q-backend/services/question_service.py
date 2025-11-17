"""
题目生成服务层
包含题目生成、出题历史等业务逻辑
"""
import json
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple
from uuid import uuid4
from fastapi import HTTPException
from utils.unified_logger import get_logger
from infrastructure.service_manager import service_manager
from services.common import (
    load_json_file, save_json_file, generate_id, get_current_iso_time
)
from services.knowledge_service import KnowledgeService

logger = get_logger(__name__)

# 数据文件路径
DATA_DIR = Path(__file__).parent.parent / "data"
QUESTION_FILE = DATA_DIR / "question.json"
FILE_DIR = Path(__file__).parent.parent / "file"


class QuestionService:
    """题目生成服务类"""
    
    @staticmethod
    def load_questions_raw() -> List[dict]:
        """加载题目记录列表（原始格式，不展开question_content）"""
        return load_json_file(QUESTION_FILE, default_key="questions")
    
    @staticmethod
    def load_questions() -> List[dict]:
        """加载题目记录列表（从question.json），展开question_content到顶层"""
        questions_raw = load_json_file(QUESTION_FILE, default_key="questions")
        result = []
        
        for q in questions_raw:
            if "question_content" not in q or not isinstance(q["question_content"], dict):
                continue
                
            question_content = q["question_content"]
            # 展开question_content到顶层，同时保留元数据
            expanded_question = {
                "question_id": q.get("question_id"),
                "created_time": q.get("created_time"),
                "knowledge_id": q.get("knowledge_id"),
                "bank_id": q.get("bank_id"),
                "type": question_content.get("type", "single_choice"),
                "question": question_content.get("question", ""),
                "options": question_content.get("options", []),
                "answer": question_content.get("answer", ""),
                "difficulty": question_content.get("difficulty", ""),
                "score": question_content.get("score", ""),
                "explanation": question_content.get("explanation", ""),
                "knowledge": question_content.get("knowledge", ""),
            }
            result.append(expanded_question)
        
        return result
    
    @staticmethod
    def save_questions_to_file(questions: List[dict]):
        """保存题目记录列表到question.json"""
        save_json_file(QUESTION_FILE, questions, default_key="questions")
    
    @staticmethod
    def collect_files_and_knowledge_points(
        selected_items: List[Dict[str, Any]], 
        file_dir: Path
    ) -> Tuple[List[Path], List[Dict[str, Any]]]:
        """收集所有关联的文件路径和知识点信息"""
        file_paths = []
        knowledge_points = []
        collected_file_names = set()  # 用于去重
        
        # 加载知识树以获取完整的知识点信息
        knowledge_items_list = KnowledgeService.load_knowledge_tree()
        item_map = {item["id"]: item for item in knowledge_items_list}
        
        for item in selected_items:
            if item.get("type") == "knowledge":
                knowledge_item_id = item.get("knowledge_item_id", "")
                file_name = item.get("file_name", "")
                item_id = item.get("id", "")
                
                knowledge_text = item.get("text", "")
                if not knowledge_text and item_id in item_map:
                    knowledge_text = item_map[item_id].get("name", "")
                
                if knowledge_text:
                    knowledge_points.append({
                        "id": item_id,
                        "text": knowledge_text,
                        "file_name": file_name
                    })
                
                # 文件现在直接存储在 file 目录下
                if file_name:
                    file_path = file_dir / file_name
                    if file_path.exists() and file_path not in file_paths:
                        file_paths.append(file_path)
                        collected_file_names.add(file_name)
            else:
                knowledge_item_id = item.get("id", "")
                item_name = item.get("name", "")
                
                if item.get("type") == "document" and item_name:
                    knowledge_points.append({
                        "id": knowledge_item_id,
                        "text": item_name,
                        "file_name": ""
                    })
                
                # 对于文档节点，查找该文档关联的所有文件（通过知识点中的file_name）
                if knowledge_item_id:
                    # 查找该文档下的所有知识点，获取关联的文件名
                    for kp_item in knowledge_items_list:
                        if (kp_item.get("type") == "knowledge" and 
                            kp_item.get("parentId") == knowledge_item_id):
                            file_name = kp_item.get("file_name", "")
                            if file_name and file_name not in collected_file_names:
                                file_path = file_dir / file_name
                                if file_path.exists() and file_path not in file_paths:
                                    file_paths.append(file_path)
                                    collected_file_names.add(file_name)
        
        return file_paths, knowledge_points
    
    @staticmethod
    def build_knowledge_text(knowledge_points: List[Dict[str, Any]]) -> str:
        """构建知识点文本（包含ID）"""
        if knowledge_points:
            return "\n".join([
                f"- [{kp.get('id', '')}] {kp['text']}" 
                for kp in knowledge_points 
                if kp.get("text")
            ])
        else:
            return "根据文档内容"
    
    @staticmethod
    def upload_files_to_openai(client, file_paths: List[Path]) -> List[str]:
        """上传文件到OpenAI"""
        file_objects = []
        for file_path in file_paths:
            try:
                file_obj = client.files.create(file=file_path, purpose="file-extract")
                file_objects.append(file_obj.id)
                logger.info(f"已上传文件: {file_path.name}")
            except Exception as e:
                logger.warning(f"上传文件失败 {file_path.name}: {str(e)}")
        
        if not file_objects:
            raise HTTPException(status_code=500, detail="文件上传失败")
        
        return file_objects
    
    @staticmethod
    def build_file_messages(file_objects: List[str]) -> List[Dict[str, str]]:
        """构建文件消息列表"""
        messages_base = [
            {'role': 'system', 'content': f'fileid://{file_objects[0]}'}
        ]
        for file_id in file_objects[1:]:
            messages_base.append({'role': 'system', 'content': f'fileid://{file_id}'})
        return messages_base
    
    @staticmethod
    def build_question_requirements(question_types: List[Dict[str, Any]]) -> Tuple[int, List[Dict[str, str]]]:
        """构建题目要求列表"""
        type_name_map = {
            'single_choice': '单选题',
            'multiple_choice': '多选题',
            'true_false': '判断题',
            'essay': '问答题'
        }
        
        difficulty_map = {
            'low': '低',
            'medium': '中',
            'high': '高'
        }
        
        if not question_types:
            question_types = [{'type': 'single_choice', 'label': '单选题', 'low': 1, 'medium': 0, 'high': 0}]
        
        total_count = 0
        question_requirements = []
        
        for qtype in question_types:
            qtype_type = qtype.get('type', 'single_choice')
            qtype_label = qtype.get('label', type_name_map.get(qtype_type, '单选题'))
            
            for difficulty in ['low', 'medium', 'high']:
                count = qtype.get(difficulty, 0)
                if count <= 0:
                    continue
                
                difficulty_name = difficulty_map.get(difficulty, difficulty)
                total_count += count
                
                for i in range(count):
                    question_requirements.append({
                        'type': qtype_type,
                        'type_label': qtype_label,
                        'difficulty': difficulty_name
                    })
        
        return total_count, question_requirements
    
    @staticmethod
    def build_prompt(
        knowledge_text: str, 
        question_requirements: List[Dict[str, str]], 
        total_count: int
    ) -> str:
        """构建AI提示词"""
        json_schema_example = {
            "questions": [
                {
                    "type": "single_choice",
                    "question": "题目内容",
                    "options": ["选项A", "选项B", "选项C", "选项D"],
                    "answer": "A",
                    "difficulty": "低",
                    "score": "1",
                    "explanation": "题目解析",
                    "knowledge": "知识点1",
                    "knowledge_id": "知识点ID"
                }
            ]
        }
        
        requirements_text = "\n".join([
            f"{i+1}. {req['type_label']}，难度：{req['difficulty']}"
            for i, req in enumerate(question_requirements)
        ])
        
        prompt = f"""根据以下知识点和关联文档，生成 {total_count} 道题目。

知识点（格式：[ID] 知识点内容）：
{knowledge_text}

题目要求：
{requirements_text}

请严格按照以下 JSON 格式返回题目列表，确保：
1. 返回一个 JSON 对象，包含 "questions" 数组
2. 每道题目包含以下字段：
   - type: 题型（single_choice/multiple_choice/true_false/essay）
   - question: 题干（字符串）
   - options: 选项数组（单选题/多选题必填，判断题和问答题可为空数组）
   - answer: 答案（单选题/判断题为单个选项如"A"或"正确"，多选题为多个选项如"AB"，问答题为参考答案文本）
   - difficulty: 难易度（"低"/"中"/"高"）
   - score: 分值（字符串，如"1"、"2"、"5"）
   - explanation: 试题解析（字符串）
   - knowledge: 知识点内容
   - knowledge_id: 知识点ID（从上述知识点列表中提取对应的ID，如果题目涉及多个知识点，使用第一个知识点的ID）

3. 题目顺序必须与上述要求顺序一致
4. 只返回 JSON，不要包含任何其他文字说明

JSON 格式示例：
{json.dumps(json_schema_example, ensure_ascii=False, indent=2)}"""
        
        return prompt
    
    @staticmethod
    def call_ai_to_generate_questions(
        client, 
        messages_base: List[Dict[str, str]], 
        prompt: str
    ) -> List[Dict[str, Any]]:
        """调用AI生成题目"""
        messages = messages_base + [{'role': 'user', 'content': prompt}]
        
        completion = client.chat.completions.create(
            model="qwen-long",
            messages=messages,
            response_format={"type": "json_object"}
        )
        
        if not completion.choices or len(completion.choices) == 0:
            raise HTTPException(status_code=500, detail="AI 未返回任何内容")
        
        response_content = completion.choices[0].message.content
        logger.info(f"AI 返回内容长度: {len(response_content)}")
        
        from utils import json_utils
        response_json = json_utils.json_match(response_content)
        questions_list = response_json.get("questions", [])
        
        if not questions_list:
            raise HTTPException(status_code=500, detail="AI 返回的题目列表为空")
        
        return questions_list
    
    @staticmethod
    def save_question_record(
        questions_list: List[Dict[str, Any]], 
        bank_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """保存题目记录到文件（每道题目作为独立对象，题目内容嵌套在question_content中）"""
        questions_raw = QuestionService.load_questions_raw()
        
        saved_question_ids = []
        created_time = get_current_iso_time()
        
        for question_data in questions_list:
            question_id = str(uuid4())
            knowledge_id = question_data.get("knowledge_id")
            
            question_content = {
                "type": question_data.get("type", "single_choice"),
                "question": question_data.get("question", ""),
                "options": question_data.get("options", []),
                "answer": question_data.get("answer", ""),
                "difficulty": question_data.get("difficulty", ""),
                "score": question_data.get("score", ""),
                "explanation": question_data.get("explanation", ""),
                "knowledge": question_data.get("knowledge", ""),
                "knowledge_id": knowledge_id
            }
            
            question_obj = {
                "question_id": question_id,
                "created_time": created_time,
                "knowledge_id": knowledge_id,
                "bank_id": bank_id,
                "question_content": question_content
            }
            
            questions_raw.append(question_obj)
            saved_question_ids.append(question_id)
        
        QuestionService.save_questions_to_file(questions_raw)
        
        logger.info(f"题目内容已保存到 {QUESTION_FILE}，共 {len(questions_list)} 道题目")
        
        return {
            "question_id": saved_question_ids[0] if saved_question_ids else None,
            "created_time": created_time,
            "question_ids": saved_question_ids
        }
    
    @staticmethod
    def _normalize_question_types_config(question_types: List[Dict[str, Any]]) -> str:
        """将题型配置序列化为字符串，用于比较配置是否相同"""
        if not question_types:
            return ""
        # 对配置进行排序，确保相同配置能匹配
        sorted_config = sorted(
            question_types,
            key=lambda x: (x.get('type', ''), x.get('low', 0), x.get('medium', 0), x.get('high', 0))
        )
        return json.dumps(sorted_config, sort_keys=True)
    
    @staticmethod
    async def generate_questions(
        selected_items: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """生成题目
        
        从每个 selected_item 的 question_types 字段中提取题型配置
        相同配置的知识点一起生成，不同配置的知识点分别生成
        """
        client = service_manager.get_openai_client()
        
        # 1. 过滤出有题型配置的知识点
        items_with_config = []
        for item in selected_items:
            question_types = item.get('question_types', [])
            if question_types and isinstance(question_types, list) and len(question_types) > 0:
                # 检查是否有设置题目数量
                has_quantity = any(
                    qt.get('low', 0) > 0 or qt.get('medium', 0) > 0 or qt.get('high', 0) > 0
                    for qt in question_types
                )
                if has_quantity:
                    items_with_config.append(item)
        
        if not items_with_config:
            raise HTTPException(status_code=400, detail="未配置需要生成的题目数量，请至少为一个知识点配置题型")
        
        # 2. 按题型配置分组知识点
        config_groups = {}  # key: 配置的字符串表示, value: 该配置下的知识点列表
        for item in items_with_config:
            question_types = item.get('question_types', [])
            config_key = QuestionService._normalize_question_types_config(question_types)
            if config_key not in config_groups:
                config_groups[config_key] = []
            config_groups[config_key].append(item)
        
        # 3. 为每个配置组分别生成题目
        all_questions = []
        for config_key, group_items in config_groups.items():
            # 3.1 收集该组所有知识点的文件路径和知识点信息
            group_file_paths, group_knowledge_points = QuestionService.collect_files_and_knowledge_points(
                group_items, FILE_DIR
            )
            
            if not group_file_paths:
                logger.warning(f"配置组未找到关联的文件，跳过该组")
                continue
            
            # 3.2 构建知识点文本
            group_knowledge_text = QuestionService.build_knowledge_text(group_knowledge_points)
            
            # 3.3 上传文件到OpenAI
            group_file_objects = QuestionService.upload_files_to_openai(client, group_file_paths)
            
            # 3.4 构建文件消息
            group_messages_base = QuestionService.build_file_messages(group_file_objects)
            
            # 3.5 构建题目要求（使用该组第一个知识点的配置，因为同组配置相同）
            group_question_types = group_items[0].get('question_types', [])
            group_total_count, group_question_requirements = QuestionService.build_question_requirements(group_question_types)
            
            if group_total_count == 0:
                logger.warning(f"配置组题目数量为0，跳过该组")
                continue
            
            # 3.6 构建提示词
            group_prompt = QuestionService.build_prompt(group_knowledge_text, group_question_requirements, group_total_count)
            
            # 3.7 调用AI生成题目
            group_questions = QuestionService.call_ai_to_generate_questions(
                client, group_messages_base, group_prompt
            )
            
            if len(group_questions) != group_total_count:
                logger.warning(f"配置组期望生成 {group_total_count} 道题目，实际返回 {len(group_questions)} 道")
            
            # 3.8 将生成的题目添加到总列表
            all_questions.extend(group_questions)
        
        if not all_questions:
            raise HTTPException(status_code=400, detail="未能生成任何题目")
        
        # 4. 返回所有生成的题目
        return {
            "questions": all_questions
        }
    
    @staticmethod
    def get_quiz_history() -> List[dict]:
        """获取出题历史记录列表"""
        questions = QuestionService.load_questions()
        # 按创建时间倒序排列（最新的在前）
        questions.sort(key=lambda x: x.get("created_time", ""), reverse=True)
        return questions


# 服务实例
question_service = QuestionService()

