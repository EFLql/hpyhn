'use client'
import { useState } from 'react'

export default function LikeDislike({ 
  postId, 
  currentReaction,
  onSelect 
}) {
  const [isHovering, setIsHovering] = useState(false)

  return (
    <div className="flex items-center space-x-1">
      <button
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onClick={() => onSelect(postId, 'like')}
        className={`text-xl ${currentReaction === 'like' ? 'text-green-500' : 'text-gray-400 hover:text-green-500'}`}
        title="喜欢"
      >
        {currentReaction === 'like' || isHovering ? '👍' : '😊'}
      </button>
      
      <button
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onClick={() => onSelect(postId, 'dislike')}
        className={`text-xl ${currentReaction === 'dislike' ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}
        title="不喜欢"
      >
        {currentReaction === 'dislike' || isHovering ? '👎' : '😊'}
      </button>
    </div>
  )
}