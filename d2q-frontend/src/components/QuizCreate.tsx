import { useState, useMemo, useEffect } from 'react';
import { Card, Button, Empty, Tree, message, Checkbox, InputNumber, Modal, Tag, Typography, Divider, Steps, Input, Select, Tabs, Space } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { FolderOutlined, FileOutlined, DeleteOutlined, BookOutlined, SettingOutlined, PlusOutlined } from '@ant-design/icons';
import { KnowledgeItem, SelectedKnowledgePointNode } from '../types';
import { ApiService } from '../services/api';
import './QuizCreate.css';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface QuizCreateProps {
  selectedItems: (KnowledgeItem | SelectedKnowledgePointNode)[];
  onRemoveItem: (itemId: string, siblingsToAdd?: SelectedKnowledgePointNode[]) => void;
  onClearAll: () => void;
  onNavigateToBank?: (bankId?: string) => void; // 跳转到题库管理页面的回调，可传递题库ID
}

interface CustomDataNode extends DataNode {
  item?: KnowledgeItem;
}

// 试题类型定义
type QuestionType = 'single_choice' | 'multiple_choice' | 'true_false' | 'essay';

interface QuestionTypeConfig {
  type: QuestionType;
  label: string;
  enabled: boolean;
  low: number;
  medium: number;
  high: number;
}

// 默认试题类型配置
const getDefaultQuestionTypes = (): QuestionTypeConfig[] => [
  { type: 'single_choice', label: '单选题', enabled: true, low: 0, medium: 0, high: 0 },
  { type: 'multiple_choice', label: '多选题', enabled: false, low: 0, medium: 0, high: 0 },
  { type: 'true_false', label: '判断题', enabled: false, low: 0, medium: 0, high: 0 },
  { type: 'essay', label: '问答题', enabled: false, low: 0, medium: 0, high: 0 },
];

// 题目数据结构
interface ParsedQuestion {
  question: string; // 题干
  options: string[]; // 选项
  answer: string; // 答案
  difficulty: string; // 难易度
  score: string; // 分值
  explanation?: string; // 解析
  knowledge?: string; // 知识点
  knowledge_id?: string; // 知识点ID（AI返回）
  edited?: boolean; // 是否被编辑过
  type?: QuestionType; // 题目类型
}

export const QuizCreate = ({ selectedItems, onRemoveItem, onClearAll, onNavigateToBank }: QuizCreateProps) => {
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [mergedKnowledgeTree, setMergedKnowledgeTree] = useState<KnowledgeItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]);
  
  // 步骤条相关状态
  const [currentStep, setCurrentStep] = useState<number>(0);
  
  // 步骤二：题型Tab切换
  const [activeQuestionTypeTab, setActiveQuestionTypeTab] = useState<string>('all');
  
  // 步骤三：题库选择相关状态
  const [quizBanks, setQuizBanks] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedQuizBankId, setSelectedQuizBankId] = useState<string>('');
  const [isCreateQuizBankModalVisible, setIsCreateQuizBankModalVisible] = useState(false);
  const [newQuizBankName, setNewQuizBankName] = useState<string>('');
  const [savedQuestionId, setSavedQuestionId] = useState<string>(''); // 步骤二保存的question_id
  const [isCreatingQuizBank, setIsCreatingQuizBank] = useState(false);
  
  // 编辑题目Modal相关状态
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number>(-1);
  const [editingQuestion, setEditingQuestion] = useState<ParsedQuestion | null>(null);
  
  // 全局试题类型配置
  const [globalQuestionTypes, setGlobalQuestionTypes] = useState<QuestionTypeConfig[]>(getDefaultQuestionTypes());
  
  // 单个知识点的试题类型配置（key: itemId, value: QuestionTypeConfig[]）
  const [itemQuestionTypes, setItemQuestionTypes] = useState<Map<string, QuestionTypeConfig[]>>(new Map());
  
  // Modal 相关状态
  const [isConfigModalVisible, setIsConfigModalVisible] = useState(false);
  const [currentConfigItemId, setCurrentConfigItemId] = useState<string | null>(null); // null 表示全局配置
  const [tempQuestionTypes, setTempQuestionTypes] = useState<QuestionTypeConfig[]>(getDefaultQuestionTypes());

  // 加载知识树结构（知识点已经合并到knowledge_tree.json中）
  useEffect(() => {
    const loadKnowledgeTree = async () => {
      try {
        const flatItems = await ApiService.loadKnowledgeTree();
        
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
        
        if (flatItems.length > 0) {
          const treeItems = buildTreeFromFlatList(flatItems);
          setMergedKnowledgeTree(treeItems);
        }
      } catch (error) {
        console.error('加载知识树结构失败:', error);
      }
    };
    
    loadKnowledgeTree();
  }, []);

  // 加载题库列表（步骤三）
  useEffect(() => {
    const loadQuizBanks = async () => {
      if (currentStep === 2) {
        try {
          const banks = await ApiService.getQuestionBanks();
          const formattedBanks = banks.map(bank => ({
            id: bank.bank_id,
            name: bank.bank_name
          }));
          setQuizBanks(formattedBanks);
        } catch (error) {
          console.error('加载题库列表失败:', error);
        }
      }
    };
    loadQuizBanks();
  }, [currentStep]);


  // 将选中的知识点构建成树形结构（保持左侧的父子结构）
  const treeData = useMemo(() => {
    if (selectedItems.length === 0 || mergedKnowledgeTree.length === 0) return [];

    // 从合并后的知识树中获取选中项的完整信息（包含所有子项）
    const findItem = (items: KnowledgeItem[], itemId: string): KnowledgeItem | null => {
      for (const item of items) {
        if (item.id === itemId) {
          return item;
        }
        if (item.children && item.children.length > 0) {
          const found = findItem(item.children, itemId);
          if (found) return found;
        }
      }
      return null;
    };
    const selectedItemsWithChildren: KnowledgeItem[] = [];
    const selectedKnowledgePointNodes: SelectedKnowledgePointNode[] = [];
    
    selectedItems.forEach(selectedItem => {
      if ('type' in selectedItem && selectedItem.type === 'knowledge') {
        // 选中的是知识点节点
        selectedKnowledgePointNodes.push(selectedItem as SelectedKnowledgePointNode);
      } else {
        // 选中的是知识项
        const fullItem = findItem(mergedKnowledgeTree, selectedItem.id);
        if (fullItem) {
          selectedItemsWithChildren.push(fullItem);
        }
      }
    });

    // 如果没有选中的知识项，但有点知识点节点，也需要显示
    if (selectedItemsWithChildren.length === 0 && selectedKnowledgePointNodes.length === 0) return [];

    // 创建所有项的映射（包含所有子项）
    const itemMap = new Map<string, KnowledgeItem>();
    const collectAllItems = (items: KnowledgeItem[]) => {
      items.forEach(item => {
        itemMap.set(item.id, item);
        if (item.children && item.children.length > 0) {
          collectAllItems(item.children);
        }
      });
    };
    collectAllItems(selectedItemsWithChildren);
    
    // 将选中的知识点节点及其所有子节点也添加到itemMap中
    // 这样isKnowledgePointSelected函数才能正确检查父节点是否被选中
    selectedKnowledgePointNodes.forEach(node => {
      const fullItem = findItem(mergedKnowledgeTree, node.id);
      if (fullItem) {
        collectAllItems([fullItem]);
      }
    });

    // 构建树结构（只显示选中的根节点及其所有子项）
    const rootItems: KnowledgeItem[] = [];
    selectedItemsWithChildren.forEach(item => {
      // 如果这个项的父节点也在选中列表中，则它是子节点，不需要作为根节点
      const parentInSelected = selectedItems.find(selected => selected.id === item.parentId);
      if (!parentInSelected) {
        // 父节点不在选中列表中，作为根节点
        rootItems.push(item);
      }
    });

    // 检查项是否在选中列表中
    const isItemSelected = (itemId: string): boolean => {
      return selectedItems.some(selected => {
        if ('type' in selected && selected.type === 'knowledge') {
          return false; // 知识点节点不显示删除按钮
        }
        return (selected as KnowledgeItem).id === itemId;
      });
    };

    // 检查知识点节点是否在选中列表中（包括父节点被选中的情况）
    const isKnowledgePointSelected = (itemId: string): boolean => {
      // 直接检查节点是否在选中列表中
      if (selectedKnowledgePointNodes.some(node => node.id === itemId)) {
        return true;
      }
      
      // 检查节点的父节点是否被选中（递归检查所有祖先节点）
      const checkParentSelected = (currentId: string): boolean => {
        // 从itemMap中查找当前节点
        const currentNode = itemMap.get(currentId);
        if (!currentNode || !currentNode.parentId) {
          return false;
        }
        
        // 检查父节点是否在选中列表中
        if (selectedKnowledgePointNodes.some(node => node.id === currentNode.parentId)) {
          return true;
        }
        
        // 递归检查父节点的父节点
        return checkParentSelected(currentNode.parentId);
      };
      
      return checkParentSelected(itemId);
    };
    
    // 检查知识点节点是否直接选中（用于显示删除按钮，不包括父节点被选中的情况）
    const isKnowledgePointDirectlySelected = (itemId: string): boolean => {
      return selectedKnowledgePointNodes.some(node => node.id === itemId);
    };

    // 处理单独选中的知识点节点（文档不在选中列表中）
    // 需要从合并后的知识树中找到文档，然后构建完整的知识点树
    const findItemInTree = (items: KnowledgeItem[], itemId: string): KnowledgeItem | null => {
      for (const item of items) {
        if (item.id === itemId) {
          return item;
        }
        if (item.children && item.children.length > 0) {
          const found = findItemInTree(item.children, itemId);
          if (found) return found;
        }
      }
      return null;
    };

    // 按文档分组知识点节点
    const pointsByDoc = new Map<string, SelectedKnowledgePointNode[]>();
    selectedKnowledgePointNodes.forEach(node => {
      const docId = node.knowledge_item_id;
      if (!pointsByDoc.has(docId)) {
        pointsByDoc.set(docId, []);
      }
      pointsByDoc.get(docId)!.push(node);
    });

    // 为不在选中列表中的文档构建知识点树（知识点节点已经在knowledge_tree.json中）
    const standaloneKnowledgePointTrees: CustomDataNode[] = [];
    pointsByDoc.forEach((_nodes, docId) => {
      // 检查文档是否在选中列表中
      const docInSelected = selectedItemsWithChildren.find(item => item.id === docId);
      if (docInSelected) {
        // 文档在选中列表中，知识点会在文档树中显示
        return;
      }

      // 从合并后的知识树中找到文档及其知识点子节点
      const doc = findItemInTree(mergedKnowledgeTree, docId);
      if (!doc) return;

      // 递归查找该文档下的所有知识点节点（保持树形结构）
      const findKnowledgePointNodes = (items: KnowledgeItem[], parentId: string | null): KnowledgeItem[] => {
        const result: KnowledgeItem[] = [];
        items.forEach(item => {
          if (item.type === 'knowledge') {
            // 检查是否在选中列表中
            if (isKnowledgePointSelected(item.id)) {
              // 递归处理子节点，保持树形结构
              const knowledgeNode: KnowledgeItem = {
                ...item,
                children: item.children ? findKnowledgePointNodes(item.children, item.id) : []
              };
              result.push(knowledgeNode);
            } else if (item.children && item.children.length > 0) {
              // 即使当前节点未选中，也要检查子节点
              const childNodes = findKnowledgePointNodes(item.children, item.id);
              if (childNodes.length > 0) {
                // 如果子节点有选中的，需要包含当前节点以保持树形结构
                const knowledgeNode: KnowledgeItem = {
                  ...item,
                  children: childNodes
                };
                result.push(knowledgeNode);
              }
            }
          } else if (item.children && item.children.length > 0) {
            // 继续查找子节点
            result.push(...findKnowledgePointNodes(item.children, parentId));
          }
        });
        return result;
      };

      // 从文档的子节点开始查找
      const knowledgePointItems = doc.children ? findKnowledgePointNodes(doc.children, doc.id) : [];
      
      if (knowledgePointItems.length > 0) {
        // 构建知识点树（保持层级结构）
        const buildKnowledgePointTree = (items: KnowledgeItem[]): CustomDataNode[] => {
          return items.map(item => {
            // 使用 isKnowledgePointDirectlySelected 来检查是否显示删除按钮
            // 这样只有直接选中的节点才会显示删除按钮，而不是因为父节点被选中而显示
            const isDirectlySelected = isKnowledgePointDirectlySelected(item.id);
            const children: CustomDataNode[] = [];
            
            if (item.children && item.children.length > 0) {
              children.push(...buildKnowledgePointTree(item.children));
            }

            // 检查节点是否被选中（包括父节点被选中的情况）
            const isSelected = isKnowledgePointSelected(item.id);
            
            return {
              title: (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingRight: 8 }}>
                  <span style={{ display: 'flex', alignItems: 'center', flex: 1, overflow: 'hidden', minWidth: 0 }}>
                    <BookOutlined style={{ color: '#db002a', marginRight: 8, flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name}
                    </span>
                  </span>
                  {isSelected && (
                    <>
                      {/* 所有被选中的知识点节点（包括叶子节点）都可以配置题型 */}
                      <Button
                        type="link"
                        size="small"
                        icon={<SettingOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenConfigModal(item.id);
                        }}
                        style={{ marginLeft: 8, flexShrink: 0, color: '#db002a' }}
                      />
                      {/* 所有被选中的知识点节点（包括叶子节点）都可以删除 */}
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          console.log('点击删除按钮，节点ID:', item.id);
                          
                          // 检查节点是否直接选中
                          const isDirectlySelected = selectedKnowledgePointNodes.some(node => node.id === item.id);
                          if (isDirectlySelected) {
                            // 如果节点直接选中，直接删除
                            onRemoveItem(item.id);
                          } else {
                            // 如果节点因为父节点被选中而显示，需要特殊处理：
                            // 1. 找到父节点
                            // 2. 移除父节点
                            // 3. 将父节点的其他子节点（除了要删除的叶子节点）添加到选中列表
                            const findParentNode = (currentId: string): { parentId: string; parentNode: KnowledgeItem | null } | null => {
                              const currentNode = itemMap.get(currentId);
                              if (!currentNode || !currentNode.parentId) {
                                return null;
                              }
                              
                              // 检查父节点是否在选中列表中
                              const parentNode = itemMap.get(currentNode.parentId);
                              if (parentNode && selectedKnowledgePointNodes.some(node => node.id === currentNode.parentId)) {
                                return { parentId: currentNode.parentId, parentNode };
                              }
                              
                              // 递归查找父节点
                              return findParentNode(currentNode.parentId);
                            };
                            
                            const parentInfo = findParentNode(item.id);
                            if (parentInfo && parentInfo.parentNode) {
                              // 将父节点的其他子节点（除了要删除的叶子节点）添加到选中列表
                              let siblingsToAdd: SelectedKnowledgePointNode[] = [];
                              if (parentInfo.parentNode.children && parentInfo.parentNode.children.length > 0) {
                                siblingsToAdd = parentInfo.parentNode.children
                                  .filter(child => child.id !== item.id && child.type === 'knowledge')
                                  .map(child => {
                                    // 构建 SelectedKnowledgePointNode
                                    const parentDoc = findItemInTree(mergedKnowledgeTree, parentInfo.parentNode!.parentId || '');
                                    return {
                                      id: child.id,
                                      knowledge_item_id: parentDoc?.id || child.parentId || '',
                                      file_name: child.file_name || '',
                                      node_id: child.node_id || 0,
                                      text: child.name,
                                      path: [],
                                      type: 'knowledge' as const
                                    } as SelectedKnowledgePointNode;
                                  });
                                
                                console.log('需要添加的兄弟节点:', siblingsToAdd);
                              }
                              
                              // 移除父节点，同时添加兄弟节点
                              onRemoveItem(parentInfo.parentId, siblingsToAdd);
                            } else {
                              console.warn('无法找到要删除的父节点');
                            }
                          }
                        }}
                        style={{ marginLeft: 4, flexShrink: 0 }}
                      />
                    </>
                  )}
                </div>
              ),
              key: item.id,
              isLeaf: children.length === 0,
              children: children.length > 0 ? children : undefined,
              item: item
            };
          });
        };

        // 构建知识点树（已经是树形结构，直接转换）
        const pointTreeNodes = buildKnowledgePointTree(knowledgePointItems);
        
        if (pointTreeNodes.length > 0) {
          // 创建文档节点，包含知识点树
          standaloneKnowledgePointTrees.push({
            title: (
              <div style={{ display: 'flex', alignItems: 'center', flex: 1, overflow: 'hidden', minWidth: 0 }}>
                <FileOutlined style={{ color: '#db002a', marginRight: 8, flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.name}
                </span>
              </div>
            ),
            key: `doc-${docId}`,
            isLeaf: pointTreeNodes.length === 0,
            children: pointTreeNodes.length > 0 ? pointTreeNodes : undefined,
            item: doc
          });
        }
      }
    });

    // 转换为 Tree 的 DataNode（保持左侧的父子结构）
    const convertToTreeData = (items: KnowledgeItem[]): CustomDataNode[] => {
      return items.map(item => {
        const isSelected = isItemSelected(item.id);
        const children: CustomDataNode[] = [];
        
        // 添加子知识项（保持层级结构，包括知识点节点）
        if (item.children && item.children.length > 0) {
          children.push(...convertToTreeData(item.children));
        }

        // 确定图标
        let icon;
        if (item.type === 'folder') {
          icon = <FolderOutlined style={{ color: '#db002a', marginRight: 8, flexShrink: 0 }} />;
        } else if (item.type === 'knowledge') {
          icon = <BookOutlined style={{ color: '#db002a', marginRight: 8, flexShrink: 0 }} />;
          // 知识点节点使用不同的选中检查
          // isKnowledgePointSelected 检查节点是否被选中（包括父节点被选中的情况）
          // 所有被选中的知识点节点（包括叶子节点）都可以配置题型和删除
          const isKpSelected = isKnowledgePointSelected(item.id);
          return {
            title: (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingRight: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', flex: 1, overflow: 'hidden', minWidth: 0 }}>
                  {icon}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </span>
                </span>
                {isKpSelected && (
                  <>
                    {/* 所有被选中的知识点节点（包括叶子节点）都可以配置题型 */}
                    <Button
                      type="link"
                      size="small"
                      icon={<SettingOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenConfigModal(item.id);
                      }}
                      style={{ marginLeft: 8, flexShrink: 0, color: '#db002a' }}
                    />
                    {/* 所有被选中的知识点节点（包括叶子节点）都可以删除 */}
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        console.log('点击删除按钮，节点ID:', item.id);
                        
                        // 检查节点是否直接选中
                        const isDirectlySelected = selectedKnowledgePointNodes.some(node => node.id === item.id);
                        if (isDirectlySelected) {
                          // 如果节点直接选中，直接删除
                          onRemoveItem(item.id);
                        } else {
                          // 如果节点因为父节点被选中而显示，需要特殊处理：
                          // 1. 找到父节点
                          // 2. 移除父节点
                          // 3. 将父节点的其他子节点（除了要删除的叶子节点）添加到选中列表
                          const findParentNode = (currentId: string): { parentId: string; parentNode: KnowledgeItem | null } | null => {
                            const currentNode = itemMap.get(currentId);
                            if (!currentNode || !currentNode.parentId) {
                              return null;
                            }
                            
                            // 检查父节点是否在选中列表中
                            const parentNode = itemMap.get(currentNode.parentId);
                            if (parentNode && selectedKnowledgePointNodes.some(node => node.id === currentNode.parentId)) {
                              return { parentId: currentNode.parentId, parentNode };
                            }
                            
                            // 递归查找父节点
                            return findParentNode(currentNode.parentId);
                          };
                          
                          const parentInfo = findParentNode(item.id);
                          if (parentInfo && parentInfo.parentNode) {
                            // 将父节点的其他子节点（除了要删除的叶子节点）添加到选中列表
                            let siblingsToAdd: SelectedKnowledgePointNode[] = [];
                            if (parentInfo.parentNode.children && parentInfo.parentNode.children.length > 0) {
                              siblingsToAdd = parentInfo.parentNode.children
                                .filter(child => child.id !== item.id && child.type === 'knowledge')
                                .map(child => {
                                  // 构建 SelectedKnowledgePointNode
                                  const parentDoc = findItemInTree(mergedKnowledgeTree, parentInfo.parentNode!.parentId || '');
                                  return {
                                    id: child.id,
                                    knowledge_item_id: parentDoc?.id || child.parentId || '',
                                    file_name: child.file_name || '',
                                    node_id: child.node_id || 0,
                                    text: child.name,
                                    path: [],
                                    type: 'knowledge' as const
                                  } as SelectedKnowledgePointNode;
                                });
                              
                              console.log('需要添加的兄弟节点:', siblingsToAdd);
                            }
                            
                            // 移除父节点，同时添加兄弟节点
                            onRemoveItem(parentInfo.parentId, siblingsToAdd);
                          } else {
                            console.warn('无法找到要删除的父节点');
                          }
                        }
                      }}
                      style={{ marginLeft: 4, flexShrink: 0 }}
                    />
                  </>
                )}
              </div>
            ),
            key: item.id,
            isLeaf: children.length === 0,
            children: children.length > 0 ? children : undefined,
            item: item
          };
        } else {
          // folder 或 document 类型
          icon = <FileOutlined style={{ color: '#db002a', marginRight: 8, flexShrink: 0 }} />;
        }

        return {
          title: (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingRight: 8 }}>
              <span style={{ display: 'flex', alignItems: 'center', flex: 1, overflow: 'hidden', minWidth: 0 }}>
                {icon}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.name}
                </span>
              </span>
              {isSelected && (
                <>
                  {/* 文件夹和文档不显示题型配置按钮，只有知识点节点才显示 */}
                  {/* 知识点节点已经在上面单独处理并返回了，这里只处理 folder 和 document */}
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveItem(item.id);
                    }}
                    style={{ marginLeft: 8, flexShrink: 0 }}
                  />
                </>
              )}
            </div>
          ),
          key: item.id,
          isLeaf: children.length === 0,
          children: children.length > 0 ? children : undefined,
          item: item
        };
      });
    };

    return [...convertToTreeData(rootItems), ...standaloneKnowledgePointTrees];
  }, [selectedItems, mergedKnowledgeTree, onRemoveItem]);

  // 自动展开所有节点（包括知识点节点）
  useEffect(() => {
    if (selectedItems.length === 0 || mergedKnowledgeTree.length === 0) {
      setExpandedKeys([]);
      return;
    }
    
    const allKeys: React.Key[] = [];
    
    // 递归收集所有节点的key
    const collectKeys = (nodes: CustomDataNode[]) => {
      nodes.forEach(node => {
        allKeys.push(node.key);
        if (node.children && node.children.length > 0) {
          collectKeys(node.children);
        }
      });
    };
    
    // 使用treeData来计算展开的keys
    if (treeData.length > 0) {
      collectKeys(treeData);
    }
    
    setExpandedKeys(allKeys);
  }, [treeData]);

  // 打开题型配置Modal
  const handleOpenConfigModal = (itemId: string | null = null) => {
    setCurrentConfigItemId(itemId);
    if (itemId === null) {
      // 全局配置
      setTempQuestionTypes([...globalQuestionTypes]);
    } else {
      // 单个知识点配置：如果知识点有单独配置，显示单独配置；否则显示继承的配置
      const itemMap = new Map<string, KnowledgeItem>();
      const buildItemMap = (items: KnowledgeItem[]) => {
        items.forEach(item => {
          itemMap.set(item.id, item);
          if (item.children && item.children.length > 0) {
            buildItemMap(item.children);
          }
        });
      };
      buildItemMap(mergedKnowledgeTree);
      
      // 获取该知识点的题型配置（支持继承）
      const questionTypes = getQuestionTypesForItem(itemId, itemMap);
      setTempQuestionTypes([...questionTypes]);
    }
    setIsConfigModalVisible(true);
  };

  // 保存题型配置
  const handleSaveConfig = () => {
    if (currentConfigItemId === null) {
      // 保存全局配置
      setGlobalQuestionTypes([...tempQuestionTypes]);
      message.success('全局题型配置已保存');
    } else {
      // 保存单个知识点配置
      // 深拷贝配置，确保不会引用同一个对象
      const configToSave = tempQuestionTypes.map(qt => ({
        ...qt,
        enabled: qt.enabled,
        low: qt.low,
        medium: qt.medium,
        high: qt.high
      }));
      
      const newMap = new Map(itemQuestionTypes);
      newMap.set(currentConfigItemId, configToSave);
      setItemQuestionTypes(newMap);
      
      // 调试日志：检查保存的配置
      console.log(`保存知识点 ${currentConfigItemId} 的配置:`, configToSave);
      console.log(`保存后的 itemQuestionTypes:`, Array.from(newMap.entries()));
      
      message.success('知识点题型配置已保存');
    }
    setIsConfigModalVisible(false);
  };

  // 获取知识点使用的题型配置（支持继承父节点配置）
  // 逻辑：
  // 1. 如果当前节点有配置，使用当前节点的配置
  // 2. 否则，向上查找父节点配置：
  //    - 如果父节点有单独配置，使用父节点的配置
  //    - 如果父节点没有单独配置，继续向上查找
  //    - 如果所有父节点都没有单独配置，使用全局默认配置
  const getQuestionTypesForItem = (itemId: string, itemMap?: Map<string, KnowledgeItem>): QuestionTypeConfig[] => {
    // 1. 检查当前节点是否有配置
    const itemConfig = itemQuestionTypes.get(itemId);
    if (itemConfig) {
      // 深拷贝配置，避免引用问题
      return itemConfig.map(qt => ({ ...qt }));
    }
    
    // 2. 向上查找父节点配置
    if (itemMap) {
      const currentItem = itemMap.get(itemId);
      if (currentItem && currentItem.parentId) {
        // 检查父节点是否有单独配置
        const parentConfig = itemQuestionTypes.get(currentItem.parentId);
        if (parentConfig) {
          // 父节点有单独配置，使用父节点的配置（深拷贝）
          return parentConfig.map(qt => ({ ...qt }));
        } else {
          // 父节点没有单独配置，继续向上查找
          return getQuestionTypesForItem(currentItem.parentId, itemMap);
        }
      }
    }
    
    // 3. 如果都没有配置，使用全局默认配置（深拷贝）
    return globalQuestionTypes.map(qt => ({ ...qt }));
  };

  // 识别题目类型
  const detectQuestionType = (question: ParsedQuestion): QuestionType => {
    // 如果没有选项，判定为问答题
    if (!question.options || question.options.length === 0) {
      return 'essay';
    }
    
    // 如果只有两个选项，且选项内容包含"正确"、"错误"、"对"、"错"等关键词，判定为判断题
    if (question.options.length === 2) {
      const optionText = question.options.join(' ').toLowerCase();
      if (optionText.includes('正确') || optionText.includes('错误') || 
          optionText.includes('对') || optionText.includes('错') ||
          optionText.includes('true') || optionText.includes('false') ||
          optionText.includes('是') || optionText.includes('否')) {
        return 'true_false';
      }
    }
    
    // 如果答案包含多个字母（如AB、ACD），判定为多选题
    if (question.answer && question.answer.length > 1 && /^[A-Z]+$/.test(question.answer.trim())) {
      return 'multiple_choice';
    }
    
    // 如果有选项且答案只有一个字母，判定为单选题
    if (question.options.length > 0 && question.answer && question.answer.length === 1 && /^[A-Z]$/.test(question.answer.trim())) {
      return 'single_choice';
    }
    
    // 默认返回单选题
    return 'single_choice';
  };

  // 提取树数据中的所有叶子节点（与页面展示的叶子节点保持一致）
  const getLeafNodes = (nodes: CustomDataNode[]): (KnowledgeItem | SelectedKnowledgePointNode)[] => {
    const leafNodes: (KnowledgeItem | SelectedKnowledgePointNode)[] = [];
    
    const traverse = (nodeList: CustomDataNode[]) => {
      nodeList.forEach(node => {
        // 如果是叶子节点（没有子节点或子节点为空，与页面展示的 isLeaf 逻辑一致）
        if (!node.children || node.children.length === 0) {
          if (node.item) {
            // 如果是知识点节点（type === 'knowledge'），优先使用 SelectedKnowledgePointNode
            if (node.item.type === 'knowledge') {
              // 检查是否是 SelectedKnowledgePointNode（在 selectedItems 中查找）
              const selectedNode = selectedItems.find(
                si => 'type' in si && si.type === 'knowledge' && si.id === node.item!.id
              ) as SelectedKnowledgePointNode | undefined;
              
              if (selectedNode) {
                // 使用 SelectedKnowledgePointNode，保留完整信息（包括 knowledge_item_id, file_name 等）
                leafNodes.push(selectedNode);
              } else {
                // 如果不是 SelectedKnowledgePointNode，从 mergedKnowledgeTree 中查找完整信息
                const findItemInTree = (items: KnowledgeItem[], itemId: string): KnowledgeItem | null => {
                  for (const item of items) {
                    if (item.id === itemId) {
                      return item;
                    }
                    if (item.children && item.children.length > 0) {
                      const found = findItemInTree(item.children, itemId);
                      if (found) return found;
                    }
                  }
                  return null;
                };
                
                const fullItem = findItemInTree(mergedKnowledgeTree, node.item.id);
                if (fullItem) {
                  leafNodes.push(fullItem);
                }
              }
            } else {
              // 非知识点节点（folder 或 document），直接添加
              // 这些节点如果是叶子节点，也应该被包含（例如：没有子知识点的文档节点）
              leafNodes.push(node.item);
            }
          }
        } else {
          // 继续遍历子节点，直到找到所有叶子节点
          traverse(node.children);
        }
      });
    };
    
    traverse(nodes);
    return leafNodes;
  };

  // 生成题目
  const handleGenerateQuestion = async () => {
    if (selectedItems.length === 0) {
      message.warning('请先选择知识点');
      return;
    }

    setIsGenerating(true);
    setParsedQuestions([]);
    setSavedQuestionId(''); // 重置已保存的question_id，因为要生成新题目

    try {
      // 从 treeData 中提取所有叶子节点
      const leafNodes = getLeafNodes(treeData);
      
      if (leafNodes.length === 0) {
        message.warning('未找到叶子节点，请选择知识点');
        setIsGenerating(false);
        return;
      }

      // 构建 itemMap 用于查找父节点
      // 需要包含 mergedKnowledgeTree 中的所有节点，以及 leafNodes 中的节点
      const itemMap = new Map<string, KnowledgeItem>();
      const buildItemMap = (items: KnowledgeItem[]) => {
        items.forEach(item => {
          itemMap.set(item.id, item);
          if (item.children && item.children.length > 0) {
            buildItemMap(item.children);
          }
        });
      };
      buildItemMap(mergedKnowledgeTree);
      
      // 确保 leafNodes 中的所有节点都在 itemMap 中
      // 如果节点不在 itemMap 中，需要从 mergedKnowledgeTree 中查找并添加
      const findItemInTree = (items: KnowledgeItem[], itemId: string): KnowledgeItem | null => {
        for (const item of items) {
          if (item.id === itemId) {
            return item;
          }
          if (item.children && item.children.length > 0) {
            const found = findItemInTree(item.children, itemId);
            if (found) return found;
          }
        }
        return null;
      };
      
      leafNodes.forEach(node => {
        if (!itemMap.has(node.id)) {
          // 如果节点不在 itemMap 中，从 mergedKnowledgeTree 中查找
          const fullItem = findItemInTree(mergedKnowledgeTree, node.id);
          if (fullItem) {
            // 递归添加该节点及其所有子节点到 itemMap
            const addItemToMap = (item: KnowledgeItem) => {
              itemMap.set(item.id, item);
              if (item.children && item.children.length > 0) {
                item.children.forEach(child => addItemToMap(child));
              }
            };
            addItemToMap(fullItem);
          }
        }
      });
      
      // 为每个叶子节点添加题型配置（支持继承父节点配置）
      const leafNodesWithConfig = leafNodes.map(item => {
        const questionTypes = getQuestionTypesForItem(item.id, itemMap);
        
        // 调试日志：检查配置来源
        const hasItemConfig = itemQuestionTypes.has(item.id);
        if (hasItemConfig) {
          console.log(`知识点 ${item.id} (${(item as any).name || (item as any).text}) 使用单独配置:`, itemQuestionTypes.get(item.id));
        } else {
          console.log(`知识点 ${item.id} (${(item as any).name || (item as any).text}) 使用继承配置:`, questionTypes);
        }
        
        // 检查是否有选中的题型
        const enabledTypes = questionTypes.filter(qt => qt.enabled);
        
        // 检查是否有设置题目数量
        const hasQuantity = enabledTypes.some(qt => qt.low > 0 || qt.medium > 0 || qt.high > 0);
        
        // 构建该知识点的题型配置
        const questionTypeConfig = hasQuantity ? enabledTypes.map(qt => ({
          type: qt.type,
          label: qt.label,
          low: qt.low,
          medium: qt.medium,
          high: qt.high
        })) : undefined;
        
        // 调试日志：检查最终配置
        if (questionTypeConfig) {
          console.log(`知识点 ${item.id} 最终配置:`, questionTypeConfig);
        }
        
        // 将题型配置添加到 item 中
        return {
          ...item,
          question_types: questionTypeConfig
        };
      }).filter(item => {
        // 过滤掉没有配置题型的知识点
        return item.question_types && item.question_types.length > 0;
      });

      if (leafNodesWithConfig.length === 0) {
        message.warning('请至少为一个知识点配置试题类型和数量');
        setIsGenerating(false);
        return;
      }

      // 传递带题型配置的叶子节点给后端（不再传递独立的 question_types 参数）
      const result = await ApiService.generateQuestions(leafNodesWithConfig);
      
      if (result.success) {
        let parsed: ParsedQuestion[] = [];
        
        // 优先使用 JSON 格式的 questions 字段
        if (result.questions && Array.isArray(result.questions)) {
          parsed = result.questions.map((q: any) => {
            // 处理选项：如果选项已经包含标签（如 "A. xxx"），直接使用；否则添加标签
            const formattedOptions = q.options && Array.isArray(q.options) 
              ? q.options.map((opt: string, idx: number) => {
                  // 检查选项是否已经包含标签（格式：A. xxx 或 A xxx）
                  const hasLabel = /^[A-Z]\.?\s/.test(opt.trim());
                  if (hasLabel) {
                    return opt; // 已经包含标签，直接使用
                  } else {
                    // 没有标签，添加标签
                    const label = String.fromCharCode(65 + idx); // A, B, C, D...
                    return `${label}. ${opt}`;
                  }
                })
              : [];
            
            const parsedQuestion: ParsedQuestion = {
              question: q.question || '',
              options: formattedOptions,
              answer: q.answer || '',
              difficulty: q.difficulty || '',
              score: q.score || '',
              explanation: q.explanation || '',
              knowledge: q.knowledge || '',
              knowledge_id: q.knowledge_id || '',
              type: q.type || detectQuestionType({
                question: q.question || '',
                options: formattedOptions,
                answer: q.answer || '',
                difficulty: q.difficulty || '',
                score: q.score || ''
              }),
              edited: false
            };
            
            return parsedQuestion;
          });
        }
        
        if (parsed.length > 0) {
          setParsedQuestions(parsed);
          setCurrentStep(1); // 生成成功后自动进入步骤二
          setActiveQuestionTypeTab('all'); // 重置tab为全部
          message.success(`成功生成 ${parsed.length} 道题目`);
        } else {
          message.error('未生成任何题目');
        }
      } else {
        message.error('生成题目失败');
      }
    } catch (error: any) {
      console.error('生成题目失败:', error);
      message.error(error.message || '生成题目失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  // 步骤二：删除题目
  const handleDeleteQuestion = (index: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这道题目吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: () => {
        const updatedQuestions = parsedQuestions.filter((_, i) => i !== index);
        setParsedQuestions(updatedQuestions);
        message.success('题目已删除');
      }
    });
  };

  // 步骤二：打开编辑Modal
  const handleOpenEditModal = (index: number) => {
    setEditingQuestionIndex(index);
    const question = parsedQuestions[index];
    // 确保options数组存在
    const questionWithOptions = {
      ...question,
      options: question.options || []
    };
    setEditingQuestion(questionWithOptions);
    setIsEditModalVisible(true);
  };

  // 步骤二：保存编辑
  const handleSaveEdit = () => {
    if (editingQuestionIndex >= 0 && editingQuestion) {
      const updatedQuestions = [...parsedQuestions];
      // 重新识别题目类型（以防编辑后类型改变）
      const updatedType = detectQuestionType(editingQuestion);
      updatedQuestions[editingQuestionIndex] = { 
        ...editingQuestion, 
        edited: true,
        type: updatedType
      };
      setParsedQuestions(updatedQuestions);
      setIsEditModalVisible(false);
      setEditingQuestionIndex(-1);
      setEditingQuestion(null);
      message.success('题目已更新');
    }
  };

  // 步骤二：保存所有题目
  const handleSaveAllQuestions = async () => {
    if (parsedQuestions.length === 0) {
      message.warning('没有题目可保存');
      return;
    }

    try {
      // 获取所有题目
      const questionsToSave = parsedQuestions.map(q => ({
        question: q.question,
        options: q.options,
        answer: q.answer,
        difficulty: q.difficulty,
        score: q.score,
        explanation: q.explanation || '',
        knowledge: q.knowledge || '',
        knowledge_id: q.knowledge_id || '',
        type: q.type || 'single_choice'
      }));

      // 保存题目到question.json（不关联题库）
      const result = await ApiService.saveQuestions(questionsToSave);
      
      if (result.success) {
        message.success(`已保存 ${result.question_count} 道题目到question.json`);
        // 保存question_id，用于步骤三更新bank_id
        if (result.question_id) {
          setSavedQuestionId(result.question_id);
        }
        // 进入步骤三
        setCurrentStep(2);
      } else {
        message.error('保存题目失败');
      }
    } catch (error: any) {
      console.error('保存题目失败:', error);
      message.error(error.message || '保存题目失败，请重试');
    }
  };

  // 根据题型过滤题目
  const getFilteredQuestions = (): ParsedQuestion[] => {
    if (activeQuestionTypeTab === 'all') {
      return parsedQuestions;
    }
    return parsedQuestions.filter(q => q.type === activeQuestionTypeTab);
  };

  // 统计各题型的数量
  const getQuestionTypeCounts = () => {
    const counts = {
      all: parsedQuestions.length,
      single_choice: 0,
      multiple_choice: 0,
      true_false: 0,
      essay: 0
    };
    
    parsedQuestions.forEach(q => {
      if (q.type) {
        counts[q.type] = (counts[q.type] || 0) + 1;
      }
    });
    
    return counts;
  };

  // 获取题型中文名称
  const getQuestionTypeLabel = (type: QuestionType | 'all'): string => {
    const labels: Record<string, string> = {
      all: '全部',
      single_choice: '单选题',
      multiple_choice: '多选题',
      true_false: '判断题',
      essay: '问答题'
    };
    return labels[type] || type;
  };

  // 步骤三：打开创建题库Modal
  const handleOpenCreateQuizBankModal = () => {
    setNewQuizBankName('');
    setIsCreateQuizBankModalVisible(true);
  };

  // 步骤三：创建新题库
  const handleCreateQuizBank = async () => {
    if (!newQuizBankName.trim()) {
      message.warning('请输入题库名称');
      return;
    }
    setIsCreatingQuizBank(true);
    try {
      const result = await ApiService.createQuestionBank(newQuizBankName.trim());
      if (result.success && result.bank) {
        const newBank = { id: result.bank.bank_id, name: result.bank.bank_name };
        setQuizBanks([...quizBanks, newBank]);
        setSelectedQuizBankId(result.bank.bank_id);
        setNewQuizBankName('');
        setIsCreateQuizBankModalVisible(false);
        message.success('题库创建成功');
      } else {
        message.error(result.detail || '创建题库失败');
      }
    } catch (error: any) {
      console.error('创建题库失败:', error);
      message.error(error.message || '创建题库失败');
    } finally {
      setIsCreatingQuizBank(false);
    }
  };

  // 步骤三：保存题目到题库
  const handleSaveToQuizBank = async () => {
    if (!selectedQuizBankId) {
      message.warning('请选择题库');
      return;
    }
    if (!savedQuestionId) {
      message.warning('未找到已保存的题目记录，请重新保存题目');
      return;
    }

    try {
      // 调用API更新题目记录的bank_id
      const result = await ApiService.updateQuestionBank(savedQuestionId, selectedQuizBankId);
      
      if (result.success) {
        message.success(`已关联 ${parsedQuestions.length} 道题目到题库`);
        
        // 保存选中的题库ID（用于跳转）
        const bankIdToNavigate = selectedQuizBankId;
        
        // 重置状态
        setCurrentStep(0);
        setParsedQuestions([]);
        setSelectedQuizBankId('');
        setSavedQuestionId('');
        
        // 跳转到题库管理页面，并传递选中的题库ID
        if (onNavigateToBank) {
          onNavigateToBank(bankIdToNavigate);
        }
      } else {
        message.error(result.message || '关联题库失败');
      }
    } catch (error: any) {
      console.error('关联题库失败:', error);
      message.error(error.message || '关联题库失败');
    }
  };

  // 步骤条配置
  const steps = [
    {
      title: '选择知识点',
    },
    {
      title: '编辑题目',
    },
    {
      title: '选择题库',
    },
  ];

  return (
    <div className="quiz-create">
      <div className="quiz-create-header">
        <h2>AI 出题</h2>
        <p style={{ color: '#666', fontSize: 14, marginTop: 8 }}>
          已选择 {selectedItems.length} 个{selectedItems.length > 0 && selectedItems.some(item => 'type' in item && item.type === 'knowledge') ? '知识点' : '知识项'}
        </p>
      </div>

      {/* 步骤条 */}
      <div style={{ marginBottom: 24 }}>
        <Steps current={currentStep} items={steps} />
      </div>

      {/* 步骤一：选择知识点并生成题目 */}
      {currentStep === 0 && (
        <>
          {selectedItems.length === 0 ? (
            <Empty
              description="请在左侧选择知识点"
              style={{ marginTop: 60 }}
            />
          ) : (
            <>
              <Card
                title="已选知识点"
                size="small"
                extra={
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                      type="link"
                      size="small"
                      icon={<SettingOutlined />}
                      onClick={() => handleOpenConfigModal(null)}
                      style={{ color: '#db002a' }}
                    >
                      题型配置
                    </Button>
                    <Button
                      type="link"
                      danger
                      size="small"
                      onClick={onClearAll}
                      disabled={selectedItems.length === 0}
                    >
                      清空全部
                    </Button>
                  </div>
                }
                style={{ marginBottom: 16 }}
              >
                <div className="selected-items-tree">
                  <Tree
                    treeData={treeData}
                    expandedKeys={expandedKeys}
                    onExpand={setExpandedKeys}
                    blockNode
                    defaultExpandAll
                  />
                </div>
              </Card>

              <Button
                type="primary"
                danger
                block
                size="large"
                onClick={handleGenerateQuestion}
                disabled={isGenerating || selectedItems.length === 0}
                loading={isGenerating}
                style={{ marginBottom: 16 }}
              >
                {isGenerating ? '正在生成题目...' : '生成题目'}
              </Button>
            </>
          )}
        </>
      )}

      {/* 步骤二：选择、编辑需要的题目并保存 */}
      {currentStep === 1 && (
        <>
          {parsedQuestions.length === 0 ? (
            <Empty description="暂无题目，请先生成题目" />
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#333' }}>
                  生成的题目 ({parsedQuestions.length} 道)
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    type="primary"
                    danger
                    onClick={handleSaveAllQuestions}
                    disabled={parsedQuestions.length === 0}
                  >
                    保存题目
                  </Button>
                  <Button onClick={() => setCurrentStep(0)}>返回上一步</Button>
                </div>
              </div>
              
              {/* 题型Tab切换 */}
              <Tabs
                activeKey={activeQuestionTypeTab}
                onChange={setActiveQuestionTypeTab}
                items={(() => {
                  const counts = getQuestionTypeCounts();
                  const tabItems = [
                    {
                      key: 'all',
                      label: `全部 (${counts.all}题)`,
                    },
                    {
                      key: 'single_choice',
                      label: `单选题 (${counts.single_choice}题)`,
                    },
                    {
                      key: 'multiple_choice',
                      label: `多选题 (${counts.multiple_choice}题)`,
                    },
                    {
                      key: 'true_false',
                      label: `判断题 (${counts.true_false}题)`,
                    },
                    {
                      key: 'essay',
                      label: `问答题 (${counts.essay}题)`,
                    },
                  ];
                  // 只显示有题目的题型
                  return tabItems.filter(item => {
                    if (item.key === 'all') return true;
                    return counts[item.key as keyof typeof counts] > 0;
                  });
                })()}
                style={{ marginBottom: 16 }}
              />
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {(() => {
                  const filteredQuestions = getFilteredQuestions();
                  // 创建原始索引映射，用于保持选中状态
                  const originalIndices = filteredQuestions.map(fq => 
                    parsedQuestions.findIndex(pq => pq === fq)
                  );
                  
                  return filteredQuestions.map((q, filteredIndex) => {
                    const originalIndex = originalIndices[filteredIndex];
                    return (
                      <Card
                        key={originalIndex}
                        size="small"
                        style={{
                          border: '1px solid #f0f0f0',
                          borderRadius: 6,
                          background: '#fff'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                          <Text style={{ fontSize: 15, fontWeight: 500, color: '#333', flexShrink: 0 }}>
                            第 {originalIndex + 1} 题
                          </Text>
                          {q.edited && (
                            <Tag color="green" style={{ flexShrink: 0 }}>已编辑</Tag>
                          )}
                          <Paragraph style={{ margin: 0, fontSize: 15, fontWeight: 500, color: '#333', flex: 1 }}>
                            {q.question}
                          </Paragraph>
                          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                            <Button
                              type="link"
                              size="small"
                              onClick={() => handleOpenEditModal(originalIndex)}
                              style={{ color: '#db002a' }}
                            >
                              编辑
                            </Button>
                            <Button
                              type="link"
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={() => handleDeleteQuestion(originalIndex)}
                            >
                              删除
                            </Button>
                          </div>
                        </div>
                        
                        {(q.type || q.difficulty || q.score) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                            {q.type && (
                              <Tag color="blue">
                                {getQuestionTypeLabel(q.type)}
                              </Tag>
                            )}
                            {q.difficulty && (
                              <Tag color={q.difficulty === '高' ? 'red' : q.difficulty === '中' ? 'orange' : 'green'}>
                                难度: {q.difficulty}
                              </Tag>
                            )}
                            {q.score && (
                              <Tag>分值: {q.score}</Tag>
                            )}
                          </div>
                        )}
                        
                        {q.options.length > 0 && (
                          <div style={{ marginBottom: 16 }}>
                            {q.options.map((option, optIndex) => {
                              // 判断选项是否被选中（用于单选题和多选题）
                              const isSelected = q.type === 'single_choice' || q.type === 'multiple_choice'
                                ? q.answer && q.answer.includes(option.charAt(0))
                                : false;
                              return (
                                <div 
                                  key={optIndex} 
                                  style={{ 
                                    marginBottom: 8, 
                                    fontSize: 14, 
                                    color: isSelected ? '#db002a' : '#666',
                                    fontWeight: isSelected ? 500 : 'normal'
                                  }}
                                >
                                  {option}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        
                        {q.answer && (
                          <div style={{ marginBottom: 12 }}>
                            <Text strong style={{ color: '#333' }}>答案：</Text>
                            <Text style={{ marginLeft: 8, color: '#333' }}>{q.answer}</Text>
                          </div>
                        )}
                        
                        {q.knowledge && (
                          <>
                            <Divider style={{ margin: '12px 0' }} />
                            <div style={{ marginBottom: 12 }}>
                              <Text strong style={{ color: '#333' }}>知识点：</Text>
                              <Text style={{ marginLeft: 8, color: '#333' }}>{q.knowledge}</Text>
                            </div>
                          </>
                        )}
                        {q.explanation && (
                          <>
                            <Divider style={{ margin: '12px 0' }} />
                            <div style={{ marginBottom: 12 }}>
                              <Text strong style={{ color: '#333' }}>解析：</Text>
                              <Text style={{ marginLeft: 8, color: '#333' }}>{q.explanation}</Text>
                            </div>
                          </>
                        )}
                      </Card>
                    );
                  });
                })()}
              </div>
            </>
          )}
        </>
      )}

      {/* 步骤三：选择题目需要保存到哪个题库 */}
      {currentStep === 2 && (
        <>
          <Card title="选择题库" style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>已保存的题目：{parsedQuestions.length} 道</Text>
              <Select
                style={{ width: '100%' }}
                placeholder="请选择题库"
                value={selectedQuizBankId}
                onChange={setSelectedQuizBankId}
                dropdownRender={(menu) => (
                  <>
                    {menu}
                    <Divider style={{ margin: '8px 0' }} />
                    <div style={{ padding: '4px 8px' }}>
                      <Button
                        type="link"
                        icon={<PlusOutlined />}
                        onClick={handleOpenCreateQuizBankModal}
                        style={{ width: '100%', textAlign: 'left', padding: '4px 8px' }}
                      >
                        新增题库
                      </Button>
                    </div>
                  </>
                )}
              >
                {quizBanks.map(bank => (
                  <Option key={bank.id} value={bank.id}>{bank.name}</Option>
                ))}
              </Select>
            </div>
          </Card>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => setCurrentStep(1)}>返回上一步</Button>
            <Button
              type="primary"
              danger
              onClick={handleSaveToQuizBank}
              disabled={!selectedQuizBankId}
            >
              保存到题库
            </Button>
          </div>
        </>
      )}

      {/* 创建题库Modal */}
      <Modal
        title="新增题库"
        open={isCreateQuizBankModalVisible}
        onOk={handleCreateQuizBank}
        onCancel={() => {
          setIsCreateQuizBankModalVisible(false);
          setNewQuizBankName('');
        }}
        okText="保存"
        cancelText="取消"
        confirmLoading={isCreatingQuizBank}
      >
        <div style={{ marginTop: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>题库名称：</Text>
          <Input
            placeholder="请输入题库名称"
            value={newQuizBankName}
            onChange={(e) => setNewQuizBankName(e.target.value)}
            onPressEnter={handleCreateQuizBank}
            autoFocus
          />
        </div>
      </Modal>

      {/* 编辑题目Modal */}
      <Modal
        title="编辑题目"
        open={isEditModalVisible}
        onOk={handleSaveEdit}
        onCancel={() => {
          setIsEditModalVisible(false);
          setEditingQuestion(null);
          setEditingQuestionIndex(-1);
        }}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        {editingQuestion && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>题干：</Text>
              <TextArea
                value={editingQuestion.question}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditingQuestion({ ...editingQuestion, question: e.target.value })}
                rows={3}
                style={{ marginTop: 8 }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text strong>选项：</Text>
                <Button
                  type="dashed"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    const currentOptions = editingQuestion.options || [];
                    const newOptions = [...currentOptions, `${String.fromCharCode(65 + currentOptions.length)}. `];
                    setEditingQuestion({ ...editingQuestion, options: newOptions });
                  }}
                >
                  添加选项
                </Button>
              </div>
              {(!editingQuestion.options || editingQuestion.options.length === 0) ? (
                <div style={{ color: '#999', fontSize: 14, marginTop: 8 }}>
                  问答题无需选项，可直接填写答案
                </div>
              ) : (
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  {editingQuestion.options.map((option, index) => (
                    <div key={index} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Input
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...editingQuestion.options];
                          newOptions[index] = e.target.value;
                          setEditingQuestion({ ...editingQuestion, options: newOptions });
                        }}
                        placeholder={`选项 ${String.fromCharCode(65 + index)}`}
                        style={{ flex: 1 }}
                      />
                      {editingQuestion.options.length > 1 && (
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => {
                            const newOptions = editingQuestion.options.filter((_, i) => i !== index);
                            setEditingQuestion({ ...editingQuestion, options: newOptions });
                          }}
                        >
                          删除
                        </Button>
                      )}
                    </div>
                  ))}
                </Space>
              )}
            </div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>答案：</Text>
              <Input
                value={editingQuestion.answer}
                onChange={(e) => setEditingQuestion({ ...editingQuestion, answer: e.target.value })}
                style={{ marginTop: 8 }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>知识点：</Text>
              <Input
                value={editingQuestion.knowledge || ''}
                onChange={(e) => setEditingQuestion({ ...editingQuestion, knowledge: e.target.value })}
                style={{ marginTop: 8 }}
                placeholder="请输入知识点"
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>解析：</Text>
              <TextArea
                value={editingQuestion.explanation || ''}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditingQuestion({ ...editingQuestion, explanation: e.target.value })}
                rows={4}
                style={{ marginTop: 8 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div>
                <Text strong>难度：</Text>
                <Select
                  value={editingQuestion.difficulty}
                  onChange={(value) => setEditingQuestion({ ...editingQuestion, difficulty: value })}
                  style={{ width: 120, marginLeft: 8 }}
                >
                  <Option value="低">低</Option>
                  <Option value="中">中</Option>
                  <Option value="高">高</Option>
                </Select>
              </div>
              <div>
                <Text strong>分值：</Text>
                <Input
                  value={editingQuestion.score}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, score: e.target.value })}
                  style={{ width: 120, marginLeft: 8 }}
                />
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 题型配置Modal */}
      <Modal
        title={currentConfigItemId === null ? "全局题型配置" : "知识点题型配置"}
        open={isConfigModalVisible}
        onOk={handleSaveConfig}
        onCancel={() => setIsConfigModalVisible(false)}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        <div style={{ padding: '8px 0' }}>
          {tempQuestionTypes.map((qt, index) => (
            <div
              key={qt.type}
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: index < tempQuestionTypes.length - 1 ? 16 : 0,
                padding: '8px 0'
              }}
            >
              <div style={{ width: 100, marginRight: 16 }}>
                <Checkbox
                  checked={qt.enabled}
                  onChange={(e) => {
                    const newTypes = [...tempQuestionTypes];
                    newTypes[index].enabled = e.target.checked;
                    setTempQuestionTypes(newTypes);
                  }}
                >
                  {qt.label}
                </Checkbox>
              </div>
              <div style={{ flex: 1, display: 'flex', gap: 16 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ minWidth: 50, fontSize: 14 }}>低难度</span>
                  <InputNumber
                    min={0}
                    value={qt.low}
                    onChange={(value) => {
                      const newTypes = [...tempQuestionTypes];
                      newTypes[index].low = value || 0;
                      setTempQuestionTypes(newTypes);
                    }}
                    disabled={!qt.enabled}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: 14 }}>个</span>
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ minWidth: 50, fontSize: 14 }}>中难度</span>
                  <InputNumber
                    min={0}
                    value={qt.medium}
                    onChange={(value) => {
                      const newTypes = [...tempQuestionTypes];
                      newTypes[index].medium = value || 0;
                      setTempQuestionTypes(newTypes);
                    }}
                    disabled={!qt.enabled}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: 14 }}>个</span>
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ minWidth: 50, fontSize: 14 }}>高难度</span>
                  <InputNumber
                    min={0}
                    value={qt.high}
                    onChange={(value) => {
                      const newTypes = [...tempQuestionTypes];
                      newTypes[index].high = value || 0;
                      setTempQuestionTypes(newTypes);
                    }}
                    disabled={!qt.enabled}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: 14 }}>个</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};

