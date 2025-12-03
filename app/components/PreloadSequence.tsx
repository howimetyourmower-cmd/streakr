"use client";
import { useState, useEffect } from "react";
import Image from "next/image";

type Props = {
  images: string[];
  duration?: number; // how long each image stays (ms)
  onFinished: () => void;
};

export default function PreloadSequence({
  images,
  duration = 500,
  onFinished,
}: Props) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (index >= images.length) {
      // finished all images → fade out → show real site
      setTimeout(() => onFinished(), 300);
      return;
    }

    const timer = setTimeout(() => {
      setIndex((i) => i + 1);
    }, duration);

    return () => clearTimeout(timer);
  }, [index, images.length, duration, onFinished]);

  if (index >= images.length) return null;

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-[9999]">
      <div
        key={index}
        className="w-full h-full flex items-center justify-center transition-opacity duration-300 opacity-100"
      >
        <Image
          src={images[index]}
          alt="Preload"
          width={1200}
          height={800}
          className="object-cover w-full h-full"
          priority
        />
      </div>
    </div>
  );
}
