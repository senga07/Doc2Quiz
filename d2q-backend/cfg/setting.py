from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    """应用配置类 - 使用Pydantic Settings管理配置"""
    
    # 服务器配置
    host: str = "0.0.0.0"
    port: int = 8001
    
    # LLM配置
    fast_llm: Optional[str] = None  # 格式: "provider:model"，例如 "dashscope:qwen-turbo" 或 "azure_openai:gpt-4o-mini"
    
    # Azure OpenAI配置（如果使用）
    azure_openai_endpoint: Optional[str] = None
    azure_openai_api_key: Optional[str] = None
    azure_openai_api_version: Optional[str] = None
    
    # Dashscope配置（如果使用）
    dashscope_api_key: Optional[str] = None
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache
def get_settings():
    return Settings()


