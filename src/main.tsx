import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// 移除启动Loading遮罩
function removeSplashScreen() {
  const splash = document.getElementById("splash-screen");
  if (splash) {
    splash.classList.add("fade-out");
    // 等待淡出动画完成后移除元素
    setTimeout(() => {
      splash.remove();
    }, 300);
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// React渲染完成后移除splash screen
// 使用requestAnimationFrame确保DOM已更新
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    removeSplashScreen();
  });
});
