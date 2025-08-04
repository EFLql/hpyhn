'use client'
import { useState, useRef, useEffect } from 'react'

const reactions = [
  { emoji: '😍', type: 'like', label: 'like', color: 'text-blue-500' },
  { emoji: '🥱', type: 'dislike', label: 'dislike', color: 'text-red-500' }
]

// Facebook风格的点赞SVG图标 (轮廓形式)
const LikeIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
  </svg>
)

export default function FacebookReaction({ postId, currentReaction, onSelect }) {
  const [isHovered, setIsHovered] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedReaction, setSelectedReaction] = useState(null)
  const [hoveredReaction, setHoveredReaction] = useState(null)
  const timeoutRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsHovered(true)
    setIsOpen(true)
  }

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsHovered(false)
      setIsOpen(false)
      setHoveredReaction(null)
    }, 150)
  }

  const handleReactionSelect = (reactionType) => {
    onSelect(postId, reactionType); // reactionType可以是null来取消选择
    setSelectedReaction(reactionType);
    setIsOpen(false);
  }

  const handleToggleOpen = () => {
    setIsOpen(!isOpen)
  }

  // 获取当前选中的表情
  const getCurrentReaction = () => {
    if (currentReaction) {
      return reactions.find(r => r.type === currentReaction)
    }
    return null
  }

  const currentReactionObj = getCurrentReaction()

  return (
    <div 
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex items-center">
        {currentReactionObj ? (
          <button
            onClick={() => handleReactionSelect(null)} // 直接取消选择
            className="flex items-center text-sm font-medium rounded-full px-3 py-1 hover:bg-gray-200 transition-colors"
          >
            <span className="mr-1 text-lg transform transition-transform hover:scale-110">
              {currentReactionObj.emoji}
            </span>
            <span className={currentReactionObj.color}>
              {currentReactionObj.label}
            </span>
          </button>
        ) : (
          <button
            onClick={handleToggleOpen}
            className="flex items-center text-sm text-gray-500 font-medium rounded-full px-3 py-1 hover:bg-gray-200 transition-colors"
          >
            <span className="mr-1 transform transition-transform hover:scale-110">
              <LikeIcon className="w-5 h-5" />
            </span>
            <span>like it?</span>
          </button>
        )}
      </div>

      {/* Reactions popup with enhanced animations */}
      {isOpen && (
        <div 
          className={`absolute bottom-full mb-2 flex bg-white rounded-full shadow-lg p-1 transition-all duration-300 ${
            isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}
          style={{ right: 0 }}
        >
          {reactions.map((reaction, index) => (
            <div 
              key={reaction.type} 
              className="relative"
              onMouseEnter={() => setHoveredReaction(reaction.type)}
              onMouseLeave={() => setHoveredReaction(null)}
            >
              <button
                onClick={() => handleReactionSelect(reaction.type)}
                className={`w-9 h-9 flex items-center justify-center rounded-full text-xl transition-all duration-200 transform hover:scale-125 ${
                  currentReaction === reaction.type 
                    ? 'bg-gray-100 scale-110' 
                    : 'hover:bg-gray-50'
                }`}
                style={{
                  transitionDelay: isHovered ? `${index * 50}ms` : '0ms', // 移除了+1的偏移
                  transform: isHovered 
                    ? 'translateX(0) scale(1)' 
                    : `translateX(${(reactions.length - index - 1) * 20}px) scale(0.8)`,
                  zIndex: reactions.length - index
                }}
              >
                <span className="transform transition-transform hover:scale-125">
                  {reaction.emoji}
                </span>
              </button>
              {/* Tooltip */}
              <div 
                className={`absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-black bg-opacity-75 rounded transition-opacity duration-200 ${
                  hoveredReaction === reaction.type ? 'opacity-100' : 'opacity-0'
                }`}
                style={{ 
                  transitionDelay: hoveredReaction === reaction.type ? '100ms' : '0ms',
                  pointerEvents: 'none'
                }}
              >
                {reaction.label}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-black border-t-opacity-75"></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
