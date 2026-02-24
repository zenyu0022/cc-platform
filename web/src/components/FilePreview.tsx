'use client';

import { useState, useEffect, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { FileNode } from '@/types';

interface Props {
  file: FileNode | null;
  onClose: () => void;
  onSave: (content: string) => void;
}

const editableExtensions = ['ts', 'tsx', 'js', 'jsx', 'json', 'md', 'txt', 'html', 'css', 'py', 'go', 'rs', 'yaml', 'yml', 'xml', 'sql', 'sh'];

function getExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || 'txt';
}

function isEditable(filename: string): boolean {
  const ext = getExtension(filename);
  return editableExtensions.includes(ext);
}

function getLanguageExtension(filename: string) {
  const ext = getExtension(filename);
  switch (ext) {
    case 'js':
    case 'jsx':
      return javascript({ jsx: true });
    case 'ts':
    case 'tsx':
      return javascript({ jsx: true, typescript: true });
    case 'json':
      return json();
    case 'md':
      return markdown();
    default:
      return [];
  }
}

function getFileTypeLabel(filename: string): string {
  const ext = getExtension(filename);
  const typeMap: Record<string, string> = {
    fig: 'Figma 设计文件',
    png: 'PNG 图片',
    jpg: 'JPEG 图片',
    jpeg: 'JPEG 图片',
    svg: 'SVG 矢量图',
    pdf: 'PDF 文档',
    zip: 'ZIP 压缩包',
    doc: 'Word 文档',
    docx: 'Word 文档',
    xls: 'Excel 表格',
    xlsx: 'Excel 表格',
  };
  return typeMap[ext] || `${ext.toUpperCase()} 文件`;
}

export default function FilePreview({ file, onClose, onSave }: Props) {
  const [content, setContent] = useState('');
  const [isEdited, setIsEdited] = useState(false);

  useEffect(() => {
    if (file) {
      setContent(file.content || '');
      setIsEdited(false);
    }
  }, [file]);

  const canEdit = useMemo(() => {
    return file ? isEditable(file.name) : false;
  }, [file]);

  const handleChange = (value: string) => {
    setContent(value);
    setIsEdited(true);
  };

  const handleSave = () => {
    onSave(content);
    setIsEdited(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      if (canEdit && isEdited) {
        handleSave();
      }
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canEdit, isEdited, content]);

  if (!file) return null;

  const ext = getExtension(file.name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-[800px] max-h-[80vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="h-12 px-4 flex items-center justify-between border-b border-neutral-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6" />
            </svg>
            <span className="font-medium text-neutral-900">{file.name}</span>
            {isEdited && (
              <span className="text-xs text-amber-500 ml-1">未保存</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <svg className="w-4 h-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {canEdit ? (
            <CodeMirror
              value={content}
              height="100%"
              minHeight="400px"
              maxHeight="60vh"
              extensions={[getLanguageExtension(file.name)]}
              onChange={handleChange}
              theme="light"
              basicSetup={{
                lineNumbers: true,
                highlightActiveLineGutter: true,
                highlightSpecialChars: true,
                foldGutter: true,
                drawSelection: true,
                dropCursor: true,
                allowMultipleSelections: true,
                indentOnInput: true,
                bracketMatching: true,
                closeBrackets: true,
                autocompletion: true,
                rectangularSelection: true,
                crosshairCursor: true,
                highlightActiveLine: true,
                highlightSelectionMatches: true,
                closeBracketsKeymap: true,
                defaultKeymap: true,
                searchKeymap: true,
                historyKeymap: true,
                foldKeymap: true,
                completionKeymap: true,
                lintKeymap: true,
              }}
            />
          ) : (
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-50 flex items-center justify-center">
                <svg className="w-8 h-8 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <path d="M14 2v6h6" />
                </svg>
              </div>
              <p className="text-sm text-neutral-600 font-medium mb-1">{getFileTypeLabel(file.name)}</p>
              <p className="text-xs text-neutral-400">
                {file.size ? `${(file.size / 1024).toFixed(1)} KB` : '大小未知'}
              </p>
              <p className="text-xs text-neutral-300 mt-4">此文件类型暂不支持在线预览</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {canEdit && (
          <div className="h-14 px-4 flex items-center justify-end gap-2 border-t border-neutral-100 flex-shrink-0">
            <button
              onClick={onClose}
              className="h-9 px-4 text-sm text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={!isEdited}
              className={`h-9 px-4 text-sm font-medium rounded-lg transition-colors ${
                isEdited
                  ? 'bg-neutral-900 text-white hover:bg-neutral-800'
                  : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
              }`}
            >
              保存 (⌘S)
            </button>
          </div>
        )}

        {!canEdit && (
          <div className="h-14 px-4 flex items-center justify-end border-t border-neutral-100 flex-shrink-0">
            <button
              onClick={onClose}
              className="h-9 px-4 text-sm text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              关闭
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
