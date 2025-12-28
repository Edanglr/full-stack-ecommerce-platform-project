import React, { useState, useCallback, useEffect } from "react";
import { useChatSocket } from "../../hooks/useChatSocket";

function CustomerChat({ user }) {
  const isReady = !!user;
  const chatId = isReady ? `chat-${user._id || user.id}` : null;

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  /* ✅ 1. DEĞİŞİKLİK: LocalStorage'dan Durum Okuma 
     Sayfa yenilendiğinde pencere daha önce açıksa yine açık başlar.
  */
  const [open, setOpen] = useState(() => {
    const savedState = localStorage.getItem("chatWindowOpen");
    return savedState === "true"; 
  });

  /* ✅ 2. DEĞİŞİKLİK: Durumu LocalStorage'a Yazma
     Kullanıcı pencereyi açıp kapattığında tarayıcı bunu hatırlar.
  */
  useEffect(() => {
    localStorage.setItem("chatWindowOpen", open);
  }, [open]);

  /* ✅ SAYFA AÇILINCA / REFRESH → ESKİ MESAJLARI ÇEK */
  useEffect(() => {
    if (!chatId) return;

    const fetchMessages = async () => {
      try {
        const res = await fetch(`http://localhost:5050/api/chats/${chatId}`);
        const data = await res.json();
        setMessages(data.messages || []);
      } catch (err) {
        console.error("Customer fetchMessages error:", err);
      }
    };

    fetchMessages();
  }, [chatId]);

  /* ✅ SOCKET’TEN GELEN YENİ MESAJLAR */
  const handleNewMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const { sendMessage } = useChatSocket({
    chatId,
    onMessage: handleNewMessage,
  });

  const handleSend = () => {
    if (!text.trim() || !isReady) return;

    sendMessage({
      chatId,
      senderId: user._id || user.id,
      senderRole: "customer",
      senderName: user.name || "Customer",
      text,
    });

    setText("");
  };
  
  const handleEndChat = async () => {
    if (!window.confirm("Sohbeti sonlandırmak istiyor musunuz?")) return;

    try {
      // ⚠️ DİKKAT: Method'u DELETE yerine PUT yapıyoruz.
      // Backend'de bu ID'li sohbetin 'status'unu 'closed' yapan bir endpoint olmalı.
      const response = await fetch(`http://localhost:5050/api/chats/${chatId}/close`, {
        method: "PUT", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" })
      });

      if (response.ok) {
        setMessages([]); // Müşterinin ekranını temizle
        setOpen(false);  // Pencereyi kapat
        localStorage.removeItem("chatWindowOpen"); // LocalStorage temizle
        console.log("Sohbet sonlandırıldı (Arşivlendi).");
      } 
    } catch (err) {
      console.error("Hata:", err);
    }
  };

  return (
    <>
      {open && (
        <div style={styles.chatWindow}>
          <div style={styles.header}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span>Live Support</span>
            </div>
            
            <div style={{ display: "flex", gap: "10px" }}>
               {/* End Chat Butonu */}
              <button 
                onClick={handleEndChat} 
                style={styles.endChatBtn}
                title="End Chat"
              >
                End
              </button>

              {/* Minimize (Küçültme) Butonu */}
              <button onClick={() => setOpen(false)} style={styles.closeBtn}>
                ✕
              </button>
            </div>
          </div>

          <div style={styles.messages}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  ...styles.message,
                  alignSelf:
                    m.senderRole === "customer" ? "flex-end" : "flex-start",
                    backgroundColor: m.senderRole === "customer" ? "#dcf8c6" : "#f1f1f1" // Müşteri mesajı rengi farklı olsun
                }}
              >
                <b style={{ fontSize: 11 }}>{m.senderName || "Support"}</b>
                <div>{m.text}</div>
              </div>
            ))}
          </div>

          <div style={styles.inputRow}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={isReady ? "Type a message..." : "Please login to chat"}
              style={styles.input}
              disabled={!isReady}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
            <button onClick={handleSend} disabled={!isReady} style={styles.sendBtn}>
              Send
            </button>
          </div>
        </div>
      )}

      {/* 💬 CHAT BALONU */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={styles.floatingButton}
          title="Live Support"
        >
          💬
        </button>
      )}
    </>
  );
}

export default CustomerChat;

/* 🎨 STYLES */
const styles = {
  floatingButton: {
    position: "fixed",
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: "50%",
    background: "#000",
    color: "#fff",
    fontSize: 26,
    border: "none",
    cursor: "pointer",
    zIndex: 9999,
    boxShadow: "0 4px 10px rgba(0,0,0,0.3)"
  },
  chatWindow: {
    position: "fixed",
    bottom: 90, // Butonun hemen üstünde başlasın
    right: 20,
    width: 320,
    height: 420,
    background: "#fff",
    borderRadius: 12,
    boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
    display: "flex",
    flexDirection: "column",
    zIndex: 9999,
    overflow: "hidden"
  },
  header: {
    padding: "10px 15px",
    background: "#000",
    color: "#fff",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#fff",
    fontSize: 18,
    cursor: "pointer",
  },
  endChatBtn: {
    background: "#ff4d4d",
    border: "none",
    color: "#fff",
    fontSize: 12,
    padding: "4px 8px",
    borderRadius: "4px",
    cursor: "pointer",
    fontWeight: "bold"
  },
  messages: {
    flex: 1,
    padding: 10,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    backgroundColor: "#fff"
  },
  message: {
    padding: "8px 12px",
    borderRadius: 10,
    maxWidth: "80%",
    wordWrap: "break-word",
    fontSize: "14px"
  },
  inputRow: {
    display: "flex",
    gap: 6,
    padding: 10,
    borderTop: "1px solid #ddd",
    background: "#f9f9f9"
  },
  input: {
    flex: 1,
    padding: "8px",
    borderRadius: "20px",
    border: "1px solid #ccc",
    outline: "none"
  },
  sendBtn: {
    padding: "0 15px",
    borderRadius: "20px",
    border: "none",
    background: "#000",
    color: "#fff",
    cursor: "pointer"
  }
};