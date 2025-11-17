import { useState, useMemo, useEffect } from 'react';
import { Card, Button, Empty, Tree, message, Modal, Tag, Typography, Divider, Steps, Input, Select, InputNumber, Row, Col } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { FolderOutlined, FileOutlined, DeleteOutlined, BookOutlined, PlusOutlined } from '@ant-design/icons';
import { KnowledgeItem, SelectedKnowledgePointNode } from '../types';
import { ApiService } from '../services/api';
import './QuizCompose.css';

const { Text, Paragraph } = Typography;
const { Option } = Select;

interface QuizComposeProps {
  selectedItems: (KnowledgeItem | SelectedKnowledgePointNode)[];
  onRemoveItem: (itemId: string) => void;
  onClearAll: () => void;
  selectedBankId: string;
  onBankIdChange: (bankId: string) => void;
}

interface CustomDataNode extends DataNode {
  item?: KnowledgeItem;
}

interface Question {
  question_id?: string;
  question: string;
  options: string[];
  answer: string;
  difficulty: string;
  score: string;
  explanation?: string;
  knowledge?: string;
  knowledge_id?: string;
  type?: string;
}

interface QuizComposeProps {
  selectedItems: (KnowledgeItem | SelectedKnowledgePointNode)[];
  onRemoveItem: (itemId: string) => void;
  onClearAll: () => void;
  selectedBankId: string;
  onBankIdChange: (bankId: string) => void;
  onNavigateToPaper?: (quizId?: string) => void;
}

export const QuizCompose = ({ selectedItems, onRemoveItem, onClearAll, selectedBankId, onBankIdChange, onNavigateToPaper }: QuizComposeProps) => {
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [mergedKnowledgeTree, setMergedKnowledgeTree] = useState<KnowledgeItem[]>([]);
  
  // 步骤条相关状态
  const [currentStep, setCurrentStep] = useState<number>(0);
  
  // 步骤二：题目相关状态
  const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  
  // 题库列表（用于第一步选择）
  const [quizBanks, setQuizBanks] = useState<Array<{ id: string; name: string }>>([]);
  
  // 试卷列表（用于第一步选择）
  const [quizBankList, setQuizBankList] = useState<Array<{ quiz_id: string; quiz_name: string; creator: string; created_time: string }>>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string>('');
  const [isCreateQuizModalVisible, setIsCreateQuizModalVisible] = useState(false);
  const [newQuizName, setNewQuizName] = useState<string>('');
  const [isCreatingQuiz, setIsCreatingQuiz] = useState(false);
  
  // 题型统计和配置
  const [typeStatistics, setTypeStatistics] = useState<{
    single_choice: number;
    multiple_choice: number;
    true_false: number;
    essay: number;
  }>({
    single_choice: 0,
    multiple_choice: 0,
    true_false: 0,
    essay: 0
  });
  const [targetCounts, setTargetCounts] = useState<{
    single_choice: number;
    multiple_choice: number;
    true_false: number;
    essay: number;
  }>({
    single_choice: 0,
    multiple_choice: 0,
    true_false: 0,
    essay: 0
  });
  
  // 步骤三：试卷相关状态
  const [isCreatePaperModalVisible, setIsCreatePaperModalVisible] = useState(false);
  const [newPaperName, setNewPaperName] = useState<string>('');
  const [selectedPaperId, setSelectedPaperId] = useState<string>('');
  const [isCreatingPaper, setIsCreatingPaper] = useState(false);

  // 加载知识树结构
  useEffect(() => {
    const loadKnowledgeTree = async () => {
      try {
        const flatItems = await ApiService.loadKnowledgeTree();
        
        const buildTreeFromFlatList = (flatItems: KnowledgeItem[]): KnowledgeItem[] => {
          const itemMap = new Map<string, KnowledgeItem>();
          const rootItems: KnowledgeItem[] = [];

          flatItems.forEach(item => {
            itemMap.set(item.id, { ...item, children: [] });
          });

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

  // 加载题库列表（步骤一）
  useEffect(() => {
    const loadQuizBanks = async () => {
      if (currentStep === 0) {
        try {
          const banks = await ApiService.getQuestionBanks();
          const formattedBanks = banks.map(bank => ({
            id: bank.bank_id,
            name: bank.bank_name
          }));
          setQuizBanks(formattedBanks);
          if (formattedBanks.length > 0 && !selectedBankId) {
            onBankIdChange(formattedBanks[0].id);
          }
        } catch (error) {
          console.error('加载题库列表失败:', error);
        }
      }
    };
    loadQuizBanks();
  }, [currentStep]);
  
  // 加载试卷列表（步骤三）
  useEffect(() => {
    const loadQuizBankList = async () => {
      if (currentStep === 2) {
        try {
          const result = await ApiService.getQuizBanks();
          if (result.success && result.quizs) {
            setQuizBankList(result.quizs);
          }
        } catch (error) {
          console.error('加载试卷列表失败:', error);
        }
      }
    };
    loadQuizBankList();
  }, [currentStep]);
  
  // 创建试卷
  const handleCreateQuiz = async () => {
    if (!newQuizName.trim()) {
      message.warning('请输入试卷名称');
      return;
    }
    
    setIsCreatingQuiz(true);
    try {
      const result = await ApiService.createQuiz(newQuizName.trim());
      if (result.success && result.quiz) {
        const newQuiz = result.quiz;
        setQuizBankList([...quizBankList, newQuiz]);
        setSelectedQuizId(newQuiz.quiz_id);
        setIsCreateQuizModalVisible(false);
        setNewQuizName('');
        message.success('试卷创建成功');
      } else {
        message.error(result.message || '创建试卷失败');
      }
    } catch (error: any) {
      console.error('创建试卷失败:', error);
      message.error(error.message || '创建试卷失败');
    } finally {
      setIsCreatingQuiz(false);
    }
  };

  // 加载选中知识点的题型统计（步骤二，用于显示统计信息）
  useEffect(() => {
    const loadStatistics = async () => {
      if (currentStep === 1 && selectedItems.length > 0) {
        setLoadingQuestions(true);
        try {
          // 从完整知识树中查找选中项的所有子节点中的知识点
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
          
          const allKnowledgeIds = new Set<string>();
          
          // 1. 直接从 selectedItems 中提取知识点ID
          selectedItems.forEach(item => {
            if ('type' in item && item.type === 'knowledge') {
              allKnowledgeIds.add(item.id);
            }
          });
          
          // 2. 从完整知识树中查找选中项的所有子节点中的知识点
          selectedItems.forEach(item => {
            const fullItem = findItemInTree(mergedKnowledgeTree, item.id);
            if (fullItem) {
              // 递归获取该节点下所有知识点ID
              const collectKnowledgeIds = (node: KnowledgeItem) => {
                if (node.type === 'knowledge') {
                  allKnowledgeIds.add(node.id);
                }
                if (node.children && node.children.length > 0) {
                  node.children.forEach(child => collectKnowledgeIds(child));
                }
              };
              collectKnowledgeIds(fullItem);
            }
          });
          
          const selectedKnowledgeIds = Array.from(allKnowledgeIds);
          
          if (selectedKnowledgeIds.length > 0) {
            // 根据选中的知识点ID统计题目数量（不区分题库）
            const statisticsResult = await ApiService.getQuestionTypeStatistics(selectedKnowledgeIds);
            
            if (statisticsResult.success && statisticsResult.type_statistics) {
              setTypeStatistics(statisticsResult.type_statistics);
              // 不重置目标数量，保留用户已配置的数量
            }
          } else {
            // 如果没有选中知识点，重置统计
            setTypeStatistics({
              single_choice: 0,
              multiple_choice: 0,
              true_false: 0,
              essay: 0
            });
          }
        } catch (error) {
          console.error('加载题型统计失败:', error);
          message.error('加载题型统计失败');
        } finally {
          setLoadingQuestions(false);
        }
      }
    };
    loadStatistics();
  }, [currentStep, selectedItems, mergedKnowledgeTree]);

  // 将选中的知识点构建成树形结构
  const treeData = useMemo(() => {
    if (selectedItems.length === 0 || mergedKnowledgeTree.length === 0) return [];

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
        selectedKnowledgePointNodes.push(selectedItem as SelectedKnowledgePointNode);
      } else {
        const fullItem = findItem(mergedKnowledgeTree, selectedItem.id);
        if (fullItem) {
          selectedItemsWithChildren.push(fullItem);
        }
      }
    });

    if (selectedItemsWithChildren.length === 0 && selectedKnowledgePointNodes.length === 0) return [];

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
    
    selectedKnowledgePointNodes.forEach(node => {
      const fullItem = findItem(mergedKnowledgeTree, node.id);
      if (fullItem) {
        collectAllItems([fullItem]);
      }
    });

    const rootItems: KnowledgeItem[] = [];
    selectedItemsWithChildren.forEach(item => {
      const parentInSelected = selectedItems.find(selected => selected.id === item.parentId);
      if (!parentInSelected) {
        rootItems.push(item);
      }
    });

    const isItemSelected = (itemId: string): boolean => {
      return selectedItems.some(selected => {
        if ('type' in selected && selected.type === 'knowledge') {
          return false;
        }
        return (selected as KnowledgeItem).id === itemId;
      });
    };

    const isKnowledgePointSelected = (itemId: string): boolean => {
      if (selectedKnowledgePointNodes.some(node => node.id === itemId)) {
        return true;
      }
      
      const checkParentSelected = (currentId: string): boolean => {
        const currentNode = itemMap.get(currentId);
        if (!currentNode || !currentNode.parentId) {
          return false;
        }
        
        if (selectedKnowledgePointNodes.some(node => node.id === currentNode.parentId)) {
          return true;
        }
        
        return checkParentSelected(currentNode.parentId);
      };
      
      return checkParentSelected(itemId);
    };
    
    const isKnowledgePointDirectlySelected = (itemId: string): boolean => {
      return selectedKnowledgePointNodes.some(node => node.id === itemId);
    };

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

    const pointsByDoc = new Map<string, SelectedKnowledgePointNode[]>();
    selectedKnowledgePointNodes.forEach(node => {
      const docId = node.knowledge_item_id;
      if (!pointsByDoc.has(docId)) {
        pointsByDoc.set(docId, []);
      }
      pointsByDoc.get(docId)!.push(node);
    });

    const standaloneKnowledgePointTrees: CustomDataNode[] = [];
    pointsByDoc.forEach((_nodes, docId) => {
      const docInSelected = selectedItemsWithChildren.find(item => item.id === docId);
      if (docInSelected) {
        return;
      }

      const doc = findItemInTree(mergedKnowledgeTree, docId);
      if (!doc) return;

      const findKnowledgePointNodes = (items: KnowledgeItem[], parentId: string | null): KnowledgeItem[] => {
        const result: KnowledgeItem[] = [];
        items.forEach(item => {
          if (item.type === 'knowledge') {
            if (isKnowledgePointSelected(item.id)) {
              const knowledgeNode: KnowledgeItem = {
                ...item,
                children: item.children ? findKnowledgePointNodes(item.children, item.id) : []
              };
              result.push(knowledgeNode);
            } else if (item.children && item.children.length > 0) {
              const childNodes = findKnowledgePointNodes(item.children, item.id);
              if (childNodes.length > 0) {
                const knowledgeNode: KnowledgeItem = {
                  ...item,
                  children: childNodes
                };
                result.push(knowledgeNode);
              }
            }
          } else if (item.children && item.children.length > 0) {
            result.push(...findKnowledgePointNodes(item.children, parentId));
          }
        });
        return result;
      };

      const knowledgePointItems = doc.children ? findKnowledgePointNodes(doc.children, doc.id) : [];
      
      if (knowledgePointItems.length > 0) {
        const buildKnowledgePointTree = (items: KnowledgeItem[]): CustomDataNode[] => {
          return items.map(item => {
            const isDirectlySelected = isKnowledgePointDirectlySelected(item.id);
            const children: CustomDataNode[] = [];
            
            if (item.children && item.children.length > 0) {
              children.push(...buildKnowledgePointTree(item.children));
            }

            return {
              title: (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingRight: 8 }}>
                  <span style={{ display: 'flex', alignItems: 'center', flex: 1, overflow: 'hidden', minWidth: 0 }}>
                    <BookOutlined style={{ color: '#db002a', marginRight: 8, flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name}
                    </span>
                  </span>
                  {isDirectlySelected && (
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveItem(item.id);
                      }}
                      style={{ marginLeft: 4, flexShrink: 0 }}
                    />
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

        const pointTreeNodes = buildKnowledgePointTree(knowledgePointItems);
        
        if (pointTreeNodes.length > 0) {
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

    const convertToTreeData = (items: KnowledgeItem[]): CustomDataNode[] => {
      return items.map(item => {
        const isSelected = isItemSelected(item.id);
        const children: CustomDataNode[] = [];
        
        if (item.children && item.children.length > 0) {
          children.push(...convertToTreeData(item.children));
        }

        let icon;
        if (item.type === 'folder') {
          icon = <FolderOutlined style={{ color: '#db002a', marginRight: 8, flexShrink: 0 }} />;
        } else if (item.type === 'knowledge') {
          icon = <BookOutlined style={{ color: '#db002a', marginRight: 8, flexShrink: 0 }} />;
          const isKpDirectlySelected = isKnowledgePointDirectlySelected(item.id);
          return {
            title: (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingRight: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', flex: 1, overflow: 'hidden', minWidth: 0 }}>
                  {icon}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </span>
                </span>
                {isKpDirectlySelected && (
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveItem(item.id);
                    }}
                    style={{ marginLeft: 4, flexShrink: 0 }}
                  />
                )}
              </div>
            ),
            key: item.id,
            isLeaf: children.length === 0,
            children: children.length > 0 ? children : undefined,
            item: item
          };
        } else {
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

  // 自动展开所有节点
  useEffect(() => {
    if (selectedItems.length === 0 || mergedKnowledgeTree.length === 0) {
      setExpandedKeys([]);
      return;
    }
    
    const allKeys: React.Key[] = [];
    
    const collectKeys = (nodes: CustomDataNode[]) => {
      nodes.forEach(node => {
        allKeys.push(node.key);
        if (node.children && node.children.length > 0) {
          collectKeys(node.children);
        }
      });
    };
    
    if (treeData.length > 0) {
      collectKeys(treeData);
    }
    
    setExpandedKeys(allKeys);
  }, [treeData]);

  // 步骤二：组卷
  const handleFilterQuestions = async () => {
    if (!selectedBankId) {
      message.warning('请选择题库');
      return;
    }

    if (selectedItems.length === 0) {
      message.warning('请先选择知识点');
      return;
    }

    // 检查是否配置了题目数量
    const totalCount = targetCounts.single_choice + targetCounts.multiple_choice + 
                      targetCounts.true_false + targetCounts.essay;
    if (totalCount === 0) {
      message.warning('请配置各题型的生成数量');
      return;
    }

    // 递归获取所有选中项及其子节点中的知识点ID（包含所有叶子节点）
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
    
    const allKnowledgeIds = new Set<string>();
    
    // 1. 直接从 selectedItems 中提取知识点ID
    selectedItems.forEach(item => {
      if ('type' in item && item.type === 'knowledge') {
        allKnowledgeIds.add(item.id);
      }
    });
    
    // 2. 从完整知识树中查找选中项的所有子节点中的知识点
    selectedItems.forEach(item => {
      const fullItem = findItemInTree(mergedKnowledgeTree, item.id);
      if (fullItem) {
        // 递归获取该节点下所有知识点ID
        const collectKnowledgeIds = (node: KnowledgeItem) => {
          if (node.type === 'knowledge') {
            allKnowledgeIds.add(node.id);
          }
          if (node.children && node.children.length > 0) {
            node.children.forEach(child => collectKnowledgeIds(child));
          }
        };
        collectKnowledgeIds(fullItem);
      }
    });
    
    const selectedKnowledgeIds = Array.from(allKnowledgeIds);

    if (selectedKnowledgeIds.length === 0) {
      message.warning('请至少选择一个知识点');
      return;
    }

    try {
      // 调用组卷接口（quiz_name传空字符串，选择试卷时再更新）
      const result = await ApiService.composeQuiz({
        bank_id: selectedBankId,
        knowledge_ids: selectedKnowledgeIds,
        target_counts: targetCounts,
        quiz_name: ""
      });

      if (result.success) {
        message.success(`组卷成功！共生成 ${result.question_count} 道题目`);
        setCurrentStep(2);
      } else {
        message.error(result.message || '组卷失败');
      }
    } catch (error: any) {
      console.error('组卷失败:', error);
      message.error(error.message || '组卷失败');
    }
  };

  // 步骤三：创建试卷
  const handleCreatePaper = async () => {
    if (!newPaperName.trim()) {
      message.warning('请输入试卷名称');
      return;
    }
    if (selectedQuestions.length === 0) {
      message.warning('请先配置试题数量');
      return;
    }

    setIsCreatingPaper(true);
    try {
      // TODO: 调用后端API创建试卷
      // const result = await ApiService.createQuizPaper({
      //   paper_name: newPaperName.trim(),
      //   question_ids: selectedQuestions.map(q => q.question_id).filter(Boolean)
      // });
      
      message.success('试卷创建成功');
      setIsCreatePaperModalVisible(false);
      const newPaperId = `paper_${Date.now()}`; // 临时ID，实际应该从API返回
      setSelectedPaperId(newPaperId);
      setNewPaperName('');
      // 不重置步骤，让用户可以选择继续操作或完成
    } catch (error: any) {
      console.error('创建试卷失败:', error);
      message.error(error.message || '创建试卷失败');
    } finally {
      setIsCreatingPaper(false);
    }
  };

  // 步骤条配置
  const steps = [
    {
      title: '选择题库和知识点',
    },
    {
      title: '配置组卷策略',
    },
    {
      title: '选择试卷',
    },
  ];

  return (
    <div className="quiz-compose">
      <div className="quiz-compose-header">
        <h2>AI 组卷</h2>
        <p style={{ color: '#666', fontSize: 14, marginTop: 8 }}>
          已选择 {selectedItems.length} 个{selectedItems.length > 0 && selectedItems.some(item => 'type' in item && item.type === 'knowledge') ? '知识点' : '知识项'}
        </p>
      </div>

      {/* 步骤条 */}
      <div style={{ marginBottom: 24 }}>
        <Steps current={currentStep} items={steps} />
      </div>

      {/* 步骤一：选择题库和知识点 */}
      {currentStep === 0 && (
        <>
          <Card title="选择题库" size="small" style={{ marginBottom: 16 }}>
            <Select
              style={{ width: '100%' }}
              placeholder="请选择题库"
              value={selectedBankId}
              onChange={(value) => {
                onBankIdChange(value);
              }}
            >
              {quizBanks.map(bank => (
                <Option key={bank.id} value={bank.id}>{bank.name}</Option>
              ))}
            </Select>
            {!selectedBankId && (
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">请先选择题库，然后从左侧选择知识点</Text>
              </div>
            )}
          </Card>
          
          {selectedBankId && (
            <>
              {selectedItems.length === 0 ? (
                <Empty
                  description="请从左侧选择知识点"
                  style={{ marginTop: 60 }}
                />
              ) : (
                <>
                  <Card
                    title="已选知识点"
                    size="small"
                    extra={
                      <Button
                        type="link"
                        danger
                        size="small"
                        onClick={onClearAll}
                        disabled={selectedItems.length === 0}
                      >
                        清空全部
                      </Button>
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
                    onClick={() => setCurrentStep(1)}
                    disabled={selectedItems.length === 0}
                    style={{ marginBottom: 16 }}
                  >
                    下一步
                  </Button>
                </>
              )}
            </>
          )}
        </>
      )}

      {/* 步骤二：配置组卷策略 */}
      {currentStep === 1 && (
        <>
          <Card title="配置组卷策略" size="small" style={{ marginBottom: 16 }}>
            <Text strong style={{ display: 'block', marginBottom: 16 }}>题型配置：</Text>
            <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Card size="small" style={{ background: '#f9f9f9' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <Text strong>单选题</Text>
                          <div style={{ marginTop: 4 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              题库中：{typeStatistics.single_choice} 道
                            </Text>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Text>生成：</Text>
                          <InputNumber
                            min={0}
                            max={typeStatistics.single_choice}
                            value={targetCounts.single_choice}
                            onChange={(value) => {
                              const numValue = value || 0;
                              const maxValue = typeStatistics.single_choice;
                              setTargetCounts({ ...targetCounts, single_choice: Math.min(numValue, maxValue) });
                            }}
                            style={{ width: 80 }}
                          />
                          <Text type="secondary" style={{ fontSize: 12 }}>道</Text>
                        </div>
                      </div>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" style={{ background: '#f9f9f9' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <Text strong>多选题</Text>
                          <div style={{ marginTop: 4 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              题库中：{typeStatistics.multiple_choice} 道
                            </Text>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Text>生成：</Text>
                          <InputNumber
                            min={0}
                            max={typeStatistics.multiple_choice}
                            value={targetCounts.multiple_choice}
                            onChange={(value) => {
                              const numValue = value || 0;
                              const maxValue = typeStatistics.multiple_choice;
                              setTargetCounts({ ...targetCounts, multiple_choice: Math.min(numValue, maxValue) });
                            }}
                            style={{ width: 80 }}
                          />
                          <Text type="secondary" style={{ fontSize: 12 }}>道</Text>
                        </div>
                      </div>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" style={{ background: '#f9f9f9' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <Text strong>判断题</Text>
                          <div style={{ marginTop: 4 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              题库中：{typeStatistics.true_false} 道
                            </Text>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Text>生成：</Text>
                          <InputNumber
                            min={0}
                            max={typeStatistics.true_false}
                            value={targetCounts.true_false}
                            onChange={(value) => {
                              const numValue = value || 0;
                              const maxValue = typeStatistics.true_false;
                              setTargetCounts({ ...targetCounts, true_false: Math.min(numValue, maxValue) });
                            }}
                            style={{ width: 80 }}
                          />
                          <Text type="secondary" style={{ fontSize: 12 }}>道</Text>
                        </div>
                      </div>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" style={{ background: '#f9f9f9' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <Text strong>问答题</Text>
                          <div style={{ marginTop: 4 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              题库中：{typeStatistics.essay} 道
                            </Text>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Text>生成：</Text>
                          <InputNumber
                            min={0}
                            max={typeStatistics.essay}
                            value={targetCounts.essay}
                            onChange={(value) => {
                              const numValue = value || 0;
                              const maxValue = typeStatistics.essay;
                              setTargetCounts({ ...targetCounts, essay: Math.min(numValue, maxValue) });
                            }}
                            style={{ width: 80 }}
                          />
                          <Text type="secondary" style={{ fontSize: 12 }}>道</Text>
                        </div>
                      </div>
                    </Card>
                  </Col>
            </Row>
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">
                总计：{targetCounts.single_choice + targetCounts.multiple_choice + targetCounts.true_false + targetCounts.essay} 道题目
              </Text>
            </div>
          </Card>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => setCurrentStep(0)}>返回上一步</Button>
            <Button
              type="primary"
              danger
              onClick={handleFilterQuestions}
              disabled={!selectedBankId}
            >
              下一步
            </Button>
          </div>
        </>
      )}

      {/* 步骤三：选择试卷 */}
      {currentStep === 2 && (
        <>
          <Card title="选择试卷" size="small" style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <Select
                style={{ width: '100%' }}
                placeholder="请选择试卷"
                value={selectedQuizId}
                onChange={setSelectedQuizId}
                dropdownRender={(menu) => (
                  <>
                    {menu}
                    <Divider style={{ margin: '8px 0' }} />
                    <div style={{ padding: '4px 8px' }}>
                      <Button
                        type="link"
                        icon={<PlusOutlined />}
                        onClick={() => setIsCreateQuizModalVisible(true)}
                        style={{ width: '100%', textAlign: 'left', padding: '4px 8px' }}
                      >
                        新增试卷
                      </Button>
                    </div>
                  </>
                )}
              >
                {quizBankList.map(quiz => (
                  <Option key={quiz.quiz_id} value={quiz.quiz_id}>{quiz.quiz_name}</Option>
                ))}
              </Select>
            </div>
          </Card>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => setCurrentStep(1)}>返回上一步</Button>
            <Button
              type="primary"
              danger
              onClick={async () => {
                if (!selectedQuizId) {
                  message.warning('请选择试卷');
                  return;
                }
                
                try {
                  // 获取选中的试卷信息
                  const selectedQuiz = quizBankList.find(quiz => quiz.quiz_id === selectedQuizId);
                  if (!selectedQuiz) {
                    message.error('未找到选中的试卷');
                    return;
                  }
                  
                  // 更新试卷题目中的quiz_id和quiz_name
                  const result = await ApiService.updateQuizQuestionsQuizInfo(
                    selectedQuiz.quiz_id,
                    selectedQuiz.quiz_name
                  );
                  
                  if (result.success) {
                    message.success('已保存到试卷');
                    setCurrentStep(0);
                    setSelectedQuestions([]);
                    const savedQuizId = selectedQuizId;
                    setSelectedQuizId('');
                    // 跳转到试卷管理页面
                    if (onNavigateToPaper) {
                      onNavigateToPaper(savedQuizId);
                    }
                  } else {
                    message.error(result.message || '保存失败');
                  }
                } catch (error: any) {
                  console.error('保存到试卷失败:', error);
                  message.error(error.message || '保存到试卷失败');
                }
              }}
              disabled={!selectedQuizId}
            >
              保存到试卷
            </Button>
          </div>
        </>
      )}

      {/* 创建试卷Modal */}
      <Modal
        title="创建新试卷"
        open={isCreatePaperModalVisible}
        onOk={handleCreatePaper}
        onCancel={() => {
          setIsCreatePaperModalVisible(false);
          setNewPaperName('');
        }}
        okText="创建"
        cancelText="取消"
        confirmLoading={isCreatingPaper}
      >
        <div style={{ marginTop: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>试卷名称：</Text>
          <Input
            placeholder="请输入试卷名称"
            value={newPaperName}
            onChange={(e) => setNewPaperName(e.target.value)}
            onPressEnter={handleCreatePaper}
            autoFocus
          />
        </div>
      </Modal>
      
      {/* 创建试卷Modal */}
      <Modal
        title="新增试卷"
        open={isCreateQuizModalVisible}
        onOk={handleCreateQuiz}
        onCancel={() => {
          setIsCreateQuizModalVisible(false);
          setNewQuizName('');
        }}
        okText="保存"
        cancelText="取消"
        confirmLoading={isCreatingQuiz}
      >
        <div style={{ marginTop: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>试卷名称：</Text>
          <Input
            placeholder="请输入试卷名称"
            value={newQuizName}
            onChange={(e) => setNewQuizName(e.target.value)}
            onPressEnter={handleCreateQuiz}
            autoFocus
          />
        </div>
      </Modal>
    </div>
  );
};
