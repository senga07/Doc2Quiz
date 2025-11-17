import { useState, useEffect, useRef } from 'react';
import { Typography, Upload, List, Button, message, Spin, Tree, Card, Tag } from 'antd';
import type { UploadFile, UploadProps } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { InboxOutlined, DeleteOutlined, FileTextOutlined, FileOutlined, CheckCircleOutlined, RobotOutlined } from '@ant-design/icons';
import { KnowledgeItem } from '../types';
import { ApiService } from '../services/api';
import './FileUpload.css';

const { Title, Text } = Typography;
const { Dragger } = Upload;

interface FileUploadProps {
  selectedItem: KnowledgeItem | null;
  onKnowledgeExtracted?: () => void; // 知识点提取完成时的回调
}

interface KnowledgeTreeNode extends DataNode {
  file_name?: string;
  title_path?: string;
  children?: KnowledgeTreeNode[];
}

interface UploadedFile {
  filename: string;
  file_path?: string;
  file_size?: number;
  modified_time?: number;
}

export const FileUpload = ({ selectedItem, onKnowledgeExtracted }: FileUploadProps) => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [treeData, setTreeData] = useState<KnowledgeTreeNode[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uploadedFileNamesRef = useRef<string[]>([]);

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    fileList,
    showUploadList: false, // 隐藏默认的文件列表展示
    beforeUpload: (file) => {
      setFileList((prev) => [...prev, file as UploadFile]);
      return false; // 阻止自动上传
    },
    onRemove: (file) => {
      setFileList((prev) => prev.filter((item) => item.uid !== file.uid));
    },
    onChange: (info) => {
      setFileList(info.fileList);
    },
  };

  // 将扁平化的知识项数组转换为树结构（公共函数）
  const buildTreeFromFlatList = (flatItems: KnowledgeItem[]): KnowledgeItem[] => {
    const itemMap = new Map<string, KnowledgeItem>();
    const rootItems: KnowledgeItem[] = [];

    // 首先创建所有项的映射
    flatItems.forEach(item => {
      itemMap.set(item.id, { ...item, children: [] });
    });

    // 然后构建树结构
    flatItems.forEach(item => {
      const node = itemMap.get(item.id)!;
      if (item.parentId === null) {
        rootItems.push(node);
      } else {
        const parent = itemMap.get(item.parentId);
        if (parent) {
          if (!parent.children) {
            parent.children = [];
          }
          parent.children.push(node);
        }
      }
    });

    return rootItems;
  };

  // 从知识目录树中构建知识点树数据（保持完整的树形结构）
  // items 已经是树形结构的 knowledge 节点数组
  const buildTreeDataFromKnowledgeTree = (items: KnowledgeItem[]): KnowledgeTreeNode[] => {
    // 递归转换知识项为树节点
    const convertToTreeNode = (item: KnowledgeItem): KnowledgeTreeNode => {
      // 递归处理子节点
      const children: KnowledgeTreeNode[] = [];
      if (item.children && item.children.length > 0) {
        item.children.forEach(child => {
          children.push(convertToTreeNode(child));
        });
      }

      // 构建节点
      const node: KnowledgeTreeNode = {
        title: (
          <span>
            <FileTextOutlined style={{ marginRight: 8, color: '#db002a' }} />
            {item.name}
            {item.file_name && (
              <span style={{ marginLeft: 8, color: '#999', fontSize: 12 }}>
                (来源: {item.file_name})
              </span>
            )}
          </span>
        ) as any,
        key: item.id,
        file_name: item.file_name || '',
        title_path: item.name,
        children: children.length > 0 ? children : undefined,
        isLeaf: children.length === 0
      };

      return node;
    };

    // 转换所有节点
    return items.map(item => convertToTreeNode(item));
  };

  // 轮询获取知识点（从知识目录树中）
  const pollKnowledgePoints = async () => {
    if (!selectedItem) return;

    try {
      // 从知识目录树中加载，构建完整的树结构
      const allItems = await ApiService.loadKnowledgeTree();
      
      // 构建完整的知识树
      const knowledgeTree = buildTreeFromFlatList(allItems);
      
      // 递归查找选中文档及其下的所有知识点节点（保持树形结构）
      const findDocumentInTree = (items: KnowledgeItem[], docId: string): KnowledgeItem | null => {
        for (const item of items) {
          if (item.id === docId) {
            return item;
          }
          if (item.children && item.children.length > 0) {
            const found = findDocumentInTree(item.children, docId);
            if (found) return found;
          }
        }
        return null;
      };
      
      const selectedDocument = findDocumentInTree(knowledgeTree, selectedItem.id);
      
      if (selectedDocument && selectedDocument.children) {
        // 提取文档下的所有 knowledge 节点，保持树形结构
        const extractKnowledgeNodes = (items: KnowledgeItem[]): KnowledgeItem[] => {
          const result: KnowledgeItem[] = [];
          items.forEach(item => {
            if (item.type === 'knowledge') {
              // 递归处理子节点
              const knowledgeNode: KnowledgeItem = {
                ...item,
                children: item.children ? extractKnowledgeNodes(item.children) : []
              };
              result.push(knowledgeNode);
            } else if (item.children && item.children.length > 0) {
              // 如果不是 knowledge 类型，继续查找子节点
              const childKnowledgeNodes = extractKnowledgeNodes(item.children);
              result.push(...childKnowledgeNodes);
            }
          });
          return result;
        };
        
        const knowledgeNodes = extractKnowledgeNodes(selectedDocument.children);
        
        // 检查是否有新提取的知识点（根据文件名）
        const extractedFiles = new Set(knowledgeNodes.map(item => item.file_name).filter(Boolean));
        const hasNewFiles = uploadedFileNamesRef.current.some(name => extractedFiles.has(name));
        
        if (hasNewFiles) {
          // 构建树形结构显示
          const treeItems = buildTreeDataFromKnowledgeTree(knowledgeNodes);
          setTreeData(treeItems);
          
          // 通知父组件刷新知识目录树（实时更新）
          if (onKnowledgeExtracted) {
            onKnowledgeExtracted();
          }
          
          // 检查是否所有文件都已提取完成
          const allExtracted = uploadedFileNamesRef.current.every(name => 
            extractedFiles.has(name)
          );
          
          if (allExtracted) {
            setIsExtracting(false);
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            message.success('知识点提取完成');
          }
        }
      }
    } catch (error) {
      console.error('获取知识点失败:', error);
    }
  };

  // 组件卸载时清理轮询
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // 当选中项变化时，加载知识点并清空本次上传的文件列表
  useEffect(() => {
    if (selectedItem) {
      loadKnowledgePoints();
      // 切换知识项时清空本次上传的文件列表
      setUploadedFiles([]);
    } else {
      setTreeData([]);
      setUploadedFiles([]);
    }
  }, [selectedItem]);

  const loadKnowledgePoints = async () => {
    if (!selectedItem) return;
    
    try {
      // 从知识目录树中加载，构建完整的树结构
      const allItems = await ApiService.loadKnowledgeTree();
      
      // 构建完整的知识树
      const knowledgeTree = buildTreeFromFlatList(allItems);
      
      // 递归查找选中文档及其下的所有知识点节点（保持树形结构）
      const findDocumentInTree = (items: KnowledgeItem[], docId: string): KnowledgeItem | null => {
        for (const item of items) {
          if (item.id === docId) {
            return item;
          }
          if (item.children && item.children.length > 0) {
            const found = findDocumentInTree(item.children, docId);
            if (found) return found;
          }
        }
        return null;
      };
      
      const selectedDocument = findDocumentInTree(knowledgeTree, selectedItem.id);
      
      if (selectedDocument && selectedDocument.children) {
        // 提取文档下的所有 knowledge 节点，保持树形结构
        const extractKnowledgeNodes = (items: KnowledgeItem[]): KnowledgeItem[] => {
          const result: KnowledgeItem[] = [];
          items.forEach(item => {
            if (item.type === 'knowledge') {
              // 递归处理子节点
              const knowledgeNode: KnowledgeItem = {
                ...item,
                children: item.children ? extractKnowledgeNodes(item.children) : []
              };
              result.push(knowledgeNode);
            } else if (item.children && item.children.length > 0) {
              // 如果不是 knowledge 类型，继续查找子节点
              const childKnowledgeNodes = extractKnowledgeNodes(item.children);
              result.push(...childKnowledgeNodes);
            }
          });
          return result;
        };
        
        const knowledgeNodes = extractKnowledgeNodes(selectedDocument.children);
        
        // 构建树形结构显示
        const treeItems = buildTreeDataFromKnowledgeTree(knowledgeNodes);
        setTreeData(treeItems);
      } else {
        setTreeData([]);
      }
    } catch (error) {
      console.error('加载知识点失败:', error);
    }
  };

  const handleUpload = async () => {
    if (fileList.length === 0 || !selectedItem) {
      message.warning('请先选择文件');
      return;
    }

    try {
      // 将 UploadFile 转换为 File 对象
      const files: File[] = [];
      fileList.forEach(file => {
        if (file.originFileObj) {
          files.push(file.originFileObj as File);
        }
      });

      if (files.length === 0) {
        message.warning('没有有效的文件可以上传');
        return;
      }

      // 记录上传的文件名
      uploadedFileNamesRef.current = files.map(f => f.name);

      // 显示上传中状态
      const hide = message.loading(`正在上传 ${files.length} 个文件...`, 0);

      // 批量上传文件
      const result = await ApiService.uploadMultipleFiles(files, selectedItem.id);

      hide();

      if (result && result.success) {
        message.success(`成功上传 ${result.files.length} 个文件，正在提取知识点...`);
        
        // 更新已上传文件列表（只显示本次上传的文件）
        const newFiles = result.files || [];
        setUploadedFiles(newFiles);
        
        // 清空待上传文件列表
        setFileList([]);
        
        // 开始提取知识点
        setIsExtracting(true);
        
        // 开始轮询获取知识点
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
        pollingIntervalRef.current = setInterval(pollKnowledgePoints, 2000); // 每2秒轮询一次
        
        // 立即查询一次
        setTimeout(pollKnowledgePoints, 1000);
      } else {
        message.error('文件上传失败');
      }
    } catch (error) {
      console.error('上传文件失败:', error);
      message.error('文件上传失败，请重试');
    }
  };

  if (!selectedItem) {
    return (
      <div className="file-upload-container">
        <div className="upload-placeholder">
          <RobotOutlined style={{ fontSize: 24, color: '#db002a', marginBottom: 12 }} />
          <Text type="secondary" style={{ fontSize: 16 }}>
            请上传文档，AI将自动解析知识点
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div className="file-upload-container">
      <Title level={4}>上传文档到: {selectedItem.name}</Title>

      <Dragger {...uploadProps} style={{ marginBottom: 24 }}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽文件到此处上传</p>
        <p className="ant-upload-hint">支持多个文件同时上传</p>
      </Dragger>

      {/* 已上传文件列表 */}
      {uploadedFiles.length > 0 && (
        <Card 
          title={
            <span>
              <CheckCircleOutlined style={{ marginRight: 8, color: '#db002a' }} />
              已上传文件 ({uploadedFiles.length})
            </span>
          }
          style={{ marginBottom: 24 }}
          size="small"
        >
          <List
            dataSource={uploadedFiles}
            renderItem={(file) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<FileOutlined style={{ fontSize: 20, color: '#db002a' }} />}
                  title={
                    <span>
                      {file.filename}
                      {file.file_size && (
                        <Tag color="#db002a" style={{ marginLeft: 8 }}>
                          {(file.file_size / 1024 / 1024).toFixed(2)} MB
                        </Tag>
                      )}
                    </span>
                  }
                  description={
                    file.modified_time 
                      ? `上传时间: ${new Date(file.modified_time * 1000).toLocaleString()}`
                      : undefined
                  }
                />
              </List.Item>
            )}
            pagination={uploadedFiles.length > 10 ? { pageSize: 10, size: 'small' } : false}
          />
        </Card>
      )}

      {fileList.length > 0 && (
        <div className="uploaded-files">
          <Title level={5}>已选择文件 ({fileList.length})</Title>
          <List
            dataSource={fileList}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button
                    type="link"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => {
                      setFileList((prev) => prev.filter((file) => file.uid !== item.uid));
                    }}
                  >
                    删除
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={item.name}
                  description={
                    item.size ? `${(item.size / 1024 / 1024).toFixed(2)} MB` : ''
                  }
                />
              </List.Item>
            )}
            style={{ marginBottom: 16 }}
          />
          <Button
            type="primary"
            danger
            block
            size="large"
            onClick={handleUpload}
            disabled={isExtracting}
          >
            {isExtracting ? '提取中...' : '确认上传'}
          </Button>
        </div>
      )}

      {/* 知识点提取状态 */}
      {isExtracting && (
        <Card style={{ marginTop: 24 }}>
          <Spin tip="正在提取知识点，请稍候..." size="large">
            <div style={{ minHeight: 100, padding: 20, textAlign: 'center' }}>
              <p>AI正在分析文档内容，提取目录结构...</p>
            </div>
          </Spin>
        </Card>
      )}

      {/* 知识点树状图展示 */}
      {!isExtracting && treeData.length > 0 && (
        <Card 
          title={<Title level={5} style={{ margin: 0 }}>知识点目录结构</Title>}
          style={{ marginTop: 24 }}
        >
          <Tree
            showLine
            showIcon
            defaultExpandAll
            treeData={treeData}
            style={{ background: '#fafafa', padding: 16, borderRadius: 4 }}
          />
        </Card>
      )}
    </div>
  );
};
