import React from 'react';

const Skeleton = ({ className = '', width, height, variant = 'rectangular', count = 1 }) => {
  const baseStyle = "animate-pulse bg-gray-200 dark:bg-gray-700";
  const variants = {
    rectangular: "rounded-md",
    circular: "rounded-full",
    text: "rounded h-4",
  };

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`${baseStyle} ${variants[variant]} ${className}`}
          style={{ width, height }}
        />
      ))}
    </>
  );
};

export default Skeleton;