'use client';

import { useData } from '@/providers/DataContext';

export function useProjects() {
  const { projects, currentProject, isLoading, selectProject, createProject } = useData();

  return {
    projects,
    currentProject,
    isLoading,
    selectProject,
    createProject,
  };
}
