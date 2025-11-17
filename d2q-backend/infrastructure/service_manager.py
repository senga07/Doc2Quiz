"""
服务管理器

提供基本的服务管理功能，避免循环依赖
"""
from cfg.setting import get_settings
from utils.unified_logger import get_logger


class ServiceManager:
    """服务管理器 - 单例模式"""
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not self._initialized:
            self.logger = get_logger(__name__)
            self.openai_client = None
            self._initialized = True

    
    def initialize(self) -> bool:
        """初始化基本服务"""
        try:
            self.logger.info("开始初始化服务管理器...")

            settings = get_settings()
            
            # 初始化 OpenAI 客户端
            self._initialize_openai_client(settings)
            
            self.logger.info("服务管理器初始化完成")
            return True
        except Exception as e:
            self.logger.error(f"服务初始化失败: {e}")
            return False
    
    def _initialize_openai_client(self, settings):
        """初始化 OpenAI 客户端实例"""
        try:
            from openai import OpenAI
            
            self.openai_client = OpenAI(
                api_key=settings.dashscope_api_key,
                base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
            )
            
            self.logger.info("OpenAI 客户端已初始化")
        except Exception as e:
            self.logger.error(f"OpenAI 客户端初始化失败: {e}")
            raise
    
    def get_openai_client(self):
        """获取 OpenAI 客户端实例"""
        if self.openai_client is None:
            self.logger.warning("OpenAI 客户端未初始化，尝试初始化...")
            settings = get_settings()
            self._initialize_openai_client(settings)
        return self.openai_client
    
    def get_config(self):
        """获取配置实例"""
        return get_settings()


# 全局服务管理器实例
service_manager = ServiceManager()

