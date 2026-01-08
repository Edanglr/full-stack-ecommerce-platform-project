import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:5050";

export function useChatSocket({ chatId, onMessage, onAdminMessage }) {
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL, { withCredentials: true });

    if (chatId) {
      socketRef.current.emit("joinChat", { chatId });
    }

    if (onMessage) {
      // Use "newMessage" event name to match the server-side emitter
      socketRef.current.on("newMessage", (msg) => {
        onMessage(msg);
      });
    }

    if (onAdminMessage) {
      socketRef.current.on("adminNewMessage", (msg) => {
        onAdminMessage(msg);
      });
    }

    return () => {
      socketRef.current.disconnect();
    };
  }, [chatId, onMessage, onAdminMessage]);

  const sendMessage = (data) => {
    socketRef.current.emit("sendMessage", data);
  };

  return { sendMessage };
}
