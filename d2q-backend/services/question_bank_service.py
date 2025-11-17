"""
题库管理服务层
包含题库CRUD、题目保存、题目列表等业务逻辑
"""
from pathlib import Path
from typing import List, Optional, Dict, Any
from uuid import uuid4
import random
from fastapi import HTTPException
from utils.unified_logger import get_logger
from services.common import (
    load_json_file, save_json_file, generate_id, get_current_iso_time
)

logger = get_logger(__name__)

# 数据文件路径
DATA_DIR = Path(__file__).parent.parent / "data"
QUESTION_FILE = DATA_DIR / "question.json"
QUESTION_BANK_FILE = DATA_DIR / "question_bank.json"
QUIZ_QUESTION_FILE = DATA_DIR / "quiz_question.json"
QUIZ_BANK_FILE = DATA_DIR / "quiz_bank.json"


class QuestionBankService:
    """题库管理服务类"""
    
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
            if "question_content" not in q:
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
    def load_question_banks() -> List[dict]:
        """加载题库列表"""
        return load_json_file(QUESTION_BANK_FILE, default_key="banks")
    
    @staticmethod
    def save_question_banks(banks: List[dict]):
        """保存题库列表"""
        save_json_file(QUESTION_BANK_FILE, banks, default_key="banks")
    
    @staticmethod
    def create_question_bank(bank_name: str, creator: Optional[str] = None) -> Dict[str, Any]:
        """创建题库"""
        banks = QuestionBankService.load_question_banks()
        
        # 检查题库名称是否已存在
        if any(bank.get("bank_name") == bank_name for bank in banks):
            raise HTTPException(status_code=400, detail="题库名称已存在")
        
        # 创建新的题库记录
        bank_id = generate_id("bank")
        new_bank = {
            "bank_id": bank_id,
            "bank_name": bank_name,
            "creator": creator or "系统",
            "created_time": get_current_iso_time()
        }
        
        banks.append(new_bank)
        QuestionBankService.save_question_banks(banks)
        
        logger.info(f"题库已创建并保存: {bank_name}")
        
        return new_bank
    
    @staticmethod
    def get_question_banks() -> List[dict]:
        """获取题库列表"""
        banks = QuestionBankService.load_question_banks()
        # 按创建时间倒序排列（最新的在前）
        banks.sort(key=lambda x: x.get("created_time", ""), reverse=True)
        return banks
    
    @staticmethod
    def get_quiz_banks() -> List[dict]:
        """获取所有试卷列表"""
        quizs = load_json_file(QUIZ_BANK_FILE, default_key="quizs")
        # 按创建时间倒序排列（最新的在前）
        quizs.sort(key=lambda x: x.get("created_time", ""), reverse=True)
        return quizs
    
    @staticmethod
    def get_quiz_questions(quiz_id: str, page: int = 1, page_size: int = 10) -> Dict[str, Any]:
        """
        获取指定试卷中的题目列表（支持分页）
        
        Args:
            quiz_id: 试卷ID
            page: 页码，从1开始
            page_size: 每页数量
            
        Returns:
            包含题目列表、总数、页码等信息的字典
        """
        quiz_questions = QuestionBankService.load_quiz_questions_from_file()
        
        # 过滤出指定试卷的题目
        filtered_questions = [
            q for q in quiz_questions 
            if q.get("quiz_id") == quiz_id
        ]
        
        # 按question_id排序（保持顺序）
        filtered_questions.sort(key=lambda x: x.get("question_id", ""))
        
        # 分页处理
        total = len(filtered_questions)
        start = (page - 1) * page_size
        end = start + page_size
        paginated_questions = filtered_questions[start:end]
        
        return {
            "data": paginated_questions,
            "total": total,
            "page": page,
            "page_size": page_size
        }
    
    @staticmethod
    def save_questions(
        questions_list: List[Dict[str, Any]], 
        bank_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """保存题目记录到文件（每道题目作为独立对象，题目内容嵌套在question_content中）"""
        questions = QuestionBankService.load_questions_raw()
        
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
            
            questions.append(question_obj)
            saved_question_ids.append(question_id)
        
        QuestionBankService.save_questions_to_file(questions)
        
        logger.info(f"题目内容已保存到 {QUESTION_FILE}，共 {len(questions_list)} 道题目")
        
        return {
            "question_id": saved_question_ids[0] if saved_question_ids else None,
            "created_time": created_time,
            "question_ids": saved_question_ids
        }
    
    @staticmethod
    def update_question_bank(question_id: str, bank_id: str) -> None:
        """
        更新题目记录的bank_id
        
        更新指定题目及其同一批次（相同created_time）的所有题目
        注意：只更新bank_id字段，保留其他所有字段（包括knowledge_id）
        """
        # 直接从文件加载原始格式
        questions_raw = load_json_file(QUESTION_FILE, default_key="questions")
        
        found_question = None
        for question in questions_raw:
            if question.get("question_id") == question_id:
                found_question = question
                break
        
        if not found_question:
            raise HTTPException(status_code=404, detail="题目记录不存在")
        
        created_time = found_question.get("created_time")
        updated_count = 0
        for question in questions_raw:
            if (question.get("created_time") == created_time and 
                question.get("bank_id") is None):
                question["bank_id"] = bank_id
                updated_count += 1
        
        save_json_file(QUESTION_FILE, questions_raw, default_key="questions")
        logger.info(f"题目批次（created_time: {created_time}）已关联到题库 {bank_id}，共更新 {updated_count} 道题目")
    
    @staticmethod
    def get_questions(
        page: int = 1, 
        page_size: int = 10, 
        bank_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """获取题目列表，支持分页和按题库ID过滤"""
        if not QUESTION_FILE.exists():
            return {
                "data": [],
                "total": 0,
                "page": page,
                "page_size": page_size,
                "question_info": None
            }
        
        questions_list = QuestionBankService.load_questions()
        
        # 如果指定了bank_id，过滤出所有bank_id匹配的题目
        if bank_id:
            filtered_questions = [q for q in questions_list if q.get("bank_id") == bank_id]
        else:
            # 如果没有指定bank_id，返回所有题目
            filtered_questions = questions_list
        
        # 按创建时间倒序排序
        filtered_questions.sort(key=lambda x: x.get("created_time", ""), reverse=True)
        
        # 分页处理
        total = len(filtered_questions)
        start = (page - 1) * page_size
        end = start + page_size
        paginated_questions = filtered_questions[start:end]
        
        # 获取最新的题目信息（用于question_info）
        latest_question = filtered_questions[0] if filtered_questions else None
        
        return {
            "data": paginated_questions,
            "total": total,
            "page": page,
            "page_size": page_size,
            "question_info": {
                "question_id": latest_question.get("question_id") if latest_question else None,
                "created_time": latest_question.get("created_time") if latest_question else None
            }
        }
    
    @staticmethod
    def delete_question(question_id: str) -> bool:
        """删除指定ID的题目"""
        questions_raw = QuestionBankService.load_questions_raw()
        
        original_count = len(questions_raw)
        questions_raw = [q for q in questions_raw if q.get("question_id") != question_id]
        
        if len(questions_raw) == original_count:
            raise HTTPException(status_code=404, detail="题目不存在")
        
        QuestionBankService.save_questions_to_file(questions_raw)
        
        logger.info(f"题目已删除: {question_id}")
        return True
    
    @staticmethod
    def get_question_type_statistics(knowledge_ids: List[str]) -> Dict[str, Any]:
        """
        根据知识点ID列表统计各题型的数量（不区分题库）
        
        Args:
            knowledge_ids: 知识点ID列表
            
        Returns:
            包含各题型统计的字典
        """
        if not knowledge_ids:
            return {
                "total": 0,
                "type_statistics": {
                    "single_choice": 0,
                    "multiple_choice": 0,
                    "true_false": 0,
                    "essay": 0
                }
            }
        
        questions_list = QuestionBankService.load_questions()
        
        # 根据知识点ID过滤题目（不区分题库）
        filtered_questions = [
            q for q in questions_list 
            if q.get("knowledge_id") in knowledge_ids
        ]
        
        # 统计各题型的数量
        type_statistics = {
            "single_choice": 0,
            "multiple_choice": 0,
            "true_false": 0,
            "essay": 0
        }
        
        for question in filtered_questions:
            question_type = question.get("type", "")
            if question_type:
                question_type = question_type.lower()
                if question_type in type_statistics:
                    type_statistics[question_type] += 1
        
        return {
            "total": len(filtered_questions),
            "type_statistics": type_statistics
        }
    
    @staticmethod
    def get_filtered_knowledge_tree(bank_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        获取过滤后的知识树，只保留question.json中存在knowledge_id的节点及其父节点
        
        Args:
            bank_id: 题库ID，如果提供则只返回该题库中有题目的知识点
            
        Returns:
            过滤后的知识树节点列表（扁平化格式）
        """
        from services.knowledge_service import knowledge_service
        
        # 1. 从question.json中提取所有唯一的knowledge_id
        questions_raw = QuestionBankService.load_questions_raw()
        knowledge_ids_with_questions = set()
        
        for question in questions_raw:
            # 如果指定了bank_id，只统计该题库的题目
            if bank_id and question.get("bank_id") != bank_id:
                continue
            knowledge_id = question.get("knowledge_id")
            if knowledge_id:
                knowledge_ids_with_questions.add(knowledge_id)
        
        # 如果没有题目，返回空列表
        if not knowledge_ids_with_questions:
            return []
        
        # 2. 加载完整的知识树
        all_knowledge_items = knowledge_service.load_knowledge_tree()
        
        # 3. 构建ID到节点的映射
        id_to_node = {item.get("id"): item for item in all_knowledge_items}
        
        # 4. 找到所有需要保留的节点ID（包括有题目的节点及其所有父节点）
        nodes_to_keep = set()
        
        def add_node_and_parents(node_id: str):
            """递归添加节点及其所有父节点"""
            if node_id in nodes_to_keep:
                return  # 已经处理过
            
            node = id_to_node.get(node_id)
            if not node:
                return
            
            nodes_to_keep.add(node_id)
            
            # 递归处理父节点
            parent_id = node.get("parentId")
            if parent_id:
                add_node_and_parents(parent_id)
        
        # 5. 对于每个有题目的knowledge_id，添加它及其所有父节点
        for knowledge_id in knowledge_ids_with_questions:
            add_node_and_parents(knowledge_id)
        
        # 6. 过滤出需要保留的节点
        filtered_items = [item for item in all_knowledge_items if item.get("id") in nodes_to_keep]
        
        logger.info(f"过滤后的知识树包含 {len(filtered_items)} 个节点（原始 {len(all_knowledge_items)} 个）" + 
                   (f"，题库ID: {bank_id}" if bank_id else ""))
        
        return filtered_items
    
    @staticmethod
    def compose_quiz(
        bank_id: str,
        knowledge_ids: List[str],
        target_counts: Dict[str, int],
        quiz_name: str
    ) -> Dict[str, Any]:
        """
        根据组卷策略组合题目（支持多个题库的知识点）
        
        Args:
            bank_id: 当前题库ID
            knowledge_ids: 选中的知识点ID列表（可能来自多个题库）
            target_counts: 各题型的目标数量 {single_choice: 5, multiple_choice: 3, ...}
            quiz_name: 试卷名称（组卷时为空，选择试卷时更新）
            
        Returns:
            包含题目数量的字典
        """
        # 加载所有题目
        questions_list = QuestionBankService.load_questions()
        
        if not questions_list:
            raise HTTPException(status_code=400, detail="题库中没有题目")
        
        if not knowledge_ids:
            raise HTTPException(status_code=400, detail="请至少选择一个知识点")
        
        quiz_items = []
        
        # 对每种题型进行组卷
        for question_type, target_count in target_counts.items():
            if target_count <= 0:
                continue
            
            # 过滤出该题型的题目，且匹配选中的知识点（不限制题库）
            type_questions = [
                q for q in questions_list 
                if q.get("type", "").lower() == question_type.lower()
                and q.get("knowledge_id") in knowledge_ids
            ]
            
            if not type_questions:
                logger.warning(f"没有找到{question_type}类型且匹配选中知识点的题目")
                continue
            
            # 计算每个知识点最少选择数量
            min_per_knowledge = target_count // len(knowledge_ids)
            
            selected_questions = []
            used_question_ids = set()
            
            # 第一步：从每个知识点中随机选择最少数量（可以从任意题库）
            for knowledge_id in knowledge_ids:
                # 找出该知识点的题目（不限制题库）
                knowledge_questions = [
                    q for q in type_questions 
                    if q.get("knowledge_id") == knowledge_id
                    and q.get("question_id") not in used_question_ids
                ]
                
                # 随机选择min_per_knowledge道题
                if knowledge_questions:
                    count = min(min_per_knowledge, len(knowledge_questions))
                    selected = random.sample(knowledge_questions, count)
                    selected_questions.extend(selected)
                    used_question_ids.update(q.get("question_id") for q in selected)
            
            # 第二步：如果题目数量不够，从剩余的匹配知识点的题目中随机抽取补全
            remaining_needed = target_count - len(selected_questions)
            if remaining_needed > 0:
                # 找出剩余的题目（未使用且匹配知识点的）
                remaining_questions = [
                    q for q in type_questions 
                    if q.get("question_id") not in used_question_ids
                    and q.get("knowledge_id") in knowledge_ids
                ]
                
                if remaining_questions:
                    count = min(remaining_needed, len(remaining_questions))
                    selected = random.sample(remaining_questions, count)
                    selected_questions.extend(selected)
                    used_question_ids.update(q.get("question_id") for q in selected)
            
            # 将选中的题目转换为目标格式（quiz_id和quiz_name为空，选择试卷时更新）
            # 需要从原始question.json中获取完整的question_content
            questions_raw = QuestionBankService.load_questions_raw()
            question_id_to_raw = {q.get("question_id"): q for q in questions_raw if q.get("question_id")}
            
            for question in selected_questions:
                question_id = question.get("question_id")
                raw_question = question_id_to_raw.get(question_id) if question_id else None
                
                # 从原始question.json中获取question_content
                if raw_question and "question_content" in raw_question:
                    question_content = raw_question["question_content"]
                else:
                    # 如果没有找到原始数据，从展开的question对象中构建
                    question_content = {
                        "type": question.get("type", ""),
                        "question": question.get("question", ""),
                        "options": question.get("options", []),
                        "answer": question.get("answer", ""),
                        "difficulty": question.get("difficulty", ""),
                        "score": question.get("score", ""),
                        "explanation": question.get("explanation", ""),
                        "knowledge": question.get("knowledge", ""),
                        "knowledge_id": question.get("knowledge_id", "")
                    }
                
                quiz_item = {
                    "quiz_id": "",  # 配置组卷策略时为空，选择试卷时更新
                    "quiz_name": "",  # 配置组卷策略时为空，选择试卷时更新
                    "question_id": question_id or str(uuid4()),  # 问题uuid
                    "question_content": question_content
                }
                quiz_items.append(quiz_item)
        
        # 保存到quiz_question.json
        QuestionBankService.save_quiz_questions_to_file(quiz_items)
        
        logger.info(f"组卷完成，共 {len(quiz_items)} 道题目")
        
        return {
            "question_count": len(quiz_items)
        }
    
    @staticmethod
    def save_quiz_questions_to_file(quiz_items: List[Dict[str, Any]]) -> None:
        """保存试卷题目到quiz_question.json"""
        # 加载现有的试卷题目
        existing_questions = QuestionBankService.load_quiz_questions_from_file()
        
        # 合并新题目
        existing_questions.extend(quiz_items)
        
        # 保存
        save_json_file(QUIZ_QUESTION_FILE, existing_questions, default_key="quiz_questions")
        logger.info(f"试卷题目已保存到 {QUIZ_QUESTION_FILE}，共 {len(existing_questions)} 条记录")
    
    @staticmethod
    def load_quiz_questions_from_file() -> List[Dict[str, Any]]:
        """从quiz_question.json加载试卷题目"""
        return load_json_file(QUIZ_QUESTION_FILE, default_key="quiz_questions")
    
    @staticmethod
    def create_quiz(quiz_name: str, creator: str = "系统") -> Dict[str, Any]:
        """
        创建新试卷并保存到quiz_bank.json
        
        Args:
            quiz_name: 试卷名称
            creator: 创建者，默认为"系统"
            
        Returns:
            包含quiz_id、quiz_name、creator、created_time的字典
        """
        quiz_id = str(uuid4())
        created_time = get_current_iso_time()
        
        quiz_data = {
            "quiz_id": quiz_id,
            "quiz_name": quiz_name,
            "creator": creator,
            "created_time": created_time
        }
        
        # 加载现有的试卷列表
        quizs = QuestionBankService.get_quiz_banks()
        
        # 添加新试卷
        quizs.append(quiz_data)
        
        # 保存到文件
        save_json_file(QUIZ_BANK_FILE, quizs, default_key="quizs")
        
        logger.info(f"试卷已创建：quiz_id={quiz_id}, quiz_name={quiz_name}")
        
        return quiz_data
    
    @staticmethod
    def update_quiz_questions_quiz_info(quiz_id: str, quiz_name: str) -> None:
        """
        更新试卷题目中的quiz_id和quiz_name
        只更新quiz_id为空的题目记录
        
        Args:
            quiz_id: 试卷ID
            quiz_name: 试卷名称
        """
        quiz_questions = QuestionBankService.load_quiz_questions_from_file()
        
        updated_count = 0
        for question in quiz_questions:
            # 只更新quiz_id为空的题目
            if not question.get("quiz_id"):
                question["quiz_id"] = quiz_id
                question["quiz_name"] = quiz_name
                updated_count += 1
        
        if updated_count > 0:
            save_json_file(QUIZ_QUESTION_FILE, quiz_questions, default_key="quiz_questions")
            logger.info(f"已更新 {updated_count} 条题目记录的试卷信息：quiz_id={quiz_id}, quiz_name={quiz_name}")


# 服务实例
question_bank_service = QuestionBankService()

