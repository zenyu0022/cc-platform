'use client';

import { useData } from '@/providers/DataContext';
import { Attachment } from '@/types';

export function usePosts() {
  const { posts, createPost, deletePost, createReply } = useData();

  const addPost = async (title: string, content: string, attachments?: Attachment[], tags?: string[]) => {
    return createPost({ title, content, attachments, tags });
  };

  const addReply = async (postId: string, content: string) => {
    return createReply(postId, content);
  };

  const removePost = async (postId: string) => {
    return deletePost(postId);
  };

  return {
    posts,
    createPost: addPost,
    deletePost: removePost,
    createReply: addReply,
  };
}
