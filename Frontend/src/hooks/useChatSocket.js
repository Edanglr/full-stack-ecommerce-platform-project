// frontend/src/hooks/useChatSocket.js
import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:5050";

export function useChatSocket({ chatId, onMessage, onAdminMessage }) {
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"], 
    });

    socketRef.current = socket;

    socket.on("connect_error", (err) => {
      console.error("Socket connect_error:", err?.message || err);
    });

    if (chatId) {
      socket.emit("joinChat", { chatId });
    }

    // Listener'ları tanımla (cleanup için referans lazım)
    const handleNewMessage = (msg) => onMessage && onMessage(msg);
    const handleAdminNewMessage = (msg) => onAdminMessage && onAdminMessage(msg);

    if (onMessage) socket.on("newMessage", handleNewMessage);
    if (onAdminMessage) socket.on("adminNewMessage", handleAdminNewMessage);

    return () => {
      socket.off("newMessage", handleNewMessage);
      socket.off("adminNewMessage", handleAdminNewMessage);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [chatId, onMessage, onAdminMessage]);

  const sendMessage = (data) => {
    if (!socketRef.current) {
      console.warn("Socket not ready yet. Message not sent:", data);
      return;
    }
    socketRef.current.emit("sendMessage", data);
  };

  return { sendMessage };
}
