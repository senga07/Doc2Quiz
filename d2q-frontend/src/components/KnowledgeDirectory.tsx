import { useState, useEffect, useMemo, useCallback } from 'react';
import { Input, Tree, Button, Modal, Form, message, Radio, Popconfirm } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { FolderOutlined, FileOutlined, PlusOutlined, DeleteOutlined, BookOutlined } from '@ant-design/icons';
import { KnowledgeItem, SelectedKnowledgePointNode } from '../types';
import { ApiService } from '../services/api';
import { generateUUID } from '../utils';
import './KnowledgeDirectory.css';

interface KnowledgeDirectoryProps {
  onSelectItem: (item: KnowledgeItem | null) => void;
  selectedItem: KnowledgeItem | null;
  activeTab: string;
  onQuizItemsChange?: (items: (KnowledgeItem | SelectedKnowledgePointNode)[]) => void;
  selectedQuizItems?: (KnowledgeItem | SelectedKnowledgePointNode)[];
  refreshKey?: number; // 刷新触发器，当值变化时重新加载知识树
  selectedBankId?: string; // AI组卷时选择的题库ID
}

interface CustomDataNode extends DataNode {
  item?: KnowledgeItem;
  knowledgePointNode?: SelectedKnowledgePointNode;
}

export const KnowledgeDirectory = ({ 
  onSelectItem, 
  selectedItem, 
  activeTab,
  onQuizItemsChange,
  selectedQuizItems = [],
  refreshKey = 0,
  selectedBankId
}: KnowledgeDirectoryProps) => {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [quizExpandedKeys, setQuizExpandedKeys] = useState<React.Key[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<KnowledgeItem | null>(null);
  const [isTypeModalVisible, setIsTypeModalVisible] = useState(false);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'folder' | 'document'>('folder');
  const [form] = Form.useForm();
  const [quizSearchKeyword, setQuizSearchKeyword] = useState('');
  const [quizKnowledgeItems, setQuizKnowledgeItems] = useState<KnowledgeItem[]>([]);

  // 将扁平化的知识项数组转换为树结构
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

  // 加载知识树数据的函数
  const loadKnowledgeTreeData = useCallback(async () => {
    try {
      // AI组卷标签页使用过滤后的知识树（只显示有题目的知识点）
      // 如果提供了selectedBankId，则只显示该题库的知识点
      const items = activeTab === 'compose' 
        ? await ApiService.loadKnowledgeTreeForCompose(selectedBankId)
        : await ApiService.loadKnowledgeTree();
      
      if (items.length > 0) {
        // 将扁平化的知识项数组转换为树结构
        const treeItems = buildTreeFromFlatList(items);
        
        // 调试：检查knowledge节点是否被正确加载
        const knowledgeCount = items.filter(item => item.type === 'knowledge').length;
        console.log(`加载的知识树数据(${activeTab === 'compose' ? 'AI组卷' : '完整'}):`, {
          totalItems: items.length,
          knowledgeItems: knowledgeCount,
          treeItems: treeItems.length,
          bankId: selectedBankId
        });
        
        // 同时更新知识目录和AI出题标签页的数据
        setKnowledgeItems(treeItems);
        setQuizKnowledgeItems(treeItems);
        
        // 设置默认展开的根节点
        const rootItem = treeItems.find(item => item.parentId === null);
        if (rootItem) {
          setExpandedKeys([rootItem.id]);
          setQuizExpandedKeys([rootItem.id]);
        }
      } else if (activeTab === 'compose') {
        // AI组卷标签页如果没有数据，清空显示
        setKnowledgeItems([]);
        setQuizKnowledgeItems([]);
      }
    } catch (error) {
      console.error('加载知识树结构失败:', error);
    }
  }, [activeTab, selectedBankId]);

  // 当 refreshKey、activeTab 或 selectedBankId 变化时，重新加载知识树
  useEffect(() => {
    loadKnowledgeTreeData();
  }, [refreshKey, activeTab, selectedBankId, loadKnowledgeTreeData]);

  // 扁平化知识项数组（用于保存）
  const flattenKnowledgeItems = (items: KnowledgeItem[]): KnowledgeItem[] => {
    const result: KnowledgeItem[] = [];
    const flatten = (item: KnowledgeItem) => {
      const { children, ...itemWithoutChildren } = item;
      result.push(itemWithoutChildren);
      if (children && children.length > 0) {
        children.forEach(child => flatten(child));
      }
    };
    items.forEach(item => flatten(item));
    return result;
  };

  // 将 KnowledgeItem 转换为 Tree 的 DataNode（处理树结构，包含children）
  const convertToTreeData = (items: KnowledgeItem[]): CustomDataNode[] => {
    return items.map(item => {
      // 递归处理子节点
      const children = item.children && item.children.length > 0 
        ? convertToTreeData(item.children) 
        : [];
      
      // 确定图标
      let icon;
      if (item.type === 'folder') {
        icon = <FolderOutlined style={{ color: '#db002a' }} />;
      } else if (item.type === 'knowledge') {
        icon = <BookOutlined style={{ color: '#db002a' }} />;
      } else {
        icon = <FileOutlined style={{ color: '#db002a' }} />;
      }
      
      // 判断是否为叶子节点：所有类型都根据是否有子节点判断
      // document类型如果有knowledge子节点，应该可以展开
      const isLeaf = children.length === 0;
      
      return {
        title: item.name,
        key: item.id,
        icon: icon,
        isLeaf: isLeaf,
        children: children.length > 0 ? children : undefined,
        item: item
      } as CustomDataNode;
    });
  };

  // 搜索过滤
  const filterTreeData = (items: KnowledgeItem[], keyword: string): KnowledgeItem[] => {
    if (!keyword) {
      // 没有搜索关键词时，直接返回所有项（已经是树结构，只包含根节点）
      return items;
    }

    const lowerKeyword = keyword.toLowerCase();
    const result: KnowledgeItem[] = [];

    const searchInItem = (item: KnowledgeItem): KnowledgeItem | null => {
      const matchesName = item.name.toLowerCase().includes(lowerKeyword);
      const filteredChildren: KnowledgeItem[] = [];

      if (item.children) {
        item.children.forEach(child => {
          const matchedChild = searchInItem(child);
          if (matchedChild) {
            filteredChildren.push(matchedChild);
          }
        });
      }

      if (matchesName || filteredChildren.length > 0) {
        return {
          ...item,
          children: filteredChildren.length > 0 ? filteredChildren : item.children
        };
      }

      return null;
    };

    items.forEach(item => {
      const matched = searchInItem(item);
      if (matched) {
        result.push(matched);
      }
    });

    return result;
  };

  const treeData = convertToTreeData(filterTreeData(knowledgeItems, searchKeyword));

  const handleSelect = (_selectedKeys: React.Key[], info: any) => {
    const node = info.node as CustomDataNode;
    if (node.item) {
      const item = node.item;
      if (item.type === 'folder') {
        // 点击文件夹时选中文件夹
        setSelectedFolder(item);
        onSelectItem(null); // 清除文档选择
      } else if (item.type === 'document') {
        // 点击文档时选中文档
        setSelectedFolder(null); // 清除文件夹选择
        onSelectItem(item);
      } else if (item.type === 'knowledge') {
        // 点击知识点时，可以选择其父文档（如果有的话）
        // 知识点节点本身不直接作为选中项，但可以显示
        setSelectedFolder(null);
        onSelectItem(null);
      }
    } else {
      // 取消选择
      setSelectedFolder(null);
      onSelectItem(null);
    }
  };

  const handleExpand = (expandedKeysValue: React.Key[]) => {
    setExpandedKeys(expandedKeysValue);
  };

  const handleQuizExpand = (expandedKeysValue: React.Key[]) => {
    setQuizExpandedKeys(expandedKeysValue);
  };

  // AI出题标签页的节点选择处理（支持多选）
  const handleQuizSelect = (_checkedKeys: any, info: any) => {
    if (!onQuizItemsChange) return;
    
    // antd Tree的onCheck事件，info包含node和checked信息
    const { node, checked } = info;
    const customNode = node as CustomDataNode;
    
    let newSelectedItems: (KnowledgeItem | SelectedKnowledgePointNode)[];
    
    if (customNode.item) {
      // 选中的是知识项
      const item = customNode.item;
      
      // 检查是否是knowledge类型的节点
      if (item.type === 'knowledge') {
        // 将knowledge节点转换为SelectedKnowledgePointNode格式
        // 需要找到该knowledge节点的父文档ID（向上查找直到找到document类型）
        const findParentDocument = (items: KnowledgeItem[], targetId: string): KnowledgeItem | null => {
          // 递归查找包含目标ID的节点
          const findItem = (items: KnowledgeItem[], id: string): KnowledgeItem | null => {
            for (const currentItem of items) {
              if (currentItem.id === id) {
                return currentItem;
              }
              if (currentItem.children && currentItem.children.length > 0) {
                const found = findItem(currentItem.children, id);
                if (found) return found;
              }
            }
            return null;
          };
          
          // 找到目标节点
          const targetItem = findItem(items, targetId);
          if (!targetItem) return null;
          
          // 向上查找文档节点
          let currentId = targetItem.parentId;
          while (currentId) {
            const parentItem = findItem(items, currentId);
            if (!parentItem) break;
            
            if (parentItem.type === 'document') {
              return parentItem;
            }
            currentId = parentItem.parentId;
          }
          
          return null;
        };
        
        const parentDoc = findParentDocument(quizKnowledgeItems, item.id);
        
        if (checked) {
          // 添加选中项
          // 构建SelectedKnowledgePointNode
          const knowledgePointNode: SelectedKnowledgePointNode = {
            id: item.id,
            knowledge_item_id: parentDoc?.id || item.parentId || '',
            file_name: item.file_name || '',
            node_id: item.node_id || 0,
            text: item.name,
            path: [], // 可以后续优化，构建完整路径
            type: 'knowledge'
          };
          
          if (!selectedQuizItems.find(i => 'type' in i && i.type === 'knowledge' && i.id === item.id)) {
            newSelectedItems = [...selectedQuizItems, knowledgePointNode];
          } else {
            newSelectedItems = selectedQuizItems;
          }
        } else {
          // 移除选中项
          newSelectedItems = selectedQuizItems.filter(i => !('type' in i && i.type === 'knowledge' && i.id === item.id));
        }
      } else {
        // 选中的是folder或document类型的节点
        if (checked) {
          // 添加选中项
          if (!selectedQuizItems.find(i => (i as KnowledgeItem).id === item.id && !('type' in i && i.type === 'knowledge'))) {
            newSelectedItems = [...selectedQuizItems, item];
          } else {
            newSelectedItems = selectedQuizItems;
          }
        } else {
          // 移除选中项
          newSelectedItems = selectedQuizItems.filter(i => !((i as KnowledgeItem).id === item.id && !('type' in i && i.type === 'knowledge')));
        }
      }
    } else if (customNode.knowledgePointNode) {
      // 选中的是知识点节点
      const pointNode = customNode.knowledgePointNode;
      
      if (checked) {
        // 添加选中项
        if (!selectedQuizItems.find(i => 'type' in i && i.type === 'knowledge' && i.id === pointNode.id)) {
          newSelectedItems = [...selectedQuizItems, pointNode];
        } else {
          newSelectedItems = selectedQuizItems;
        }
      } else {
        // 移除选中项
        newSelectedItems = selectedQuizItems.filter(i => !('type' in i && i.type === 'knowledge' && i.id === pointNode.id));
      }
    } else {
      return;
    }
    
    onQuizItemsChange(newSelectedItems);
  };


  // 将 KnowledgeItem 转换为支持 Checkbox 的 Tree DataNode（用于AI出题）
  // 知识点已经合并到knowledge_tree.json中，直接使用树结构
  const convertToQuizTreeData = (items: KnowledgeItem[]): CustomDataNode[] => {
    return items.map(item => {
      const children: CustomDataNode[] = [];
      
      // 添加子知识项（文件夹、文档或知识点）
      if (item.children && item.children.length > 0) {
        children.push(...convertToQuizTreeData(item.children));
      }

      // 确定图标和样式
      let icon;
      if (item.type === 'folder') {
        icon = <FolderOutlined style={{ color: '#db002a', marginRight: 8, flexShrink: 0 }} />;
      } else if (item.type === 'knowledge') {
        icon = <BookOutlined style={{ color: '#db002a', marginRight: 8, flexShrink: 0 }} />;
      } else {
        icon = <FileOutlined style={{ color: '#db002a', marginRight: 8, flexShrink: 0 }} />;
      }

      return {
        title: (
          <div style={{ display: 'flex', alignItems: 'center', flex: 1, overflow: 'hidden', minWidth: 0 }}>
            {icon}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.name}
            </span>
          </div>
        ),
        key: item.id,
        isLeaf: children.length === 0,
        children: children.length > 0 ? children : undefined,
        item: item
      } as CustomDataNode;
    });
  };

  const quizTreeData = useMemo(() => {
    // 使用AI出题标签页专用的知识目录数据
    return convertToQuizTreeData(filterTreeData(quizKnowledgeItems, quizSearchKeyword));
  }, [quizKnowledgeItems, quizSearchKeyword]);

  const quizCheckedKeys = useMemo(() => {
    return selectedQuizItems.map(item => item.id);
  }, [selectedQuizItems]);

  // 处理新增按钮点击
  const handleAddClick = () => {
    setIsTypeModalVisible(true);
  };

  // 处理类型选择
  const handleTypeSelect = (type: 'folder' | 'document') => {
    setModalType(type);
    setIsTypeModalVisible(false);
    setIsCreateModalVisible(true);
  };

  // 通用的创建知识项函数
  const createKnowledgeItem = async (type: 'folder' | 'document') => {
    try {
      const values = await form.validateFields();
      const itemName = type === 'folder' ? values.folderName : values.documentName;
      
      // 确定父文件夹ID
      let parentId: string | null;
      if (type === 'document') {
        // 创建文档时，如果有选中的文件夹，使用选中的文件夹；否则使用根目录
        parentId = selectedFolder ? selectedFolder.id : null;
      } else {
        // 创建文件夹时，如果有选中的文件夹，在选中文件夹下创建；否则在根目录创建
        parentId = selectedFolder ? selectedFolder.id : null;
      }
      
      const newItem: KnowledgeItem = {
        id: generateUUID(),
        name: itemName.trim(),
        type: type,
        parentId: parentId,
        createdAt: new Date().toISOString()
      };

      // 更新父文件夹的 children（前端内存中的树结构需要children字段）
      const updateItems = (items: KnowledgeItem[]): KnowledgeItem[] => {
        // 如果 parentId 为 null，说明是根节点，直接添加到根节点数组
        if (newItem.parentId === null) {
          return [...items, { ...newItem, children: [] }];
        }
        
        // 否则在树中查找父节点并添加
        return items.map(item => {
          if (item.id === newItem.parentId) {
            return {
              ...item,
              children: [...(item.children || []), { ...newItem, children: [] }]
            };
          }
          if (item.children) {
            return {
              ...item,
              children: updateItems(item.children)
            };
          }
          return item;
        });
      };

      const updatedItems = updateItems(knowledgeItems);
      setKnowledgeItems(updatedItems);
      // 展开新创建的节点，如果是子节点则同时展开父节点
      const keysToExpand = [newItem.id];
      if (newItem.parentId) {
        keysToExpand.push(newItem.parentId);
      }
      setExpandedKeys([...expandedKeys, ...keysToExpand]);
      setIsCreateModalVisible(false);
      form.resetFields();
      message.success(type === 'folder' ? '文件夹创建成功' : '文档创建成功');
      
      // 自动保存到后端
      const flattenedItems = flattenKnowledgeItems(updatedItems);
      await ApiService.saveKnowledgeTree(flattenedItems);
    } catch (error) {
      console.error(`创建${type === 'folder' ? '文件夹' : '文档'}失败:`, error);
    }
  };

  const handleCreateFolder = async () => {
    await createKnowledgeItem('folder');
  };

  const handleCreateDocument = async () => {
    await createKnowledgeItem('document');
  };

  // 删除知识项（包括文件夹及其所有子项）
  const deleteKnowledgeItem = async (item: KnowledgeItem) => {
    try {
      // 递归收集要删除的所有项ID（包括子项）
      const itemsToDelete = new Set<string>();
      const collectItems = (targetItem: KnowledgeItem) => {
        itemsToDelete.add(targetItem.id);
        if (targetItem.children) {
          targetItem.children.forEach(child => collectItems(child));
        }
      };
      collectItems(item);

      // 从树结构中删除
      const removeItem = (items: KnowledgeItem[]): KnowledgeItem[] => {
        return items
          .filter(item => !itemsToDelete.has(item.id))
          .map(item => {
            if (item.children) {
              return {
                ...item,
                children: removeItem(item.children)
              };
            }
            return item;
          });
      };

      const updatedItems = removeItem(knowledgeItems);
      setKnowledgeItems(updatedItems);
      
      // 清除选中状态
      if (selectedFolder && itemsToDelete.has(selectedFolder.id)) {
        setSelectedFolder(null);
      }
      if (selectedItem && itemsToDelete.has(selectedItem.id)) {
        onSelectItem(null);
      }
      
      // 从展开的keys中移除
      setExpandedKeys(expandedKeys.filter(key => !itemsToDelete.has(key as string)));
      
      // 删除关联的知识点（递归删除所有子项的知识点）
      const deletePromises = Array.from(itemsToDelete).map(itemId => 
        ApiService.deleteKnowledgePoints(itemId)
      );
      await Promise.all(deletePromises);
      
      message.success(item.type === 'folder' ? '文件夹删除成功' : '文档删除成功');
      
      // 自动保存到后端
      const flattenedItems = flattenKnowledgeItems(updatedItems);
      await ApiService.saveKnowledgeTree(flattenedItems);
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  const handleDelete = () => {
    const itemToDelete = selectedFolder || selectedItem;
    if (itemToDelete) {
      deleteKnowledgeItem(itemToDelete);
    }
  };

  return (
    <div className="knowledge-directory">
      {activeTab === 'directory' && (
        <>
          <Input.Search
            placeholder="搜索"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            size="small"
            style={{ marginBottom: 12 }}
            allowClear
          />

          <div className="directory-tree">
            <Tree
              showIcon
              treeData={treeData}
              expandedKeys={expandedKeys}
              selectedKeys={
                selectedFolder 
                  ? [selectedFolder.id] 
                  : selectedItem 
                    ? [selectedItem.id] 
                    : []
              }
              onSelect={handleSelect}
              onExpand={handleExpand}
              blockNode
            />
          </div>

          {(selectedFolder || selectedItem) && (
            <div style={{ marginBottom: 8, padding: 6, background: '#f0f0f0', borderRadius: 4, fontSize: 11 }}>
              {selectedFolder ? `📁 ${selectedFolder.name}` : `📄 ${selectedItem?.name}`}
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
            {(selectedFolder || selectedItem) && (
              <Popconfirm
                title={`确定要删除${selectedFolder ? '文件夹' : '文档'}吗？`}
                description={selectedFolder ? '删除文件夹将同时删除其下的所有子项' : '删除后无法恢复'}
                onConfirm={handleDelete}
                okText="确定"
                cancelText="取消"
                okButtonProps={{ danger: true }}
              >
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
                  style={{ flex: 1 }}
                >
                  删除
                </Button>
              </Popconfirm>
            )}
            <Button
              type="primary"
              danger
              icon={<PlusOutlined />}
              onClick={handleAddClick}
              size="small"
              style={{ flex: 1 }}
            >
              新增
            </Button>
          </div>
        </>
      )}

      {(activeTab === 'quiz' || activeTab === 'compose') && (
        <>
          <Input.Search
            placeholder="搜索知识点"
            value={quizSearchKeyword}
            onChange={(e) => setQuizSearchKeyword(e.target.value)}
            size="small"
            style={{ marginBottom: 12 }}
            allowClear
          />

          <div className="directory-tree">
            <Tree
              showIcon
              checkable
              treeData={quizTreeData}
              expandedKeys={quizExpandedKeys}
              checkedKeys={quizCheckedKeys}
              onCheck={handleQuizSelect}
              onExpand={handleQuizExpand}
              blockNode
            />
          </div>
        </>
      )}

      {/* 类型选择对话框 */}
      <Modal
        title="选择新增类型"
        open={isTypeModalVisible}
        onCancel={() => setIsTypeModalVisible(false)}
        footer={null}
        width={400}
      >
        <div style={{ padding: '20px 0', textAlign: 'center' }}>
          <Radio.Group
            onChange={(e) => handleTypeSelect(e.target.value)}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <Radio.Button value="folder" style={{ height: 50, lineHeight: '50px', fontSize: 16 }}>
              <FolderOutlined style={{ marginRight: 8, color: '#db002a' }} />
              新增文件夹
            </Radio.Button>
            <Radio.Button value="document" style={{ height: 50, lineHeight: '50px', fontSize: 16 }}>
              <FileOutlined style={{ marginRight: 8, color: '#db002a' }} />
              新增文档
            </Radio.Button>
          </Radio.Group>
        </div>
      </Modal>

      {/* 创建对话框 */}
      <Modal
        title={modalType === 'folder' ? '创建文件夹' : '创建文档'}
        open={isCreateModalVisible}
        onOk={modalType === 'folder' ? handleCreateFolder : handleCreateDocument}
        onCancel={() => {
          setIsCreateModalVisible(false);
          form.resetFields();
        }}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          {modalType === 'folder' ? (
            <>
              <Form.Item
                name="folderName"
                label="文件夹名称"
                rules={[{ required: true, message: '请输入文件夹名称' }]}
              >
                <Input placeholder="请输入文件夹名称" autoFocus />
              </Form.Item>
              {selectedFolder && (
                <Form.Item label="父文件夹">
                  <Input value={selectedFolder.name} disabled />
                </Form.Item>
              )}
            </>
          ) : (
            <>
              <Form.Item
                name="documentName"
                label="文档名称"
                rules={[{ required: true, message: '请输入文档名称' }]}
              >
                <Input placeholder="请输入文档名称" autoFocus />
              </Form.Item>
              {selectedFolder && (
                <Form.Item label="父文件夹">
                  <Input value={selectedFolder.name} disabled />
                </Form.Item>
              )}
              {!selectedFolder && (
                <div style={{ color: '#999', fontSize: 12, marginTop: -8 }}>
                  提示：未选中文件夹，文档将创建在根目录
                </div>
              )}
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
};

