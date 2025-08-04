'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabase/client'

export default function HNComments({ postId }) {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchComments = async () => {
      const { data, error } = await supabase
        .from('hn_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })
        .limit(3)  // 只获取3条评论
      
      if (!error) setComments(data || [])
      setLoading(false)
    }

    fetchComments()
  }, [postId])

  if (loading) return <div>加载评论中...</div>
  if (comments.length === 0) return <div>暂无评论</div>

  return (
    <div className="space-y-4 mt-4">
      {comments.map(comment => (
        <div key={comment.id} className="border-l-2 pl-4 border-gray-200">
          <div className="text-xs text-gray-500">
            {comment.user_id} · {new Date(comment.created_at).toLocaleString()}
          </div>
          <div 
            className="prose prose-sm mt-1" 
            dangerouslySetInnerHTML={{ __html: comment.text }}
          />
        </div>
      ))}
    </div>
  )
}