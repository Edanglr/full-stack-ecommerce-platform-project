import React, { useEffect, useState } from "react";
import SupportChat from "./chat/SupportChat";
import { useChatSocket } from "../hooks/useChatSocket";

function AdminLiveChatPage({ user }) {
  const [activeChats, setActiveChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);

  /* 🔹 Sayfa açılınca admin chat listesi */
  useEffect(() => {
    const token = localStorage.getItem("token");

    const fetchChats = async () => {
      try {
        const res = await fetch("http://localhost:5050/api/chats/admin", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();

        setActiveChats(
          (data || []).map((c) => ({
            id: c.customerId,
            name: c.customerName || c.customerId,
            chatId: c.chatId,
            lastText: c.lastText,
          }))
        );
      } catch (err) {
        console.error("fetchChats error:", err);
      }
    };

    fetchChats();
  }, []);

  /* 🔹 Socket: yeni müşteri mesajı gelirse listeye ekle */
  useChatSocket({
    chatId: null,
    onAdminMessage: (msg) => {
      if (!msg.chatId || !msg.customerId) return;

      setActiveChats((prev) => {
        const exists = prev.find((c) => c.chatId === msg.chatId);
        if (exists) return prev;

        return [
          ...prev,
          {
            id: msg.customerId,
            name: msg.customerName || msg.customerId,
            chatId: msg.chatId,
            lastText: msg.text,
          },
        ];
      });
    },
  });

  return (
    <div style={styles.container}>
      {/* SOL PANEL – CUSTOMER LIST */}
      <div style={styles.leftPanel}>
        <h3>Customer Chats</h3>

        {activeChats.length === 0 && (
          <p style={{ fontSize: 14, color: "#777" }}>
            No active chats yet.
          </p>
        )}

        {activeChats.map((c) => (
          <div
            key={c.chatId}
            style={{
              ...styles.customerItem,
              background:
                selectedChat?.chatId === c.chatId ? "#eee" : "transparent",
            }}
            onClick={() => setSelectedChat(c)}
          >
            💬 {c.name}
            {c.lastText && (
              <div style={{ fontSize: 12, color: "#666" }}>
                {c.lastText}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* SAĞ PANEL – SADECE CHAT */}
      <div style={styles.rightPanel}>
        {selectedChat ? (
          <SupportChat
            supportUser={user}
            chatId={selectedChat.chatId}
            customerName={selectedChat.name}
          />
        ) : (
          <div style={{ padding: 20, color: "#666" }}>
            Select a customer to start chatting.
          </div>
        )}
      </div>
    </div>
  );
}

/* 🔹 STYLES (HATAYI ÇÖZEN KISIM) */
const styles = {
  container: {
    display: "flex",
    height: "calc(100vh - 80px)",
    marginTop: 80,
  },
  leftPanel: {
    width: 260,
    borderRight: "1px solid #ccc",
    padding: 10,
  },
  customerItem: {
    padding: "10px",
    cursor: "pointer",
    borderRadius: 6,
    marginBottom: 6,
  },
  rightPanel: {
    flex: 1,
    padding: 10,
  },
};

export default AdminLiveChatPage;
