'use client';

import { useData } from '@/providers/DataContext';

export function useProjects() {
  const {
    projects,
    currentProject,
    isLoading,
    selectProject,
    createProject,
    createFolder,
    createFile,
    updateFileContent,
    deleteNode,
    renameNode,
    moveNode,
  } = useData();

  return {
    projects,
    currentProject,
    isLoading,
    selectProject,
    createProject,
    createFolder,
    createFile,
    updateFileContent,
    deleteNode,
    renameNode,
    moveNode,
  };
}
