// src/components/HeroVideo.js
import React from "react";

function HeroVideo() {
  return (
    <div
      className="hero-video-container"
      style={{
        marginTop: "80px",   
        height: "400px",    
        overflow: "hidden",  
      }}
    >
      <video
        className="hero-video"
        src="/project-video.mp4"
        autoPlay
        loop
        muted
        playsInline
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center 40%",
        }}
      />
    </div>
  );
}

export default HeroVideo;
