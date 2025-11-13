"use client";

import { useState, useCallback } from 'react';
import Image from 'next/image';

const ImageGallery = ({ images }) => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [mainImageInModal, setMainImageInModal] = useState(null);
  const [touchStartX, setTouchStartX] = useState(0);

  const openModal = (image) => {
    setSelectedImage(image);
    setMainImageInModal(image);
  };

  const closeModal = () => {
    setSelectedImage(null);
    setMainImageInModal(null);
  };

  const navigateImage = useCallback((direction) => {
    const currentIndex = images.indexOf(mainImageInModal);
    if (direction === 'next') {
      const nextIndex = (currentIndex + 1) % images.length;
      setMainImageInModal(images[nextIndex]);
    } else if (direction === 'prev') {
      const prevIndex = (currentIndex - 1 + images.length) % images.length;
      setMainImageInModal(images[prevIndex]);
    }
  }, [images, mainImageInModal]);

  // Handle touch start for swipe
  const handleTouchStart = useCallback((e) => {
    setTouchStartX(e.touches[0].clientX);
  }, []);

  // Handle touch end for swipe
  const handleTouchEnd = useCallback((e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const swipeDistance = touchEndX - touchStartX;
    const swipeThreshold = 50; // pixels to consider a swipe

    if (swipeDistance > swipeThreshold) {
      navigateImage('prev'); // Swiped right, go to previous image
    } else if (swipeDistance < -swipeThreshold) {
      navigateImage('next'); // Swiped left, go to next image
    }
    setTouchStartX(0); // Reset touch start position
  }, [touchStartX, navigateImage]);


  return (
    <div className="image-gallery w-full">
      {images.length > 0 && (
        <div className="cursor-pointer relative flex items-center justify-center bg-gray-100 rounded-lg shadow-md" onClick={() => openModal(images[0])}>
          <Image src={images[0].src} alt={images[0].alt} layout="responsive" width={700} height={475} objectFit="contain" className="rounded-lg" />
        </div>
      )}

      {selectedImage && (
        // Outer div for modal overlay, handles closing when clicking outside
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          {/* Inner div for modal content, prevents closing when clicking inside */}
          <div className="relative bg-white p-2 md:p-4 rounded-lg overflow-auto" style={{ maxWidth: '90vw', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
            {/* Main image container with touch handlers and new navigation buttons */}
            <div
              className="relative w-[90vw] h-[50vh] sm:w-[80vw] sm:h-[60vh] md:w-[80vw] md:h-[70vh] flex items-center justify-center mx-auto"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <Image src={mainImageInModal.src} alt={mainImageInModal.alt} layout="fill" objectFit="contain" />

              {/* Previous Button */}
              <button
                onClick={(e) => { e.stopPropagation(); navigateImage('prev'); }} // Stop propagation to prevent modal closing
                className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-3 rounded-full hover:bg-opacity-75 focus:outline-none z-10 text-xl"
              >
                &larr;
              </button>

              {/* Next Button */}
              <button
                onClick={(e) => { e.stopPropagation(); navigateImage('next'); }} // Stop propagation to prevent modal closing
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-3 rounded-full hover:bg-opacity-75 focus:outline-none z-10 text-xl"
              >
                &rarr;
              </button>
            </div>
            <div className="flex justify-center mt-2 md:mt-4 space-x-2">
              {images.map((image, index) => (
                <div key={index} className={`cursor-pointer ${image === mainImageInModal ? 'border-2 border-orange-500' : ''}`} onClick={(e) => { e.stopPropagation(); setMainImageInModal(image); }}>
                  <Image src={image.src} alt={image.alt} width={120} height={80} objectFit="cover" className="rounded-md" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageGallery;