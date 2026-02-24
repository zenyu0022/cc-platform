/**
 * useAuthors Hook - 从帖子和回复中动态提取发帖人列表
 */
import { useMemo } from 'react';

interface Author {
  id: string;
  name: string;
  type: 'human' | 'agent';
}

interface Post {
  author: Author;
  replies?: { author: Author }[];
}

interface TimelineEvent {
  author: Author;
}

interface Member {
  id: string;
  name: string;
  type: 'human' | 'agent';
}

/**
 * 从帖子、回复和静态成员中提取唯一的发帖人列表
 */
export function useAuthors(
  posts: Post[],
  timeline?: TimelineEvent[],
  staticMembers?: Member[]
): Author[] {
  return useMemo(() => {
    const authorMap = new Map<string, Author>();

    // 1. 从帖子中提取
    posts?.forEach(post => {
      if (post.author?.id) {
        authorMap.set(post.author.id, {
          id: post.author.id,
          name: post.author.name,
          type: post.author.type,
        });
      }

      // 2. 从回复中提取
      post.replies?.forEach(reply => {
        if (reply.author?.id) {
          authorMap.set(reply.author.id, {
            id: reply.author.id,
            name: reply.author.name,
            type: reply.author.type,
          });
        }
      });
    });

    // 3. 从 timeline 中提取（可选）
    timeline?.forEach(event => {
      if (event.author?.id) {
        authorMap.set(event.author.id, {
          id: event.author.id,
          name: event.author.name,
          type: event.author.type,
        });
      }
    });

    // 4. 合并静态成员
    staticMembers?.forEach(member => {
      if (!authorMap.has(member.id)) {
        authorMap.set(member.id, {
          id: member.id,
          name: member.name,
          type: member.type,
        });
      }
    });

    // 排序：人类优先，然后按名称排序
    return Array.from(authorMap.values()).sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'human' ? -1 : 1;
      }
      return a.name.localeCompare(b.name, 'zh-CN');
    });
  }, [posts, timeline, staticMembers]);
}

export default useAuthors;
