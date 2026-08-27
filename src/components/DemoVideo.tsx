import { brand } from "@/config/brand";

export function DemoVideo() {
  return (
    <div className="demo">
      <div className="demo-bar">
        <span className="mock-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="mock-title">
          {brand.domain}
          {brand.appPath}
          <span className="mock-pill">recorded session</span>
        </span>
      </div>
      <video
        className="demo-video"
        poster="/demo/umbrachat-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={`${brand.products.chat} answering a prompt with Smart Privacy on`}
      >
        <source src="/demo/umbrachat.webm" type="video/webm" />
        <source src="/demo/umbrachat.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
