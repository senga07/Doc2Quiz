import { Document } from '../types';

interface DocumentListProps {
  documents: Document[];
  onSelect: (document: Document) => void;
  onDelete: (documentId: string) => void;
}

export const DocumentList = ({ documents, onSelect, onDelete }: DocumentListProps) => {
  return (
    <div className="document-list">
      <h2>文档列表</h2>
      {documents.length === 0 ? (
        <p>暂无文档</p>
      ) : (
        <ul>
          {documents.map((doc) => (
            <li key={doc.document_id}>
              <span>{doc.filename}</span>
              <span>{doc.status}</span>
              <button onClick={() => onSelect(doc)}>选择</button>
              <button onClick={() => onDelete(doc.document_id)}>删除</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};


